const https = require('https');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const STOP_WORDS = new Set([
  'what', 'when', 'where', 'which', 'about', 'from', 'that', 'this', 'with', 'have', 'were', 'will', 'would', 'could', 'should',
  'there', 'their', 'they', 'them', 'been', 'being', 'into', 'your', 'does', 'did', 'just', 'tell', 'please', 'discuss', 'discussion'
]);

function normalizeWhitespace(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function cleanDiarizedText(rawText) {
  const withoutLabels = String(rawText || '')
    .replace(/\[(?:UNKNOWN|SPEAKER_[0-9]+)\]\s*\([^)]*\):\s*/gi, '')
    .replace(/\[[^\]]+\]\s*:\s*/g, '');

  return normalizeWhitespace(withoutLabels);
}

function extractKeywords(question) {
  return normalizeWhitespace(question)
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length >= 4 && !STOP_WORDS.has(w));
}

function bestRelevantSentence(text, question) {
  const cleaned = cleanDiarizedText(text);
  if (!cleaned) return '';

  const sentences = cleaned
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (sentences.length === 0) return cleaned.slice(0, 240);

  const keywords = extractKeywords(question);
  if (keywords.length === 0) {
    return sentences[0].slice(0, 240);
  }

  let best = sentences[0];
  let bestScore = -1;

  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();
    const score = keywords.reduce((acc, kw) => acc + (lower.includes(kw) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      best = sentence;
    }
  }

  return best.slice(0, 260);
}

function ensureConversationalClosing(answer) {
  const trimmed = normalizeWhitespace(answer);
  if (!trimmed) {
    return 'I could not find enough context to answer that clearly right now. Do you want to ask anything else?';
  }

  const withoutClosing = trimmed.replace(/\s*do you want to ask anything else\??\s*$/i, '').trim();
  return `${withoutClosing}\n\nDo you want to ask anything else?`;
}

function buildSystemPrompt() {
  return [
    'You are Kairo, a professional in-meeting assistant.',
    'Lead with facts, not yourself. Avoid filler phrases like "I recall", "I found", "I don\'t have", "It seems that", or "I can try".',
    'Instead of "I recall that in Meeting X...", say "In Meeting X, the team discussed...".',
    'Use ONLY the provided context from meeting memory and live transcript.',
    'Never output raw diarization labels like [UNKNOWN], [SPEAKER_00], or timestamp ranges.',
    'Always cite the meeting title when referencing previous meetings.',
    'Be direct and concise. Prefer short 1-2 paragraphs. No filler, no hedging, no repetition.',
    'Do not repeat information already stated in the same response.',
    'If context is genuinely insufficient, say so directly and concisely.',
    'Do not fabricate decisions, dates, owners, or action items.',
    'You are ONLY a meeting assistant. You answer questions about meetings, discussions, decisions, and action items from the provided meeting context. If a question is unrelated to the context or meetings (e.g. coding, general knowledge, math, recipes), respond with exactly: "I am only a meeting assistant. Unfortunately, I can only help with questions about your meetings. Do you want to ask anything else?"',
  ].join(' ');
}

