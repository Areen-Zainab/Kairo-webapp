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

module.exports = {
  findMeetingDirectory,
  ensureUploadsDirectory,
  saveMeetingFile,
  getFullFilePath,
  deleteMeetingFile,
  getFileBuffer,
  detectFileType,
  findCompleteAudioFile,
  getLiveTranscriptEntries
};

