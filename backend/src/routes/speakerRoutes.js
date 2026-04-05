/**
 * speakerRoutes.js
 * 
 * Phase 1: Speaker Identification API Routes
 * 
 * Endpoints:
 *   POST   /api/speakers/consent/grant          - Grant biometric consent
 *   POST   /api/speakers/consent/revoke         - Revoke biometric consent + soft-delete embeddings
 *   GET    /api/speakers/consent/status         - Get own consent + enrollment status
 *
 *   GET    /api/speakers/meetings/:meetingId    - Get all speaker identity mappings for a meeting
 *   POST   /api/speakers/meetings/:meetingId/assign - Manually assign a speaker to a user (Tier 4)
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { authenticateToken } = require('../middleware/auth');
const SpeakerIdentificationService = require('../services/SpeakerIdentificationService');
const VoiceEmbeddingBridge = require('../services/VoiceEmbeddingBridge');
const prisma = require('../lib/prisma');

// Multer — accept audio uploads up to 50MB into memory
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const tmpDir = path.join(__dirname, '../../data/voice_samples_tmp');
      require('fs').mkdirSync(tmpDir, { recursive: true });
      cb(null, tmpDir);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || '.wav';
      cb(null, `user_${req.user?.id}_${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
});


// ============================================================
// CONSENT ROUTES
// ============================================================

/**
 * POST /api/speakers/consent/grant
 * Grant biometric consent for the authenticated user.
 * Must be called before any voice embedding is generated.
 */
router.post('/consent/grant', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await SpeakerIdentificationService.grantConsent(userId);
    return res.status(200).json({
      success: true,
      message: 'Biometric consent granted. Your voice profile can now be created.',
      user: result.user,
    });
  } catch (error) {
    console.error('[SpeakerRoutes] Grant consent error:', error.message);
    return res.status(500).json({ error: 'Failed to grant consent.' });
  }
});

/**
 * POST /api/speakers/consent/revoke
 * Revoke biometric consent and soft-delete all stored embeddings.
 * GDPR/BIPA compliance: clears all biometric data.
 */
router.post('/consent/revoke', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await SpeakerIdentificationService.revokeConsent(userId);
    return res.status(200).json({
      success: true,
      message: 'Biometric consent revoked. All voice data has been removed.',
      embeddingsDeactivated: result.embeddingsDeactivated,
    });
  } catch (error) {
    console.error('[SpeakerRoutes] Revoke consent error:', error.message);
    return res.status(500).json({ error: 'Failed to revoke consent.' });
  }
});

/**
 * GET /api/speakers/consent/status
 * Returns the authenticated user's current consent + enrollment status.
 * Used by the settings page to show enrollment state and re-enrollment prompts.
 */
router.get('/consent/status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const status = await SpeakerIdentificationService.getConsentStatus(userId);
    return res.status(200).json({ success: true, ...status });
  } catch (error) {
    console.error('[SpeakerRoutes] Get consent status error:', error.message);
    return res.status(500).json({ error: 'Failed to retrieve consent status.' });
  }
});

// ============================================================
// SPEAKER IDENTITY MAP ROUTES (per meeting)
// ============================================================

/**
 * GET /api/speakers/meetings/:meetingId
 * Returns all speaker → user identity mappings for a specific meeting.
 * Includes resolved names and confidence scores.
 * Used by the TranscriptTab to display identified speaker names.
 */
router.get('/meetings/:meetingId', authenticateToken, async (req, res) => {
  try {
    const meetingId = parseInt(req.params.meetingId);
    if (isNaN(meetingId)) {
      return res.status(400).json({ error: 'Invalid meeting ID.' });
    }

    // Verify user is a member of the workspace this meeting belongs to
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      select: { workspaceId: true },
    });

    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found.' });
    }

    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: meeting.workspaceId,
          userId: req.user.id,
        },
      },
    });

    if (!membership) {
      return res.status(403).json({ error: 'You do not have access to this meeting.' });
    }

    const mappings = await SpeakerIdentificationService.getIdentityMappings(meetingId);

    return res.status(200).json({
      success: true,
      meetingId,
      mappings,
      totalSpeakers: mappings.length,
      resolvedSpeakers: mappings.filter(m => m.isResolved).length,
    });
  } catch (error) {
    console.error('[SpeakerRoutes] Get identity mappings error:', error.message);
    return res.status(500).json({ error: 'Failed to retrieve speaker mappings.' });
  }
});

/**
 * POST /api/speakers/meetings/:meetingId/assign
 * Tier 4: Manually assign a speaker label to a user.
 * Called when a user clicks "Identify Speaker" in the transcript UI.
 * 
 * Body: { speakerLabel: "SPEAKER_00", userId: 42 }
 */
