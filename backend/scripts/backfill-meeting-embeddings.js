require('dotenv').config();
const prisma = require('../src/lib/prisma');
const AIInsightsService = require('../src/services/AIInsightsService');
const MeetingEmbeddingService = require('../src/services/MeetingEmbeddingService');

/**
 * Backfill transcript embeddings for meetings that have transcripts.
 *
 * Usage:
 *   node backend/scripts/backfill-meeting-embeddings.js --workspaceId=1
 *   node backend/scripts/backfill-meeting-embeddings.js --limit=50
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (const a of args) {
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

async function main() {
  const args = parseArgs();
  const workspaceId = args.workspaceId ? parseInt(args.workspaceId, 10) : null;
  const limit = args.limit ? parseInt(args.limit, 10) : 200;

  const where = {
    ...(workspaceId ? { workspaceId } : {}),
    // Only attempt backfill for meetings likely to have a transcript
    status: { in: ['completed', 'in-progress'] }
  };

  const meetings = await prisma.meeting.findMany({
    where,
    orderBy: { id: 'desc' },
    take: limit,
    select: { id: true, workspaceId: true, title: true }
  });

  console.log(`Found ${meetings.length} meeting(s) to consider for backfill.`);

  let embedded = 0;
  let skippedNoTranscript = 0;
  let skippedHasEmbeddings = 0;
  let failed = 0;

  for (const m of meetings) {
    try {
      const existingCount = await prisma.meetingEmbedding.count({
        where: { meetingId: m.id }
      });

      if (existingCount > 0) {
        skippedHasEmbeddings++;
        continue;
      }

      const transcriptCheck = await AIInsightsService.checkTranscriptAvailable(m.id);
      if (!transcriptCheck.available) {
        skippedNoTranscript++;
        continue;
      }

      const { transcriptText } = await AIInsightsService.loadDiarizedTranscript(m.id);
      if (!transcriptText || transcriptText.trim().length < 20) {
        skippedNoTranscript++;
        continue;
      }

      console.log(`Embedding transcript for meeting ${m.id} (${m.title || 'Untitled'})...`);
      await MeetingEmbeddingService.embedTranscript(m.id, transcriptText);
      embedded++;
    } catch (e) {
      failed++;
      console.warn(`Failed meeting ${m.id}: ${e.message}`);
    }
  }

  console.log('--- Backfill summary ---');
  console.log({
    embedded,
    skippedNoTranscript,
    skippedHasEmbeddings,
    failed
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

