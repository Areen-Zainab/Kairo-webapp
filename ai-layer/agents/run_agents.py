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
# NOTE: SummaryAgent is imported lazily only when needed to avoid unnecessary initialization
try:
    # Relative imports (when run as: python -m agents.run_agents)
    from .topic_segmentation_agent import TopicSegmentationAgent
    from .decision_extraction_agent import DecisionExtractionAgent
    from .action_item_agent import ActionItemAgent
    from .sentiment_analysis_agent import SentimentAnalysisAgent
    from .participant_analysis_agent import ParticipantAnalysisAgent
    USING_RELATIVE_IMPORTS = True
except ImportError:
    # Absolute imports (when run directly: python run_agents.py)
    from topic_segmentation_agent import TopicSegmentationAgent
    from decision_extraction_agent import DecisionExtractionAgent
    from action_item_agent import ActionItemAgent
    from sentiment_analysis_agent import SentimentAnalysisAgent
    from participant_analysis_agent import ParticipantAnalysisAgent
    USING_RELATIVE_IMPORTS = False


def run_all(transcript: str, transcript_json: Dict[str, Any] | None = None) -> Dict[str, Any]:
    """Run all agents on the given transcript and return a combined dict."""
    topic_agent = TopicSegmentationAgent()
    decision_agent = DecisionExtractionAgent()
    action_agent = ActionItemAgent()
    sentiment_agent = SentimentAnalysisAgent()

    topics = topic_agent.run(transcript)
    decisions = decision_agent.run(transcript)
    actions = action_agent.run(transcript)
    sentiment = sentiment_agent.run(transcript)
    
    # Run participant agent if JSON transcript is provided (before summary)
    participants = None
    if transcript_json:
        participant_agent = ParticipantAnalysisAgent()
        participants = participant_agent.run(transcript_json)
    
    # Import and generate summary ONLY when needed (lazy import to avoid initialization overhead)
    if USING_RELATIVE_IMPORTS:
        from .summary_agent import SummaryAgent
    else:
        from summary_agent import SummaryAgent
    
    summary_agent = SummaryAgent()
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

    # If specific agent requested, run only that agent (not all)
    if agent_key == "topics":
        topic_agent = TopicSegmentationAgent()
        result = topic_agent.run(transcript)
    elif agent_key == "decisions":
        decision_agent = DecisionExtractionAgent()
        result = decision_agent.run(transcript)
    elif agent_key == "action_items":
        action_agent = ActionItemAgent()
        # Read existing action items from AGENT_CONTEXT (same pattern as summary agent)
        context_json = os.getenv('AGENT_CONTEXT', '{}')
        try:
            context = json.loads(context_json) if context_json else {}
        except json.JSONDecodeError:
            context = {}
        existing_items = context.get('existingActionItems') or None
        result = action_agent.run(transcript, existing_items=existing_items)
    elif agent_key == "sentiment":
        sentiment_agent = SentimentAnalysisAgent()
        result = sentiment_agent.run(transcript)
    elif agent_key == "summary":
        # Summary agent should be called with context from already-executed agents
        # Backend passes context via AGENT_CONTEXT environment variable
        # Import SummaryAgent lazily
        if USING_RELATIVE_IMPORTS:
            from .summary_agent import SummaryAgent
        else:
            from summary_agent import SummaryAgent
        
        summary_agent = SummaryAgent()
        
        # Read context from environment variable
        context_json = os.getenv('AGENT_CONTEXT', '{}')
        try:
            context = json.loads(context_json) if context_json else {}
        except json.JSONDecodeError:
            context = {}
        
        # Extract context components
        topics = context.get('topics')
        decisions = context.get('decisions')
        raw_action_items = context.get('actionItems')
        sentiment = context.get('sentiment')
        participants = context.get('participants')

        # Normalize action_items to a flat list — the summary agent always expects a list.
        # The context-aware agent returns {enrichments, new_items}; flatten it here so
        # summary_agent.py never needs to handle dicts.
        if isinstance(raw_action_items, dict):
            action_items = (
                list(raw_action_items.get('new_items') or []) +
                list(raw_action_items.get('enrichments') or [])
            )
        elif isinstance(raw_action_items, list):
            action_items = raw_action_items
        else:
            action_items = []
        
        # Call summary agent with context
        result = summary_agent.run(
            transcript,
            topic_segments=topics,
            decisions=decisions,
            action_items=action_items,
            sentiment=sentiment,
            participants=participants
        )
    elif agent_key == "participants" and transcript_json:
        participant_agent = ParticipantAnalysisAgent()
        result = participant_agent.run(transcript_json)
    elif transcript_json:
        # Run all agents including participant (no specific agent requested)
        full_result = run_all(transcript, transcript_json)
        result = full_result
    else:
        # Run all text-based agents (no specific agent requested)
        full_result = run_all(transcript, None)
        result = full_result

    json_output = json.dumps(result, ensure_ascii=False)
    sys.stdout.write(json_output + "\n")
    sys.stdout.flush()


if __name__ == "__main__":
    main()



