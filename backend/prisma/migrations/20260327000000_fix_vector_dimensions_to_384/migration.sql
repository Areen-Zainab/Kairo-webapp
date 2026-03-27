-- Fix vector dimensions: alter embedding columns from vector(1536) to vector(384)
-- This aligns the DB schema with EmbeddingService.js which uses all-MiniLM-L6-v2 (384 dims)

-- Drop existing HNSW indexes before altering column types
DROP INDEX IF EXISTS "meeting_embeddings_embedding_idx";
DROP INDEX IF EXISTS "meeting_memory_contexts_summary_embedding_idx";

-- Alter meeting_embeddings.embedding from vector(1536) to vector(384)
ALTER TABLE "meeting_embeddings"
  ALTER COLUMN "embedding" TYPE vector(384)
  USING embedding::text::vector(384);

-- Alter meeting_memory_contexts.summary_embedding from vector(1536) to vector(384)
ALTER TABLE "meeting_memory_contexts"
  ALTER COLUMN "summary_embedding" TYPE vector(384)
  USING summary_embedding::text::vector(384);

-- Recreate HNSW indexes for cosine similarity search at 384 dimensions
CREATE INDEX IF NOT EXISTS meeting_embeddings_embedding_idx
  ON "meeting_embeddings"
  USING hnsw ("embedding" vector_cosine_ops);

CREATE INDEX IF NOT EXISTS meeting_memory_contexts_summary_embedding_idx
  ON "meeting_memory_contexts"
  USING hnsw ("summary_embedding" vector_cosine_ops);
