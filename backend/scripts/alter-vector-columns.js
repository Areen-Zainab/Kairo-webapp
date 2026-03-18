const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixVectorColumns() {
  console.log("Dropping and recreating pgvector columns for 384 dimensions...");
  try {
    // 1. Drop existing columns (this automatically drops the associated indexes)
    await prisma.$executeRawUnsafe(`ALTER TABLE meeting_embeddings DROP COLUMN embedding;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE meeting_memory_contexts DROP COLUMN summary_embedding;`);
    console.log("Old 1536-dim columns and their indexes dropped.");

    // 2. Add columns back with the correct dimensions
    await prisma.$executeRawUnsafe(`ALTER TABLE meeting_embeddings ADD COLUMN embedding vector(384);`);
    await prisma.$executeRawUnsafe(`ALTER TABLE meeting_memory_contexts ADD COLUMN summary_embedding vector(384);`);
    console.log("New 384-dim columns added.");

    // 3. Recreate the HNSW indexes
    await prisma.$executeRawUnsafe(`
      CREATE INDEX meeting_embeddings_embedding_idx ON meeting_embeddings 
      USING hnsw (embedding vector_cosine_ops);
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX meeting_memory_contexts_summary_embedding_idx ON meeting_memory_contexts 
      USING hnsw (summary_embedding vector_cosine_ops);
    `);
    console.log("Indexes recreated successfully.");

  } catch (e) {
    console.error("Error fixing vector columns:", e);
  } finally {
    await prisma.$disconnect();
  }
}

fixVectorColumns();
