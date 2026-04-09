const fs = require('fs');
const path = require('path');
const prisma = require('../lib/prisma');
const TranscriptionService = require('./TranscriptionService');
const { findMeetingDirectory, findCompleteAudioFile } = require('../utils/meetingFileStorage');

/**
 * Best-effort, non-blocking diarization generator intended for "missing diarized transcript" cases.
 *
 * Design goals:
 * - Never block HTTP responses (caller should fire-and-forget)
 * - Avoid duplicate concurrent runs (DB metadata lock)
 * - Only generate diarized transcript artifacts (json/txt/srt/stats + chunk-like transcript files)
 * - Do NOT regenerate embeddings/AI insights (those are handled by explicit reprocess)
 */
class DiarizationOnDemandService {
  /**
   * Generate diarized outputs for a meeting if missing.
   * Safe to call repeatedly (idempotent).
   *
   * @param {number} meetingId
   * @returns {Promise<{started:boolean, skipped?:string}>}
   */
  static async ensureDiarizedTranscript(meetingId) {
    const meetingIdNum = typeof meetingId === 'string' ? parseInt(meetingId, 10) : meetingId;
    if (!Number.isInteger(meetingIdNum)) return { started: false, skipped: 'invalid_meeting_id' };

    const meetingDir = findMeetingDirectory(meetingIdNum);
    if (!meetingDir) return { started: false, skipped: 'missing_meeting_dir' };

    const diarizedJsonPath = path.join(meetingDir, 'transcript_diarized.json');
    if (fs.existsSync(diarizedJsonPath) && fs.statSync(diarizedJsonPath).size > 0) {
      return { started: false, skipped: 'already_present' };
    }

    // Acquire metadata lock in DB to avoid concurrent runs.
    // We keep the logic simple: if status is 'running' and lastStart < 15 minutes ago, skip.
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingIdNum },
      select: { id: true, status: true, metadata: true, startTime: true }
    });
    if (!meeting) return { started: false, skipped: 'meeting_not_found' };
    if (meeting.status !== 'completed') return { started: false, skipped: 'meeting_not_completed' };

    const md = meeting.metadata || {};
    const diarizationStatus = md.diarizationStatus;
    const diarizationStartedAt = md.diarizationStartedAt ? new Date(md.diarizationStartedAt) : null;
    const recentlyStarted =
      diarizationStatus === 'running' &&
      diarizationStartedAt &&
      (Date.now() - diarizationStartedAt.getTime()) < 15 * 60 * 1000;

    if (recentlyStarted) {
      return { started: false, skipped: 'already_running' };
    }

    await prisma.meeting.update({
      where: { id: meetingIdNum },
      data: {
        updatedAt: new Date(),
        metadata: {
          ...md,
          diarizationStatus: 'running',
          diarizationStartedAt: new Date().toISOString(),
          diarizationError: null
        }
      }
    });

    // Run in background but within this async flow (caller should not await).
    setImmediate(async () => {
      const transcription = new TranscriptionService(meetingDir, null, meetingIdNum);
      try {
        const completeAudioPath = findCompleteAudioFile(meetingIdNum);
        const meetingStartMs = meeting?.startTime ? new Date(meeting.startTime).getTime() : Date.now();

        if (!completeAudioPath || !fs.existsSync(completeAudioPath)) {
          throw new Error('Complete audio not found for diarization');
        }

        const diarized = await transcription.runDiarizationPython(completeAudioPath);
        const segments = diarized?.segments || [];
        if (!Array.isArray(segments) || segments.length === 0) {
          throw new Error('Diarization returned no segments');
        }

        // Rebuild transcript artifacts from diarized segments (same strategy as MeetingReprocessService).
        transcription.utterances = [];
        transcription.chunkCount = 0;
        transcription.firstTimestamp = null;

        const transcriptsDir = path.join(meetingDir, 'transcripts');
        if (!fs.existsSync(transcriptsDir)) fs.mkdirSync(transcriptsDir, { recursive: true });

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

          const chunkNum = transcription.chunkCount++;
          const chunkFilename = `chunk_${chunkNum}_transcript.txt`;
          fs.writeFileSync(path.join(transcriptsDir, chunkFilename), `${timestampIso}\n${text}\n`);

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
        }

        await transcription.saveDiarizedOutputs();
        const stats = transcription.generateStatistics();
        fs.writeFileSync(path.join(meetingDir, 'transcript_stats.json'), JSON.stringify(stats, null, 2));

        // Mark completed
        const latest = await prisma.meeting.findUnique({
          where: { id: meetingIdNum },
          select: { metadata: true }
        });
        await prisma.meeting.update({
          where: { id: meetingIdNum },
          data: {
            updatedAt: new Date(),
            metadata: {
              ...(latest?.metadata || {}),
              diarizationStatus: 'completed',
              diarizationCompletedAt: new Date().toISOString(),
              diarizationError: null
            }
          }
        });
      } catch (err) {
        try {
          const latest = await prisma.meeting.findUnique({
            where: { id: meetingIdNum },
            select: { metadata: true }
          });
          await prisma.meeting.update({
            where: { id: meetingIdNum },
            data: {
              updatedAt: new Date(),
              metadata: {
                ...(latest?.metadata || {}),
                diarizationStatus: 'failed',
                diarizationCompletedAt: new Date().toISOString(),
                diarizationError: err?.message || String(err)
              }
            }
          });
        } catch (_) {
          // best-effort; ignore
        }
      } finally {
        try {
          transcription.cleanup();
        } catch (_) {
          // ignore
        }
      }
    });

    return { started: true };
  }
}

module.exports = DiarizationOnDemandService;

