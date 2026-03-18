const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { v4: uuidv4 } = require('uuid');
const prisma = require('../lib/prisma');
const { findMeetingDirectory } = require('../utils/meetingFileStorage');
const NotificationService = require('./NotificationService');
const MeetingEmbeddingService = require('./MeetingEmbeddingService');

// In-memory storage for generation status (not persisted to DB)
// If backend restarts, these are cleared, preventing false "generating" states
const activeGenerations = new Map(); // meetingId -> { status, progress, startTime, error }

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
   * Get generation status for a meeting (checks in-memory first, then DB)
   * Returns { status, progress, startTime, error, isActive }
   */
  getGenerationStatus(meetingId) {
    const meetingIdInt = parseInt(meetingId);

    // Check in-memory first (active generations)
    if (activeGenerations.has(meetingIdInt)) {
      const status = activeGenerations.get(meetingIdInt);
      return {
        status: status.status,
        progress: status.progress,
        startTime: status.startTime,
        error: status.error,
        isActive: true // Indicates this is actively generating
      };
    }

    // Not in memory, return idle (will check DB for persisted insights separately)
    return {
      status: 'idle',
      progress: 0,
      startTime: null,
      error: null,
      isActive: false
    };
  }

  /**
   * Get the set of insight types that already exist for a meeting
   * Returns Set of insight type strings (e.g., 'summary', 'action_items', etc.)
   */
  async getExistingInsightTypes(meetingId) {
    const meetingIdStr = String(meetingId);
    const existingTypes = new Set();

    try {
      const insights = await prisma.aiInsight.findMany({
        where: { meetingId: meetingIdStr },
        select: { insightType: true }
      });

      insights.forEach(insight => {
        existingTypes.add(insight.insightType);
      });
    } catch (error) {
      console.warn(`Warning: Could not fetch existing insight types: ${error.message}`);
    }

    return existingTypes;
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
        env: {
          ...process.env,
          PYTHONUNBUFFERED: '1',
          PYTHONIOENCODING: 'utf-8',  // Fix Windows encoding issues
          MISTRAL_API_KEY: process.env.MISTRAL_API_KEY  // Explicitly pass for agents
        }
      });

      // Register for cleanup on server shutdown
      if (global.registerChildProcess) {
        global.registerChildProcess(proc, 'Transcript Converter');
      }

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
  async runTextAgent(agentKey, transcriptText, context = null) {
    return new Promise((resolve, reject) => {
      const pythonExe = this.getPythonExecutable();
      const scriptPath = AGENT_SCRIPT_PATH;

      const proc = spawn(pythonExe, [scriptPath, agentKey], {
        shell: process.platform === 'win32',
        cwd: path.dirname(scriptPath),
        env: {
          ...process.env,
          PYTHONIOENCODING: 'utf-8',  // Fix Windows encoding issues
          MISTRAL_API_KEY: process.env.MISTRAL_API_KEY,  // Explicitly pass for summary agent
          // Pass context as JSON string in environment variable
          AGENT_CONTEXT: context ? JSON.stringify(context) : ''
        }
      });

      // Register for cleanup on server shutdown
      if (global.registerChildProcess) {
        global.registerChildProcess(proc, `AI Agent: ${agentKey}`);
      }

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        const stderrChunk = data.toString();
        stderr += stderrChunk;
        // Log stderr output immediately for debugging (especially for summary agent)
        if (stderrChunk.trim()) {
          console.error(`[${agentKey}] ${stderrChunk.trim()}`);
        }
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

      // Create a temporary JSON file in data/temp directory (not in src/ to avoid nodemon restarts)
      const tempDir = path.resolve(__dirname, '../../data/temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      const tempJsonPath = path.join(tempDir, `temp_transcript_${Date.now()}.json`);
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
        env: {
          ...process.env,
          PYTHONUNBUFFERED: '1',
          PYTHONIOENCODING: 'utf-8',  // Fix Windows encoding issues
          MISTRAL_API_KEY: process.env.MISTRAL_API_KEY  // Explicitly pass for agents
        }
      });

      // Register for cleanup on server shutdown
      if (global.registerChildProcess) {
        global.registerChildProcess(proc, 'Participant Analysis Agent');
      }

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
   * Update progress in database
   */
  async updateProgress(meetingId, progress) {
    try {
      const meetingIdInt = parseInt(meetingId);
      const currentMeeting = await prisma.meeting.findUnique({
        where: { id: meetingIdInt },
        select: { metadata: true }
      });

      if (currentMeeting) {
        await prisma.meeting.update({
          where: { id: meetingIdInt },
          data: {
            updatedAt: new Date(), // Keep activity alive
            metadata: {
              ...(currentMeeting.metadata || {}),
              aiInsightsProgress: Math.round(progress)
            }
          }
        });
      }
    } catch (e) {
      console.warn(`Failed to update progress for ${meetingId}: ${e.message}`);
    }
  }

  /**
   * Run all agents sequentially to avoid rate limit exhaustion
   * Text-based agents run one at a time, participant agent runs in parallel
   */
  async runAllAgents(meetingId, transcriptText, transcriptJson) {
    console.log('🤖 Running all AI agents...');

    // Total steps: 5 text agents + 1 participant agent = 6 steps
    const totalSteps = 6;
    let completedSteps = 0;

    // Helper to increment and save progress
    const incrementProgress = async () => {
      completedSteps++;
      const progress = (completedSteps / totalSteps) * 90; // Cap at 90% until final save
      console.log(`   Progress: ${Math.round(progress)}% (${completedSteps}/${totalSteps})`);
      await this.updateProgress(meetingId, progress);
    };

    // Helper to add timeout to agent execution
    const withTimeout = (promise, timeoutMs, agentName) => {
      return Promise.race([
        promise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`${agentName} agent timed out after ${timeoutMs}ms`)), timeoutMs)
        )
      ]);
    };

    // Text-based agents that use Groq API - run sequentially to avoid rate limits
    // IMPORTANT: Run summary LAST to avoid Groq rate limits
    const textAgents = [
      { key: 'decisions', name: 'Decisions' },
      { key: 'sentiment', name: 'Sentiment' },
      { key: 'topics', name: 'Topics' },
      { key: 'action_items', name: 'Action Items' }
    ];

    // Run text agents sequentially and save each as it completes
    const textResults = [];
    for (const { key, name } of textAgents) {
      try {
        console.log(`  Running ${name} agent...`);
        // Increased timeout to 10 minutes to allow for rate limit retries
        const result = await withTimeout(
          this.runTextAgent(key, transcriptText),
          10 * 60 * 1000, // 10 minutes (allows for rate limit retries)
          name
        );
        console.log(`  ✅ ${name} agent completed`);
        await incrementProgress();
        textResults.push({ key, result, success: true });

        // Save this insight immediately to database (progressive loading)
        try {
          await this.saveIndividualInsight(meetingId, key, result);
          console.log(`  💾 Saved ${name} to database`);
        } catch (saveErr) {
          console.warn(`  ⚠️ Failed to save ${name}: ${saveErr.message}`);
        }

        // Small delay between agents to help avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
      } catch (error) {
        console.error(`  ❌ ${name} agent failed:`, error.message);
        await incrementProgress(); // Count as complete even if failed
        textResults.push({ key, result: null, success: false, error: error.message });

        // Continue to next agent even if this one failed
        console.log(`  ⏳ Waiting 20 seconds before next agent...`);
        await new Promise(resolve => setTimeout(resolve, 20000)); // 20 second delay
      }
    }

    // Run participant agent separately (needs JSON, doesn't use Groq API)
    // Can run in parallel since it doesn't share the same rate limit
    const participantPromise = (async () => {
      try {
        console.log('  Running Participant Analysis agent...');
        // Add 5 minute timeout for participant agent
        const result = await withTimeout(
          this.runParticipantAgent(transcriptJson),
          5 * 60 * 1000, // 5 minutes
          'Participant Analysis'
        );
        console.log('  ✅ Participant Analysis agent completed');
        await incrementProgress();
        
        // Save participant insight immediately
        try {
          await this.saveIndividualInsight(meetingId, 'participants', result);
          console.log('  💾 Saved Participant Analysis to database');
        } catch (saveErr) {
          console.warn(`  ⚠️ Failed to save Participant Analysis: ${saveErr.message}`);
        }
        
        return { key: 'participants', result, success: true };
      } catch (error) {
        console.error('  ❌ Participant Analysis agent failed:', error.message);
        await incrementProgress();
        return { key: 'participants', result: null, success: false, error: error.message };
      }
    })();

    // Wait for participant agent to complete (text agents already done)
    const participantResult = await participantPromise;

    // NOW run summary agent LAST with all context from other agents
    console.log('  Running Summary agent (using Hugging Face Mistral)...');
    let summaryResult = null;
    try {
      // Prepare context for summary from completed agents
      const contextForSummary = {
        topics: textResults.find(r => r.key === 'topics')?.result || null,
        decisions: textResults.find(r => r.key === 'decisions')?.result || null,
        actionItems: textResults.find(r => r.key === 'action_items')?.result || null,
        sentiment: textResults.find(r => r.key === 'sentiment')?.result || null,
        participants: participantResult.result || null
      };

      const summaryAgent = await this.runTextAgent('summary', transcriptText, contextForSummary);
      console.log('  ✅ Summary agent completed');
      await incrementProgress();
      summaryResult = { key: 'summary', result: summaryAgent, success: true };
      
      // Save summary immediately
      try {
        await this.saveIndividualInsight(meetingId, 'summary', summaryAgent);
        console.log('  💾 Saved Summary to database');
      } catch (saveErr) {
        console.warn(`  ⚠️ Failed to save Summary: ${saveErr.message}`);
      }
    } catch (error) {
      console.error(`  ❌ Summary agent failed: ${error.message}`);
      await incrementProgress();
      summaryResult = { key: 'summary', result: null, success: false, error: error.message };
    }

    // Aggregate results
    const insights = {
      summary: summaryResult?.success && summaryResult.result ? summaryResult.result : null,
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
   * Regenerate ONLY action items and save them (non-destructive to other insights)
   */
  async regenerateActionItemsOnly(meetingId) {
    console.log(`\n🔄 Regenerating action items only for meeting ${meetingId}...`);
    const meetingIdStr = String(meetingId);

    // Check transcript availability
    const transcriptCheck = await this.checkTranscriptAvailable(meetingId);
    if (!transcriptCheck.available) {
      return { success: false, error: transcriptCheck.error || 'Transcript not available' };
    }

    // Load transcript text
    const { transcriptText } = await this.loadDiarizedTranscript(meetingId);
    if (!transcriptText || transcriptText.trim().length < 20) {
      return { success: false, error: 'Transcript too short for action item extraction' };
    }

    // Run action items agent
    let actionItems = [];
    try {
      actionItems = await this.runTextAgent('action_items', transcriptText);
    } catch (err) {
      return { success: false, error: err.message || 'Action items agent failed' };
    }

    // Check if placeholder
    const isPlaceholderActionItems = (list) => {
      return (
        Array.isArray(list) &&
        list.length === 1 &&
        typeof list[0] === 'object' &&
        (list[0].title === 'No action items detected' ||
          list[0].action === 'No action items detected.' ||
          list[0].title === 'No action items detected.')
      );
    };

    if (!Array.isArray(actionItems) || actionItems.length === 0) {
      return { success: false, error: 'No action items identified' };
    }

    const isPlaceholder = isPlaceholderActionItems(actionItems);

    // Save action items to ai_insights table (always save, even placeholder)
    const avgConfidence =
      actionItems.reduce((sum, item) => sum + (item.confidence || 0.8), 0) / actionItems.length;

    await prisma.$transaction(async (tx) => {
      // Remove previous action_items insights
      await tx.aiInsight.deleteMany({
        where: { meetingId: meetingIdStr, insightType: 'action_items' }
      });

      await tx.aiInsight.create({
        data: {
          id: uuidv4(),
          meetingId: meetingIdStr,
          insightType: 'action_items',
          content: JSON.stringify(actionItems),
          confidenceScore: Number(avgConfidence)
        }
      });
    });

    if (isPlaceholder) {
      console.log(`ℹ️ No action items detected for meeting ${meetingId} - saved placeholder`);
      return { success: true, count: 0, placeholder: true };
    }

    console.log(`✅ Regenerated ${actionItems.length} action item(s) for meeting ${meetingId}`);
    return { success: true, count: actionItems.length };
  }

  /**
   * Save individual insight to database immediately (for progressive loading)
   */
  async saveIndividualInsight(meetingId, insightType, result) {
    if (!result) return;

    const meetingIdStr = String(meetingId);
    const { v4: uuidv4 } = require('uuid');

    try {
      // Delete existing insight of this type
      await prisma.aiInsight.deleteMany({
        where: {
          meetingId: meetingIdStr,
          insightType: this._mapInsightTypeToEnum(insightType)
        }
      });

      // Save new insight
      const content = JSON.stringify(result);
      const confidence = this._extractConfidence(insightType, result);

      await prisma.aiInsight.create({
        data: {
          id: uuidv4(),
          meetingId: meetingIdStr,
          insightType: this._mapInsightTypeToEnum(insightType),
          content: content,
          confidenceScore: Number(confidence)
        }
      });
    } catch (error) {
      console.error(`Failed to save ${insightType} insight:`, error.message);
      throw error;
    }
  }

  /**
   * Map insight type to database enum value
   */
  _mapInsightTypeToEnum(insightType) {
    const mapping = {
      'summary': 'summary',
      'decisions': 'decisions',
      'sentiment': 'sentiment',
      'topics': 'topics',
      'action_items': 'action_items',
      'participants': 'other' // participants use 'other' type
    };
    return mapping[insightType] || 'other';
  }

  /**
   * Extract confidence score from result
   */
  _extractConfidence(insightType, result) {
    if (!result) return 0.8;

    switch (insightType) {
      case 'summary':
        return result.confidence || 0.85;
      case 'decisions':
        if (Array.isArray(result)) {
          return result.reduce((sum, d) => sum + (d.confidence || 0.8), 0) / (result.length || 1);
        }
        return 0.8;
      case 'sentiment':
        return result.confidence || 0.8;
      case 'topics':
        return 0.8;
      case 'action_items':
        if (Array.isArray(result)) {
          return result.reduce((sum, item) => sum + (item.confidence || 0.8), 0) / (result.length || 1);
        }
        return 0.8;
      case 'participants':
        return 0.85;
      default:
        return 0.8;
    }
  }

  /**
   * Save insights to database with transaction safety
   */
  async saveInsightsToDatabase(meetingId, insights) {
    console.log('💾 Saving insights to database...');

    // Convert meetingId to string if it's a number (for UUID compatibility)
    const meetingIdStr = String(meetingId);

    // Fetch existing decisions (to keep if new run returns only placeholder)
    let existingDecisionsContent = null;
    let existingDecisionsConfidence = null;
    try {
      const existingDecisionRow = await prisma.aiInsight.findFirst({
        where: { meetingId: meetingIdStr, insightType: 'decisions' },
        orderBy: { createdAt: 'desc' }
      });
      if (existingDecisionRow && existingDecisionRow.content) {
        const parsed = JSON.parse(existingDecisionRow.content);
        if (Array.isArray(parsed)) {
          existingDecisionsContent = parsed;
        } else if (parsed && parsed.decisions && Array.isArray(parsed.decisions)) {
          existingDecisionsContent = parsed.decisions;
        }
        existingDecisionsConfidence = existingDecisionRow.confidenceScore || null;
      }
    } catch (err) {
      console.warn(`Warning: Could not load existing decisions for preservation: ${err.message}`);
    }

    const isPlaceholderDecisions = (list) => {
      return (
        Array.isArray(list) &&
        list.length === 1 &&
        typeof list[0] === 'object' &&
        (list[0].decision === 'No decisions identified.' || list[0].decision === 'No decisions made')
      );
    };

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
        let decisionsToSave = insights.decisions;

        // If new output is placeholder but we have prior good decisions, keep the old ones
        if (isPlaceholderDecisions(insights.decisions) && existingDecisionsContent && !isPlaceholderDecisions(existingDecisionsContent)) {
          console.log('   ⚠️ New decisions are placeholder; preserving previous decisions from DB.');
          decisionsToSave = existingDecisionsContent;
        }

        const content = JSON.stringify(decisionsToSave);
        const avgConfidence =
          decisionsToSave.reduce((sum, d) => sum + (d.confidence || existingDecisionsConfidence || 0.8), 0) /
          decisionsToSave.length;

        await tx.aiInsight.create({
          data: {
            id: uuidv4(),
            meetingId: meetingIdStr,
            insightType: 'decisions',
            content: content,
            confidenceScore: Number(avgConfidence)
          }
        });
        console.log(`   ✅ Saved ${decisionsToSave.length} decision(s)`);
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

      // Helper to check if action items are placeholder
      const isPlaceholderActionItems = (list) => {
        return (
          Array.isArray(list) &&
          list.length === 1 &&
          typeof list[0] === 'object' &&
          (list[0].title === 'No action items detected' ||
            list[0].action === 'No action items detected.' ||
            list[0].title === 'No action items detected.')
        );
      };

      // Save action items (ALWAYS save, even if placeholder)
      if (insights.actionItems && Array.isArray(insights.actionItems) && insights.actionItems.length > 0) {
        const content = JSON.stringify(insights.actionItems);
        const avgConfidence = insights.actionItems.reduce((sum, item) => sum + (item.confidence || 0.8), 0) / insights.actionItems.length;
        const isPlaceholder = isPlaceholderActionItems(insights.actionItems);

        // Save to ai_insights table (for AI insights panel)
        await tx.aiInsight.create({
          data: {
            id: uuidv4(),
            meetingId: meetingIdStr,
            insightType: 'action_items',
            content: content,
            confidenceScore: Number(avgConfidence)
          }
        });

        if (isPlaceholder) {
          console.log(`   ℹ️ No action items detected - saved placeholder message`);
        } else {
          console.log(`   ✅ Saved ${insights.actionItems.length} action item(s) to ai_insights table`);
        }

        // Only sync to action_items table if NOT placeholder
        if (!isPlaceholder) {
          try {
            const meetingIdInt = parseInt(meetingIdStr);

            // Delete existing live action items (they were from partial transcript)
            const deletedCount = await tx.actionItem.deleteMany({
              where: { meetingId: meetingIdInt }
            });
            console.log(`   🔄 Deleted ${deletedCount.count} live action items (replacing with post-meeting regenerated items)`);

            // Insert post-meeting action items
            const ActionItemService = require('./ActionItemService');
            for (const item of insights.actionItems) {
              const canonicalKey = ActionItemService._generateCanonicalKey({
                title: item.action || item.task || item.title || '',
                description: item.description || item.details || '',
                assignee: item.assignee || item.owner || null
              });

              await tx.actionItem.create({
                data: {
                  meetingId: meetingIdInt,
                  title: item.action || item.task || item.title || 'Action item',
                  description: item.description || item.details || '',
                  assignee: item.assignee || item.owner || null,
                  dueDate: item.due_date || item.deadline || null,
                  canonicalKey,
                  confidence: item.confidence || avgConfidence,
                  sourceChunk: null, // Post-meeting analysis, not from a specific chunk
                  status: 'pending',
                  rawData: item,
                  updateHistory: [],
                  firstSeenAt: new Date(),
                  lastSeenAt: new Date()
                }
              });
            }
            console.log(`   ✅ Synced ${insights.actionItems.length} action items to action_items table (post-meeting regeneration)`);
          } catch (syncError) {
            console.error(`   ⚠️ Warning: Failed to sync action items to action_items table: ${syncError.message}`);
            // Don't fail the entire transaction, just log the warning
          }
        } else {
          console.log(`   ⏭️ Skipping action_items table sync (no actionable items found)`);
        }
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
      // Mark meeting as insights generated (if field exists) AND update metadata
      try {
        // Get current metadata first
        const currentMeeting = await tx.meeting.findUnique({
          where: { id: parseInt(meetingIdStr) },
          select: { metadata: true }
        });

        const currentMetadata = currentMeeting?.metadata || {};

        await tx.meeting.update({
          where: { id: parseInt(meetingIdStr) },
          data: {
            aiInsightsGenerated: true, // Type-safe update if field exists in schema
            updatedAt: new Date(),
            metadata: {
              ...currentMetadata,
              aiInsightsStatus: 'completed',
              aiInsightsCompletedAt: new Date().toISOString()
            }
          }
        });
        console.log(`   ✅ Updated meeting metadata (status: completed)`);
      } catch (error) {
        // Fallback for aiInsightsGenerated if it's missing in schema but try validation first
        console.warn(`Note: Type-safe update failed: ${error.message}. Trying partial update...`);
        // Retry just metadata if previous failed (likely due to aiInsightsGenerated)
        try {
          const currentMeeting = await tx.meeting.findUnique({
            where: { id: parseInt(meetingIdStr) },
            select: { metadata: true }
          });
          const currentMetadata = currentMeeting?.metadata || {};

          await tx.meeting.update({
            where: { id: parseInt(meetingIdStr) },
            data: {
              metadata: {
                ...currentMetadata,
                aiInsightsStatus: 'completed',
                aiInsightsCompletedAt: new Date().toISOString()
              }
            }
          });
        } catch (e) {
          console.error(`Failed to update completion status: ${e.message}`);
        }
      }
    });

    console.log('✅ Insights saved to database (transaction completed)');
  }

  /**
   * Main entry point: Generate insights for a meeting
   * @param {number|string} meetingId - The meeting ID
   * @param {boolean} forceRegenerate - If true, skip existence check and always regenerate
   */
  async generateInsights(meetingId, forceRegenerate = false) {
    console.log(`\n🧠 Starting AI insights generation for meeting ${meetingId}...`);
    console.log(`   Meeting ID type: ${typeof meetingId}, value: ${meetingId}`);
    if (forceRegenerate) {
      console.log(`   🔄 Force regeneration mode - will regenerate even if insights exist`);
    }

    const meetingIdInt = parseInt(meetingId, 10);
    if (Number.isNaN(meetingIdInt)) {
      return { success: false, error: `Invalid meetingId: ${meetingId}` };
    }

    const updateMetadataStatus = async (status, errorMessage = null, progress = 0) => {
      try {
        const meetingIdInt = parseInt(meetingId);

        // Always update in-memory status
        activeGenerations.set(meetingIdInt, {
          status,
          progress,
          startTime: status === 'generating' ? new Date() : activeGenerations.get(meetingIdInt)?.startTime || new Date(),
          error: errorMessage
        });
        console.log(`   📝 In-memory status: ${status}, progress: ${progress}%`);

        // Only persist to DB when completed or failed (NOT when generating)
        // This prevents stale "generating" states after backend restarts
        if (status === 'completed' || status === 'failed') {
          const currentMeeting = await prisma.meeting.findUnique({
            where: { id: meetingIdInt },
            select: { metadata: true }
          });
          if (currentMeeting) {
            await prisma.meeting.update({
              where: { id: meetingIdInt },
              data: {
                metadata: {
                  ...(currentMeeting.metadata || {}),
                  aiInsightsStatus: status,
                  aiInsightsError: errorMessage,
                  aiInsightsProgress: progress,
                  aiInsightsStartTime: null // Clear start time on completion/failure
                }
              }
            });
            console.log(`   💾 Persisted status to DB: ${status}`);
          }

          // Clear from in-memory after persisting final state
          if (status === 'completed') {
            activeGenerations.delete(meetingIdInt);
          }
        }
      } catch (metaErr) {
        console.error(`Failed to update insights metadata status (${status}):`, metaErr.message);
      }
    };

    try {
      // Ensure status is set to generating at the start
      await updateMetadataStatus('generating', null, 0);
      console.log(`   Status set to 'generating'`);

      // Only check for existing insights if not forcing regeneration
      if (!forceRegenerate) {
        const existingTypes = await this.getExistingInsightTypes(meetingId);

        // Only skip if ALL core insights exist (not including action_items - those should be regenerated post-meeting)
        const coreInsightsExist = existingTypes.has('summary') &&
          existingTypes.has('decisions') &&
          existingTypes.has('topics') &&
          existingTypes.has('sentiment');

        if (coreInsightsExist) {
          console.log(`ℹ️  Core insights already exist for meeting ${meetingId}`);
          console.log(`   Existing types: ${Array.from(existingTypes).join(', ')}`);

          // Still regenerate action items if they don't exist (post-meeting with complete transcript)
          if (!existingTypes.has('action_items')) {
            console.log(`   📋 Action items missing, will regenerate with complete transcript...`);
            // Continue to generate action items only
          } else {
            console.log(`   Skipping full regeneration (all insights including action items exist)`);
            await updateMetadataStatus('completed', null, 100);
            return { success: true, skipped: true, message: 'All insights already generated' };
          }
        }
      } else {
        console.log(`   🔄 Force regeneration - skipping existence check`);
      }

      // Check if transcript is available
      console.log('🔍 Checking for transcript...');
      const transcriptCheck = await this.checkTranscriptAvailable(meetingId);
      if (!transcriptCheck.available) {
        console.error(`❌ Transcript not available: ${transcriptCheck.error}`);
        console.error(`   This means AI insights cannot be generated.`);
        console.error(`   Please ensure the meeting has been transcribed and the transcript file exists.`);
        await updateMetadataStatus('failed', transcriptCheck.error, 0);
        return { success: false, error: transcriptCheck.error };
      }

      // Load transcript
      console.log('📄 Loading transcript...');
      console.log(`   Transcript path: ${transcriptCheck.transcriptPath}`);
      const { transcriptText, transcriptJson } = await this.loadDiarizedTranscript(meetingId);
      console.log(`✅ Transcript loaded (${transcriptText.length} characters)`);

      // If transcript is effectively empty, bail out with clear status
      if (!transcriptText || transcriptText.trim().length < 20) {
        const msg = `Transcript is empty or too short (${transcriptText.length} chars), cannot generate insights`;
        console.error(`⚠️  ${msg}`);
        await updateMetadataStatus('failed', msg, 0);
        return { success: false, error: msg };
      }

      if (transcriptText.length < 50) {
        console.warn(`⚠️  Transcript is very short (${transcriptText.length} chars), insights may be limited`);
      }

      // Run all agents
      console.log('🤖 Running AI agents...');
      const insights = await this.runAllAgents(meetingId, transcriptText, transcriptJson);
      console.log('✅ All agents completed');

      // Save to database
      console.log('💾 Saving insights to database...');
      try {
        await this.saveInsightsToDatabase(meetingId, insights);
        console.log('✅ Insights saved to database');
      } catch (saveError) {
        console.error(`❌ Failed to save insights to database: ${saveError.message}`);
        // Update status to failed if save fails
        await updateMetadataStatus('failed', `Failed to save insights: ${saveError.message}`, 0);
        throw saveError; // Re-throw to be caught by outer catch
      }

      // Explicitly update status to completed after successful save
      // This ensures status is set even if saveInsightsToDatabase didn't update it
      await updateMetadataStatus('completed', null, 100);

      console.log(`✅ AI insights generation completed for meeting ${meetingId}`);

      // MEETING MEMORY ENGINE: Generate Embeddings
      try {
        console.log(`🧠 [Memory Engine] Starting embedding generation for meeting ${meetingId}...`);
        
        // 1. Embed the full transcript text (chunked automatically)
        if (transcriptText) {
          await MeetingEmbeddingService.embedTranscript(meetingIdInt, transcriptText);
        }

        // 2. Embed the summary and save memory context
        if (insights.summary) {
          const summaryCandidate =
            insights.summary.paragraph_summary ||
            insights.summary.overview ||
            insights.summary.executive_summary ||
            insights.summary.detailed_summary ||
            insights.summary.bullet_summary ||
            insights.summary.summary;

          // Use the best available summary text; fallback to a truncated transcript.
          const summaryText =
            typeof summaryCandidate === 'string' && summaryCandidate.trim()
              ? summaryCandidate.trim()
              : (typeof transcriptText === 'string'
                ? transcriptText.slice(0, 2000).trim()
                : '');
            
          // Get topics list
          const topics = insights.topics ? insights.topics.map(t => typeof t === 'string' ? t : (t.topic || JSON.stringify(t))) : [];
          
          // Get decision list
          const decisions = insights.decisions || [];
          
          // Get participant list
          let participants = [];
          if (Array.isArray(insights.participants)) {
            participants = insights.participants
              .map((p) => (typeof p === 'string' ? p : p?.name))
              .filter(Boolean);
          }

          await MeetingEmbeddingService.generateMemoryContext(
            meetingIdInt,
            summaryText,
            topics,
            decisions,
            participants
          );
        }
        
        console.log(`✅ [Memory Engine] Embeddings successfully generated and stored.`);
      } catch (embError) {
        console.error(`⚠️ [Memory Engine] Failed to generate embeddings:`, embError.message);
        // Non-fatal error, we still consider insights "completed"
      }

      // Send notification that insights are ready
      try {
        const meeting = await prisma.meeting.findUnique({
          where: { id: meetingIdInt },
          include: {
            workspace: {
              select: { name: true }
            }
          }
        });
        
        if (meeting) {
          await NotificationService.notifyInsightsReady(meeting, meeting.workspace?.name);
        }
      } catch (notifError) {
        console.error('  ⚠️ Failed to send insights ready notification:', notifError.message);
      }

      return { success: true, insights };
    } catch (error) {
      console.error(`❌ AI insights generation failed for meeting ${meetingId}:`, error);
      console.error(`   Error stack:`, error.stack);

      // Update metadata to indicate failure
      await updateMetadataStatus('failed', error.message, 0);

      return { success: false, error: error.message };
    }
  }
}

module.exports = new AIInsightsService();
