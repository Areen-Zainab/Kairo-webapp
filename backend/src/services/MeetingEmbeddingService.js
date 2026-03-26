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

      // Regeneration safety:
      // - embedTranscript is insert-only today.
      // - AIInsightsService can be called with forceRegenerate=true, which would otherwise create duplicates.
      // Replace transcript embeddings deterministically per meeting.
      await prisma.meetingEmbedding.deleteMany({
        where: { meetingId, contentType: 'transcript' }
      });
      
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

      // Regeneration safety for summary embeddings.
      await prisma.meetingEmbedding.deleteMany({
        where: { meetingId, contentType: 'summary' }
      });
      
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
}

module.exports = new MeetingEmbeddingService();
