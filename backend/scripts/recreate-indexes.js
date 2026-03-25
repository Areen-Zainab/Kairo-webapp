const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createIndexes() {
  console.log("Creating HNSW indexes for vector(384)...");
  try {
    // 1. Create index on meeting_embeddings.embedding
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS meeting_embeddings_embedding_idx ON meeting_embeddings 
      USING hnsw (embedding vector_cosine_ops);
    `);
    console.log("Created index on meeting_embeddings.embedding");

    // 2. Create index on meeting_memory_contexts.summary_embedding
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS meeting_memory_contexts_summary_embedding_idx ON meeting_memory_contexts 
      USING hnsw (summary_embedding vector_cosine_ops);
    `);
    console.log("Created index on meeting_memory_contexts.summary_embedding");
  } catch (e) {
    console.error("Error creating indexes:", e);
  } finally {
    await prisma.$disconnect();
  }
}

createIndexes();
