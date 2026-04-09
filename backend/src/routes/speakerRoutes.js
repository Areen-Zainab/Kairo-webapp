const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const prisma = require('../lib/prisma');
const { authenticateToken } = require('../middleware/auth');
const SpeakerIdentificationService = require('../services/SpeakerIdentificationService');
const VoiceEmbeddingBridge = require('../services/VoiceEmbeddingBridge');
const { broadcastSpeakerIdentified } = require('../services/WebSocketServer');

// Configure multer for temp audio storage
const upload = multer({
  dest: 'data/voice_samples_tmp/',
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
});

// ============================================================
// CONSENT MANAGEMENT
// ============================================================

/**
 * GET /api/speakers/consent/status
 * Get the current user's biometric consent status and enrollment info.
 */
router.get('/consent/status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const status = await SpeakerIdentificationService.getConsentStatus(userId);
    return res.json({ success: true, ...status });
  } catch (error) {
    console.error('[SpeakerRoutes] Status error:', error.message);
    return res.status(500).json({ error: 'Failed to fetch consent status.' });
  }
});

/**
 * POST /api/speakers/consent/grant
 * Grant biometric consent for voice fingerprinting.
 */
router.post('/consent/grant', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await SpeakerIdentificationService.grantConsent(userId);
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('[SpeakerRoutes] Grant error:', error.message);
    return res.status(500).json({ error: 'Failed to grant consent.' });
  }
});

/**
 * POST /api/speakers/consent/revoke
 * Revoke biometric consent and DELETE all stored voice fingerprints.
 */
