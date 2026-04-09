const fs = require('fs');
const path = require('path');
const prisma = require('../lib/prisma');
const TranscriptionService = require('./TranscriptionService');
const AIInsightsService = require('./AIInsightsService');
const MeetingEmbeddingService = require('./MeetingEmbeddingService');
const { findMeetingDirectory, findCompleteAudioFile } = require('../utils/meetingFileStorage');
const SpeakerMatchingEngine = require('./SpeakerMatchingEngine');
const SpeakerIdentificationService = require('./SpeakerIdentificationService');

function safeUnlink(filePath) {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (e) {
    // Best-effort cleanup; don't fail whole reprocess for an unlink.
    console.warn(`[MeetingReprocessService] Failed to delete ${filePath}: ${e.message}`);
  }
}

function safeRmDirContents(dirPath) {
  try {
    if (!fs.existsSync(dirPath)) return;
    const entries = fs.readdirSync(dirPath);
    for (const name of entries) {
      const full = path.join(dirPath, name);
      try {
        const stat = fs.statSync(full);
        if (stat.isDirectory()) {
          fs.rmSync(full, { recursive: true, force: true });
        } else {
          fs.unlinkSync(full);
        }
      } catch (e) {
        console.warn(`[MeetingReprocessService] Failed to remove ${full}: ${e.message}`);
      }
    }
  } catch (e) {
    console.warn(`[MeetingReprocessService] Failed to read dir ${dirPath}: ${e.message}`);
  }
}

function parseChunkIndex(filename) {
  // Supports chunk_123... or chunk_123.ext patterns.
  const match = filename.match(/chunk_(\d+)/i);
  if (!match) return null;
  const n = parseInt(match[1], 10);
  return Number.isFinite(n) ? n : null;
}

class MeetingReprocessService {
  async _updateReprocessMetadata(meetingId, patch) {
    const current = await prisma.meeting.findUnique({
      where: { id: meetingId },
      select: { metadata: true }
    });
    const currentMetadata = current?.metadata || {};
    await prisma.meeting.update({
      where: { id: meetingId },
      data: {
        updatedAt: new Date(),
        metadata: {
          ...currentMetadata,
          ...patch
        }
      }
    });
  }

