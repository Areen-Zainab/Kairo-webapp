const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const prisma = require('../lib/prisma');
const { findMeetingDirectory } = require('../utils/meetingFileStorage');

// Paths to Python scripts
const AGENT_SCRIPT_PATH = path.resolve(__dirname, '../../../ai-layer/agents/run_agents.py');
const PARTICIPANT_AGENT_PATH = path.resolve(__dirname, '../../../ai-layer/agents/participant_analysis_agent.py');
const TRANSCRIPT_CONVERTER_PATH = path.resolve(__dirname, '../../../ai-layer/utils/transcript_converter.py');

// Python executable paths (same as TranscriptionService)
const ROOT_VENV_PYTHON_WIN = path.resolve(__dirname, '../../../venv/Scripts/python.exe');
const ROOT_VENV_PYTHON_UNIX = path.resolve(__dirname, '../../../venv/bin/python');

class AIInsightsService {
  /**
   * Get Python executable path
   */
  getPythonExecutable() {
    if (process.platform === 'win32' && fs.existsSync(ROOT_VENV_PYTHON_WIN)) {
      return ROOT_VENV_PYTHON_WIN;
    }
    if (fs.existsSync(ROOT_VENV_PYTHON_UNIX)) {
      return ROOT_VENV_PYTHON_UNIX;
    }
    // Fallback to system Python
    return 'python';
  }

  /**
   * Check if transcript is available for a meeting
   * Checks multiple possible locations and formats
   */
  async checkTranscriptAvailable(meetingId) {
    console.log(`🔍 [checkTranscriptAvailable] Looking for transcript for meeting ${meetingId}...`);
    
    // Try multiple possible locations
    const possiblePaths = [];
    
    // 1. Check in meeting_data directory (primary location: {meetingId}_{name}_{timestamp}/)
    const meetingDir = findMeetingDirectory(meetingId);
    if (meetingDir) {
      console.log(`   Found meeting directory: ${meetingDir}`);
      possiblePaths.push(
        path.join(meetingDir, 'transcript_diarized.json'),
        path.join(meetingDir, 'transcript_diarized.txt'),
        path.join(meetingDir, 'transcript_complete.txt')
      );
      
      // Also check transcripts subdirectory
      const transcriptsSubdir = path.join(meetingDir, 'transcripts');
      if (fs.existsSync(transcriptsSubdir)) {
        try {
          const files = fs.readdirSync(transcriptsSubdir);
          files.forEach(f => {
            if (f.includes('transcript') || f.includes('diarized')) {
              possiblePaths.push(path.join(transcriptsSubdir, f));
            }
          });
        } catch (err) {
          console.warn(`   Could not read transcripts subdirectory: ${err.message}`);
        }
      }
    } else {
      console.warn(`   Meeting directory not found for meeting ${meetingId}`);
    }
    
    // 2. Check in recordings directory (fallback location)
    const RECORDINGS_DIR = path.join(__dirname, 'recordings');
    if (fs.existsSync(RECORDINGS_DIR)) {
      try {
        const files = fs.readdirSync(RECORDINGS_DIR);
        const transcriptFiles = files.filter(f => 
          f.startsWith('transcript_') && (f.endsWith('.txt') || f.endsWith('.json'))
        );
        transcriptFiles.forEach(f => {
          possiblePaths.push(path.join(RECORDINGS_DIR, f));
        });
        if (transcriptFiles.length > 0) {
          console.log(`   Found ${transcriptFiles.length} transcript file(s) in recordings directory`);
        }
      } catch (err) {
        console.warn(`   Could not read recordings directory: ${err.message}`);
      }
    }
    
    console.log(`   Checking ${possiblePaths.length} possible transcript locations...`);
    
    // Try each path
    for (const transcriptPath of possiblePaths) {
      if (fs.existsSync(transcriptPath)) {
        try {
          const stats = fs.statSync(transcriptPath);
          if (stats.size >= 100) {
            console.log(`✅ Found transcript at: ${transcriptPath} (${(stats.size / 1024).toFixed(1)} KB)`);
            return { available: true, transcriptPath };
          } else {
            console.warn(`   Transcript file too small: ${transcriptPath} (${stats.size} bytes)`);
          }
        } catch (error) {
          console.warn(`   Error checking ${transcriptPath}: ${error.message}`);
          continue;
        }
      }
    }
    
    // If no transcript found, return error with helpful message
    console.error(`❌ No transcript found for meeting ${meetingId}`);
    console.error(`   Checked ${possiblePaths.length} possible locations`);
    if (meetingDir) {
      console.error(`   Meeting directory exists: ${meetingDir}`);
      console.error(`   Directory contents:`, fs.readdirSync(meetingDir).join(', '));
    } else {
      console.error(`   Meeting directory not found. Expected format: {meetingId}_{name}_{timestamp}/`);
    }
    return { available: false, error: 'Transcript file not found in any expected location' };
  }

