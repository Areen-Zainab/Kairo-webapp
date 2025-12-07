const fs = require('fs');
const path = require('path');

// Base directory for all meeting data (same as MeetingBot uses)
const MEETING_DATA_BASE_DIR = path.resolve(__dirname, '../../src/services/meeting_data');

/**
 * Get the meeting directory path for a given meeting ID
 * The directory structure is: {meetingId}_{meetingName}_{timestamp}
 * We need to find the directory that starts with {meetingId}_
 */
function findMeetingDirectory(meetingId) {
  if (!fs.existsSync(MEETING_DATA_BASE_DIR)) {
    return null;
  }

  const entries = fs.readdirSync(MEETING_DATA_BASE_DIR, { withFileTypes: true });
  const meetingDir = entries.find(entry => {
    if (!entry.isDirectory()) return false;
    return entry.name.startsWith(`${meetingId}_`);
  });

  if (!meetingDir) {
    return null;
  }

  return path.join(MEETING_DATA_BASE_DIR, meetingDir.name);
}

/**
 * Ensure uploads directory exists for a meeting
 * Creates: {meetingDataDir}/uploads/
 */
function ensureUploadsDirectory(meetingId) {
  const meetingDir = findMeetingDirectory(meetingId);
  if (!meetingDir) {
    // Create a new directory if meeting data doesn't exist yet
    const meetingDirName = `${meetingId}_meeting_${Date.now()}`;
    const newMeetingDir = path.join(MEETING_DATA_BASE_DIR, meetingDirName);
    fs.mkdirSync(newMeetingDir, { recursive: true });
    
    const uploadsDir = path.join(newMeetingDir, 'uploads');
    fs.mkdirSync(uploadsDir, { recursive: true });
    return { meetingDir: newMeetingDir, uploadsDir, relativePath: `${meetingDirName}/uploads` };
  }

  const uploadsDir = path.join(meetingDir, 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // Return relative path from MEETING_DATA_BASE_DIR
  const relativePath = path.relative(MEETING_DATA_BASE_DIR, uploadsDir);
  return { meetingDir, uploadsDir, relativePath };
}

/**
 * Save uploaded file to meeting's uploads directory
 * @param {number} meetingId - Meeting ID
 * @param {Buffer} fileBuffer - File buffer
 * @param {string} originalFilename - Original filename
 * @returns {Promise<{filepath: string, fullPath: string, filename: string}>}
 */
async function saveMeetingFile(meetingId, fileBuffer, originalFilename) {
  const { uploadsDir, relativePath } = ensureUploadsDirectory(meetingId);

  // Sanitize filename and ensure uniqueness
  const timestamp = Date.now();
  const sanitized = originalFilename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const ext = path.extname(sanitized);
  const basename = path.basename(sanitized, ext);
  const filename = `${basename}_${timestamp}${ext}`;
  
  const fullPath = path.join(uploadsDir, filename);
  fs.writeFileSync(fullPath, fileBuffer);

  // Return relative path (from MEETING_DATA_BASE_DIR) for database storage
  const filepath = path.join(relativePath, filename).replace(/\\/g, '/'); // Use forward slashes

  return { filepath, fullPath, filename };
}

/**
 * Get full file path from relative path stored in database
 */
function getFullFilePath(relativePath) {
  return path.join(MEETING_DATA_BASE_DIR, relativePath);
}

/**
 * Delete a file from meeting uploads
 */
function deleteMeetingFile(relativePath) {
  const fullPath = getFullFilePath(relativePath);
  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
    return true;
  }
  return false;
}

/**
 * Get file buffer for download
 */
function getFileBuffer(relativePath) {
  const fullPath = getFullFilePath(relativePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error('File not found');
  }
  return fs.readFileSync(fullPath);
}

/**
 * Detect file type from mime type or extension
 */
