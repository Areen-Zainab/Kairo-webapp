"""
Transcript Converter Utility
----------------------------

Converts speaker-diarized transcript JSON files to various formats needed by AI agents.
Provides both text format (for most agents) and structured JSON format (for participant analysis).
"""

from __future__ import annotations

import json
import os
from typing import Dict, Any, List, Optional


def load_diarized_json(diarized_json_path: str) -> Dict[str, Any]:
    """
    Load and parse a speaker-diarized transcript JSON file.
    
    Args:
        diarized_json_path: Path to the transcript_diarized.json file
    
    Returns:
        Dictionary with 'utterances' list and optional 'metadata'
    
    Raises:
        FileNotFoundError: If the file doesn't exist
        json.JSONDecodeError: If the file is not valid JSON
        ValueError: If the JSON structure is invalid
    """
    if not os.path.exists(diarized_json_path):
        raise FileNotFoundError(f"Transcript file not found: {diarized_json_path}")
    
    with open(diarized_json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Validate structure
    if not isinstance(data, dict):
        raise ValueError(f"Invalid JSON structure: expected dict, got {type(data)}")
    
    # Ensure utterances list exists
    if 'utterances' not in data:
        raise ValueError("JSON file missing 'utterances' key")
    
    if not isinstance(data['utterances'], list):
        raise ValueError("'utterances' must be a list")
    
    return data


def convert_diarized_json_to_text(diarized_json_path: str) -> str:
    """
    Convert speaker-diarized JSON to readable text format.
    
    Format:
        [Speaker_0] (0.0s - 5.2s): Text content here...
        [Speaker_1] (5.2s - 12.5s): More text content...
    
    Args:
        diarized_json_path: Path to the transcript_diarized.json file
    
    Returns:
        Formatted text string with speaker labels and timestamps
    """
    data = load_diarized_json(diarized_json_path)
    utterances = data.get('utterances', [])
    
    lines = []
    for utterance in utterances:
        speaker = utterance.get('speaker', 'UNKNOWN')
        text = utterance.get('text', '').strip()
        start_time = utterance.get('start_time', 0.0)
        end_time = utterance.get('end_time', 0.0)
        
        # Format time range
        time_range = f"({start_time:.1f}s - {end_time:.1f}s)"
        
        # Only include non-empty text
        if text:
            lines.append(f"[{speaker}] {time_range}: {text}")
    
    return "\n".join(lines)


def convert_diarized_json_to_simple_text(diarized_json_path: str) -> str:
    """
    Convert speaker-diarized JSON to simple text format without timestamps.
    
    Format:
        Speaker_0: Text content here...
        Speaker_1: More text content...
    
    Args:
        diarized_json_path: Path to the transcript_diarized.json file
    
    Returns:
        Simple text string with speaker labels only
    """
    data = load_diarized_json(diarized_json_path)
    utterances = data.get('utterances', [])
    
    lines = []
    for utterance in utterances:
        speaker = utterance.get('speaker', 'UNKNOWN')
        text = utterance.get('text', '').strip()
        
        if text:
            lines.append(f"{speaker}: {text}")
    
    return "\n".join(lines)


def get_transcript_json(diarized_json_path: str) -> Dict[str, Any]:
    """
    Get the full transcript JSON structure for agents that need structured data.
    
    Args:
        diarized_json_path: Path to the transcript_diarized.json file
    
    Returns:
        Complete transcript JSON dictionary with utterances and metadata
    """
    return load_diarized_json(diarized_json_path)


def get_transcript_text_only(diarized_json_path: str) -> str:
    """
    Get only the text content without speaker labels or timestamps.
    Useful for agents that don't need speaker information.
    
    Args:
        diarized_json_path: Path to the transcript_diarized.json file
    
    Returns:
        Plain text string with all utterances concatenated
    """
    data = load_diarized_json(diarized_json_path)
    utterances = data.get('utterances', [])
    
    texts = []
    for utterance in utterances:
        text = utterance.get('text', '').strip()
        if text:
            texts.append(text)
    
    return " ".join(texts)


def get_speaker_statistics(diarized_json_path: str) -> Dict[str, Any]:
    """
    Calculate basic statistics about speakers in the transcript.
    
    Args:
        diarized_json_path: Path to the transcript_diarized.json file
    
    Returns:
        Dictionary with speaker statistics:
        - speakers: List of unique speaker names
        - total_utterances: Total number of utterances
        - total_duration: Total meeting duration in seconds
        - speaker_counts: Dict mapping speaker to utterance count
        - speaker_durations: Dict mapping speaker to total speaking time in seconds
    """
    data = load_diarized_json(diarized_json_path)
    utterances = data.get('utterances', [])
    
    speakers = set()
    speaker_counts = {}
    speaker_durations = {}
    total_duration = 0.0
    
    for utterance in utterances:
        speaker = utterance.get('speaker', 'UNKNOWN')
        speakers.add(speaker)
        
        # Count utterances
        speaker_counts[speaker] = speaker_counts.get(speaker, 0) + 1
        
        # Calculate duration
        start_time = float(utterance.get('start_time', 0.0))
        end_time = float(utterance.get('end_time', 0.0))
        duration = max(0.0, end_time - start_time)
        
        speaker_durations[speaker] = speaker_durations.get(speaker, 0.0) + duration
        total_duration = max(total_duration, end_time)
    
    return {
        'speakers': sorted(list(speakers)),
        'total_utterances': len(utterances),
        'total_duration': total_duration,
        'speaker_counts': speaker_counts,
        'speaker_durations': speaker_durations
    }


def validate_transcript_json(data: Dict[str, Any]) -> tuple[bool, Optional[str]]:
    """
    Validate that a transcript JSON has the expected structure.
    
    Args:
        data: Dictionary to validate
    
    Returns:
        Tuple of (is_valid, error_message)
        If valid, error_message is None
    """
    if not isinstance(data, dict):
        return False, "Transcript data must be a dictionary"
    
    if 'utterances' not in data:
        return False, "Missing 'utterances' key"
    
    utterances = data.get('utterances', [])
    if not isinstance(utterances, list):
        return False, "'utterances' must be a list"
    
    if len(utterances) == 0:
        return False, "Transcript has no utterances"
    
    # Validate each utterance
    for idx, utterance in enumerate(utterances):
        if not isinstance(utterance, dict):
            return False, f"Utterance {idx} must be a dictionary"
        
        required_fields = ['speaker', 'text', 'start_time', 'end_time']
        for field in required_fields:
            if field not in utterance:
                return False, f"Utterance {idx} missing required field: {field}"
        
        # Validate types
        if not isinstance(utterance.get('text', ''), str):
            return False, f"Utterance {idx} 'text' must be a string"
        
        try:
            float(utterance.get('start_time', 0))
            float(utterance.get('end_time', 0))
        except (ValueError, TypeError):
            return False, f"Utterance {idx} timestamps must be numeric"
    
    return True, None