function buildUserPrompt({ question, semanticResults, liveTranscriptEntries, chatHistory }) {
  const history = Array.isArray(chatHistory)
    ? chatHistory.slice(-8).map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${String(m.text || '')}`).join('\n')
    : '';

  const semanticContext = (semanticResults || [])
    .slice(0, 8)
    .map((r, idx) => {
      const meeting = r.meeting_title || r.meetingTitle || 'Untitled meeting';
      const type = r.content_type || r.contentType || 'memory';
      const text = bestRelevantSentence(String(r.content || r.snippet || ''), question);
      return `[Memory ${idx + 1}] Meeting: ${meeting} | Type: ${type}\n${text}`;
    })
    .join('\n\n');

  const liveContext = (liveTranscriptEntries || [])
    .slice(-25)
    .map((e) => `${e.speaker || 'Speaker'}: ${cleanDiarizedText(e.text || '')}`)
    .join('\n');

  return [
    'User question:',
    question,
    '',
    history ? 'Recent chat history:\n' + history + '\n' : 'Recent chat history: (none)\n',
    'Relevant memory from previous meetings:',
    semanticContext || '(none found)',
    '',
    'Live/ongoing meeting transcript context:',
    liveContext || '(none found)',
    '',
    'Write the final answer as a professional, conversational and to-the-point assistant.'
  ].join('\n');
}

async function callGroqChatCompletion({ apiKey, model, systemPrompt, userPrompt, maxTokens, temperature, timeoutMs }) {
  const url = new URL('https://api.groq.com/openai/v1/chat/completions');
  const payload = JSON.stringify({
    model,
    temperature,
    max_tokens: maxTokens,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
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
            resolve(String(content || '').trim());
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

class MeetingMemoryChatService {
  constructor() {
    this.lastCallAtMs = 0;
    this.apiKeyIndex = 0;
  }

  buildFallbackAnswer(question, semanticResults, liveTranscriptEntries) {
    const hasSemantic = Array.isArray(semanticResults) && semanticResults.length > 0;
    const hasLive = Array.isArray(liveTranscriptEntries) && liveTranscriptEntries.length > 0;

    if (!hasSemantic && !hasLive) {
      return ensureConversationalClosing(
        `I could not find enough meeting context to answer that yet. If you want, share a little more detail about "${question}" and I will try again.`
      );
    }

    const parts = [];

    if (hasLive) {
      const lastLive = liveTranscriptEntries
        .slice(-5)
        .map((e) => cleanDiarizedText(e.text || ''))
        .filter(Boolean)
        .join(' ')
        .slice(0, 280);

      if (lastLive.trim()) {
        parts.push(`From the ongoing meeting, the latest discussion sounds like this: ${lastLive}`);
      }
    }

    if (hasSemantic) {
      const top = semanticResults[0] || {};
      const meetingName = top.meeting_title || top.meetingTitle || 'a previous meeting';
      const memoryText = bestRelevantSentence(String(top.content || top.snippet || ''), question);

      if (memoryText) {
        parts.push(`In "${meetingName}", they discussed: ${memoryText}`);
      }
    }

    if (parts.length === 0) {
      parts.push(`I found some context but not enough to answer "${question}" confidently.`);
    }

    return ensureConversationalClosing(parts.join('\n\n'));
  }

  async generateAnswer({ question, semanticResults, liveTranscriptEntries, chatHistory }) {
    const apiKeys = [process.env.GROQ_API_KEY, process.env.GROQ_API_KEY_2].filter(Boolean);
    const model = process.env.MEMORY_CHAT_GROQ_MODEL || process.env.WHISPER_MODE_GROQ_MODEL || 'llama-3.1-8b-instant';
    const maxTokens = parseInt(process.env.MEMORY_CHAT_GROQ_MAX_TOKENS || '480', 10);
    const temperature = parseFloat(process.env.MEMORY_CHAT_GROQ_TEMPERATURE || '0.5');
    const timeoutMs = parseInt(process.env.MEMORY_CHAT_GROQ_TIMEOUT_MS || '45000', 10);
    const minIntervalMs = parseInt(process.env.MEMORY_CHAT_GROQ_MIN_INTERVAL_MS || '1500', 10);
    const retries = parseInt(process.env.MEMORY_CHAT_GROQ_MAX_RETRIES || '2', 10);

    if (apiKeys.length === 0) {
      return {
        answer: this.buildFallbackAnswer(question, semanticResults, liveTranscriptEntries),
        model: 'fallback-no-groq',
        usedFallback: true
      };
    }

    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt({ question, semanticResults, liveTranscriptEntries, chatHistory });

    let lastErr = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
      const elapsed = Date.now() - this.lastCallAtMs;
      if (elapsed < minIntervalMs) {
        await sleep(minIntervalMs - elapsed);
      }

      const apiKey = apiKeys[this.apiKeyIndex % apiKeys.length];
      try {
        this.lastCallAtMs = Date.now();
        const answer = await callGroqChatCompletion({
          apiKey,
          model,
          systemPrompt,
          userPrompt,
          maxTokens,
          temperature,
          timeoutMs
        });

        if (!answer) {
          throw new Error('Empty response from Groq');
        }

        return { answer: ensureConversationalClosing(answer), model, usedFallback: false };
      } catch (err) {
        lastErr = err;
        const statusCode = err?.statusCode;
        if (statusCode === 429 || statusCode === 401) {
          this.apiKeyIndex = (this.apiKeyIndex + 1) % apiKeys.length;
        }
        if (attempt < retries) {
          await sleep(700 * Math.pow(2, attempt));
        }
      }
    }

    return {
      answer: ensureConversationalClosing(this.buildFallbackAnswer(question, semanticResults, liveTranscriptEntries)),
      model: 'fallback-groq-failed',
      usedFallback: true,
      error: lastErr?.message || 'Unknown Groq error'
    };
  }
}

module.exports = new MeetingMemoryChatService();