function detectFileType(mimeType, filename) {
  if (!mimeType && filename) {
    const ext = path.extname(filename).toLowerCase();
    if (['.pdf'].includes(ext)) return 'pdf';
    if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].includes(ext)) return 'image';
    if (['.doc', '.docx', '.txt', '.rtf'].includes(ext)) return 'document';
    if (['.ppt', '.pptx', '.key'].includes(ext)) return 'presentation';
    return 'other';
  }

  if (mimeType) {
    if (mimeType === 'application/pdf') return 'pdf';
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.includes('document') || mimeType.includes('word') || mimeType.includes('text')) return 'document';
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'presentation';
  }

  return 'other';
}

/**
 * Find complete audio file (MP3 or WebM) for a meeting
 * @param {number} meetingId - Meeting ID
 * @returns {string|null} Full path to audio file, or null if not found
 */
function findCompleteAudioFile(meetingId) {
  console.log(`[findCompleteAudioFile] Looking for audio file for meeting ${meetingId}`);
  const meetingDir = findMeetingDirectory(meetingId);
  console.log(`[findCompleteAudioFile] Meeting directory:`, meetingDir);
  
  if (!meetingDir) {
    console.log(`[findCompleteAudioFile] No meeting directory found for meeting ${meetingId}`);
    return null;
  }

  try {
    const files = fs.readdirSync(meetingDir);
    console.log(`[findCompleteAudioFile] Files in directory:`, files);
    
    // Look for complete audio files (prefer MP3, then WebM)
    const mp3File = files.find(f => f.includes('_complete.mp3'));
    console.log(`[findCompleteAudioFile] MP3 file found:`, mp3File);
    
    if (mp3File) {
      const fullPath = path.join(meetingDir, mp3File);
      console.log(`[findCompleteAudioFile] Returning MP3 path:`, fullPath);
      return fullPath;
    }
    
    const webmFile = files.find(f => f.includes('_complete.webm'));
    console.log(`[findCompleteAudioFile] WebM file found:`, webmFile);
    
    if (webmFile) {
      const fullPath = path.join(meetingDir, webmFile);
      console.log(`[findCompleteAudioFile] Returning WebM path:`, fullPath);
      return fullPath;
    }

    console.log(`[findCompleteAudioFile] No complete audio file found for meeting ${meetingId}`);
    return null;
  } catch (error) {
    console.error(`[findCompleteAudioFile] Error finding audio file for meeting ${meetingId}:`, error);
    return null;
  }
}

/**
 * Get live transcript entries for a meeting
 * @param {number} meetingId - Meeting ID
 * @param {string|null} since - ISO timestamp to filter entries (optional)
 * @returns {Array} Array of transcript entries
 */
function getLiveTranscriptEntries(meetingId, since = null) {
  const meetingDir = findMeetingDirectory(meetingId);
  if (!meetingDir) {
    return [];
  }

  const transcriptsDir = path.join(meetingDir, 'transcripts');
  if (!fs.existsSync(transcriptsDir)) {
    return [];
  }

  try {
    const files = fs.readdirSync(transcriptsDir);
    const chunkFiles = files
      .filter(f => f.startsWith('chunk_') && f.endsWith('_transcript.txt'))
      .map(f => {
        const match = f.match(/chunk_(\d+)_transcript\.txt/);
        return match ? { filename: f, chunkIndex: parseInt(match[1], 10) } : null;
      })
      .filter(Boolean)
      .sort((a, b) => a.chunkIndex - b.chunkIndex);

    const entries = [];
    const sinceDate = since ? new Date(since) : null;

    for (const { filename, chunkIndex } of chunkFiles) {
      const filePath = path.join(transcriptsDir, filename);
      try {
        const content = fs.readFileSync(filePath, 'utf8').trim();
        const lines = content.split('\n');
        if (lines.length < 2) continue;

        const timestamp = lines[0].trim();
        const text = lines.slice(1).join('\n').trim();
        
        if (!text) continue;

        const timestampDate = new Date(timestamp);
        
        // Filter by since timestamp if provided
        if (sinceDate && timestampDate <= sinceDate) {
          continue;
        }

        // Format timestamp for display (e.g., "10:02:45 AM") - includes seconds
        const displayTime = timestampDate.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });

        entries.push({
          id: `chunk_${chunkIndex}`,
          speaker: 'Speaker 1', // Default speaker, will be enhanced with diarization later
          text: text,
          timestamp: displayTime,
          chunkIndex: chunkIndex,
          rawTimestamp: timestamp
        });
      } catch (error) {
        console.error(`Error reading transcript file ${filename}:`, error.message);
      }
    }

    return entries;
  } catch (error) {
    console.error(`Error reading transcript directory for meeting ${meetingId}:`, error.message);
    return [];
  }
}

