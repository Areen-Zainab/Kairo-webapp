"""
run_agents.py
-------------

Entry point for running all Kairo AI-layer agents over a single transcript.

This script is designed to be invoked from Node.js. It reads the full
transcript from STDIN (or JSON file path for participant agent) and prints 
a single line of JSON containing the outputs of all agents.

For participant analysis, if a JSON file path is provided as second argument,
it will use that instead of text transcript.
"""

from __future__ import annotations

import json
import sys
import os
from typing import Any, Dict

# Add the agents directory to the path so we can import modules
# This allows the script to work when run directly (not as a module)
_agents_dir = os.path.dirname(os.path.abspath(__file__))
if _agents_dir not in sys.path:
    sys.path.insert(0, _agents_dir)

# Local imports (this file lives alongside the agent modules)
# Try relative imports first (for module execution), fallback to absolute (for direct execution)
try:
    # Relative imports (when run as: python -m agents.run_agents)
    from .topic_segmentation_agent import TopicSegmentationAgent
    from .decision_extraction_agent import DecisionExtractionAgent
    from .action_item_agent import ActionItemAgent
    from .sentiment_analysis_agent import SentimentAnalysisAgent
    from .summary_agent import SummaryAgent
    from .participant_analysis_agent import ParticipantAnalysisAgent
except ImportError:
    # Absolute imports (when run directly: python run_agents.py)
    from topic_segmentation_agent import TopicSegmentationAgent
    from decision_extraction_agent import DecisionExtractionAgent
    from action_item_agent import ActionItemAgent
    from sentiment_analysis_agent import SentimentAnalysisAgent
    from summary_agent import SummaryAgent
    from participant_analysis_agent import ParticipantAnalysisAgent


def run_all(transcript: str, transcript_json: Dict[str, Any] | None = None) -> Dict[str, Any]:
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
    
    # Run participant agent if JSON transcript is provided (before summary)
    participants = None
    if transcript_json:
        participant_agent = ParticipantAnalysisAgent()
        participants = participant_agent.run(transcript_json)
    
    # Generate summary with all context including participants
    summary = summary_agent.run(
        transcript,
        topic_segments=topics,
        decisions=decisions,
        action_items=actions,
        sentiment=sentiment,
        participants=participants,
    )

    result = {
        "topics": topics,
        "decisions": decisions,
        "action_items": actions,
        "sentiment": sentiment,
        "summary": summary,
    }

    # Add participants to result if available
    if participants:
        result["participants"] = participants

    return result


def main() -> None:
    """
    CLI:
      python run_agents.py                    # run all text-based agents
      python run_agents.py <json_file_path>   # run participant agent with JSON file
      python run_agents.py topics             # run only topic segmentation
      python run_agents.py decisions          # run only decision extraction
      python run_agents.py action_items       # run only action item extraction
      python run_agents.py sentiment          # run only sentiment analysis
      python run_agents.py summary            # run only summary (internally calls others)
      python run_agents.py participants <json> # run only participant analysis
    """
    # Check if first arg is a file path (for participant agent)
    transcript_json = None
    agent_key = None
    
    if len(sys.argv) > 1:
        first_arg = sys.argv[1]
        # Check if it's a file path (ends with .json or exists as file)
        if first_arg.endswith('.json') or os.path.isfile(first_arg):
            # Load JSON file for participant agent
            with open(first_arg, 'r', encoding='utf-8') as f:
                transcript_json = json.load(f)
            # Check if second arg specifies which agent
            if len(sys.argv) > 2:
                agent_key = sys.argv[2]
        else:
            # It's an agent key
            agent_key = first_arg

    # Read transcript text from stdin (if not using JSON file)
    if not transcript_json:
        data = sys.stdin.read()
        transcript = data.strip()
    else:
        # For participant agent, we still need text format for other agents
        # But participant agent will use JSON
        data = sys.stdin.read()
        transcript = data.strip() if data.strip() else ""

    # If only participant agent requested and JSON provided
    if agent_key == "participants" and transcript_json:
        participant_agent = ParticipantAnalysisAgent()
        result = participant_agent.run(transcript_json)
    elif transcript_json:
        # Run all agents including participant
        full_result = run_all(transcript, transcript_json)
        if agent_key:
            result = full_result.get(agent_key)
        else:
            result = full_result
    else:
        # Run text-based agents only
        full_result = run_all(transcript, None)
        if agent_key:
            result = full_result.get(agent_key)
        else:
            result = full_result

    json_output = json.dumps(result, ensure_ascii=False)
    sys.stdout.write(json_output + "\n")
    sys.stdout.flush()


if __name__ == "__main__":
    main()



