-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to meeting_embeddings
ALTER TABLE "meeting_embeddings" ADD COLUMN IF NOT EXISTS "embedding" vector(1536);

-- Add summary_embedding column to meeting_memory_contexts
ALTER TABLE "meeting_memory_contexts" ADD COLUMN IF NOT EXISTS "summary_embedding" vector(1536);