/**
 * Parse diarized transcript JSON file and return entries
 * @param {number} meetingId - Meeting ID
 * @returns {Array} Array of transcript entries with id, timestamp, speaker, text, confidence, startTime, endTime
 */
function getDiarizedTranscript(meetingId) {
  const meetingDir = findMeetingDirectory(meetingId);
  if (!meetingDir) {
    return [];
  }

  // Try JSON file first, fallback to TXT for backwards compatibility
  const diarizedJsonPath = path.join(meetingDir, 'transcript_diarized.json');
  const diarizedTxtPath = path.join(meetingDir, 'transcript_diarized.txt');
  
  // Prefer JSON file
  if (fs.existsSync(diarizedJsonPath)) {
    try {
      const content = fs.readFileSync(diarizedJsonPath, 'utf8');
      const data = JSON.parse(content);
      
      if (!data.utterances || !Array.isArray(data.utterances)) {
        console.error(`Invalid JSON structure in transcript_diarized.json for meeting ${meetingId}`);
        return [];
      }

      // Find the minimum start time to normalize timestamps (handle cases where first entry doesn't start at 0)
      let minStartTime = Infinity;
      data.utterances.forEach(utterance => {
        const startTime = utterance.diarized_start !== undefined 
          ? utterance.diarized_start 
          : (utterance.start_time !== undefined ? utterance.start_time : 0);
        if (startTime < minStartTime) {
          minStartTime = startTime;
        }
      });
      
      // If minStartTime is > 0, we need to normalize (subtract offset) so first entry starts at 0
      // This ensures transcript timestamps match audio file timeline starting from 0:00
      const timeOffset = minStartTime > 0 ? minStartTime : 0;

      const entries = data.utterances.map((utterance, index) => {
        // PRIORITY: Use diarized_start if available (actual audio time from diarization)
        // Otherwise fall back to start_time (chunk-based, less accurate)
        const actualStartTime = utterance.diarized_start !== undefined 
          ? utterance.diarized_start 
          : (utterance.start_time !== undefined ? utterance.start_time : 0);
        const actualEndTime = utterance.diarized_end !== undefined 
          ? utterance.diarized_end 
          : (utterance.end_time !== undefined ? utterance.end_time : actualStartTime + 3);
        
        // Normalize timestamps: subtract offset so first entry starts at 0
        // This ensures sync with audio/video playback which starts at 0:00
        const normalizedStartTime = actualStartTime - timeOffset;
        const normalizedEndTime = actualEndTime - timeOffset;

        return {
          id: `entry_${index}`,
          timestamp: normalizedStartTime, // Normalized to start from 0 for audio sync
          startTime: normalizedStartTime, // Use normalized time for consistency
          endTime: normalizedEndTime,
          speaker: utterance.speaker || 'UNKNOWN',
          text: utterance.text || '',
          confidence: 1.0, // Could be enhanced if confidence is available in JSON
          chunk: utterance.chunk,
          audioFile: utterance.audioFile,
          rawTimestamp: utterance.timestamp, // ISO timestamp string
          originalStartTime: actualStartTime, // Keep original for reference
          timeOffset: timeOffset // Store offset for debugging/reference
        };
      });

      // Sort by timestamp (relative to meeting start) to ensure chronological order
      entries.sort((a, b) => a.timestamp - b.timestamp);
      return entries;
    } catch (error) {
      console.error(`Error parsing diarized transcript JSON for meeting ${meetingId}:`, error.message);
      return [];
    }
  }
  
  // Fallback to TXT file for backwards compatibility
  if (fs.existsSync(diarizedTxtPath)) {
    try {
      const content = fs.readFileSync(diarizedTxtPath, 'utf8');
      const lines = content.split('\n');
      const entries = [];
      let currentSpeaker = null;
      let currentTimeRange = null;
      let currentText = '';
      let entryIndex = 0;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Skip empty lines
        if (!line) {
          // If we have accumulated text, save the previous entry
          if (currentSpeaker && currentText.trim()) {
            const [startTime, endTime] = currentTimeRange ? currentTimeRange.split(' - ') : ['0', '10'];
            const startSeconds = parseFloat(startTime.replace('s', ''));
            const endSeconds = parseFloat(endTime.replace('s', ''));
            
            entries.push({
              id: `entry_${entryIndex++}`,
              timestamp: startSeconds,
              startTime: startSeconds,
              endTime: endSeconds,
              speaker: currentSpeaker,
              text: currentText.trim(),
              confidence: 1.0
            });
            currentText = '';
          }
          continue;
        }

        // Check if this line is a speaker header (e.g., "SPEAKER_00 [15.0s - 18.0s]:" or "SPEAKER_00 [15.0s - 18.0s]: Text here")
        const speakerMatch = line.match(/^([A-Z_0-9]+)\s+\[([\d.]+)s\s+-\s+([\d.]+)s\]\s*:?\s*(.*)$/);
        if (speakerMatch) {
          // Save previous entry if exists
          if (currentSpeaker && currentText.trim()) {
            const [startTime, endTime] = currentTimeRange ? currentTimeRange.split(' - ') : ['0', '10'];
            const startSeconds = parseFloat(startTime.replace('s', ''));
            const endSeconds = parseFloat(endTime.replace('s', ''));
            
            entries.push({
              id: `entry_${entryIndex++}`,
              timestamp: startSeconds,
              startTime: startSeconds,
              endTime: endSeconds,
              speaker: currentSpeaker,
              text: currentText.trim(),
              confidence: 1.0
            });
          }
          
          // Start new entry
          currentSpeaker = speakerMatch[1];
          currentTimeRange = `${speakerMatch[2]}s - ${speakerMatch[3]}s`;
          // If there's text on the same line (after the colon), use it
          currentText = speakerMatch[4] ? speakerMatch[4].trim() : '';
        } else {
          // This is text content, append to current text
          if (currentText) {
            currentText += ' ' + line;
          } else {
            currentText = line;
          }
        }
      }

      // Save last entry if exists
      if (currentSpeaker && currentText.trim()) {
        const [startTime, endTime] = currentTimeRange ? currentTimeRange.split(' - ') : ['0', '10'];
        const startSeconds = parseFloat(startTime.replace('s', ''));
        const endSeconds = parseFloat(endTime.replace('s', ''));
        
        entries.push({
          id: `entry_${entryIndex++}`,
          timestamp: startSeconds,
          startTime: startSeconds,
          endTime: endSeconds,
          speaker: currentSpeaker,
          text: currentText.trim(),
          confidence: 1.0
        });
      }

      entries.sort((a, b) => a.timestamp - b.timestamp);
      return entries;
    } catch (error) {
      console.error(`Error parsing diarized transcript TXT for meeting ${meetingId}:`, error.message);
      return [];
    }
  }

  return [];
}

module.exports = {
  findMeetingDirectory,
  ensureUploadsDirectory,
  saveMeetingFile,
  getFullFilePath,
  deleteMeetingFile,
  getFileBuffer,
  detectFileType,
  findCompleteAudioFile,
  getLiveTranscriptEntries,
  getDiarizedTranscript
};