  /**
   * Check if insights already exist for a meeting
   */
  async checkInsightsExist(meetingId) {
    try {
      // Convert meetingId to string for VARCHAR comparison
      const meetingIdStr = String(meetingId);
      
      // First check the ai_insights table using Prisma's type-safe method
      try {
        const count = await prisma.aiInsight.count({
          where: {
            meetingId: meetingIdStr
          }
        });
        
        if (count > 0) {
          return true;
        }
      } catch (error) {
        // If table doesn't exist, catch the error and check the flag instead
        if (error.code === 'P2010' || (error.meta && error.meta.code === '42P01')) {
          console.warn(`⚠️  ai_insights table does not exist. Run migrations: npx prisma migrate dev`);
          // Fall through to check the meetings table flag
        } else {
          throw error; // Re-throw if it's a different error
        }
      }

      // Also check the meetings table flag if it exists (Option 1)
      // Note: meetings.id is INT, so we use parseInt for explicit type conversion
      try {
        const meeting = await prisma.meeting.findUnique({
          where: { id: parseInt(meetingIdStr) },
          select: { aiInsightsGenerated: true }
        });
        if (meeting && meeting.aiInsightsGenerated) {
          return true;
        }
      } catch (error) {
        // Field might not exist yet - that's okay, we'll rely on ai_insights table check
        // This is expected if the migration hasn't been run yet
      }

      return false;
    } catch (error) {
      console.error(`Error checking existing insights for meeting ${meetingId}:`, error);
      return false;
    }
  }

  /**
   * Load and convert diarized transcript to text format
   * Handles both JSON and TXT formats
   */
  async loadDiarizedTranscript(meetingId) {
    const { transcriptPath } = await this.checkTranscriptAvailable(meetingId);
    if (!transcriptPath) {
      throw new Error('Transcript not available');
    }

    console.log(`📄 [loadDiarizedTranscript] Loading transcript from: ${transcriptPath}`);

    let transcriptJson = null;
    let transcriptText = '';

    // Check file extension to determine format
    const isJson = transcriptPath.endsWith('.json');
    const isTxt = transcriptPath.endsWith('.txt');

    if (isJson) {
      // Read JSON file
      try {
        console.log(`   Reading JSON transcript...`);
        transcriptJson = JSON.parse(fs.readFileSync(transcriptPath, 'utf8'));
        console.log(`   JSON parsed successfully. Utterances: ${transcriptJson.utterances?.length || 0}`);
        
        // Convert to text format using Python converter
        console.log(`   Converting JSON to text format...`);
        transcriptText = await this.convertJsonToText(transcriptPath);
        console.log(`   Text conversion complete (${transcriptText.length} characters)`);
      } catch (error) {
        console.error(`❌ Error reading/parsing JSON transcript: ${error.message}`);
        throw new Error(`Failed to parse JSON transcript: ${error.message}`);
      }
    } else if (isTxt) {
      // Read TXT file directly
      console.log(`   Reading TXT transcript...`);
      transcriptText = fs.readFileSync(transcriptPath, 'utf8');
      console.log(`   TXT loaded (${transcriptText.length} characters)`);
      
      // Try to create a basic JSON structure from TXT for compatibility
      // Split by lines and create a simple structure
      const lines = transcriptText.split('\n').filter(line => line.trim());
      transcriptJson = {
        metadata: {
          generated: new Date().toISOString(),
          total_utterances: lines.length,
          speakers: ['Speaker_0'], // Default speaker
          duration_seconds: 0
        },
        utterances: lines.map((line, index) => ({
          speaker: 'Speaker_0',
          text: line.trim(),
          start_time: index * 5.0, // Approximate timing
          end_time: (index + 1) * 5.0
        }))
      };
      
      console.log(`   Converted TXT to JSON structure with ${lines.length} utterances`);
    } else {
      throw new Error(`Unsupported transcript format: ${transcriptPath}`);
    }

    return {
      transcriptText,
      transcriptJson,
      transcriptPath
    };
  }

