// preloadModels.js - Preloads WhisperX models 3 minutes before scheduled meetings
const prisma = require('../lib/prisma');
const ModelPreloader = require('../services/ModelPreloader');

/**
 * Preload models for meetings starting in 3 minutes
 */
async function preloadModels() {
  // Check if global model is available first - skip per-meeting preloads if it is
  if (ModelPreloader.isGlobalModelAvailable()) {
    console.log(`✅ Global model available, skipping per-meeting preloads`);
    return {
      success: true,
      preloaded: 0,
      failed: 0,
      total: 0,
      skipped: 'global_model_available'
    };
  }

  const now = new Date();
  const threeMinutesFromNow = new Date(now.getTime() + 3 * 60 * 1000); // 3 minutes from now
  const fourMinutesFromNow = new Date(now.getTime() + 4 * 60 * 1000); // 4 minutes from now (window)

  try {
    // Find meetings starting in 3 minutes (within a 1-minute window)
    const meetingsToPreload = await prisma.meeting.findMany({
      where: {
        status: { in: ['scheduled', 'upcoming'] },
        startTime: {
          gte: threeMinutesFromNow,
          lte: fourMinutesFromNow
        },
        meetingLink: { not: null }
      }
    });

    console.log(`Found ${meetingsToPreload.length} meeting(s) to preload models for`);

    const preloadPromises = meetingsToPreload.map(async (meeting) => {
      try {
        // Check if already preloaded
        if (ModelPreloader.isPreloaded(meeting.id)) {
          console.log(`✅ Model already preloaded for meeting ${meeting.id}`);
          return { meetingId: meeting.id, success: true, skipped: true };
        }

        // Preload model
        await ModelPreloader.preloadModel(meeting.id);
        console.log(`✅ Model preloaded for meeting ${meeting.id} (${meeting.title})`);
        return { meetingId: meeting.id, success: true };
      } catch (error) {
        console.error(`❌ Failed to preload model for meeting ${meeting.id}:`, error.message);
        return { meetingId: meeting.id, success: false, error: error.message };
      }
    });

    const results = await Promise.allSettled(preloadPromises);
    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)).length;

    console.log(`✅ Model preload job completed: ${successful} successful, ${failed} failed`);

    return {
      success: true,
      preloaded: successful,
      failed: failed,
      total: meetingsToPreload.length
    };
  } catch (error) {
    console.error('❌ Error in model preload job:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = preloadModels;

