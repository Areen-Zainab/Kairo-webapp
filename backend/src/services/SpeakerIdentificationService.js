/**
 * SpeakerIdentificationService.js
 * 
 * Phase 1: Data & Consent Layer
 * 
 * Handles:
 * - User biometric consent management (grant/revoke)
 * - Storing and retrieving speaker identity maps per meeting
 * - Voice embedding storage is populated via `VoiceEmbeddingBridge` + `user_voice_embeddings` (192-dim vectors)
 */

const fs = require('fs');
const path = require('path');
const prisma = require('../lib/prisma');

const MEETING_DATA_BASE_DIR = path.resolve(__dirname, '../../data/meetings');

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
      // Upsert — update if already exists for this meeting+label.
      // Manual assignments (tier_resolved = 4, set by a human via the UI) are never
      // overwritten by automated identification results.  A human correction is always
      // treated as ground truth until explicitly changed by another manual action.
      const result = await prisma.$executeRaw`
        INSERT INTO speaker_identity_maps 
          (id, meeting_id, speaker_label, user_id, confidence_score, tier_resolved, metadata, created_at, updated_at)
        VALUES
          (gen_random_uuid()::text, ${meetingId}, ${speakerLabel}, ${userId}, ${confidenceScore}, ${tierResolved}, ${JSON.stringify(metadata)}::jsonb, NOW(), NOW())
        ON CONFLICT (meeting_id, speaker_label) DO UPDATE SET
          user_id          = EXCLUDED.user_id,
          confidence_score = EXCLUDED.confidence_score,
          tier_resolved    = EXCLUDED.tier_resolved,
          metadata         = EXCLUDED.metadata,
          updated_at       = NOW()
        WHERE
          -- Always overwrite non-manual rows
          speaker_identity_maps.tier_resolved != 4
          -- Also overwrite manual assignments when biometrics resolved a real user
          OR EXCLUDED.user_id IS NOT NULL
      `;

      // result === 0 means ON CONFLICT fired but the WHERE clause prevented the update
      // (existing row is a manual assignment, tier 4 — kept as-is).
      if (result === 0) {
        console.log(`🔒 [SpeakerID] Kept manual assignment for ${speakerLabel} in meeting ${meetingId} (automated result skipped)`);
      } else {
        console.log(`✅ [SpeakerID] Mapped ${speakerLabel} → userID ${userId ?? 'UNRESOLVED'} (confidence: ${confidenceScore}, tier: ${tierResolved}) for meeting ${meetingId}`);
      }
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
   * Returns the full resolved mapping row after saving.
   * @param {number} meetingId
   * @param {string} speakerLabel
   * @param {number} userId
   * @returns {Promise<object>}
   */
  static async manuallyAssignSpeaker(meetingId, speakerLabel, userId) {
    await this.saveIdentityMapping(
      meetingId,
      speakerLabel,
      userId,
      1.0, // full confidence since human confirmed
      4,   // Tier 4 = human-in-the-loop
      { source: 'manual_assignment', assignedAt: new Date().toISOString() }
    );

    // Return the persisted mapping row with user details for immediate use by the route
    const rows = await prisma.$queryRaw`
      SELECT
        sim.id, sim.speaker_label, sim.user_id, u.name as user_name,
        u.profile_picture_url,
        sim.confidence_score, sim.tier_resolved, sim.metadata, sim.updated_at
      FROM speaker_identity_maps sim
      LEFT JOIN users u ON sim.user_id = u.id
      WHERE sim.meeting_id = ${meetingId} AND sim.speaker_label = ${speakerLabel}
      LIMIT 1
    `;

    const row = rows[0] ?? null;
    return row ? {
      speakerLabel:      row.speaker_label,
      userId:            row.user_id,
      userName:          row.user_name ?? null,
      profilePictureUrl: row.profile_picture_url ?? null,
      confidenceScore:   row.confidence_score,
      tierResolved:      row.tier_resolved,
      resolved:          row.user_id !== null,
    } : { success: true };
  }

  /**
   * After a manual assignment, propagate the resolved name through all
   * downstream data for this meeting so that action items, insights,
   * embeddings, memory context and the on-disk transcript JSON all
   * consistently use the real participant name instead of the diarisation
   * label (e.g. SPEAKER_00).
   *
   * @param {number} meetingId
   * @param {string} speakerLabel  - original diarisation label, e.g. "SPEAKER_00"
   * @param {number} userId        - the user being assigned
   * @param {string} userName      - resolved display name for that user
   * @returns {Promise<object>}    - summary of rows/files updated
   */
  static async cascadeNameUpdate(meetingId, speakerLabel, userId, userName) {
    const stats = { actionItems: 0, aiInsights: 0, memoryContext: false, embeddings: 0, transcriptFile: false };

    // Build match variants: "SPEAKER_00", "speaker_00", "speaker 00"
    const labelLower    = speakerLabel.toLowerCase();
    const labelSpaced   = labelLower.replace(/_/g, ' ');

    try {
      // ------------------------------------------------------------------
      // 1. action_items.assignee  (exact case-insensitive match)
      // ------------------------------------------------------------------
      const aiResult = await prisma.$executeRaw`
        UPDATE action_items
        SET assignee = ${userName}
        WHERE meeting_id = ${meetingId}
          AND LOWER(COALESCE(assignee, '')) IN (${labelLower}, ${labelSpaced})
      `;
      stats.actionItems = Number(aiResult);

      // ------------------------------------------------------------------
      // 2. ai_insights.content  (text replacement; meetingId stored as string)
      // ------------------------------------------------------------------
      const insights = await prisma.$queryRaw`
        SELECT id, content
        FROM ai_insights
        WHERE meeting_id = ${String(meetingId)}
          AND (content ILIKE ${'%' + speakerLabel + '%'} OR content ILIKE ${'%' + labelSpaced + '%'})
      `;
      for (const insight of insights) {
        const updated = insight.content
          .replace(new RegExp(speakerLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), userName)
          .replace(new RegExp(labelSpaced.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), userName);
        if (updated !== insight.content) {
          await prisma.$executeRaw`UPDATE ai_insights SET content = ${updated} WHERE id = ${insight.id}`;
          stats.aiInsights++;
        }
      }

      // ------------------------------------------------------------------
      // 3. meeting_memory_contexts  (participants array + meetingContext text)
      // ------------------------------------------------------------------
      try {
        const ctx = await prisma.meetingMemoryContext.findUnique({ where: { meetingId } });
        if (ctx) {
          const updatedParticipants = ctx.participants.map(p =>
            p.toLowerCase() === labelLower || p.toLowerCase() === labelSpaced ? userName : p
          );
          const labelRe = new RegExp(speakerLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
          const spacedRe = new RegExp(labelSpaced.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
          const updatedContext = ctx.meetingContext.replace(labelRe, userName).replace(spacedRe, userName);

          const participantsChanged = JSON.stringify(updatedParticipants) !== JSON.stringify(ctx.participants);
          const contextChanged = updatedContext !== ctx.meetingContext;

          if (participantsChanged || contextChanged) {
            await prisma.meetingMemoryContext.update({
              where: { meetingId },
              data: {
                ...(participantsChanged ? { participants: updatedParticipants } : {}),
                ...(contextChanged ? { meetingContext: updatedContext } : {}),
              },
            });
            stats.memoryContext = true;
          }
        }
      } catch (_) { /* table may not exist for all meetings */ }

      // ------------------------------------------------------------------
      // 4. meeting_embeddings.content  (vector store — text field only)
      // ------------------------------------------------------------------
      try {
        const embRows = await prisma.$queryRaw`
          SELECT id, content
          FROM meeting_embeddings
          WHERE meeting_id = ${meetingId}
            AND (content ILIKE ${'%' + speakerLabel + '%'} OR content ILIKE ${'%' + labelSpaced + '%'})
        `;
        for (const row of embRows) {
          const updated = row.content
            .replace(new RegExp(speakerLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), userName)
            .replace(new RegExp(labelSpaced.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), userName);
          if (updated !== row.content) {
            await prisma.$executeRaw`UPDATE meeting_embeddings SET content = ${updated} WHERE id = ${row.id}`;
            stats.embeddings++;
          }
        }
      } catch (_) { /* table may not exist */ }

      // ------------------------------------------------------------------
      // 5. On-disk transcript_diarized.json  (ensures future AI jobs use real names)
      // ------------------------------------------------------------------
      try {
        if (fs.existsSync(MEETING_DATA_BASE_DIR)) {
          const dirEntries = fs.readdirSync(MEETING_DATA_BASE_DIR, { withFileTypes: true });
          const meetingDirEntry = dirEntries.find(e => e.isDirectory() && e.name.startsWith(`${meetingId}_`));
          if (meetingDirEntry) {
            const diarizedPath = path.join(MEETING_DATA_BASE_DIR, meetingDirEntry.name, 'transcript_diarized.json');
            if (fs.existsSync(diarizedPath)) {
              const data = JSON.parse(fs.readFileSync(diarizedPath, 'utf8'));
              if (Array.isArray(data.utterances)) {
                let changed = false;
                data.utterances = data.utterances.map(u => {
                  if (u.speaker && u.speaker.toLowerCase() === labelLower) {
                    changed = true;
                    return { ...u, speaker: userName };
                  }
                  return u;
                });
                if (changed) {
                  fs.writeFileSync(diarizedPath, JSON.stringify(data, null, 2), 'utf8');
                  stats.transcriptFile = true;
                }
              }
            }
          }
        }
      } catch (fileErr) {
        console.warn(`[SpeakerID] Could not update transcript file for meeting ${meetingId}:`, fileErr.message);
      }

    } catch (err) {
      console.error(`[SpeakerID] cascadeNameUpdate error for ${speakerLabel} → ${userName}:`, err.message);
      throw err;
    }

    console.log(`✅ [SpeakerID] Cascade complete: ${speakerLabel} → "${userName}" in meeting ${meetingId}`, stats);
    return { userName, stats };
  }

  // ============================================================
  // VOICE EMBEDDING QUERIES
  // ============================================================

  /**
   * Check if a user has active voice embeddings (pgvector 192-dim, see UserVoiceEmbedding).
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
   * Used by `SpeakerMatchingEngine` (Tier 1).
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
