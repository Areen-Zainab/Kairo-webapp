/**
 * SpeakerIdentificationService.js
 * 
 * Phase 1: Data & Consent Layer
 * 
 * Handles:
 * - User biometric consent management (grant/revoke)
 * - Storing and retrieving speaker identity maps per meeting
 * - Voice embedding CRUD (Phase 2 will populate the actual embeddings)
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class SpeakerIdentificationService {

  // ============================================================
  // CONSENT MANAGEMENT
  // ============================================================

  /**
   * Grant biometric consent for a user.
   * Must be called before any voice embedding is stored.
   * @param {number} userId
   * @returns {Promise<object>} Updated user record
   */
  static async grantConsent(userId) {
    try {
      const user = await prisma.user.update({
        where: { id: userId },
        data: {
          biometricConsent: true,
          consentGivenAt: new Date(),
        },
        select: {
          id: true,
          name: true,
          biometricConsent: true,
          consentGivenAt: true,
        },
      });
      console.log(`✅ [SpeakerID] Biometric consent granted for user ${userId}`);
      return { success: true, user };
    } catch (error) {
      console.error(`❌ [SpeakerID] Failed to grant consent for user ${userId}:`, error.message);
      throw error;
    }
  }

  /**
   * Revoke biometric consent and soft-delete all voice embeddings.
   * GDPR/BIPA compliance: removes all biometric data on revocation.
   * @param {number} userId
   * @returns {Promise<object>}
   */
  static async revokeConsent(userId) {
    try {
      // Soft-delete all voice embeddings
      const deactivated = await prisma.$executeRaw`
        UPDATE user_voice_embeddings 
        SET is_active = FALSE, updated_at = NOW()
        WHERE user_id = ${userId}
      `;

      // Revoke consent on user record
      await prisma.user.update({
        where: { id: userId },
        data: {
          biometricConsent: false,
          consentGivenAt: null,
        },
      });

      console.log(`✅ [SpeakerID] Consent revoked and ${deactivated} embeddings deactivated for user ${userId}`);
      return { success: true, embeddingsDeactivated: deactivated };
    } catch (error) {
      console.error(`❌ [SpeakerID] Failed to revoke consent for user ${userId}:`, error.message);
      throw error;
    }
  }

  /**
   * Check if a user has given biometric consent.
   * @param {number} userId
   * @returns {Promise<boolean>}
   */
  static async hasConsent(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { biometricConsent: true },
    });
    return user?.biometricConsent === true;
  }

  /**
   * Get consent status and embedding info for a user.
   * Used by the frontend settings page.
   * @param {number} userId
   * @returns {Promise<object>}
   */
  static async getConsentStatus(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        biometricConsent: true,
        consentGivenAt: true,
        audioSampleUrl: true,
      },
    });

    if (!user) throw new Error(`User ${userId} not found`);

    // Count active voice embeddings
    const embeddingCount = await prisma.$queryRaw`
      SELECT COUNT(*) as count, MAX(created_at) as last_updated
      FROM user_voice_embeddings
      WHERE user_id = ${userId} AND is_active = TRUE
    `;

    const { count, last_updated } = embeddingCount[0];
    const daysSinceUpdate = last_updated
      ? Math.floor((Date.now() - new Date(last_updated).getTime()) / (1000 * 60 * 60 * 24))
      : null;

    return {
      hasConsent: user.biometricConsent,
      consentGivenAt: user.consentGivenAt,
      hasAudioSample: !!user.audioSampleUrl,
      embeddingCount: Number(count),
      lastEmbeddingUpdated: last_updated,
      daysSinceLastUpdate: daysSinceUpdate,
      needsReEnrollment: daysSinceUpdate !== null && daysSinceUpdate > 90,
    };
  }

  // ============================================================
  // SPEAKER IDENTITY MAP (per meeting)
  // ============================================================

  /**
   * Save or update a speaker identity mapping for a meeting.
   * @param {number} meetingId
   * @param {string} speakerLabel - e.g. 'SPEAKER_00'
   * @param {number|null} userId - null if unresolved
   * @param {number} confidenceScore - 0.0 to 1.0
   * @param {number} tierResolved - 1, 2, 3, or 4
   * @param {object} metadata - optional extra info
   * @returns {Promise<object>}
   */
  static async saveIdentityMapping(meetingId, speakerLabel, userId, confidenceScore, tierResolved, metadata = {}) {
    try {
      // Upsert — update if already exists for this meeting+label
      const result = await prisma.$executeRaw`
        INSERT INTO speaker_identity_maps 
          (id, meeting_id, speaker_label, user_id, confidence_score, tier_resolved, metadata, created_at, updated_at)
        VALUES
          (gen_random_uuid()::text, ${meetingId}, ${speakerLabel}, ${userId}, ${confidenceScore}, ${tierResolved}, ${JSON.stringify(metadata)}::jsonb, NOW(), NOW())
        ON CONFLICT (meeting_id, speaker_label) DO UPDATE SET
          user_id = EXCLUDED.user_id,
          confidence_score = EXCLUDED.confidence_score,
          tier_resolved = EXCLUDED.tier_resolved,
          metadata = EXCLUDED.metadata,
          updated_at = NOW()
      `;

      console.log(`✅ [SpeakerID] Mapped ${speakerLabel} → userID ${userId ?? 'UNRESOLVED'} (confidence: ${confidenceScore}, tier: ${tierResolved}) for meeting ${meetingId}`);
      return { success: true };
    } catch (error) {
      console.error(`❌ [SpeakerID] Failed to save identity mapping:`, error.message);
      throw error;
    }
  }

  /**
   * Get all speaker identity mappings for a meeting.
   * Joins with user names for easy consumption by the frontend.
   * @param {number} meetingId
   * @returns {Promise<Array>}
   */
  static async getIdentityMappings(meetingId) {
    try {
      const mappings = await prisma.$queryRaw`
        SELECT 
          sim.id,
          sim.speaker_label,
          sim.user_id,
          u.name as user_name,
          u.profile_picture_url,
          sim.confidence_score,
          sim.tier_resolved,
          sim.metadata,
          sim.created_at,
          sim.updated_at
        FROM speaker_identity_maps sim
        LEFT JOIN users u ON sim.user_id = u.id
        WHERE sim.meeting_id = ${meetingId}
        ORDER BY sim.speaker_label ASC
      `;

      return mappings.map(m => ({
        id: m.id,
        speakerLabel: m.speaker_label,
        userId: m.user_id,
        userName: m.user_name ?? null,
        profilePictureUrl: m.profile_picture_url ?? null,
        confidenceScore: m.confidence_score,
        tierResolved: m.tier_resolved,
        isResolved: m.user_id !== null,
        metadata: m.metadata ?? {},
      }));
    } catch (error) {
      console.error(`❌ [SpeakerID] Failed to get identity mappings for meeting ${meetingId}:`, error.message);
      throw error;
    }
  }

  /**
   * Manually assign a speaker label to a user (Tier 4 - human correction).
   * @param {number} meetingId
   * @param {string} speakerLabel
   * @param {number} userId
   * @returns {Promise<object>}
   */
  static async manuallyAssignSpeaker(meetingId, speakerLabel, userId) {
    return this.saveIdentityMapping(
      meetingId,
      speakerLabel,
      userId,
      1.0, // full confidence since human confirmed
      4,   // Tier 4 = human-in-the-loop
      { source: 'manual_assignment', assignedAt: new Date().toISOString() }
    );
  }

  // ============================================================
  // VOICE EMBEDDING PLACEHOLDERS (Phase 2 will fill these)
  // ============================================================

  /**
   * Check if a user has active voice embeddings.
   * Phase 2 will populate the actual vectors.
   * @param {number} userId
   * @returns {Promise<boolean>}
   */
  static async hasVoiceEmbedding(userId) {
    const result = await prisma.$queryRaw`
      SELECT COUNT(*) as count 
      FROM user_voice_embeddings 
      WHERE user_id = ${userId} AND is_active = TRUE
    `;
    return Number(result[0].count) > 0;
  }

  /**
   * Get all workspace users who have consented and have active embeddings.
   * Used by the matching engine in Phase 2.
   * @param {number} workspaceId
   * @returns {Promise<Array>}
   */
  static async getEnrolledWorkspaceUsers(workspaceId) {
    const users = await prisma.$queryRaw`
      SELECT 
        u.id,
        u.name,
        u.audio_sample_url,
        u.consent_given_at,
        COUNT(uve.id) as embedding_count,
        MAX(uve.created_at) as last_embedding_at
      FROM users u
      JOIN workspace_members wm ON u.id = wm.user_id
      LEFT JOIN user_voice_embeddings uve ON u.id = uve.user_id AND uve.is_active = TRUE
      WHERE wm.workspace_id = ${workspaceId}
        AND u.biometric_consent = TRUE
        AND wm.is_active = TRUE
      GROUP BY u.id, u.name, u.audio_sample_url, u.consent_given_at
      ORDER BY u.name ASC
    `;

    return users.map(u => ({
      userId: u.id,
      name: u.name,
      hasAudioSample: !!u.audio_sample_url,
      audioSampleUrl: u.audio_sample_url,
      embeddingCount: Number(u.embedding_count),
      lastEmbeddingAt: u.last_embedding_at,
      daysSinceUpdate: u.last_embedding_at
        ? Math.floor((Date.now() - new Date(u.last_embedding_at).getTime()) / (1000 * 60 * 60 * 24))
        : null,
    }));
  }
}

module.exports = SpeakerIdentificationService;
