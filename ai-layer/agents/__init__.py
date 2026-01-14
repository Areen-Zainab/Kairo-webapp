"""
Lightweight agent interfaces for Kairo's AI layer.

These agents are intentionally simple and synchronous for now so they can be
invoked easily from Node.js via a single Python entrypoint.

Each agent exposes a `run` method that accepts a full meeting transcript
(string) and returns structured JSON-serializable Python objects.
"""

from .topic_segmentation_agent import TopicSegmentationAgent
from .decision_extraction_agent import DecisionExtractionAgent
from .action_item_agent import ActionItemAgent
from .sentiment_analysis_agent import SentimentAnalysisAgent
# NOTE: SummaryAgent is NOT imported here to avoid initializing it for every agent
# It should only be imported and used by the summary agent entry point

__all__ = [
    "TopicSegmentationAgent",
    "DecisionExtractionAgent",
    "ActionItemAgent",
    "SentimentAnalysisAgent",
    # "SummaryAgent",  # Excluded to prevent initialization in other agents
]


