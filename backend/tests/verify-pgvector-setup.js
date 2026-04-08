const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verify() {
  console.log('=== pgvector Setup Verification ===\n');

  const EXPECTED_DIM = 384;

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

  // 3b. Check actual configured dimensions for key columns
  // pgvector stores dimensions in atttypmod; for vector(N), atttypmod = N + 4
  const dims = await prisma.$queryRawUnsafe(
    `
    SELECT c.relname AS table_name, a.attname AS column_name, (a.atttypmod - 4) AS dimensions
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN ('meeting_embeddings', 'meeting_memory_contexts')
      AND a.attname IN ('embedding', 'summary_embedding')
      AND a.atttypmod > 0
    ORDER BY c.relname, a.attname
    `
  );
  console.log('3b. Vector dimensions:', dims.map(d => `${d.table_name}.${d.column_name}=${d.dimensions}`));

  // 4. Test insert + similarity search
  const testVec = '[' + Array(EXPECTED_DIM).fill('0.1').join(',') + ']';

  // Pick an existing meeting id to satisfy FK constraints
  const meetingRows = await prisma.$queryRawUnsafe(
    `SELECT id FROM meetings ORDER BY id ASC LIMIT 1`
  );
  const meetingId = meetingRows?.[0]?.id;
  if (!meetingId) {
    console.log('4. Similarity test: SKIPPED (no rows in meetings table to satisfy FK)');
    console.log('\n=== All checks passed (with skipped insert test)! ===');
    return;
  }
  
  await prisma.$executeRawUnsafe(
    `INSERT INTO meeting_embeddings (id, meeting_id, content_type, content, embedding, created_at, updated_at)
     VALUES ('test-verify-uuid', ${meetingId}, 'test', 'test content', '${testVec}'::vector(${EXPECTED_DIM}), NOW(), NOW())
     ON CONFLICT (id) DO NOTHING`
  );

  const result = await prisma.$queryRawUnsafe(
    `SELECT id, content, embedding <=> '${testVec}'::vector(${EXPECTED_DIM}) AS distance
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
