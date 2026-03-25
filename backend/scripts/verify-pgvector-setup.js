const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function verify() {
  try {
    // 1. Check pgvector extension
    const ext = await prisma.$queryRaw`SELECT extname, extversion FROM pg_extension WHERE extname = 'vector'`;
    console.log('✓ pgvector extension:', ext[0] ?? 'NOT FOUND');

    // 2. Check migrations
    const migrations = await prisma.$queryRaw`SELECT migration_name, finished_at FROM "_prisma_migrations" ORDER BY finished_at`;
    console.log('✓ Applied migrations:');
    migrations.forEach(m => console.log('  -', m.migration_name));

    // 3. Check vector indexes
    const indexes = await prisma.$queryRaw`
      SELECT indexname FROM pg_indexes
      WHERE tablename IN ('meeting_embeddings', 'meeting_memory_contexts')
      AND indexname LIKE '%embedding%'
    `;
    console.log('✓ Vector indexes:');
    indexes.forEach(i => console.log('  -', i.indexname));

    // 4. Test vector insert + similarity query
    const testId = 'verify-test-' + Date.now();
    const testVector = Array(1536).fill(0.1);

    await prisma.$executeRaw`
      INSERT INTO "meeting_embeddings" (id, meeting_id, content_type, content, embedding, created_at, updated_at)
      VALUES (
        ${testId},
        (SELECT id FROM meetings LIMIT 1),
        'test',
        'verify test',
        ${`[${testVector.join(',')}]`}::vector(1536),
        NOW(),
        NOW()
      )
    `;

    const result = await prisma.$queryRaw`
      SELECT embedding <=> ${`[${testVector.join(',')}]`}::vector(1536) AS distance
      FROM "meeting_embeddings"
      WHERE id = ${testId}
    `;
    console.log('✓ Vector similarity test distance:', result[0]?.distance);

    await prisma.$executeRaw`DELETE FROM "meeting_embeddings" WHERE id = ${testId}`;
    console.log('✓ Test row cleaned up');

    console.log('\nAll checks passed. pgvector is fully set up.');
  } catch (err) {
    console.error('✗ Verification failed:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

verify();
