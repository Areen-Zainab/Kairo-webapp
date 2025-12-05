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
 * @returns {Promise<Object>} Object with transcriptLength, audioDurationSeconds, and audioDurationMinutes
 */
async function getMeetingStats(meetingId) {
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
      // Even if we have stats, verify the duration is accurate by checking the actual audio file
      let audioDurationSeconds = stats.duration_seconds || 0;
      
      // If duration is 0 or seems inaccurate, try to get from actual audio file
      if (audioDurationSeconds === 0) {
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
            break; // Use first valid duration found
          }
        }
      }
      
      return {
        transcriptLength: stats.total_words || 0,
        audioDurationSeconds,
        audioDurationMinutes: Math.round(audioDurationSeconds / 60)
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

  // NEW: Try to get duration from actual audio file (MOST ACCURATE)
  // This should be checked before fallback methods
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
          break; // Use first valid duration found
        }
      }
    } catch (error) {
      console.error('Error reading audio files for duration:', error);
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
  getMeetingStats
};