router.post('/consent/revoke', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await SpeakerIdentificationService.revokeConsent(userId);
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('[SpeakerRoutes] Revoke error:', error.message);
    return res.status(500).json({ error: 'Failed to revoke consent.' });
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
 * Body: audio file with field name "audio" (multipart) OR "audioData" (base64)
 */
router.post('/enroll', authenticateToken, upload.single('audio'), async (req, res) => {
  const fs = require('fs');
  const path = require('path');
  let tmpFilePath = null;

  try {
    if (req.file) {
      tmpFilePath = req.file.path;
    } else if (req.body.audioData) {
      // Handle base64 fallback from frontend - more robust stripping for all media types (mp4, wav, etc)
      const base64Data = req.body.audioData.includes(',') 
        ? req.body.audioData.split(',')[1] 
        : req.body.audioData;
      const buffer = Buffer.from(base64Data, 'base64');
      const tmpDir = path.join(__dirname, '../../data/voice_samples_tmp');
      require('fs').mkdirSync(tmpDir, { recursive: true });
      tmpFilePath = path.join(tmpDir, `user_${req.user.id}_${Date.now()}.wav`);
      fs.writeFileSync(tmpFilePath, buffer);
    }

    if (!tmpFilePath) {
      return res.status(400).json({ error: 'No audio file provided. Use field name "audio" or "audioData" (base64).' });
    }

    const userId = req.user.id;

    // Check consent
    const hasConsent = await SpeakerIdentificationService.hasConsent(userId);
    if (!hasConsent) {
      if (fs.existsSync(tmpFilePath)) fs.unlinkSync(tmpFilePath);
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
    if (tmpFilePath && fs.existsSync(tmpFilePath)) {
      try { fs.unlinkSync(tmpFilePath); } catch (_) {}
    }
    console.error('[SpeakerRoutes] Enroll error:', error.message);
    return res.status(500).json({ error: 'Voice enrollment failed: ' + error.message });
  }
});

/**
 * POST /api/speakers/validate-audio
 * Validate audio quality without storing an embedding.
 */
router.post('/validate-audio', authenticateToken, upload.single('audio'), async (req, res) => {
  const fs = require('fs');
  const path = require('path');
  let tmpFilePath = null;

  try {
    if (req.file) {
      tmpFilePath = req.file.path;
    } else if (req.body.audioData) {
      // Handle base64 fallback from frontend - more robust stripping for all media types
      const base64Data = req.body.audioData.includes(',') 
        ? req.body.audioData.split(',')[1] 
        : req.body.audioData;
      const buffer = Buffer.from(base64Data, 'base64');
      const tmpDir = path.join(__dirname, '../../data/voice_samples_tmp');
      require('fs').mkdirSync(tmpDir, { recursive: true });
      tmpFilePath = path.join(tmpDir, `validate_${req.user.id}_${Date.now()}.wav`);
      fs.writeFileSync(tmpFilePath, buffer);
    }

    if (!tmpFilePath) {
      return res.status(400).json({ error: 'No audio file provided. Use field name "audio" or "audioData" (base64).' });
    }

    const result = await VoiceEmbeddingBridge.validateAudio(tmpFilePath);

    if (fs.existsSync(tmpFilePath)) fs.unlinkSync(tmpFilePath);

    return res.status(200).json({ success: true, ...result });

  } catch (error) {
    if (tmpFilePath && fs.existsSync(tmpFilePath)) {
      try { fs.unlinkSync(tmpFilePath); } catch (_) {}
    }
    console.error('[SpeakerRoutes] Validate audio error:', error.message);
    return res.status(500).json({ error: 'Audio validation failed.' });
  }
});

// ============================================================
// WORKSPACE ENROLLED USERS
// ============================================================

/**
 * GET /api/speakers/workspace/:workspaceId/enrolled
 * Returns all workspace members who have given biometric consent and have
 * at least one active voice embedding — used by the frontend for the manual
 * speaker assignment picker and for displaying enrollment status.
 */
router.get('/workspace/:workspaceId/enrolled', authenticateToken, async (req, res) => {
  try {
    const workspaceId = parseInt(req.params.workspaceId, 10);
    if (isNaN(workspaceId)) {
      return res.status(400).json({ error: 'Invalid workspaceId.' });
    }

    const enrolled = await SpeakerIdentificationService.getEnrolledWorkspaceUsers(workspaceId);

    const users = enrolled.map(u => ({
      id: u.userId,
      name: u.name,
      lastEnrollment: u.lastEmbeddingAt ?? null,
    }));

    return res.json({ success: true, users });
  } catch (error) {
    console.error('[SpeakerRoutes] Enrolled users error:', error.message);
    return res.status(500).json({ error: 'Failed to fetch enrolled users.' });
  }
});

// ============================================================
// MEETING SPEAKER MAPPINGS
// ============================================================

/**
 * GET /api/speakers/meetings/:meetingId
 * Get identity mappings for all speakers in a specific meeting.
 */
router.get('/meetings/:meetingId', authenticateToken, async (req, res) => {
  try {
    const { meetingId } = req.params;
    const mappings = await SpeakerIdentificationService.getIdentityMappings(parseInt(meetingId));
    return res.json({ success: true, mappings });
  } catch (error) {
    console.error('[SpeakerRoutes] Get mappings error:', error.message);
    return res.status(500).json({ error: 'Failed to fetch speaker mappings.' });
  }
});

/**
 * POST /api/speakers/meetings/:meetingId/assign
 * Manually assign a speaker label to a specific user (Tier 4 overrides).
 * After persisting the identity mapping, triggers a cascade name update across
 * action items, AI insights, embeddings, memory context and the transcript JSON
 * file so every part of the system reflects the resolved participant name.
 */
router.post('/meetings/:meetingId/assign', authenticateToken, async (req, res) => {
  const meetingIdNum = parseInt(req.params.meetingId, 10);
  const { speakerLabel, userId } = req.body;

  if (!speakerLabel || !userId) {
    return res.status(400).json({ error: 'speakerLabel and userId are required.' });
  }

  try {
    // 1. Persist the identity mapping (tier 4, confidence 1.0) and get the resolved row back
    const mapping = await SpeakerIdentificationService.manuallyAssignSpeaker(
      meetingIdNum,
      speakerLabel,
      parseInt(userId, 10)
    );

    const userName = mapping.userName;

    // 2. Cascade: update action items, insights, embeddings, memory context + transcript file
    let cascadeStats = null;
    if (userName) {
      try {
        const result = await SpeakerIdentificationService.cascadeNameUpdate(
          meetingIdNum,
          speakerLabel,
          parseInt(userId, 10),
          userName
        );
        cascadeStats = result.stats;
      } catch (cascadeErr) {
        // Non-fatal: log but don't fail the assignment
        console.error('[SpeakerRoutes] Cascade update failed (non-fatal):', cascadeErr.message);
      }
    }

    // 3. Broadcast updated mapping to all connected clients via WebSocket
    try {
      broadcastSpeakerIdentified(meetingIdNum, [{
        speakerLabel,
        userId:            mapping.userId,
        userName:          mapping.userName,
        profilePictureUrl: mapping.profilePictureUrl ?? null,
        confidenceScore:   mapping.confidenceScore,
        tierResolved:      mapping.tierResolved,
      }]);
    } catch (_) { /* non-fatal */ }

    return res.json({
      success: true,
      message: `Speaker "${speakerLabel}" manually assigned to "${userName ?? userId}".`,
      mapping,
      cascadeStats,
    });
  } catch (error) {
    console.error('[SpeakerRoutes] Manual assign error:', error.message);
    return res.status(500).json({ error: 'Failed to assign speaker.' });
  }
});

module.exports = router;
