-- CreateIndex: HNSW index on meeting_embeddings.embedding for fast cosine similarity search
CREATE INDEX IF NOT EXISTS meeting_embeddings_embedding_idx
ON "meeting_embeddings"
USING hnsw ("embedding" vector_cosine_ops);

-- CreateIndex: HNSW index on meeting_memory_contexts.summary_embedding for fast cosine similarity search
CREATE INDEX IF NOT EXISTS meeting_memory_contexts_summary_embedding_idx
ON "meeting_memory_contexts"
USING hnsw ("summary_embedding" vector_cosine_ops);
