/**
 * backend/scripts/runAuthenticSpeakerTest.js
 * 
 * 🛠️ Authentic End-to-End Speaker ID Test Runner
 * 
 * This script allows you to test the Speaker Identification system with REAL audio.
 * It creates a meeting, mocks the diarization output, and runs the actual
 * SpeakerMatchingEngine (Tier 1 AI logic).
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const prisma = require('../src/lib/prisma');
const SpeakerMatchingEngine = require('../src/services/SpeakerMatchingEngine');
const { MEETING_DATA_BASE_DIR } = require('../src/utils/meetingFileStorage');

async function main() {
  const args = process.argv.slice(2);
  const audioIndex = args.indexOf('--audio');
  const audioPath = audioIndex !== -1 ? args[audioIndex + 1] : null;

  if (!audioPath || !fs.existsSync(audioPath)) {
    console.error('❌ Error: Please provide a valid --audio path to a .wav file.');
    console.log('Usage: node backend/scripts/runAuthenticSpeakerTest.js --audio C:\\path\\to\\voice.wav');
    process.exit(1);
  }

  console.log('🚀 Starting Authentic Speaker ID Test...');

  // 1. Find a user with voice enrollment
  const enrolledUser = await prisma.user.findFirst({
    where: {
      embeddings: {
        some: { is_active: true }
      }
    },
    include: {
      workspaces: {
        include: { workspace: true },
        take: 1
      }
    }
  });

  if (!enrolledUser) {
    console.error('❌ Error: No enrolled users found in database.');
    console.log('Please go to Settings > Voice Profile and enroll your voice first!');
    process.exit(1);
  }

  const workspace = enrolledUser.workspaces[0]?.workspace;
  if (!workspace) {
    console.error('❌ Error: Enrolled user is not in any workspace.');
    process.exit(1);
  }

  console.log(`👤 Found enrolled user: ${enrolledUser.name} (Workspace: ${workspace.name})`);

  // 2. Create a test meeting
  const meeting = await prisma.meeting.create({
    data: {
      title: `Authentic Test: ${new Date().toLocaleTimeString()}`,
      workspaceId: workspace.id,
      description: 'Automatically generated for biometric verification',
      date: new Date(),
      status: 'completed',
    }
  });

  // Add user as participant
  await prisma.meetingParticipant.create({
    data: {
      meetingId: meeting.id,
      userId: enrolledUser.id,
      role: 'HOST'
    }
  });

  console.log(`📅 Created Meeting ID: ${meeting.id}`);

  // 3. Setup meeting directory
  const meetingDirName = `${meeting.id}_authentic_test_${Date.now()}`;
  const meetingDirPath = path.join(MEETING_DATA_BASE_DIR, meetingDirName);
  fs.mkdirSync(meetingDirPath, { recursive: true });

  // 4. Copy audio file
  const audioFilename = `${meeting.id}_meeting_complete.wav`;
  const destAudioPath = path.join(meetingDirPath, audioFilename);
  fs.copyFileSync(audioPath, destAudioPath);
  console.log(`🎵 Audio file staged: ${destAudioPath}`);

  // 5. Create mock diarization JSON
  // We tell the engine that SPEAKER_00 speaks for 10 seconds
  const diarization = {
    utterances: [
      {
        speaker: 'SPEAKER_00',
        diarized_start: 0,
        diarized_end: 10,
        text: "This is a test recording to verify biometric speaker identification in the Kairo platform.",
        timestamp: new Date().toISOString()
      }
    ]
  };

  fs.writeFileSync(
    path.join(meetingDirPath, 'transcript_diarized.json'),
    JSON.stringify(diarization, null, 2)
  );
  console.log('📄 Diarization data prepared (SPEAKER_00 mapped to 0-10s).');

  // 6. Run SpeakerMatchingEngine
  console.log('\n🧠 [AI] Running SpeakerMatchingEngine (Tier 1 Cascade)...');
  try {
    const results = await SpeakerMatchingEngine.runForMeeting(meeting.id);
    
    console.log('\n🏁 TEST RESULTS:');
    console.log('-----------------------------------');
    const speaker00Match = results.results?.SPEAKER_00;
    
    if (speaker00Match && speaker00Match.resolved) {
      console.log(`✅ SUCCESS! SPEAKER_00 identified as: ${speaker00Match.userName}`);
      console.log(`📊 Confidence Score: ${(speaker00Match.confidence * 100).toFixed(1)}%`);
      console.log(`🏷️  Resolution Method: Tier ${speaker00Match.tier}`);
    } else {
      console.log('❌ FAILED: SPEAKER_00 could not be identified.');
      console.log('Possible reasons:');
      console.log('- Audio quality too low.');
      console.log('- Cosine similarity below 0.82 threshold.');
      console.log('- Enrollment embedding mismatch.');
    }
    console.log('-----------------------------------');
    console.log(`\n🔗 View result in UI: http://localhost:3000/meetings/${meeting.id}`);

  } catch (error) {
    console.error('\n❌ Engine Error:', error.message);
  } finally {
    process.exit(0);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