  /**
   * Full meeting reprocess:
   * - re-transcribe from stored chunk audio
   * - regenerate diarized outputs
   * - regenerate embeddings
   * - regenerate AI insights
   *
   * Designed to run async (background job).
   */
  async reprocessMeeting(meetingId, requestedByUserId) {
    const meetingIdNum = typeof meetingId === 'string' ? parseInt(meetingId, 10) : meetingId;
    if (!Number.isInteger(meetingIdNum)) {
      throw new Error(`Invalid meetingId: ${meetingId}`);
    }

    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingIdNum },
      select: { id: true, workspaceId: true, createdById: true, metadata: true, startTime: true }
    });
    if (!meeting) throw new Error('Meeting not found');

    const meetingDir = findMeetingDirectory(meetingIdNum);
    if (!meetingDir) throw new Error('Meeting data directory not found on disk');

    const chunksDir = path.join(meetingDir, 'chunks');
    if (!fs.existsSync(chunksDir)) throw new Error('No chunks directory found for meeting');

    const chunkFiles = fs
      .readdirSync(chunksDir)
      .filter((f) => f.endsWith('.webm') || f.endsWith('.mp3') || f.endsWith('.wav') || f.endsWith('.m4a') || f.endsWith('.ogg'))
      .map((f) => ({ name: f, idx: parseChunkIndex(f) }))
      .filter((x) => x.idx !== null)
      .sort((a, b) => a.idx - b.idx);

    await this._updateReprocessMetadata(meetingIdNum, {
      reprocessStatus: 'running',
      reprocessRequestedBy: requestedByUserId,
      reprocessStartedAt: new Date().toISOString(),
      reprocessProgress: 0,
      reprocessStep: 'cleanup',
      reprocessError: null
    });

    // Cleanup prior outputs to avoid mixing old and new transcripts.
    safeRmDirContents(path.join(meetingDir, 'transcripts'));
    safeUnlink(path.join(meetingDir, 'transcript_complete.txt'));
    safeUnlink(path.join(meetingDir, 'transcript_diarized.json'));
    safeUnlink(path.join(meetingDir, 'transcript_diarized.txt'));
    safeUnlink(path.join(meetingDir, 'transcript_diarized.srt'));
    safeUnlink(path.join(meetingDir, 'transcript_stats.json'));

    await this._updateReprocessMetadata(meetingIdNum, { reprocessStep: 'transcribing', reprocessProgress: 5 });

    const transcription = new TranscriptionService(meetingDir, null, meetingIdNum);
    try {
      const completeAudioPath = findCompleteAudioFile(meetingIdNum);
      const meetingStartMs = meeting?.startTime ? new Date(meeting.startTime).getTime() : Date.now();

      if (completeAudioPath && fs.existsSync(completeAudioPath)) {
        // ✅ Preferred path: retranscribe from complete audio.
        // We call the Python script in `--diarize` mode (already used by TranscriptionService),
        // then rebuild transcript artifacts from the returned segments.
        await this._updateReprocessMetadata(meetingIdNum, { reprocessStep: 'transcribing_complete_audio', reprocessProgress: 10 });

        const diarized = await transcription.runDiarizationPython(completeAudioPath);
        const segments = diarized?.segments || [];
        if (!Array.isArray(segments) || segments.length === 0) {
          throw new Error('Complete-audio transcription returned no segments');
        }

        // Write chunk-like transcript files and build utterances for downstream diarized outputs.
        transcription.utterances = [];
        transcription.chunkCount = 0;
        transcription.firstTimestamp = null;

        // Ensure transcripts dir exists (constructor creates it, but reprocess cleans it)
        const transcriptsDir = path.join(meetingDir, 'transcripts');
        if (!fs.existsSync(transcriptsDir)) fs.mkdirSync(transcriptsDir, { recursive: true });

        // Recreate complete transcript header
        const header = `Kairo Complete Transcript\nGenerated: ${new Date().toISOString()}\n${'='.repeat(80)}\n\n`;
        fs.writeFileSync(path.join(meetingDir, 'transcript_complete.txt'), header);

        for (let i = 0; i < segments.length; i++) {
          const seg = segments[i];
          const start = typeof seg.start === 'number' ? seg.start : 0;
          const end = typeof seg.end === 'number' ? seg.end : start;
          const text = (seg.text || '').toString().trim();
          if (!text) continue;

          const speaker = (seg.speaker || 'SPEAKER_00').toString();
          const timestampIso = new Date(meetingStartMs + Math.max(0, start) * 1000).toISOString();

          // Save a chunk transcript file (compatible with live transcript fallback tools)
          const chunkNum = transcription.chunkCount++;
          const chunkFilename = `chunk_${chunkNum}_transcript.txt`;
          fs.writeFileSync(path.join(transcriptsDir, chunkFilename), `${timestampIso}\n${text}\n`);

          // Append to complete transcript
          fs.appendFileSync(
            path.join(meetingDir, 'transcript_complete.txt'),
            `[Chunk ${chunkNum}] [${timestampIso}]\n${text}\n\n`
          );

          transcription.utterances.push({
            chunk: chunkNum,
            timestamp: timestampIso,
            audioFile: path.basename(completeAudioPath),
            text,
            speaker,
            start_time: start,
            end_time: end,
            diarized_start: start,
            diarized_end: end
          });

          if (i % 20 === 0 || i === segments.length - 1) {
            const pct = 10 + Math.round(((i + 1) / segments.length) * 60); // 10..70
            await this._updateReprocessMetadata(meetingIdNum, { reprocessProgress: Math.min(70, pct) });
          }
        }

        // Persist diarized outputs + stats (without re-running diarization again).
        await this._updateReprocessMetadata(meetingIdNum, { reprocessStep: 'finalize_outputs', reprocessProgress: 70 });
        await transcription.saveDiarizedOutputs();
        const stats = transcription.generateStatistics();
        fs.writeFileSync(path.join(meetingDir, 'transcript_stats.json'), JSON.stringify(stats, null, 2));
      } else {
        // Fallback: retranscribe from chunks if complete audio isn't present.
        if (chunkFiles.length === 0) {
          throw new Error('No complete audio file and no chunk audio files found to retranscribe');
        }

        await this._updateReprocessMetadata(meetingIdNum, { reprocessStep: 'transcribing_chunks', reprocessProgress: 10 });
        for (let i = 0; i < chunkFiles.length; i++) {
          const { name, idx } = chunkFiles[i];
          const chunkPath = path.join(chunksDir, name);
          await transcription.transcribe(chunkPath, idx);

          if (i % 5 === 0 || i === chunkFiles.length - 1) {
            const pct = 10 + Math.round(((i + 1) / chunkFiles.length) * 60); // 10..70
            await this._updateReprocessMetadata(meetingIdNum, {
              reprocessProgress: Math.min(70, pct),
              reprocessChunk: idx,
            });
          }
        }

        await this._updateReprocessMetadata(meetingIdNum, { reprocessStep: 'finalize', reprocessProgress: 70 });
        await transcription.finalize(completeAudioPath);
      }

      // ── Speaker identification (synchronous, BEFORE embeddings + insights) ───────
      // Running synchronously ensures that any resolved speaker names are cascaded
      // into transcript_diarized.json before AI insights reads the transcript.
      await this._updateReprocessMetadata(meetingIdNum, { reprocessStep: 'speaker_identification', reprocessProgress: 75 });
      try {
        const resolvedMappings = [];
        const broadcastFn = (_mid, mapping) => { resolvedMappings.push(mapping); };

        const idResult = await SpeakerMatchingEngine.runForMeeting(meetingIdNum, broadcastFn);

        // Cascade resolved names into transcript file so insights see real names.
        if (idResult?.results) {
          for (const [label, result] of Object.entries(idResult.results)) {
            if (result.resolved && result.userName && result.userId) {
              try {
                await SpeakerIdentificationService.cascadeNameUpdate(
                  meetingIdNum, label, result.userId, result.userName
                );
              } catch (e) {
                console.warn(`[MeetingReprocessService] Cascade failed for ${label}: ${e.message}`);
              }
            }
          }
        }

        // Broadcast to any open transcript panels.
        if (resolvedMappings.length > 0) {
          try {
            const { broadcastSpeakerIdentified } = require('./WebSocketServer');
            broadcastSpeakerIdentified(meetingIdNum, resolvedMappings.map(m => ({
              speakerLabel:    m.speakerLabel,
              userId:          m.userId,
              userName:        m.userName,
              confidenceScore: m.confidence,
              tierResolved:    m.tier,
            })));
          } catch (_) {}
        }
      } catch (e) {
        // Non-fatal: log and continue so insights still run even if speaker ID fails.
        console.warn(`[MeetingReprocessService] Speaker identification failed (non-fatal): ${e.message}`);
      }

      await this._updateReprocessMetadata(meetingIdNum, { reprocessStep: 'embeddings', reprocessProgress: 85 });
      await MeetingEmbeddingService.regenerateMeetingEmbeddings(meetingIdNum);

      await this._updateReprocessMetadata(meetingIdNum, { reprocessStep: 'insights', reprocessProgress: 92 });
      await AIInsightsService.generateInsights(meetingIdNum, true);

      await this._updateReprocessMetadata(meetingIdNum, {
        reprocessStatus: 'completed',
        reprocessStep: 'done',
        reprocessProgress: 100,
        reprocessCompletedAt: new Date().toISOString()
      });

      return { success: true, meetingId: meetingIdNum };
    } catch (err) {
      await this._updateReprocessMetadata(meetingIdNum, {
        reprocessStatus: 'failed',
        reprocessError: err.message || String(err),
        reprocessCompletedAt: new Date().toISOString()
      });
      throw err;
    } finally {
      try {
        transcription.cleanup();
      } catch (_) {
        // ignore
      }
    }
  }
}

module.exports = new MeetingReprocessService();

