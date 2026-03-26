const prisma = require("../lib/prisma");

/**
 * Read/query helpers for Memory Engine outputs.
 * - meeting_memory_contexts provides key topics/decisions and meeting context text.
 * - meeting_embeddings provides transcript chunks (used for a small transcript snippet).
 */
class MemoryContextService {
  /**
   * Get normalized context for a given meeting.
   * @param {number|string} meetingId
   */
  async getMeetingContext(meetingId) {
    const meetingIdInt = parseInt(meetingId, 10);
    if (Number.isNaN(meetingIdInt)) return null;

    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingIdInt },
      select: {
        id: true,
        title: true,
        startTime: true,
        endTime: true,
        duration: true,
        status: true
      }
    });

    if (!meeting) return null;

    const memoryContext = await prisma.meetingMemoryContext.findUnique({
      where: { meetingId: meetingIdInt },
      select: {
        keyTopics: true,
        keyDecisions: true,
        keyActionItems: true,
        participants: true,
        meetingContext: true,
        embeddingCount: true,
        lastProcessedAt: true
      }
    });

    // Grab a representative transcript snippet for UI.
    const firstTranscriptChunk = await prisma.meetingEmbedding.findFirst({
      where: { meetingId: meetingIdInt, contentType: "transcript" },
      select: { content: true },
      orderBy: { chunkIndex: "asc" }
    });

    const transcriptText = typeof firstTranscriptChunk?.content === "string" ? firstTranscriptChunk.content : "";

    return {
      meeting: {
        id: meeting.id,
        title: meeting.title,
        startTime: meeting.startTime,
        endTime: meeting.endTime,
        duration: meeting.duration,
        status: meeting.status
      },
      keyTopics: memoryContext?.keyTopics || [],
      keyDecisions: memoryContext?.keyDecisions || null,
      keyActionItems: memoryContext?.keyActionItems || null,
      participants: memoryContext?.participants || [],
      meetingContext: memoryContext?.meetingContext || "",
      embeddingCount: memoryContext?.embeddingCount || 0,
      lastProcessedAt: memoryContext?.lastProcessedAt || null,
      transcriptSnippet: transcriptText
        ? transcriptText.length > 600 ? `${transcriptText.slice(0, 600)}…` : transcriptText
        : null
    };
  }

  /**
   * Get related meetings using meeting_relationships (if populated).
   * @param {number|string} meetingId
   * @param {number} limit
   */
  async getRelatedMeetings(meetingId, limit = 10) {
    const meetingIdInt = parseInt(meetingId, 10);
    if (Number.isNaN(meetingIdInt)) return [];

    // 1) Prefer precomputed relationships if present
    const relationships = await prisma.meetingRelationship.findMany({
      where: {
        OR: [{ sourceMeetingId: meetingIdInt }, { targetMeetingId: meetingIdInt }]
      },
      take: Math.max(1, parseInt(limit, 10) || 10),
      orderBy: { createdAt: "desc" },
      include: {
        sourceMeeting: { select: { id: true, title: true, startTime: true, duration: true } },
        targetMeeting: { select: { id: true, title: true, startTime: true, duration: true } }
      }
    });

    if (relationships && relationships.length > 0) {
      return relationships.map((rel) => {
        const isSource = rel.sourceMeetingId === meetingIdInt;
        const other = isSource ? rel.targetMeeting : rel.sourceMeeting;

        return {
          meetingId: other?.id,
          title: other?.title,
          startTime: other?.startTime,
          duration: other?.duration,
          relationshipType: rel.relationshipType,
          similarityScore: rel.similarityScore,
          sharedTopics: rel.sharedTopics || [],
          sharedParticipants: rel.sharedParticipants || [],
          createdAt: rel.createdAt
        };
      });
    }

    // 2) Fallback: compute related meetings on-demand using summary_embedding similarity.
    // This makes the endpoint useful even before meeting_relationships is populated.
    const take = Math.max(1, parseInt(limit, 10) || 10);
    const candidateLimit = take * 5;

    const sourceContext = await prisma.meetingMemoryContext.findUnique({
      where: { meetingId: meetingIdInt },
      select: { keyTopics: true, participants: true }
    });

    if (!sourceContext) return [];

    const meetingRow = await prisma.meeting.findUnique({
      where: { id: meetingIdInt },
      select: { workspaceId: true }
    });
    if (!meetingRow) return [];

    const safeArray = (v) => Array.isArray(v) ? v : [];

    try {
      const rows = await prisma.$queryRawUnsafe(
        `
        SELECT
          mic.meeting_id AS meeting_id,
          mic.key_topics AS key_topics,
          mic.participants AS participants,
          m.title AS meeting_title,
          m.start_time AS start_time,
          m.duration AS duration,
          (mic.summary_embedding <=> (
            SELECT mic2.summary_embedding
            FROM meeting_memory_contexts mic2
            WHERE mic2.meeting_id = $1
          )) AS distance
        FROM meeting_memory_contexts mic
        JOIN meetings m ON m.id = mic.meeting_id
        WHERE m.workspace_id = $2
          AND mic.meeting_id <> $1
        ORDER BY mic.summary_embedding <=> (
          SELECT mic2.summary_embedding
          FROM meeting_memory_contexts mic2
          WHERE mic2.meeting_id = $1
        )
        LIMIT $3
        `,
        meetingIdInt,
        meetingRow.workspaceId,
        candidateLimit
      );

      const sourceTopics = safeArray(sourceContext.keyTopics).map(String);
      const sourceParticipants = safeArray(sourceContext.participants).map(String);

      const intersection = (a, b) => {
        const setB = new Set(b);
        return a.filter((x) => setB.has(x));
      };

      const scored = (rows || []).map((r) => {
        const relatedTopics = safeArray(r.key_topics).map(String);
        const relatedParticipants = safeArray(r.participants).map(String);

        const sharedTopics = intersection(sourceTopics, relatedTopics);
        const sharedParticipants = intersection(sourceParticipants, relatedParticipants);

        const distance = typeof r.distance === "number" ? r.distance : Number(r.distance);
        // pgvector cosine distance is (1 - cosine_similarity)
        const vectorSimilarity = Number.isFinite(distance) ? Math.max(0, Math.min(1, 1 - distance)) : 0;

        const topicOverlap = sharedTopics.length
          ? sharedTopics.length / Math.max(1, Math.max(sourceTopics.length, relatedTopics.length))
          : 0;
        const participantOverlap = sharedParticipants.length
          ? sharedParticipants.length / Math.max(1, Math.max(sourceParticipants.length, relatedParticipants.length))
          : 0;

        const similarityScore = 0.5 * vectorSimilarity + 0.3 * topicOverlap + 0.2 * participantOverlap;

        return {
          meetingId: r.meeting_id,
          title: r.meeting_title,
          startTime: r.start_time,
          duration: r.duration,
          relationshipType: "similar",
          similarityScore,
          sharedTopics,
          sharedParticipants,
          createdAt: null
        };
      });

      scored.sort((a, b) => (b.similarityScore ?? 0) - (a.similarityScore ?? 0));
      return scored.slice(0, take);
    } catch (err) {
      console.error(`[MemoryContextService] Failed on-demand related meetings computation:`, err.message);
      return [];
    }
  }
}

module.exports = new MemoryContextService();

