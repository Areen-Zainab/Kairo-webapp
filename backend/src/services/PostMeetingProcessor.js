const ActionItemService = require('./ActionItemService');
const Meeting = require('../models/Meeting');
const path = require('path');
const { getAudioFileDuration } = require('../utils/meetingStats');

// Base directory for all meeting data (same as MeetingBot uses)
const MEETING_DATA_BASE_DIR = path.resolve(__dirname, '../../data/meetings');

class PostMeetingProcessor {
  /**
   * Process pending action items after meeting ends.
   */
  static async processPendingActionItems(meetingId) {
    try {
      const pendingItems = await ActionItemService.getPendingForMeeting(meetingId);

      if (pendingItems.length === 0) {
        return { pendingCount: 0, requiresConfirmation: false };
      }

      return {
        pendingCount: pendingItems.length,
        requiresConfirmation: true,
        items: pendingItems.map((item) => ActionItemService._toDTO(item))
      };
    } catch (error) {
      console.error('Error processing pending action items:', error);
      return { pendingCount: 0, requiresConfirmation: false, error: error.message };
    }
  }

  /**
   * Update meeting recording URL with the complete audio file path.
   * @param {number} meetingId - Meeting ID
   * @param {string} absoluteRecordingPath - Absolute path to the recording file (MP3 or WebM)
   * @returns {Promise<boolean>} - Success status
   */
  static async updateRecordingUrl(meetingId, absoluteRecordingPath) {
    try {
      if (!absoluteRecordingPath) {
        console.log(`[PostMeetingProcessor] No recording path provided for meeting ${meetingId}`);
        return false;
      }

      // Store the complete absolute system path
      // Normalize path separators for consistency (use forward slashes)
      const normalizedPath = path.resolve(absoluteRecordingPath).replace(/\\/g, '/');

      console.log(`[PostMeetingProcessor] Updating recording URL for meeting ${meetingId}`);
      console.log(`   Complete system path: ${normalizedPath}`);

      await Meeting.update(meetingId, {
        recordingUrl: normalizedPath
      });

      console.log(`✅ [PostMeetingProcessor] Successfully updated recording URL for meeting ${meetingId}`);
      return true;
    } catch (error) {
      console.error(`❌ [PostMeetingProcessor] Error updating recording URL for meeting ${meetingId}:`, error);
      console.error(`   Error stack:`, error.stack);
      return false;
    }
  }

  /**
   * Update meeting duration with actual audio file duration.
   * @param {number} meetingId - Meeting ID
   * @param {string} audioFilePath - Absolute path to the audio file (MP3 or WebM)
   * @returns {Promise<boolean>} - Success status
   */
  static async updateMeetingDuration(meetingId, audioFilePath) {
    try {
      if (!audioFilePath) {
        console.log(`[PostMeetingProcessor] No audio file path provided for meeting ${meetingId}`);
        return false;
      }

      // Get actual audio duration from the file
      const durationSeconds = await getAudioFileDuration(audioFilePath);

      if (!durationSeconds || durationSeconds <= 0) {
        console.log(`[PostMeetingProcessor] Could not determine audio duration for meeting ${meetingId}`);
        return false;
      }

      // Convert to minutes and round to nearest minute
      const durationMinutes = Math.round(durationSeconds / 60);

      console.log(`[PostMeetingProcessor] Updating duration for meeting ${meetingId}`);
      console.log(`   Audio file: ${audioFilePath}`);
      console.log(`   Audio duration: ${durationSeconds.toFixed(2)} seconds (${durationMinutes} minutes)`);

      await Meeting.update(meetingId, {
        duration: durationMinutes
      });

      console.log(`✅ [PostMeetingProcessor] Successfully updated duration for meeting ${meetingId}`);
      return true;
    } catch (error) {
      console.error(`❌ [PostMeetingProcessor] Error updating duration for meeting ${meetingId}:`, error);
      console.error(`   Error stack:`, error.stack);
      return false;
    }
  }

  /**
   * Placeholder for future conversion to tasks.
   */
  static async convertToTasks(meetingId) {
    console.log(`[Future] Converting confirmed action items to tasks for meeting ${meetingId}`);
    return { converted: 0 };
  }
}

module.exports = PostMeetingProcessor;
