import type { MeetingMinute } from '../components/meetings/details/types';
import type { AIInsightsData } from '../hooks/useAIInsights';
import type { TranscriptEntry, MeetingNote } from '../components/meetings/details/types';

// Simple UUID generator (no external dependency)
const generateId = (): string => {
  return `minute_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Generate meeting minutes from AI insights, transcript, and notes.
 * This is a pure function that doesn't affect any existing workflow.
 */
export function generateMeetingMinutesFromInsights(
  insights: AIInsightsData | null,
  transcript: TranscriptEntry[],
  notes: MeetingNote[]
): MeetingMinute[] {
  const minutes: MeetingMinute[] = [];

  if (!insights || !insights.generated) {
    return minutes;
  }

  // Helper to extract keywords from text for searching transcript
  const extractKeywords = (text: string | null | undefined): string[] => {
    if (!text || typeof text !== 'string') return [];
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3); // Only meaningful words
    return words.slice(0, 5); // Top 5 keywords
  };

  // Helper to find timestamp in transcript for a given text with improved accuracy
  const findTimestamp = (
    searchText: string | null | undefined,
    category: string,
    additionalContext?: string
  ): number => {
    if (!transcript || transcript.length === 0) return 0;
    if (!searchText || typeof searchText !== 'string') return 0;

    const keywords = extractKeywords(searchText);
    if (keywords.length === 0) return 0;

    // Also extract keywords from additional context if provided
    const contextKeywords = additionalContext ? extractKeywords(additionalContext) : [];
    const allKeywords = [...keywords, ...contextKeywords];

    // Score each transcript entry based on keyword matches
    // Higher score = more likely to be the correct location
    let bestMatch: { entry: TranscriptEntry; score: number } | null = null;

    for (const entry of transcript) {
      if (!entry.text || typeof entry.text !== 'string') continue;
      
      const entryText = entry.text.toLowerCase();
      let score = 0;

      // Count how many keywords match
      const matchingKeywords = allKeywords.filter(kw => entryText.includes(kw));
      score += matchingKeywords.length * 2; // Weight keyword matches

      // Bonus for matching multiple keywords (more specific match)
      if (matchingKeywords.length >= 2) {
        score += 3;
      }
      if (matchingKeywords.length >= 3) {
        score += 5;
      }

      // Category-specific bonuses
      if (category === 'decision') {
        const decisionWords = ['decided', 'agreed', 'approved', 'concluded', 'resolved', 'chose'];
        if (decisionWords.some(word => entryText.includes(word))) {
          score += 2;
        }
      } else if (category === 'action-item') {
        const actionWords = ['will', 'need to', 'action', 'task', 'todo', 'assign', 'responsible'];
        if (actionWords.some(word => entryText.includes(word))) {
          score += 2;
        }
      }

      // Prefer entries with higher scores
      if (score > 0 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { entry, score };
      }
    }

    // If we found a good match (score >= 3), use it
    if (bestMatch && bestMatch.score >= 3) {
      return bestMatch.entry.timestamp || bestMatch.entry.startTime || 0;
    }

    // Fallback: if we have any match, use it (even if score is low)
    if (bestMatch) {
      return bestMatch.entry.timestamp || bestMatch.entry.startTime || 0;
    }

    // Last resort: return 0 (no timestamp found)
    return 0;
  };

  // Helper to extract speakers discussing a topic
  const extractSpeakersForTopic = (topicName: string | null | undefined, transcript: TranscriptEntry[]): string[] => {
    const speakers = new Set<string>();
    if (!topicName || typeof topicName !== 'string') return [];
    
    const keywords = extractKeywords(topicName);
    if (keywords.length === 0) return [];

    for (const entry of transcript) {
      if (!entry.text || typeof entry.text !== 'string') continue;
      const entryText = entry.text.toLowerCase();
      if (keywords.some(kw => entryText.includes(kw))) {
        if (entry.speaker && entry.speaker !== 'Unknown') {
          speakers.add(entry.speaker);
        }
      }
    }

    return Array.from(speakers);
  };

  // Helper to infer priority from impact or text
  const inferPriority = (impact?: string, text?: string): 'high' | 'medium' | 'low' => {
    const combined = `${impact || ''} ${text || ''}`.toLowerCase();
    if (combined.includes('high') || combined.includes('critical') || combined.includes('urgent')) {
      return 'high';
    }
    if (combined.includes('low') || combined.includes('minor')) {
      return 'low';
    }
    return 'medium';
  };

  // Helper to extract title from content
  const extractTitle = (content: string | null | undefined, maxLength = 60): string => {
    if (!content || typeof content !== 'string') return 'Untitled';
    const sentences = content.split(/[.!?]/).filter(s => s.trim().length > 0);
    if (sentences.length > 0) {
      const firstSentence = sentences[0].trim();
      return firstSentence.length > maxLength
        ? firstSentence.substring(0, maxLength - 3) + '...'
        : firstSentence;
    }
    return content.substring(0, maxLength);
  };

  // 1. Convert Decisions to Meeting Minutes
  if (insights.keyDecisions && insights.keyDecisions.length > 0) {
    insights.keyDecisions.forEach((decision) => {
      // Skip if decision text is missing
      if (!decision.decision || typeof decision.decision !== 'string') return;
      
      // Use provided timestamp if available, otherwise search transcript
      // Use both decision text and context for better matching
      const searchText = decision.decision;
      const contextText = decision.context || '';
      const timestamp = decision.timestamp || findTimestamp(searchText, 'decision', contextText);
      
      minutes.push({
        id: generateId(),
        title: decision.decision,
        content: `${decision.context || ''}\n\nImpact: ${decision.impact || ''}`,
        timestamp: timestamp,
        category: 'decision',
        participants: decision.participants || [],
        priority: inferPriority(decision.impact),
        aiGenerated: true
      });
    });
  }

  // 2. Convert Action Items to Meeting Minutes
  if (insights.actionItems && insights.actionItems.length > 0) {
    insights.actionItems.forEach((item) => {
      // Skip if item text is missing or invalid
      if (!item.title || typeof item.title !== 'string') return;
      
      // Skip placeholder action items
      if (item.title === 'No action items detected.' || item.title === 'No action items detected') {
        return;
      }

      // Use description as additional context for better timestamp matching
      const searchText = item.title;
      const descriptionText = item.description || '';
      const timestamp = findTimestamp(searchText, 'action-item', descriptionText);
      const participants = item.assignee ? [item.assignee] : [];
      
      minutes.push({
        id: generateId(),
        title: item.title,
        content: item.description || item.title,
        timestamp: timestamp,
        category: 'action-item',
        participants: participants,
        priority: 'medium',
        aiGenerated: true
      });
    });
  }

  // 3. Convert Topics to Discussion Minutes
  if (insights.topics && insights.topics.length > 0) {
    insights.topics.forEach((topic) => {
      // Skip if topic name is missing or invalid
      if (!topic.name || typeof topic.name !== 'string') return;
      
      const timestamp = findTimestamp(topic.name, 'discussion');
      const participants = extractSpeakersForTopic(topic.name, transcript);
      
      minutes.push({
        id: generateId(),
        title: `Discussion: ${topic.name}`,
        content: `Discussed ${topic.name}${topic.mentions > 1 ? ` (${topic.mentions} mentions)` : ''}${topic.sentiment ? ` - ${topic.sentiment} sentiment` : ''}`,
        timestamp: timestamp,
        category: 'discussion',
        participants: participants,
        priority: 'low',
        aiGenerated: true
      });
    });
  }

  // 4. Convert Notes to Follow-up Minutes
  if (notes && notes.length > 0) {
    notes.forEach((note) => {
      // Skip if note is missing required fields
      if (!note || !note.id || !note.content) return;
      
      const title = extractTitle(note.content);
      const authorName = note.author?.name || 'Unknown';
      
      minutes.push({
        id: note.id,
        title: title,
        content: note.content,
        timestamp: note.timestamp || 0,
        category: 'follow-up',
        participants: [authorName],
        priority: 'medium',
        aiGenerated: false
      });
    });
  }

  // Sort by timestamp
  return minutes.sort((a, b) => a.timestamp - b.timestamp);
}
