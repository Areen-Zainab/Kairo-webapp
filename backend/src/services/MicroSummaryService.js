const https = require('https');
const crypto = require('crypto');

const prisma = require('../lib/prisma');
const { getLiveTranscriptEntries, findMeetingDirectory } = require('../utils/meetingFileStorage');

// Global in-process rate limiter (prevents multiple cron ticks from stampeding Groq).
let lastGroqCallAtMs = 0;
let groqApiKeyIndex = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sha256(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function normalizeRecapText(text) {
  // Keep it plain and compact; downstream UI (future) can format as needed.
  const cleaned = String(text || '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return '';

  // Prefer exactly 2-3 sentences. If the model returns more, truncate safely.
  const sentences = cleaned
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (sentences.length <= 3) return cleaned;
  return sentences.slice(0, 3).join(' ');
}

function buildMicroRecapPrompt(transcriptText) {
  // Keep instructions explicit to reduce hallucinated structure.
  return `Generate a concise micro-recap (exactly 2-3 sentences) of what was discussed most recently in this meeting.

Requirements:
- Focus on key topics and any decisions or action items mentioned.
- Be faithful to the transcript (do not invent details).
- Output ONLY the recap text (no bullet points, no headings).

Transcript (most recent content):
${transcriptText}`;
}

async function callGroqChatCompletion({ apiKey, model, prompt, maxTokens, temperature, timeoutMs }) {
  const url = new URL('https://api.groq.com/openai/v1/chat/completions');
  const payload = JSON.stringify({
    model,
    temperature,
    max_tokens: maxTokens,
    messages: [
      { role: 'system', content: 'You are Kairo Whisper Mode. You generate accurate micro-recaps.' },
      { role: 'user', content: prompt }
    ]
  });

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: url.hostname,
        path: url.pathname,
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        },
        timeout: timeoutMs
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
              const err = new Error(`Groq API error (status ${res.statusCode})`);
              err.statusCode = res.statusCode;
              err.body = parsed;
              return reject(err);
            }
            const content = parsed?.choices?.[0]?.message?.content;
            resolve(content);
          } catch (e) {
            reject(new Error(`Failed to parse Groq response: ${e.message}`));
          }
        });
      }
    );

    req.on('error', (err) => reject(err));
    req.write(payload);
    req.end();
  });
}

async function callGroqWithRetries({ model, prompt, maxTokens, temperature, timeoutMs, maxRetries, minIntervalMs }) {
  const apiKeys = [process.env.GROQ_API_KEY, process.env.GROQ_API_KEY_2].filter(Boolean);
  if (apiKeys.length === 0) {
    return { recapText: '', skipped: true, reason: 'Missing GROQ_API_KEY / GROQ_API_KEY_2' };
  }

  let lastErr = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Rate limit: ensure a minimum delay between any Groq calls from this process.
    const now = Date.now();
    const elapsed = now - lastGroqCallAtMs;
    if (elapsed < minIntervalMs) {
      await sleep(minIntervalMs - elapsed);
    }

    const apiKey = apiKeys[groqApiKeyIndex % apiKeys.length];
    try {
      lastGroqCallAtMs = Date.now();
      const recap = await callGroqChatCompletion({
        apiKey,
        model,
        prompt,
        maxTokens,
        temperature,
        timeoutMs
      });

      return { recapText: normalizeRecapText(recap), skipped: false };
    } catch (err) {
      lastErr = err;

      // Rotate keys on rate limit / throttling.
      const statusCode = err?.statusCode;
      if (statusCode === 429 || statusCode === 401) {
        groqApiKeyIndex = (groqApiKeyIndex + 1) % apiKeys.length;
      }

      // Backoff before retry.
      if (attempt < maxRetries) {
        const backoffMs = 1000 * Math.pow(2, attempt);
        await sleep(backoffMs);
      }
    }
  }

  return {
    recapText: '',
    skipped: true,
    reason: `Groq call failed: ${lastErr?.message || 'unknown error'}`
  };
}

