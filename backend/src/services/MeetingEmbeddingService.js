const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const embeddingService = require('./EmbeddingService');

class MeetingEmbeddingService {
  /**
   * Splits text into smaller chunks while trying to preserve sentence boundaries.
   * Target size is around maxWords per chunk.
   * @param {string} text - Full text to chunk
   * @param {number} maxWords - Target maximum words per chunk (default 500)
   * @returns {string[]} - Array of text chunks
   */
  chunkText(text, maxWords = 500) {
    if (!text || text.trim() === '') return [];

    // Split text into sentences (handles '.', '!', '?')
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    
    const chunks = [];
    let currentChunk = [];
    let currentWordCount = 0;

    for (const sentence of sentences) {
      const sentenceWordCount = sentence.trim().split(/\s+/).length;
      
      // If adding this sentence exceeds the max word count, save the chunk and start a new one
      if (currentWordCount + sentenceWordCount > maxWords && currentChunk.length > 0) {
        chunks.push(currentChunk.join(' ').trim());
        currentChunk = [];
        currentWordCount = 0;
      }
      
      currentChunk.push(sentence.trim());
      currentWordCount += sentenceWordCount;
      
      // If a single sentence is longer than maxWords (rare, but possible), just add it as its own chunk
      if (currentWordCount > maxWords) {
        chunks.push(currentChunk.join(' ').trim());
        currentChunk = [];
        currentWordCount = 0;
      }
    }

    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join(' ').trim());
    }

    return chunks;
  }

  /**
   * Embeds a meeting transcript by chunking it and saving vectors to the DB.
   * @param {number} meetingId - The ID of the meeting
   * @param {string} transcriptText - The full transcript text
   */
  async embedTranscript(meetingId, transcriptText) {
    if (!transcriptText) return;

    try {
      console.log(`[MeetingEmbeddingService] Chunking transcript for meeting ${meetingId}...`);
      const chunks = this.chunkText(transcriptText, 500);
      
      console.log(`[MeetingEmbeddingService] Generated ${chunks.length} chunks. Generating embeddings...`);
      
      // Generate embeddings in batches if there are many chunks to avoid rate limits, 
      // but for most meetings, generateBatchEmbeddings handles it.
      const embeddings = await embeddingService.generateBatchEmbeddings(chunks);
      
      console.log(`[MeetingEmbeddingService] Saving ${chunks.length} transcript embeddings to DB...`);
      
      // Use raw SQL to insert pgvector data
      // We can use a transaction to ensure all inserts for this meeting succeed together
      const inserts = chunks.map((chunkText, index) => {
        const embeddingStr = '[' + embeddings[index].join(',') + ']';
        
        return prisma.$executeRawUnsafe(
          `INSERT INTO meeting_embeddings (id, meeting_id, content_type, content, embedding, chunk_index, created_at, updated_at)
           VALUES (gen_random_uuid(), $1, $2, $3, $4::vector(384), $5, NOW(), NOW())`,
          meetingId,
          'transcript',
          chunkText,
          embeddingStr,
          index
        );
      });

      await prisma.$transaction(inserts);
      console.log(`[MeetingEmbeddingService] Successfully embedded transcript for meeting ${meetingId}.`);
    } catch (error) {
      console.error(`[MeetingEmbeddingService] Error embedding transcript for meeting ${meetingId}:`, error);
      throw error;
    }
  }

  /**
   * Embeds a meeting summary (no chunking usually needed).
   */
  async embedSummary(meetingId, summaryText) {
    if (!summaryText) return;

    try {
      console.log(`[MeetingEmbeddingService] Generating embedding for meeting ${meetingId} summary...`);
      const embedding = await embeddingService.generateEmbedding(summaryText);
      const embeddingStr = '[' + embedding.join(',') + ']';
      
      await prisma.$executeRawUnsafe(
        `INSERT INTO meeting_embeddings (id, meeting_id, content_type, content, embedding, chunk_index, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4::vector(384), 0, NOW(), NOW())`,
        meetingId,
        'summary',
        summaryText,
        embeddingStr
      );
      console.log(`[MeetingEmbeddingService] Successfully embedded summary for meeting ${meetingId}.`);
    } catch (error) {
      console.error(`[MeetingEmbeddingService] Error embedding summary for meeting ${meetingId}:`, error);
      throw error;
    }
  }

  /**
   * Creates the MeetingMemoryContext record for a meeting, including a summary embedding.
   */
  async generateMemoryContext(meetingId, summary, topics, decisions, participants) {
    if (!summary) return;

    try {
      console.log(`[MeetingEmbeddingService] Generating Memory Context for meeting ${meetingId}...`);
      
      // The context uses the summary embedding
      const embedding = await embeddingService.generateEmbedding(summary);
      const embeddingStr = '[' + embedding.join(',') + ']';

      // We use create or update via raw SQL to handle the Unsupported pgvector type properly
      await prisma.$executeRawUnsafe(
        `INSERT INTO meeting_memory_contexts (id, meeting_id, summary_embedding, key_topics, key_decisions, participants, meeting_context, embedding_count, created_at, last_processed_at)
         VALUES (gen_random_uuid(), $1, $2::vector(384), $3::text[], $4::jsonb, $5::text[], $6, $7, NOW(), NOW())
         ON CONFLICT (meeting_id) DO UPDATE SET
         summary_embedding = EXCLUDED.summary_embedding::vector(384),
         key_topics = EXCLUDED.key_topics,
         key_decisions = EXCLUDED.key_decisions,
         participants = EXCLUDED.participants,
         meeting_context = EXCLUDED.meeting_context,
         last_processed_at = NOW()`,
        meetingId,
        embeddingStr,
        topics || [], // PostgreSQL array mapped from JS array
        decisions ? JSON.stringify(decisions) : null,
        participants || [],
        summary, // Store summary text as meeting_context
        1 // Setting default embedding count
      );

      console.log(`[MeetingEmbeddingService] Successfully generated memory context for meeting ${meetingId}.`);
    } catch (error) {
      console.error(`[MeetingEmbeddingService] Error generating memory context for meeting ${meetingId}:`, error);
      throw error;
    }
  }

  /**
   * Performs semantic search using cosine similarity across meeting_embeddings inside a specific workspace.
   */
  async searchWorkspaceMeetings(workspaceId, queryText, limit = 5) {
    if (!queryText) return [];

    try {
      const queryEmbedding = await embeddingService.generateEmbedding(queryText);
      const embeddingStr = '[' + queryEmbedding.join(',') + ']';

      // Use <=> for cosine distance search
      const results = await prisma.$queryRawUnsafe(
        `SELECT me.id, me.meeting_id, me.content_type, me.content,
                me.embedding <=> $1::vector(384) AS distance,
                m.title AS meeting_title, m.start_time
         FROM meeting_embeddings me
         JOIN meetings m ON m.id = me.meeting_id
         WHERE m.workspace_id = $2
         ORDER BY me.embedding <=> $1::vector(384)
         LIMIT $3`,
        embeddingStr,
        workspaceId,
        limit
      );

      return results;
    } catch (error) {
      console.error(`[MeetingEmbeddingService] Error searching workspace meetings:`, error);
      throw error;
    }
  }

  /**
   * Hybrid search: combines pgvector cosine similarity with PostgreSQL full-text search.
   * - Semantic score (60% weight): vector distance via <=>
   * - FTS score (40% weight): ts_rank from plainto_tsquery
   * Results are ranked by a combined score so exact keyword matches AND semantic
   * matches both surface correctly.
   *
   * Falls back to pure vector search if FTS fails (e.g. language config issues).
   *
   * @param {number} workspaceId
   * @param {string} queryText
   * @param {number} limit
   */
  async hybridSearchWorkspaceMeetings(workspaceId, queryText, limit = 10) {
    if (!queryText) return [];

    try {
      const queryEmbedding = await embeddingService.generateEmbedding(queryText);
      const embeddingStr = '[' + queryEmbedding.join(',') + ']';

      // Pull more rows (5x limit) from each source then merge/rerank
      const fetchLimit = Math.max(limit * 5, 20);

      // Run vector search and FTS in parallel
      const [vectorResults, ftsResults] = await Promise.all([
        // 1. Pure semantic (vector) search
        prisma.$queryRawUnsafe(
          `SELECT me.id::text, me.meeting_id, me.content_type, me.content,
                  me.embedding <=> $1::vector(384) AS distance,
                  m.title AS meeting_title, m.start_time
           FROM meeting_embeddings me
           JOIN meetings m ON m.id = me.meeting_id
           WHERE m.workspace_id = $2
           ORDER BY me.embedding <=> $1::vector(384)
           LIMIT $3`,
          embeddingStr,
          workspaceId,
          fetchLimit
        ),
        // 2. Full-text search using PostgreSQL tsvector
        prisma.$queryRawUnsafe(
          `SELECT me.id::text, me.meeting_id, me.content_type, me.content,
                  ts_rank(to_tsvector('english', me.content), plainto_tsquery('english', $1)) AS fts_rank,
                  m.title AS meeting_title, m.start_time
           FROM meeting_embeddings me
           JOIN meetings m ON m.id = me.meeting_id
           WHERE m.workspace_id = $2
             AND to_tsvector('english', me.content) @@ plainto_tsquery('english', $1)
           ORDER BY fts_rank DESC
           LIMIT $3`,
          queryText,
          workspaceId,
          fetchLimit
        ).catch(() => []) // FTS can fail on empty query or missing config — fallback to empty
      ]);

      // Build score maps: lower distance = better for vector; higher rank = better for FTS
      const scoreMap = new Map(); // id -> { row, vectorScore, ftsScore }

      // Normalise vector distances (0 = perfect, 2 = worst) into 0–1 score
      const maxDist = 2.0;
      for (const r of vectorResults) {
        const dist = typeof r.distance === 'number' ? r.distance : Number(r.distance);
        const vectorScore = 1 - Math.min(dist / maxDist, 1); // higher = better
        scoreMap.set(r.id, { row: r, vectorScore, ftsScore: 0 });
      }

      // Normalise FTS ranks (already 0–1 from ts_rank) and merge
      const maxFts = ftsResults.reduce((m, r) => Math.max(m, Number(r.fts_rank) || 0), 1);
      for (const r of ftsResults) {
        const ftsScore = maxFts > 0 ? (Number(r.fts_rank) || 0) / maxFts : 0;
        if (scoreMap.has(r.id)) {
          scoreMap.get(r.id).ftsScore = ftsScore;
        } else {
          scoreMap.set(r.id, { row: r, vectorScore: 0, ftsScore });
        }
      }

      // Combined score: 60% semantic + 40% FTS
      const VECTOR_WEIGHT = 0.6;
      const FTS_WEIGHT = 0.4;

      const ranked = Array.from(scoreMap.values())
        .map(({ row, vectorScore, ftsScore }) => ({
          ...row,
          // Expose distance as (1 - combinedScore) so existing dedup logic (lower = better) still works
          distance: 1 - (VECTOR_WEIGHT * vectorScore + FTS_WEIGHT * ftsScore)
        }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, limit);

      console.log(`[MeetingEmbeddingService] Hybrid search: ${vectorResults.length} vector + ${ftsResults.length} FTS → ${ranked.length} merged results`);
      return ranked;
    } catch (error) {
      console.error(`[MeetingEmbeddingService] Hybrid search error — falling back to vector:`, error);
      // Graceful fallback: pure vector
      return this.searchWorkspaceMeetings(workspaceId, queryText, limit);
    }
  }
  /**
   * Find meetings in the same workspace that are semantically similar to a given meeting.
   * Uses the meeting_memory_contexts.summary_embedding for comparison.
   *
   * @param {number} meetingId    - The source meeting to find relatives for
   * @param {number} workspaceId  - Workspace scope for search
   * @param {number} limit        - Max results to return (default 5)
   * @returns {Array}  Array of related meeting objects with similarity score
   */
  async findRelatedMeetings(meetingId, workspaceId, limit = 5) {
    try {
      // 1. Get the summary embedding for the source meeting
      const sourceContext = await prisma.$queryRawUnsafe(
        `SELECT summary_embedding, key_topics, meeting_context
         FROM meeting_memory_contexts
         WHERE meeting_id = $1
         LIMIT 1`,
        meetingId
      );

      if (!sourceContext || sourceContext.length === 0 || !sourceContext[0].summary_embedding) {
        console.log(`[MeetingEmbeddingService] No memory context/embedding found for meeting ${meetingId} — cannot find related meetings`);
        return [];
      }

      // summary_embedding comes back as a string "[0.1,0.2,...]" from pgvector
      const embeddingStr = sourceContext[0].summary_embedding;

      // 2. Find top-N similar meetings in the same workspace (excluding self)
      const related = await prisma.$queryRawUnsafe(
        `SELECT
           m.id,
           m.title,
           m.start_time,
           m.end_time,
           m.duration,
           m.status,
           m.platform,
           mmc.key_topics,
           mmc.participants,
           mmc.meeting_context AS summary,
           mmc.summary_embedding <=> $1::vector(384) AS distance
         FROM meeting_memory_contexts mmc
         JOIN meetings m ON m.id = mmc.meeting_id
         WHERE m.workspace_id = $2
           AND m.id <> $3
           AND mmc.summary_embedding IS NOT NULL
         ORDER BY mmc.summary_embedding <=> $1::vector(384)
         LIMIT $4`,
        embeddingStr,
        workspaceId,
        meetingId,
        limit
      );

      // Convert distance (0=identical, 2=opposite) to a 0–100 similarity score
      return related.map(r => ({
        id: Number(r.id),
        title: r.title,
        startTime: r.start_time,
        endTime: r.end_time,
        duration: r.duration,
        status: r.status,
        platform: r.platform,
        keyTopics: r.key_topics || [],
        participants: r.participants || [],
        summary: r.summary || null,
        similarityScore: Math.round((1 - Math.min(Number(r.distance), 1)) * 100) // 0–100
      }));
    } catch (error) {
      console.error(`[MeetingEmbeddingService] Error finding related meetings for ${meetingId}:`, error);
      return []; // Non-fatal — callers should handle empty array
    }
  }
}

module.exports = new MeetingEmbeddingService();
