"""
run_agents.py
-------------

Entry point for running all Kairo AI-layer agents over a single transcript.

This script is designed to be invoked from Node.js. It reads the full
transcript from STDIN and prints a single line of JSON containing the
outputs of all agents.
"""

from __future__ import annotations

import json
import sys
from typing import Any, Dict

# Local imports (this file lives alongside the agent modules)
from .topic_segmentation_agent import TopicSegmentationAgent
from .decision_extraction_agent import DecisionExtractionAgent
from .action_item_agent import ActionItemAgent
from .sentiment_analysis_agent import SentimentAnalysisAgent
from .summary_agent import SummaryAgent


def run_all(transcript: str) -> Dict[str, Any]:
    """Run all agents on the given transcript and return a combined dict."""
    topic_agent = TopicSegmentationAgent()
    decision_agent = DecisionExtractionAgent()
    action_agent = ActionItemAgent()
    sentiment_agent = SentimentAnalysisAgent()
    summary_agent = SummaryAgent()

    topics = topic_agent.run(transcript)
    decisions = decision_agent.run(transcript)
    actions = action_agent.run(transcript)
    sentiment = sentiment_agent.run(transcript)
    summary = summary_agent.run(
        transcript,
        topic_segments=topics,
        decisions=decisions,
        action_items=actions,
        sentiment=sentiment,
    )

    return {
        "topics": topics,
        "decisions": decisions,
        "action_items": actions,
        "sentiment": sentiment,
        "summary": summary,
    }


def main() -> None:
    """
    CLI:
      python run_agents.py               # run all agents
      python run_agents.py topics        # run only topic segmentation
      python run_agents.py decisions     # run only decision extraction
      python run_agents.py action_items  # run only action item extraction
      python run_agents.py sentiment     # run only sentiment analysis
      python run_agents.py summary       # run only summary (internally calls others)
    """
    # Optional first arg selects a single agent key
    agent_key = sys.argv[1] if len(sys.argv) > 1 else None

    data = sys.stdin.read()
    transcript = data.strip()

    full_result = run_all(transcript)

    if agent_key:
        # Return just the requested portion if it exists
        result: Any = full_result.get(agent_key)
    else:
        result = full_result

    json_output = json.dumps(result, ensure_ascii=False)
    sys.stdout.write(json_output + "\n")
    sys.stdout.flush()


if __name__ == "__main__":
    main()



