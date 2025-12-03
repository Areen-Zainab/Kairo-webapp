const fs = require('fs');
const path = require('path');
const { findMeetingDirectory } = require('./meetingFileStorage');

/**
 * Get transcript and audio statistics for a meeting
 * Reads from transcript_stats.json if available, or calculates from transcript files
 */
function getMeetingStats(meetingId) {
  const meetingDir = findMeetingDirectory(meetingId);
  if (!meetingDir) {
    return {
      transcriptLength: 0,
      audioDurationSeconds: 0,
      audioDurationMinutes: 0
    };
  }

  // Try to read transcript_stats.json first (most accurate)
  const statsPath = path.join(meetingDir, 'transcript_stats.json');
  if (fs.existsSync(statsPath)) {
    try {
      const stats = JSON.parse(fs.readFileSync(statsPath, 'utf8'));
      return {
        transcriptLength: stats.total_words || 0,
        audioDurationSeconds: stats.duration_seconds || 0,
        audioDurationMinutes: Math.round((stats.duration_seconds || 0) / 60)
      };
    } catch (error) {
      console.error('Error reading transcript stats:', error);
    }
  }

  // Fallback: Try to calculate from transcript files
  let transcriptLength = 0;
  let audioDurationSeconds = 0;

  // Read complete transcript file if it exists
  const completeTranscriptPath = path.join(meetingDir, 'transcript_complete.txt');
  if (fs.existsSync(completeTranscriptPath)) {
    try {
      const transcriptContent = fs.readFileSync(completeTranscriptPath, 'utf8');
      // Count words (split by whitespace and filter empty strings)
      const words = transcriptContent.split(/\s+/).filter(w => w.trim().length > 0);
      transcriptLength = words.length;
    } catch (error) {
      console.error('Error reading transcript file:', error);
    }
  }

  // Try to get audio duration from diarized JSON if available
  const diarizedJsonPath = path.join(meetingDir, 'transcript_diarized.json');
  if (fs.existsSync(diarizedJsonPath)) {
    try {
      const diarizedData = JSON.parse(fs.readFileSync(diarizedJsonPath, 'utf8'));
      if (Array.isArray(diarizedData) && diarizedData.length > 0) {
        // Get the last utterance's end_time as total duration
        const lastUtterance = diarizedData[diarizedData.length - 1];
        if (lastUtterance && lastUtterance.end_time) {
          audioDurationSeconds = Math.round(lastUtterance.end_time);
        }
      }
    } catch (error) {
      console.error('Error reading diarized JSON:', error);
    }
  }

  // Fallback: Calculate from chunks (if no diarized data)
  if (audioDurationSeconds === 0) {
    const chunksDir = path.join(meetingDir, 'chunks');
    if (fs.existsSync(chunksDir)) {
      try {
        const chunkFiles = fs.readdirSync(chunksDir).filter(f => f.endsWith('.webm') || f.endsWith('.mp3'));
        // Each chunk is approximately 3 seconds
        audioDurationSeconds = chunkFiles.length * 3;
      } catch (error) {
        console.error('Error reading chunks directory:', error);
      }
    }
  }

  return {
    transcriptLength,
    audioDurationSeconds,
    audioDurationMinutes: Math.round(audioDurationSeconds / 60)
  };
}

module.exports = {
  getMeetingStats
};

