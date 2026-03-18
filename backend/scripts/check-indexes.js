const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkIndexes() {
  try {
    const results = await prisma.$queryRawUnsafe(`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename IN ('meeting_embeddings', 'meeting_memory_contexts')
      AND indexdef LIKE '%vector_cosine_ops%';
    `);
    console.log(JSON.stringify(results, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

checkIndexes();