router.post('/meetings/:meetingId/assign', authenticateToken, async (req, res) => {
  try {
    const meetingId = parseInt(req.params.meetingId);
    const { speakerLabel, userId } = req.body;

    if (isNaN(meetingId)) {
      return res.status(400).json({ error: 'Invalid meeting ID.' });
    }
    if (!speakerLabel || typeof speakerLabel !== 'string') {
      return res.status(400).json({ error: 'speakerLabel is required.' });
    }
    if (!userId || isNaN(parseInt(userId))) {
      return res.status(400).json({ error: 'userId is required and must be a number.' });
    }

    // Verify user is a member of the workspace
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      select: { workspaceId: true },
    });

    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found.' });
    }

    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: meeting.workspaceId,
          userId: req.user.id,
        },
      },
    });

    if (!membership) {
      return res.status(403).json({ error: 'You do not have access to this meeting.' });
    }

    // Verify the target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: parseInt(userId) },
      select: { id: true, name: true },
    });

    if (!targetUser) {
      return res.status(404).json({ error: 'Target user not found.' });
    }

    await SpeakerIdentificationService.manuallyAssignSpeaker(
      meetingId,
      speakerLabel,
      parseInt(userId)
    );

    return res.status(200).json({
      success: true,
      message: `${speakerLabel} has been identified as ${targetUser.name}.`,
      speakerLabel,
      userId: targetUser.id,
      userName: targetUser.name,
    });
  } catch (error) {
    console.error('[SpeakerRoutes] Manual assign error:', error.message);
    return res.status(500).json({ error: 'Failed to assign speaker identity.' });
  }
});

/**
 * GET /api/speakers/workspace/:workspaceId/enrolled
 * Get all workspace users who have given consent and have voice embeddings.
 * Used by the matching engine and the "Which team member is this?" dropdown.
 */
router.get('/workspace/:workspaceId/enrolled', authenticateToken, async (req, res) => {
  try {
    const workspaceId = parseInt(req.params.workspaceId);
    if (isNaN(workspaceId)) {
      return res.status(400).json({ error: 'Invalid workspace ID.' });
    }

    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: req.user.id,
        },
      },
    });

    if (!membership) {
      return res.status(403).json({ error: 'You are not a member of this workspace.' });
    }

    const enrolled = await SpeakerIdentificationService.getEnrolledWorkspaceUsers(workspaceId);

    return res.status(200).json({
      success: true,
      workspaceId,
      enrolledUsers: enrolled,
      totalEnrolled: enrolled.length,
    });
  } catch (error) {
    console.error('[SpeakerRoutes] Get enrolled users error:', error.message);
    return res.status(500).json({ error: 'Failed to retrieve enrolled users.' });
  }
});


// ============================================================
// VOICE ENROLLMENT (Phase 2)
// ============================================================

/**
 * POST /api/speakers/enroll
 * Upload a voice sample audio file to create/update the user's voice fingerprint.
 * Requires biometric consent to be granted first.
 * 
 * Form data: audio file with field name "audio"
 * Returns: embedding ID, SNR score, version number
 */
router.post('/enroll', authenticateToken, upload.single('audio'), async (req, res) => {
  const fs = require('fs');
  let tmpFilePath = null;

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided. Use field name "audio".' });
    }

    tmpFilePath = req.file.path;
    const userId = req.user.id;

    // Check consent
    const hasConsent = await SpeakerIdentificationService.hasConsent(userId);
    if (!hasConsent) {
      fs.unlinkSync(tmpFilePath);
      return res.status(403).json({
        error: 'Biometric consent required before enrollment.',
        action: 'Call POST /api/speakers/consent/grant first.',
      });
    }

    // Enroll via VoiceEmbeddingBridge (validates SNR + generates + stores embedding)
    const result = await VoiceEmbeddingBridge.enrollUserVoice(userId, tmpFilePath, prisma);

    // Clean up temp file
    if (fs.existsSync(tmpFilePath)) fs.unlinkSync(tmpFilePath);

    if (!result.success) {
      return res.status(422).json({
        success: false,
        reason: result.reason,
        snr_db: result.snr_db,
        message: result.reason === 'snr_too_low'
          ? 'Audio quality is too low. Please re-record in a quieter environment.'
          : 'Enrollment failed. Please try again.',
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Voice fingerprint enrolled successfully.',
      embeddingId: result.embeddingId,
      version: result.version,
      snrDb: result.snrDb,
      dimensions: result.dimensions,
    });

  } catch (error) {
    if (tmpFilePath) {
      try { require('fs').unlinkSync(tmpFilePath); } catch (_) {}
    }
    console.error('[SpeakerRoutes] Enroll error:', error.message);
    return res.status(500).json({ error: 'Voice enrollment failed.' });
  }
});

/**
 * POST /api/speakers/validate-audio
 * Validate audio quality without storing an embedding.
 * Used by the frontend to check if a recording is clean before submitting.
 * 
 * Form data: audio file with field name "audio"
 */
router.post('/validate-audio', authenticateToken, upload.single('audio'), async (req, res) => {
  const fs = require('fs');
  let tmpFilePath = null;

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided. Use field name "audio".' });
    }

    tmpFilePath = req.file.path;
    const result = await VoiceEmbeddingBridge.validateAudio(tmpFilePath);

    if (fs.existsSync(tmpFilePath)) fs.unlinkSync(tmpFilePath);

    return res.status(200).json({ success: true, ...result });

  } catch (error) {
    if (tmpFilePath) {
      try { require('fs').unlinkSync(tmpFilePath); } catch (_) {}
    }
    console.error('[SpeakerRoutes] Validate audio error:', error.message);
    return res.status(500).json({ error: 'Audio validation failed.' });
  }
});

module.exports = router;

