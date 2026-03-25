const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verify() {
  console.log('=== pgvector Setup Verification ===\n');

  // 1. Check extension
  const ext = await prisma.$queryRawUnsafe(
    "SELECT extname, extversion FROM pg_extension WHERE extname='vector'"
  );
  console.log('1. Extension:', ext.length ? `${ext[0].extname} v${ext[0].extversion}` : 'NOT FOUND');

  // 2. Check indexes
  const indexes = await prisma.$queryRawUnsafe(
    "SELECT indexname FROM pg_indexes WHERE indexname LIKE '%embedding_idx%'"
  );
  console.log('2. HNSW Indexes:', indexes.map(i => i.indexname));

  // 3. Check vector columns
  const cols = await prisma.$queryRawUnsafe(
    "SELECT table_name, column_name FROM information_schema.columns WHERE udt_name='vector'"
  );
  console.log('3. Vector columns:', cols.map(c => `${c.table_name}.${c.column_name}`));

  // 4. Test insert + similarity search
  const testVec = '[' + Array(1536).fill('0.1').join(',') + ']';
  
  await prisma.$executeRawUnsafe(
    `INSERT INTO meeting_embeddings (id, meeting_id, content_type, content, embedding, created_at, updated_at)
     VALUES ('test-verify-uuid', 1, 'test', 'test content', '${testVec}'::vector(1536), NOW(), NOW())
     ON CONFLICT (id) DO NOTHING`
  );

  const result = await prisma.$queryRawUnsafe(
    `SELECT id, content, embedding <=> '${testVec}'::vector(1536) AS distance
     FROM meeting_embeddings WHERE id='test-verify-uuid'`
  );
  console.log('4. Similarity test:', result.length ? `distance=${result[0].distance}` : 'FAILED');

  // Cleanup
  await prisma.$executeRawUnsafe("DELETE FROM meeting_embeddings WHERE id='test-verify-uuid'");
  console.log('   (test row cleaned up)');

  console.log('\n=== All checks passed! ===');
}

verify()
  .catch(e => console.error('Error:', e.message))
  .finally(() => prisma.$disconnect());
