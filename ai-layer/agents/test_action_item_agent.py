"""
Test script for Action Item Agent with Grok API integration.

Usage:
    # Set environment variable first
    export GROK_API_KEY=your_api_key_here  # Linux/Mac
    set GROK_API_KEY=your_api_key_here     # Windows PowerShell
    $env:GROK_API_KEY="your_api_key_here"  # Windows PowerShell (alternative)

    # Run the test
    python test_action_item_agent.py
"""

import os
import sys
import json
from action_item_agent import ActionItemAgent

# Sample meeting transcript for testing
SAMPLE_TRANSCRIPT = """
Welcome everyone to today's meeting. Let's start by reviewing the project status.

John: I'll update the documentation by Friday. We need to make sure all the API endpoints are documented.

Sarah: Let me handle the user authentication flow. I'll have that ready by next week.

Mike: We should also review the database schema. Let's schedule a follow-up meeting for that.

John: Good point. I'll send out a calendar invite for next Tuesday.

Sarah: Also, we need to deploy the new features to staging. Can someone take care of that?

Mike: I'll take that on. I'll deploy it by end of day tomorrow.

John: Perfect. One more thing - we need to update the README with the new setup instructions.

Sarah: I can do that. I'll update it this week.

Mike: Great. Let's wrap up. Action items are: John updates docs by Friday, Sarah handles auth flow by next week, I deploy to staging tomorrow, and Sarah updates the README this week.
"""


def test_action_item_agent():
    """Test the ActionItemAgent with sample transcript."""
    print("=" * 70)
    print("Testing Action Item Agent")
    print("=" * 70)
    
    # Check if API key is set
    api_key = os.getenv("GROK_API_KEY")
    if api_key:
        print(f"✓ GROK_API_KEY found (length: {len(api_key)} chars)")
        print(f"  Using Grok Cloud API for extraction")
    else:
        print("⚠ GROK_API_KEY not found in environment")
        print("  Will use fallback pattern matching")
    print()
    
    # Initialize agent
    agent = ActionItemAgent()
    print(f"Agent initialized. Using API: {agent.use_api}")
    print()
    
    # Run extraction
    print("Running extraction on sample transcript...")
    print("-" * 70)
    
    try:
        results = agent.run(SAMPLE_TRANSCRIPT)
        
        print(f"\n✓ Extraction completed successfully!")
        print(f"  Found {len(results)} action items\n")
        
        if results:
            print("Extracted Action Items:")
            print("=" * 70)
            for idx, item in enumerate(results, 1):
                print(f"\n{idx}. {item.get('title', 'N/A')}")
                print(f"   Description: {item.get('description', 'N/A')}")
                print(f"   Assignee: {item.get('assignee', 'N/A')}")
                print(f"   Due Date: {item.get('dueDate', 'N/A')}")
                print(f"   Confidence: {item.get('confidence', 'N/A')}")
        else:
            print("No action items found.")
        
        print("\n" + "=" * 70)
        print("\nJSON Output:")
        print(json.dumps(results, indent=2, ensure_ascii=False))
        
        return True
        
    except Exception as e:
        print(f"\n❌ Error during extraction: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_with_custom_transcript(transcript: str):
    """Test with a custom transcript."""
    agent = ActionItemAgent()
    results = agent.run(transcript)
    return results


if __name__ == "__main__":
    success = test_action_item_agent()
    
    # If custom transcript provided as argument
    if len(sys.argv) > 1:
        custom_transcript = " ".join(sys.argv[1:])
        print("\n" + "=" * 70)
        print("Testing with custom transcript:")
        print("-" * 70)
        custom_results = test_with_custom_transcript(custom_transcript)
        print(json.dumps(custom_results, indent=2, ensure_ascii=False))
    
    sys.exit(0 if success else 1)
