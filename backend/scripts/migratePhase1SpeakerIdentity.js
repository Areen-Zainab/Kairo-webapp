/**
 * Phase 1: Speaker Identification - Manual Schema Migration
 * 
 * Applies the 3 schema changes needed for Phase 1:
 * 1. biometric_consent + consent_given_at columns on users table
 * 2. user_voice_embeddings table (pgvector **192-dim** — matches Prisma + VoiceEmbeddingService.py)
 * 3. speaker_identity_maps table
 *
 * Legacy: databases created with vector(256) pre-alignment need a manual migration
 * (new column / re-enroll) — PostgreSQL cannot widen/narrow pgvector dims in-place safely.
 * 
 * Run with: node scripts/migratePhase1SpeakerIdentity.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migrate() {
  console.log('🚀 Phase 1: Speaker Identification Schema Migration');
  console.log('=====================================================\n');

  try {
    await prisma.$connect();
    console.log('✅ Database connected\n');

    // Step 1: Enable pgvector extension (already enabled but safe to run again)
    console.log('📦 Step 1: Ensuring pgvector extension is active...');
    await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS vector;`);
    console.log('✅ pgvector extension ready\n');

    // Step 2: Add biometric consent fields to users table
    console.log('👤 Step 2: Adding biometric consent fields to users table...');
    
    // Check if column already exists
    const biometricConsentExists = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'biometric_consent'
    `;

    if (biometricConsentExists.length === 0) {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE users 
        ADD COLUMN biometric_consent BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN consent_given_at TIMESTAMP(3) NULL;
      `);
      console.log('✅ Added biometric_consent and consent_given_at to users\n');
    } else {
      console.log('ℹ️  biometric_consent column already exists, skipping\n');
    }

    // Step 3: Create user_voice_embeddings table
    console.log('🎙️  Step 3: Creating user_voice_embeddings table...');
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS user_voice_embeddings (
        id            TEXT        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id       INTEGER     NOT NULL,
        embedding     vector(192),
        version       INTEGER     NOT NULL DEFAULT 1,
        snr_score     DOUBLE PRECISION,
        is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
        created_at    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_voice_embedding_user
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_user_voice_embeddings_user_id 
      ON user_voice_embeddings(user_id);
    `);
    console.log('✅ user_voice_embeddings table created\n');

    // Step 4: Create speaker_identity_maps table
    console.log('🗺️  Step 4: Creating speaker_identity_maps table...');
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS speaker_identity_maps (
        id              TEXT          NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
        meeting_id      INTEGER       NOT NULL,
        speaker_label   TEXT          NOT NULL,
        user_id         INTEGER,
        confidence_score DOUBLE PRECISION NOT NULL,
        tier_resolved   INTEGER       NOT NULL,
        metadata        JSONB,
        created_at      TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at      TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_speaker_map_meeting
          FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
        CONSTRAINT fk_speaker_map_user
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
        CONSTRAINT uq_speaker_meeting_label
          UNIQUE (meeting_id, speaker_label)
      );
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_speaker_identity_maps_meeting_id 
      ON speaker_identity_maps(meeting_id);
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_speaker_identity_maps_user_id 
      ON speaker_identity_maps(user_id);
    `);
    console.log('✅ speaker_identity_maps table created\n');

    // Step 5: Verify all changes
    console.log('🔍 Step 5: Verifying migration...');
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('user_voice_embeddings', 'speaker_identity_maps')
      ORDER BY table_name;
    `;
    
    const columns = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
        AND column_name IN ('biometric_consent', 'consent_given_at')
      ORDER BY column_name;
    `;

    console.log(`✅ Tables created: ${tables.map(t => t.table_name).join(', ')}`);
    console.log(`✅ Columns added to users: ${columns.map(c => c.column_name).join(', ')}`);

    console.log('\n🎉 Phase 1 Migration Complete!');
    console.log('================================');
    console.log('✅ biometric_consent, consent_given_at → users');
    console.log('✅ user_voice_embeddings (pgvector 192-dim, aligned with Prisma schema)');
    console.log('✅ speaker_identity_maps (meeting ↔ user + confidence)');
    console.log('\nReady for Phase 2: Building the embedding service.');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

migrate();
