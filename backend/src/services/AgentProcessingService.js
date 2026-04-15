// AgentProcessingService.js
// -------------------------
//
// Node.js wrapper for the Python-based AI agents defined in `ai-layer/agents`.
// This service is intentionally standalone and is NOT yet wired into the
// rest of the system pipeline or any routes.
//
// It exposes async methods:
//   analyzeTranscript(transcriptText) -> Promise<AgentAnalysisResult>   // all agents
//   analyzeTopics(transcriptText)      -> Promise<Array>
//   extractDecisions(transcriptText)   -> Promise<Array>
//   extractActionItems(transcriptText) -> Promise<Array>
//   analyzeSentiment(transcriptText)   -> Promise<Object>
//   summarize(transcriptText)          -> Promise<Object>
//
// Where AgentAnalysisResult has the shape:
// {
//   topics: [...],
//   decisions: [...],
//   action_items: [...],
//   sentiment: {...},
//   summary: {...}
// }

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Venv Python paths (same as TranscriptionService)
const ROOT_VENV_PYTHON_WIN = path.resolve(__dirname, '../../../venv/Scripts/python.exe');
const ROOT_VENV_PYTHON_UNIX = path.resolve(__dirname, '../../../venv/bin/python');

// Path to ai-layer directory (for module execution)
const AI_LAYER_DIR = path.resolve(__dirname, '../../../ai-layer');

class AgentProcessingService {
  constructor() {
    // Check for venv Python first (has all required packages)
    const venvPython = this.getPythonExecutable();
    this.pythonCandidates = venvPython
      ? [venvPython, 'py -3.10', 'python3.10', 'python', 'py']
      : ['py -3.10', 'python3.10', 'python', 'py'];
  }

  /**
   * Get Python executable path (prefer root venv, fallback to system Python)
   * Same logic as TranscriptionService and ModelPreloader
   */
  getPythonExecutable() {
    // Check for root venv Python (Windows)
    if (process.platform === 'win32' && fs.existsSync(ROOT_VENV_PYTHON_WIN)) {
      return ROOT_VENV_PYTHON_WIN;
    }
    // Check for root venv Python (Unix/Mac)
    if (fs.existsSync(ROOT_VENV_PYTHON_UNIX)) {
      return ROOT_VENV_PYTHON_UNIX;
    }
    // Fallback to system Python
    return null;
  }

  /**
   * Internal helper to invoke the Python script with an optional agent key.
   *
   * @param {string} transcriptText
   * @param {string|null} agentKey - e.g. 'topics', 'decisions', 'action_items',
   *                                 'sentiment', 'summary', or null for all.
   * @returns {Promise<any>}
   * @private
   */
  async _runAgents(transcriptText, agentKey = null, context = null) {
    const candidates = this.pythonCandidates.slice();

    return new Promise((resolve, reject) => {
      let attempt = 0;
      const tryOne = () => {
        if (attempt >= candidates.length) {
          return reject(
            new Error(
              'Python not found for agent processing - tried all candidates'
            )
          );
        }

        const cmd = candidates[attempt++];
        // Run as module: python -m agents.run_agents [agentKey]
        // This fixes the relative import error
        const args = agentKey ? ['-m', 'agents.run_agents', agentKey] : ['-m', 'agents.run_agents'];

        // Determine if cmd is a full path or command
        const isFullPath = cmd.includes(path.sep) || (process.platform === 'win32' && cmd.includes('\\'));
        const useShell = isFullPath ? false : (process.platform === 'win32');

        const proc = spawn(cmd, args, {
          cwd: AI_LAYER_DIR, // Set working directory to ai-layer for module resolution
          shell: useShell,
          env: {
            ...process.env,
            AGENT_CONTEXT: context ? JSON.stringify(context) : ''
          }
        });

        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (data) => {
          stdout += data.toString();
        });

        proc.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        proc.on('error', () => {
          // Try the next Python candidate
          tryOne();
        });

        proc.on('close', (code) => {
          if (code === 0) {
            try {
              const trimmed = stdout.trim();
              const parsed = trimmed ? JSON.parse(trimmed) : {};
              resolve(parsed);
            } catch (parseErr) {
              reject(
                new Error(
                  `Failed to parse agent JSON output: ${parseErr.message}`
                )
              );
            }
          } else if (attempt < candidates.length) {
            // Try next candidate
            tryOne();
          } else {
            reject(
              new Error(
                stderr ||
                  `Agent processing script exited with code ${code} and no stderr.`
              )
            );
          }
        });

        // Write transcript to stdin and close
        try {
          proc.stdin.write(transcriptText);
          proc.stdin.end();
        } catch (e) {
          // If we cannot write, try next candidate
          tryOne();
        }
      };

      tryOne();
    });
  }

  /**
   * Run all AI agents on a full transcript string.
   *
   * @param {string} transcriptText - The complete meeting transcript text.
   * @returns {Promise<object>} - Combined result from all agents.
   */
  async analyzeTranscript(transcriptText) {
    if (!transcriptText || typeof transcriptText !== 'string') {
      return {
        topics: [],
        decisions: [],
        action_items: [],
        sentiment: {
          overall: 'neutral',
          positive_score: 0,
          negative_score: 0,
          neutral_score: 1,
          engagement: 'low',
        },
        summary: {
          short_summary: 'No transcript content provided.',
          detailed_summary:
            'The transcript passed to the agent processing service was empty, so no analysis could be performed.',
        },
      };
    }

    return this._runAgents(transcriptText, null);
  }

  /**
   * Run only the topic segmentation agent.
   * @param {string} transcriptText
   * @returns {Promise<Array>}
   */
  async analyzeTopics(transcriptText) {
    return this._runAgents(transcriptText || '', 'topics');
  }

  /**
   * Run only the decision extraction agent.
   * @param {string} transcriptText
   * @returns {Promise<Array>}
   */
  async extractDecisions(transcriptText) {
    return this._runAgents(transcriptText || '', 'decisions');
  }

  /**
   * Run only the action item agent.
   * @param {string} transcriptText
   * @param {object|null} context - Optional context, e.g. { existingActionItems: [...] }
   * @returns {Promise<object>} - Either {enrichments, new_items} (with context) or Array (without)
   */
  async extractActionItems(transcriptText, context = null) {
    return this._runAgents(transcriptText || '', 'action_items', context);
  }

  /**
   * Run only the sentiment analysis agent.
   * @param {string} transcriptText
   * @returns {Promise<Object>}
   */
  async analyzeSentiment(transcriptText) {
    return this._runAgents(transcriptText || '', 'sentiment');
  }

  /**
   * Run only the summary agent (which internally uses other signals).
   * @param {string} transcriptText
   * @returns {Promise<Object>}
   */
  async summarize(transcriptText) {
    return this._runAgents(transcriptText || '', 'summary');
  }
}

module.exports = new AgentProcessingService();