  /**
   * Convert JSON transcript to text format using Python converter
   * Fixed to handle paths with spaces on Windows
   */
  async convertJsonToText(jsonPath) {
    return new Promise((resolve, reject) => {
      const pythonExe = this.getPythonExecutable();
      const scriptPath = TRANSCRIPT_CONVERTER_PATH;
      
      // Use absolute paths and properly escape them for Python
      const absoluteJsonPath = path.resolve(jsonPath);
      const absoluteScriptDir = path.resolve(path.dirname(scriptPath));
      
      // For Windows, we need to properly escape backslashes and quotes in the Python string
      // Use JSON.stringify to properly escape the path
      const escapedJsonPath = JSON.stringify(absoluteJsonPath);
      const escapedScriptDir = JSON.stringify(absoluteScriptDir);

      // Create Python script that properly handles paths with spaces
      const pythonScript = `
import sys
import os
import json

# Add script directory to path
script_dir = ${escapedScriptDir}
sys.path.insert(0, script_dir)

from transcript_converter import convert_diarized_json_to_text

# Use the properly escaped path
json_path = ${escapedJsonPath}
result = convert_diarized_json_to_text(json_path)
print(result)
      `.trim();

      // Use spawn without shell to avoid path splitting issues
      const proc = spawn(pythonExe, ['-c', pythonScript], {
        shell: false, // Don't use shell to avoid path splitting
        cwd: absoluteScriptDir,
        env: { ...process.env, PYTHONUNBUFFERED: '1' }
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve(stdout.trim());
        } else {
          reject(new Error(`Transcript conversion failed: ${stderr || 'Unknown error'}`));
        }
      });

      proc.on('error', (error) => {
        reject(new Error(`Failed to start Python process: ${error.message}`));
      });
    });
  }

  /**
   * Run a single Python agent with text input
   */
  async runTextAgent(agentKey, transcriptText) {
    return new Promise((resolve, reject) => {
      const pythonExe = this.getPythonExecutable();
      const scriptPath = AGENT_SCRIPT_PATH;

      const proc = spawn(pythonExe, [scriptPath, agentKey], {
        shell: process.platform === 'win32',
        cwd: path.dirname(scriptPath)
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(stdout.trim());
            resolve(result);
          } catch (parseError) {
            reject(new Error(`Failed to parse agent output: ${parseError.message}`));
          }
        } else {
          reject(new Error(`Agent ${agentKey} failed: ${stderr || 'Unknown error'}`));
        }
      });

      proc.on('error', (error) => {
        reject(new Error(`Failed to start agent ${agentKey}: ${error.message}`));
      });

      // Write transcript to stdin
      proc.stdin.write(transcriptText);
      proc.stdin.end();
    });
  }

  /**
   * Run participant analysis agent with JSON input
   */
  async runParticipantAgent(transcriptJson) {
    return new Promise((resolve, reject) => {
      const pythonExe = this.getPythonExecutable();
      const scriptPath = PARTICIPANT_AGENT_PATH;

      // Create a temporary JSON file to pass to the agent
      const tempJsonPath = path.join(__dirname, `temp_transcript_${Date.now()}.json`);
      fs.writeFileSync(tempJsonPath, JSON.stringify(transcriptJson));
      
      // Use absolute paths and properly escape them for Python
      const absoluteTempPath = path.resolve(tempJsonPath);
      const absoluteScriptDir = path.resolve(path.dirname(scriptPath));
      
      // For Windows, we need to properly escape backslashes and quotes in the Python string
      // Use JSON.stringify to properly escape the paths
      const escapedTempPath = JSON.stringify(absoluteTempPath);
      const escapedScriptDir = JSON.stringify(absoluteScriptDir);

      // Create Python script that properly handles paths with spaces
      // Use a single-line command to avoid issues with Windows cmd.exe
      const pythonScript = `import sys; import json; import os; sys.path.insert(0, ${escapedScriptDir}); from participant_analysis_agent import ParticipantAnalysisAgent; f = open(${escapedTempPath}, 'r', encoding='utf-8'); transcript_json = json.load(f); f.close(); agent = ParticipantAnalysisAgent(); result = agent.run(transcript_json); print(json.dumps(result, ensure_ascii=False))`;

      const proc = spawn(pythonExe, ['-c', pythonScript], {
        shell: false, // Don't use shell to avoid path splitting
        cwd: absoluteScriptDir,
        env: { ...process.env, PYTHONUNBUFFERED: '1' }
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        // Clean up temp file
        try {
          if (fs.existsSync(tempJsonPath)) {
            fs.unlinkSync(tempJsonPath);
          }
        } catch (e) {
          console.warn(`Failed to delete temp file: ${tempJsonPath}`);
        }

        if (code === 0) {
          try {
            const result = JSON.parse(stdout.trim());
            resolve(result);
          } catch (parseError) {
            reject(new Error(`Failed to parse participant agent output: ${parseError.message}`));
          }
        } else {
          reject(new Error(`Participant agent failed: ${stderr || 'Unknown error'}`));
        }
      });

      proc.on('error', (error) => {
        // Clean up temp file on error
        try {
          if (fs.existsSync(tempJsonPath)) {
            fs.unlinkSync(tempJsonPath);
          }
        } catch (e) {
          // Ignore cleanup errors
        }
        reject(new Error(`Failed to start participant agent: ${error.message}`));
      });
    });
  }

  /**
   * Run all agents in parallel where possible
   */
  async runAllAgents(transcriptText, transcriptJson) {
    console.log('🤖 Running all AI agents...');

    // Run text-based agents in parallel
    const textAgents = [
      { key: 'summary', name: 'Summary' },
      { key: 'decisions', name: 'Decisions' },
      { key: 'sentiment', name: 'Sentiment' },
      { key: 'topics', name: 'Topics' },
      { key: 'action_items', name: 'Action Items' }
    ];

    const textAgentPromises = textAgents.map(async ({ key, name }) => {
      try {
        console.log(`  Running ${name} agent...`);
        const result = await this.runTextAgent(key, transcriptText);
        console.log(`  ✅ ${name} agent completed`);
        return { key, result, success: true };
      } catch (error) {
        console.error(`  ❌ ${name} agent failed:`, error.message);
        return { key, result: null, success: false, error: error.message };
      }
    });

    // Run participant agent separately (needs JSON)
    const participantPromise = (async () => {
      try {
        console.log('  Running Participant Analysis agent...');
        const result = await this.runParticipantAgent(transcriptJson);
        console.log('  ✅ Participant Analysis agent completed');
        return { key: 'participants', result, success: true };
      } catch (error) {
        console.error('  ❌ Participant Analysis agent failed:', error.message);
        return { key: 'participants', result: null, success: false, error: error.message };
      }
    })();

    // Wait for all agents to complete
    const textResults = await Promise.all(textAgentPromises);
    const participantResult = await participantPromise;

    // Aggregate results
    const insights = {
      summary: null,
      decisions: null,
      sentiment: null,
      topics: null,
      actionItems: null,
      participants: null
    };

    // Process text agent results
    for (const { key, result, success } of textResults) {
      if (success && result) {
        switch (key) {
          case 'summary':
            insights.summary = result;
            break;
          case 'decisions':
            insights.decisions = result;
            break;
          case 'sentiment':
            insights.sentiment = result;
            break;
          case 'topics':
            insights.topics = result;
            break;
          case 'action_items':
            insights.actionItems = result;
            break;
        }
      }
    }

    // Process participant result
    if (participantResult.success && participantResult.result) {
      insights.participants = participantResult.result;
    }

    return insights;
  }

  /**
   * Save insights to database with transaction safety
   */
  async saveInsightsToDatabase(meetingId, insights) {
    console.log('💾 Saving insights to database...');

    // Convert meetingId to string if it's a number (for UUID compatibility)
    const meetingIdStr = String(meetingId);

    // Use Prisma transaction to ensure atomicity
    await prisma.$transaction(async (tx) => {
      // Delete existing insights for this meeting using Prisma's type-safe method
      try {
        const deleted = await tx.aiInsight.deleteMany({
          where: {
            meetingId: meetingIdStr
          }
        });
        if (deleted.count > 0) {
          console.log(`   Deleted ${deleted.count} existing insight(s)`);
        }
      } catch (error) {
        console.warn(`Warning: Could not delete existing insights: ${error.message}`);
        // Continue anyway - might be first time generating
      }

      // Save summary
      if (insights.summary) {
        const content = JSON.stringify(insights.summary);
        const confidence = insights.summary.confidence || 0.85;
        
        await tx.aiInsight.create({
          data: {
            id: uuidv4(),
            meetingId: meetingIdStr,
            insightType: 'summary',
            content: content,
            confidenceScore: Number(confidence)
          }
        });
        console.log(`   ✅ Saved summary insight`);
      }

      // Save decisions
      if (insights.decisions && Array.isArray(insights.decisions) && insights.decisions.length > 0) {
        const content = JSON.stringify(insights.decisions);
        const avgConfidence = insights.decisions.reduce((sum, d) => sum + (d.confidence || 0.8), 0) / insights.decisions.length;
        
        await tx.aiInsight.create({
          data: {
            id: uuidv4(),
            meetingId: meetingIdStr,
            insightType: 'decisions',
            content: content,
            confidenceScore: Number(avgConfidence)
          }
        });
        console.log(`   ✅ Saved ${insights.decisions.length} decision(s)`);
      }

      // Save sentiment
      if (insights.sentiment) {
        const content = JSON.stringify(insights.sentiment);
        const confidence = insights.sentiment.confidence || 0.8;
        
        await tx.aiInsight.create({
          data: {
            id: uuidv4(),
            meetingId: meetingIdStr,
            insightType: 'sentiment',
            content: content,
            confidenceScore: Number(confidence)
          }
        });
        console.log(`   ✅ Saved sentiment insight`);
      }

      // Save topics
      if (insights.topics && Array.isArray(insights.topics) && insights.topics.length > 0) {
        const content = JSON.stringify(insights.topics);
        const avgConfidence = 0.8; // Topics don't have individual confidence
        
        await tx.aiInsight.create({
          data: {
            id: uuidv4(),
            meetingId: meetingIdStr,
            insightType: 'topics',
            content: content,
            confidenceScore: Number(avgConfidence)
          }
        });
        console.log(`   ✅ Saved ${insights.topics.length} topic(s)`);
      }

      // Save action items
      if (insights.actionItems && Array.isArray(insights.actionItems) && insights.actionItems.length > 0) {
        const content = JSON.stringify(insights.actionItems);
        const avgConfidence = insights.actionItems.reduce((sum, item) => sum + (item.confidence || 0.8), 0) / insights.actionItems.length;
        
        await tx.aiInsight.create({
          data: {
            id: uuidv4(),
            meetingId: meetingIdStr,
            insightType: 'action_items',
            content: content,
            confidenceScore: Number(avgConfidence)
          }
        });
        console.log(`   ✅ Saved ${insights.actionItems.length} action item(s)`);
      }

      // Save participants (use 'other' type since 'participants' is not in enum)
      if (insights.participants && Array.isArray(insights.participants) && insights.participants.length > 0) {
        const content = JSON.stringify(insights.participants);
        const avgConfidence = 0.85; // Participants don't have individual confidence
        
        await tx.aiInsight.create({
          data: {
            id: uuidv4(),
            meetingId: meetingIdStr,
            insightType: 'other',
            content: content,
            confidenceScore: Number(avgConfidence)
          }
        });
        console.log(`   ✅ Saved ${insights.participants.length} participant(s)`);
      }

      // Mark meeting as insights generated (if field exists)
      try {
        await tx.meeting.update({
          where: { id: parseInt(meetingIdStr) },
          data: {
            aiInsightsGenerated: true,
            updatedAt: new Date()
          }
        });
        console.log(`   ✅ Updated meeting ai_insights_generated flag`);
      } catch (error) {
        // Field might not exist yet - log but don't fail
        console.warn(`Note: Could not update ai_insights_generated flag (field may not exist): ${error.message}`);
      }
    });

    console.log('✅ Insights saved to database (transaction completed)');
  }

  /**
   * Main entry point: Generate insights for a meeting
   */
  async generateInsights(meetingId) {
    console.log(`\n🧠 Starting AI insights generation for meeting ${meetingId}...`);
    console.log(`   Meeting ID type: ${typeof meetingId}, value: ${meetingId}`);

    try {
      // Check if insights already exist
      const insightsExist = await this.checkInsightsExist(meetingId);
      if (insightsExist) {
        console.log(`ℹ️  Insights already exist for meeting ${meetingId}, skipping generation`);
        return { success: true, skipped: true, message: 'Insights already generated' };
      }

      // Check if transcript is available
      console.log('🔍 Checking for transcript...');
      const transcriptCheck = await this.checkTranscriptAvailable(meetingId);
      if (!transcriptCheck.available) {
        console.error(`❌ Transcript not available: ${transcriptCheck.error}`);
        console.error(`   This means AI insights cannot be generated.`);
        console.error(`   Please ensure the meeting has been transcribed and the transcript file exists.`);
        return { success: false, error: transcriptCheck.error };
      }

      // Load transcript
      console.log('📄 Loading transcript...');
      console.log(`   Transcript path: ${transcriptCheck.transcriptPath}`);
      const { transcriptText, transcriptJson } = await this.loadDiarizedTranscript(meetingId);
      console.log(`✅ Transcript loaded (${transcriptText.length} characters)`);
      
      if (transcriptText.length < 50) {
        console.warn(`⚠️  Transcript is very short (${transcriptText.length} chars), insights may be limited`);
      }

      // Run all agents
      console.log('🤖 Running AI agents...');
      const insights = await this.runAllAgents(transcriptText, transcriptJson);
      console.log('✅ All agents completed');

      // Save to database
      console.log('💾 Saving insights to database...');
      await this.saveInsightsToDatabase(meetingId, insights);
      console.log('✅ Insights saved to database');

      console.log(`✅ AI insights generation completed for meeting ${meetingId}`);
      return { success: true, insights };
    } catch (error) {
      console.error(`❌ AI insights generation failed for meeting ${meetingId}:`, error);
      console.error(`   Error stack:`, error.stack);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new AIInsightsService();
