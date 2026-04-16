require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const MeetingEmbeddingService = require('../src/services/MeetingEmbeddingService');

async function testEmbeddingPipeline() {
  console.log('=== Testing Meeting Memory Engine Pipeline ===\n');

  try {
    // 1. Get a random workspace (or first available)
    const workspace = await prisma.workspace.findFirst();
    if (!workspace) {
      console.error('No workspaces found. Please create one first.');
      return;
    }
    console.log(`Using Workspace: ${workspace.name} (${workspace.id})`);

    // 2. Create a dummy meeting
    const meeting = await prisma.meeting.create({
      data: {
        workspaceId: workspace.id,
        title: 'Test Meeting for Memory Engine',
        description: 'Testing if embeddings are properly generated',
        startTime: new Date(),
        endTime: new Date(Date.now() + 30 * 60000), // 30 mins later
        duration: 30,
        meetingType: 'scheduled',
        status: 'completed',
        createdById: workspace.ownerId
      }
    });
    console.log(`Created test meeting: ${meeting.id}`);

    // 3. Test Transcript Embedding (Chunking Strategy)
    const testTranscript = `
Hello everyone, welcome to the test meeting. 
Today we are discussing the new Meeting Memory Engine feature for Kairo.
The goal is to use pgvector to store embeddings of all our transcripts and summaries.
This will allow us to do semantic search across all meetings in a workspace.
For example, if someone asks "what did we decide about the new marketing budget?", 
the system can find the exact meeting and timestamp where that was discussed.
This requires us to chunk the transcripts into smaller pieces, usually around 500 words.
Then we send those chunks to OpenAI's embedding API to get a 1536-dimensional vector.
Finally, we store those vectors in PostgreSQL using the pgvector extension.
It's a really powerful feature that will make Kairo much smarter!
    `.repeat(5); // Repeat to ensure it gets chunked if we had a smaller maxWords, but 500 is big. Let's make it long enough to be at least 1 chunk.

    console.log('\n--- Testing Transcript Embedding ---');
    await MeetingEmbeddingService.embedTranscript(meeting.id, testTranscript);

    // 4. Test Summary & Context Embedding
    const testSummary = "The team discussed the implementation of the new Meeting Memory Engine using pgvector and OpenAI embeddings to enable semantic search capabilities.";
    const testTopics = ["Meeting Memory Engine", "pgvector", "Semantic Search"];
    const testDecisions = [{ decision: "Use pgvector for storage" }, { decision: "Use OpenAI text-embedding-3-small" }];
    const testParticipants = ["Alice", "Bob", "Charlie"];

    console.log('\n--- Testing Context Validation & Embedding ---');
    await MeetingEmbeddingService.generateMemoryContext(
      meeting.id,
      testSummary,
      testTopics,
      testDecisions,
      testParticipants
    );

    // 5. Verify data in DB
    console.log('\n--- Verifying Database Records ---');
    
    const embedCount = await prisma.meetingEmbedding.count({
      where: { meetingId: meeting.id }
    });
    console.log(`Transcript embedding chunks saved: ${embedCount}`);

    const contextRecord = await prisma.meetingMemoryContext.findUnique({
      where: { meetingId: meeting.id }
    });
    console.log(`Memory context created: ${contextRecord ? 'Yes' : 'No'}`);

    // 6. Test Semantic Search
    console.log('\n--- Testing Semantic Search ---');
    const searchQuery = "How are we storing the vectors for semantic search?";
    console.log(`Search Query: "${searchQuery}"`);
    
    const searchResults = await MeetingEmbeddingService.searchWorkspaceMeetings(workspace.id, searchQuery, 3);
    
    console.log(`Found ${searchResults.length} results.`);
    searchResults.forEach((r, i) => {
      console.log(`\nResult ${i+1} (Distance: ${r.distance.toFixed(4)})`);
      console.log(`Meeting: ${r.meeting_title}`);
      console.log(`Content Type: ${r.content_type}`);
      // Truncate content for display
      const snippet = r.content.length > 100 ? r.content.substring(0, 100) + '...' : r.content;
      console.log(`Snippet: "${snippet}"`);
    });

    // 7. Cleanup
    console.log('\n--- Cleaning up test data ---');
    await prisma.meeting.delete({
      where: { id: meeting.id }
    });
    console.log('Test meeting and associated embeddings deleted (via Cascade).');

    console.log('\n=== Pipeline Test Completed Successfully! ===');

  } catch (error) {
    console.error('\n❌ Pipeline Test Failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testEmbeddingPipeline();
