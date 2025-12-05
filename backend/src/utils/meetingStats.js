const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const ffmpeg = require('@ffmpeg-installer/ffmpeg');
const { promisify } = require('util');
const { findMeetingDirectory } = require('./meetingFileStorage');

const execAsync = promisify(exec);

/**
 * Get actual duration of audio file using ffprobe
 * @param {string} audioPath - Path to the audio file
 * @returns {Promise<number|null>} Duration in seconds, or null if unable to determine
 */
async function getAudioFileDuration(audioPath) {
  if (!fs.existsSync(audioPath)) {
    return null;
  }

  try {
    const ffmpegPath = ffmpeg.path;
    
    // Try JSON output first (most reliable)
    const jsonCommand = `"${ffmpegPath}" -v error -show_entries format=duration -of json "${audioPath}"`;
    const { stdout } = await execAsync(jsonCommand, { maxBuffer: 1024 * 1024 });
    
    const json = JSON.parse(stdout);
    if (json.format && json.format.duration) {
      return parseFloat(json.format.duration);
    }
    
    // Fallback: default format
    const defaultCommand = `"${ffmpegPath}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioPath}"`;
    const { stdout: defaultStdout } = await execAsync(defaultCommand, { maxBuffer: 1024 * 1024 });
    const duration = parseFloat(defaultStdout.trim());
    
    if (!isNaN(duration) && duration > 0) {
      return duration;
    }
  } catch (error) {
    console.error('Error getting audio file duration:', error.message);
  }
  
  return null;
}

/**
 * Get transcript and audio statistics for a meeting
 * Reads from transcript_stats.json if available, or calculates from transcript files
 * @param {string|number} meetingId - The meeting ID
 * @param {string} [recordingUrl] - Optional recording URL/path from database
 * @returns {Promise<Object>} Object with transcriptLength, audioDurationSeconds, and audioDurationMinutes
 */
async function getMeetingStats(meetingId, recordingUrl = null) {
  let audioDurationSeconds = 0;
  
  // PRIORITY 1: Use recordingUrl from database if available (most accurate path)
  if (recordingUrl) {
    try {
      // recordingUrl is stored as absolute path, normalize it
      const audioPath = path.resolve(recordingUrl);
      if (fs.existsSync(audioPath)) {
        const duration = await getAudioFileDuration(audioPath);
        if (duration && duration > 0) {
          audioDurationSeconds = Math.round(duration);
          console.log(`[getMeetingStats] Using duration from recordingUrl: ${audioDurationSeconds}s`);
        }
      }
    } catch (error) {
      console.error('Error getting duration from recordingUrl:', error);
    }
  }
  
  const meetingDir = findMeetingDirectory(meetingId);
  if (!meetingDir) {
    // If we got duration from recordingUrl, still return it even if meetingDir not found
    if (audioDurationSeconds > 0) {
      return {
        transcriptLength: 0,
        audioDurationSeconds,
        audioDurationMinutes: Math.round(audioDurationSeconds / 60)
      };
    }
    return {
      transcriptLength: 0,
      audioDurationSeconds: 0,
      audioDurationMinutes: 0
    };
  }

  // PRIORITY 2: If we don't have duration from recordingUrl, try to get from actual audio file in meeting directory
  if (audioDurationSeconds === 0) {
    try {
      const files = fs.readdirSync(meetingDir);
      const completeAudioFiles = files.filter(f => 
        f.includes('_complete.mp3') || f.includes('_complete.webm')
      );
      
      // Try MP3 first, then WebM
      for (const filename of completeAudioFiles) {
        const audioPath = path.join(meetingDir, filename);
        const duration = await getAudioFileDuration(audioPath);
        if (duration && duration > 0) {
          audioDurationSeconds = Math.round(duration);
          console.log(`[getMeetingStats] Using duration from audio file: ${audioDurationSeconds}s`);
          break; // Use first valid duration found
        }
      }
    } catch (error) {
      console.error('Error reading audio files for duration:', error);
    }
  }

  // Try to read transcript_stats.json for transcript length and other stats
  const statsPath = path.join(meetingDir, 'transcript_stats.json');
  let transcriptLength = 0;
  if (fs.existsSync(statsPath)) {
    try {
      const stats = JSON.parse(fs.readFileSync(statsPath, 'utf8'));
      transcriptLength = stats.total_words || 0;
      
      // Only use stats duration if we don't have a better source
      // (we already got duration from recordingUrl or audio file above)
      if (audioDurationSeconds === 0 && stats.duration_seconds) {
        audioDurationSeconds = Math.round(stats.duration_seconds);
        console.log(`[getMeetingStats] Using duration from transcript_stats.json: ${audioDurationSeconds}s`);
      }
    } catch (error) {
      console.error('Error reading transcript stats:', error);
    }
  }

  // Fallback: Try to calculate transcript length from transcript files if not already set
  if (transcriptLength === 0) {
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
  }

  // PRIORITY 3: Try to get audio duration from diarized JSON if still not found
  if (audioDurationSeconds === 0) {
    const diarizedJsonPath = path.join(meetingDir, 'transcript_diarized.json');
    if (fs.existsSync(diarizedJsonPath)) {
      try {
        const diarizedData = JSON.parse(fs.readFileSync(diarizedJsonPath, 'utf8'));
        if (Array.isArray(diarizedData) && diarizedData.length > 0) {
          // Get the last utterance's end_time as total duration
          const lastUtterance = diarizedData[diarizedData.length - 1];
          if (lastUtterance && lastUtterance.end_time) {
            audioDurationSeconds = Math.round(lastUtterance.end_time);
            console.log(`[getMeetingStats] Using duration from diarized JSON: ${audioDurationSeconds}s`);
          }
        }
      } catch (error) {
        console.error('Error reading diarized JSON:', error);
      }
    }
  }

  // Fallback: Calculate from chunks (if no audio file found)
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
  getMeetingStats,
  getAudioFileDuration
};