class MicroSummaryService {
  /**
   * Generate (or skip) a WhisperMode micro-recap for a meeting.
   * This is intentionally write-minimal to avoid touching unrelated services.
   *
   * @param {number} meetingId
   * @param {object} meeting - Meeting row (id/status/endTime/metadata) to avoid extra DB reads.
   * @returns {Promise<{generated: boolean, skipped: boolean, reason?: string, recapText?: string}>}
   */
  async maybeGenerateMicroRecap(meetingId, meeting, isManual = false, options = {}) {
    const whisperEnabled = process.env.WHISPER_MODE_ENABLED === 'true';
    if (!whisperEnabled) {
      return { generated: false, skipped: true, reason: 'WHISPER_MODE_ENABLED=false' };
    }

    if (options?.excludeTranscript) {
      return { generated: false, skipped: true, reason: 'Transcript excluded for this recap request' };
    }

    const maxMeetingsStored = parseInt(process.env.WHISPER_MODE_MAX_STORED_RECAPS || '10', 10);
    const transcriptMaxChars = parseInt(process.env.WHISPER_MODE_TRANSCRIPT_MAX_CHARS || '3000', 10);

    const whisperMeta = meeting?.metadata?.whisperMode || {};

    // Active meeting guard: cron already filters, but this prevents ended meetings during status lag.
    const nowMs = Date.now();
    const endTimeMs = meeting?.endTime ? new Date(meeting.endTime).getTime() : 0;
    if (endTimeMs && endTimeMs < nowMs) {
      return { generated: false, skipped: true, reason: 'Meeting appears ended (endTime < now)' };
    }

    // Fetch all available transcript entries (no time window); TRANSCRIPT_MAX_CHARS caps input size.
    const entries = getLiveTranscriptEntries(meetingId, null);
    if (!entries || entries.length === 0) {
      return { generated: false, skipped: true, reason: 'No live transcript entries found' };
    }

    // Build transcript text from latest chunks.
    const transcriptTextRaw = entries.map((e) => e.text).filter(Boolean).join('\n').trim();
    if (transcriptTextRaw.length < 80) {
      return { generated: false, skipped: true, reason: 'Transcript too short for recap' };
    }

    const transcriptText =
      transcriptTextRaw.length > transcriptMaxChars
        ? transcriptTextRaw.slice(-transcriptMaxChars)
        : transcriptTextRaw;

    const transcriptHash = sha256(transcriptText);
    const lastHash = whisperMeta.lastRecapTranscriptHash || null;

    if (lastHash && lastHash === transcriptHash) {
      return { generated: false, skipped: true, reason: 'Transcript unchanged (hash match)' };
    }

    // Groq / rate limit guard.
    const model = process.env.WHISPER_MODE_GROQ_MODEL || 'llama-3.1-8b-instant';
    const maxTokens = parseInt(process.env.WHISPER_MODE_GROQ_MAX_TOKENS || '180', 10);
    const temperature = parseFloat(process.env.WHISPER_MODE_GROQ_TEMPERATURE || '0.4');
    const timeoutMs = parseInt(process.env.WHISPER_MODE_GROQ_TIMEOUT_MS || '60000', 10);
    const maxRetries = parseInt(process.env.WHISPER_MODE_GROQ_MAX_RETRIES || '2', 10);
    const groqMinIntervalMs = parseInt(process.env.WHISPER_MODE_GROQ_MIN_INTERVAL_MS || '12000', 10);

    const prompt = buildMicroRecapPrompt(transcriptText);
    const { recapText, skipped, reason } = await callGroqWithRetries({
      model,
      prompt,
      maxTokens,
      temperature,
      timeoutMs,
      maxRetries,
      minIntervalMs: groqMinIntervalMs
    });

    if (skipped || !recapText) {
      return { generated: false, skipped: true, reason: reason || 'Groq recap skipped' };
    }

    const recapAtIso = new Date().toISOString();

    // Persist into meeting.metadata (no schema migrations; keeps feature modular).
    const existingRecaps = Array.isArray(whisperMeta.microRecaps) ? whisperMeta.microRecaps : [];
    const newRecapEntry = {
      at: recapAtIso,
      recapText,
      transcriptHash
    };

    const nextRecaps = [newRecapEntry, ...existingRecaps].slice(0, maxMeetingsStored);

    const nextWhisperMeta = {
      ...whisperMeta,
      lastRecapAt: recapAtIso,
      lastRecapTranscriptHash: transcriptHash,
      microRecaps: nextRecaps
    };

    const nextMetadata = {
      ...(meeting?.metadata || {}),
      whisperMode: nextWhisperMeta
    };

    await prisma.meeting.update({
      where: { id: meetingId },
      data: { metadata: nextMetadata }
    });

    // Broadcast via WebSocket
    try {
      const WebSocketServer = require('./WebSocketServer');
      WebSocketServer.broadcastWhisperRecap(meetingId, newRecapEntry);
    } catch (wsErr) {
      console.warn(`⚠️ [WhisperMode] Failed to broadcast recap for meeting ${meetingId}:`, wsErr.message);
    }

    // Optional file persistence for debugging / future UI.
    try {
      const meetingDir = findMeetingDirectory(meetingId);
      if (meetingDir) {
        const filePath = require('path').join(meetingDir, 'whisper_recaps.json');
        const payload = {
          meetingId,
          updatedAt: recapAtIso,
          microRecaps: nextRecaps
        };
        require('fs').writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
      }
    } catch (e) {
      // Non-fatal: keep DB update as the source of truth.
      console.warn(`⚠️ [WhisperMode] Failed writing whisper_recaps.json for meeting ${meetingId}:`, e.message);
    }

    return { generated: true, skipped: false, recapText };
  }
}

module.exports = MicroSummaryService;

