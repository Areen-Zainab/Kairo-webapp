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
   */
  async checkTranscriptAvailable(meetingId) {
    const meetingDir = findMeetingDirectory(meetingId);
    if (!meetingDir) {
      return { available: false, error: 'Meeting directory not found' };
    }

    const transcriptPath = path.join(meetingDir, 'transcript_diarized.json');
    if (!fs.existsSync(transcriptPath)) {
      return { available: false, error: 'Transcript file not found' };
    }

    // Check if file has content
    try {
      const stats = fs.statSync(transcriptPath);
      if (stats.size < 100) {
        return { available: false, error: 'Transcript file is too small or empty' };
      }
    } catch (error) {
      return { available: false, error: `Error checking transcript: ${error.message}` };
    }

    return { available: true, transcriptPath };
  }

  /**
   * Check if insights already exist for a meeting
   */
  async checkInsightsExist(meetingId) {
    try {
      // Convert meetingId to string for VARCHAR comparison
      const meetingIdStr = String(meetingId);
      
      // First check the ai_insights table (Option 2)
      const result = await prisma.$queryRaw`
        SELECT COUNT(*) as count 
        FROM ai_insights 
        WHERE meeting_id = ${meetingIdStr}
      `;
      
      const insightCount = Number(result[0]?.count || 0);
      if (insightCount > 0) {
        return true;
      }

      // Also check the meetings table flag if it exists (Option 1)
      try {
        const meetingResult = await prisma.$queryRaw`
          SELECT ai_insights_generated FROM meetings WHERE id = ${meetingIdStr}
        `;
        if (meetingResult && meetingResult.length > 0 && meetingResult[0].ai_insights_generated) {
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
   */
  async loadDiarizedTranscript(meetingId) {
    const { transcriptPath } = await this.checkTranscriptAvailable(meetingId);
    if (!transcriptPath) {
      throw new Error('Transcript not available');
    }

    // Read JSON file
    const transcriptJson = JSON.parse(fs.readFileSync(transcriptPath, 'utf8'));

    // Convert to text format using Python converter
    const transcriptText = await this.convertJsonToText(transcriptPath);

    return {
      transcriptText,
      transcriptJson,
      transcriptPath
    };
  }

  /**
   * Convert JSON transcript to text format using Python converter
   */
  async convertJsonToText(jsonPath) {
    return new Promise((resolve, reject) => {
      const pythonExe = this.getPythonExecutable();
      const scriptPath = TRANSCRIPT_CONVERTER_PATH;
      
      // Normalize paths for cross-platform compatibility
      const normalizedJsonPath = jsonPath.replace(/\\/g, '/');
      const normalizedScriptDir = path.dirname(scriptPath).replace(/\\/g, '/');

      const proc = spawn(pythonExe, ['-c', `
import sys
import os
sys.path.insert(0, r"${normalizedScriptDir}")
from transcript_converter import convert_diarized_json_to_text
result = convert_diarized_json_to_text(r"${normalizedJsonPath}")
print(result)
      `], {
        shell: process.platform === 'win32',
        cwd: path.dirname(scriptPath),
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
      
      // Normalize paths for cross-platform compatibility
      const normalizedTempPath = tempJsonPath.replace(/\\/g, '/');
      const normalizedScriptDir = path.dirname(scriptPath).replace(/\\/g, '/');

      const proc = spawn(pythonExe, ['-c', `
import sys
import json
import os
sys.path.insert(0, r"${normalizedScriptDir}")
from participant_analysis_agent import ParticipantAnalysisAgent

with open(r"${normalizedTempPath}", 'r', encoding='utf-8') as f:
    transcript_json = json.load(f)

agent = ParticipantAnalysisAgent()
result = agent.run(transcript_json)
print(json.dumps(result, ensure_ascii=False))
      `], {
        shell: process.platform === 'win32',
        cwd: path.dirname(scriptPath),
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
      // Delete existing insights for this meeting
      try {
        await tx.$executeRaw`
          DELETE FROM ai_insights WHERE meeting_id = ${meetingIdStr}
        `;
      } catch (error) {
        console.warn(`Warning: Could not delete existing insights: ${error.message}`);
        // Continue anyway - might be first time generating
      }

      // Save summary
      if (insights.summary) {
        const summaryId = uuidv4();
        const content = JSON.stringify(insights.summary);
        const confidence = insights.summary.confidence || 0.85;
        
        await tx.$executeRaw`
          INSERT INTO ai_insights (id, meeting_id, insight_type, content, confidence_score)
          VALUES (${summaryId}, ${meetingIdStr}, 'summary', ${content}, ${Number(confidence)})
        `;
      }

      // Save decisions
      if (insights.decisions && Array.isArray(insights.decisions) && insights.decisions.length > 0) {
        const decisionsId = uuidv4();
        const content = JSON.stringify(insights.decisions);
        const avgConfidence = insights.decisions.reduce((sum, d) => sum + (d.confidence || 0.8), 0) / insights.decisions.length;
        
        await tx.$executeRaw`
          INSERT INTO ai_insights (id, meeting_id, insight_type, content, confidence_score)
          VALUES (${decisionsId}, ${meetingIdStr}, 'decisions', ${content}, ${Number(avgConfidence)})
        `;
      }

      // Save sentiment
      if (insights.sentiment) {
        const sentimentId = uuidv4();
        const content = JSON.stringify(insights.sentiment);
        const confidence = insights.sentiment.confidence || 0.8;
        
        await tx.$executeRaw`
          INSERT INTO ai_insights (id, meeting_id, insight_type, content, confidence_score)
          VALUES (${sentimentId}, ${meetingIdStr}, 'sentiment', ${content}, ${Number(confidence)})
        `;
      }

      // Save topics
      if (insights.topics && Array.isArray(insights.topics) && insights.topics.length > 0) {
        const topicsId = uuidv4();
        const content = JSON.stringify(insights.topics);
        const avgConfidence = 0.8; // Topics don't have individual confidence
        
        await tx.$executeRaw`
          INSERT INTO ai_insights (id, meeting_id, insight_type, content, confidence_score)
          VALUES (${topicsId}, ${meetingIdStr}, 'topics', ${content}, ${Number(avgConfidence)})
        `;
      }

      // Save participants (use 'other' type since 'participants' is not in enum)
      if (insights.participants && Array.isArray(insights.participants) && insights.participants.length > 0) {
        const participantsId = uuidv4();
        const content = JSON.stringify(insights.participants);
        const avgConfidence = 0.85; // Participants don't have individual confidence
        
        await tx.$executeRaw`
          INSERT INTO ai_insights (id, meeting_id, insight_type, content, confidence_score)
          VALUES (${participantsId}, ${meetingIdStr}, 'other', ${content}, ${Number(avgConfidence)})
        `;
      }

      // Mark meeting as insights generated (if field exists)
      try {
        await tx.$executeRaw`
          UPDATE meetings 
          SET ai_insights_generated = TRUE, updated_at = CURRENT_TIMESTAMP
          WHERE id = ${meetingIdStr}
        `;
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

    try {
      // Check if insights already exist
      const insightsExist = await this.checkInsightsExist(meetingId);
      if (insightsExist) {
        console.log(`ℹ️  Insights already exist for meeting ${meetingId}, skipping generation`);
        return { success: true, skipped: true, message: 'Insights already generated' };
      }

      // Check if transcript is available
      const transcriptCheck = await this.checkTranscriptAvailable(meetingId);
      if (!transcriptCheck.available) {
        console.error(`❌ Transcript not available: ${transcriptCheck.error}`);
        return { success: false, error: transcriptCheck.error };
      }

      // Load transcript
      console.log('📄 Loading transcript...');
      const { transcriptText, transcriptJson } = await this.loadDiarizedTranscript(meetingId);
      console.log(`✅ Transcript loaded (${transcriptText.length} characters)`);

      // Run all agents
      const insights = await this.runAllAgents(transcriptText, transcriptJson);

      // Save to database
      await this.saveInsightsToDatabase(meetingId, insights);

      console.log(`✅ AI insights generation completed for meeting ${meetingId}`);
      return { success: true, insights };
    } catch (error) {
      console.error(`❌ AI insights generation failed for meeting ${meetingId}:`, error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new AIInsightsService();
