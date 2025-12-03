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

// Path to the Python entrypoint that runs all agents
const AGENT_SCRIPT_PATH = path.resolve(
  __dirname,
  '../../../ai-layer/agents/run_agents.py'
);

class AgentProcessingService {
  constructor() {
    this.pythonCandidates = ['py -3.10', 'python3.10', 'python', 'py'];
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
  async _runAgents(transcriptText, agentKey = null) {
    const scriptPath = AGENT_SCRIPT_PATH;
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
        const args = agentKey ? [scriptPath, agentKey] : [scriptPath];

        const proc = spawn(cmd, args, {
          shell: process.platform === 'win32',
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
   * @returns {Promise<Array>}
   */
  async extractActionItems(transcriptText) {
    return this._runAgents(transcriptText || '', 'action_items');
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


