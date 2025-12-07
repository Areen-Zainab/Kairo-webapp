import { useEffect, useState, useCallback } from 'react';
import { apiService } from '../services/api';

export interface AIInsightsData {
  summary: {
    paragraph: string;
    bullets: string[];
    confidence?: number;
  } | null;
  keyDecisions: Array<{
    decision: string;
    context: string;
    impact: string;
    participants: string[];
    timestamp?: number;
    confidence?: number;
  }>;
  actionItems: Array<{
    item: string;
    assignee?: string;
    dueDate?: string;
    priority?: string;
    confidence?: number;
  }>;
  sentiment: {
    overall: string;
    confidence: number;
    breakdown: {
      positive: number;
      neutral: number;
      negative: number;
    };
  } | null;
  topics: Array<{
    name: string;
    mentions: number;
    sentiment: string;
  }>;
  participants: Array<{
    name: string;
    speakingTime: number | string;
    speakingTimeSeconds?: number;
    engagement: string;
    keyContributions: string[];
    sentiment?: string;
  }>;
  generated: boolean;
}

export const useAIInsights = (meetingId: number | string | null) => {
  const [insights, setInsights] = useState<AIInsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const fetchInsights = useCallback(async () => {
    if (!meetingId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const numericId = typeof meetingId === 'string' ? parseInt(meetingId, 10) : meetingId;
      
      if (isNaN(numericId)) {
        setError('Invalid meeting ID');
        setLoading(false);
        return;
      }

      const response = await apiService.getAIInsights(numericId);

      if (response.data) {
        setInsights(response.data);
      } else if (response.error) {
        setError(response.error);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch AI insights');
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  const regenerateInsights = useCallback(async () => {
    if (!meetingId) return;

    setIsRegenerating(true);
    setError(null);

    try {
      const numericId = typeof meetingId === 'string' ? parseInt(meetingId, 10) : meetingId;
      
      if (isNaN(numericId)) {
        setError('Invalid meeting ID');
        setIsRegenerating(false);
        return;
      }

      const response = await apiService.regenerateAIInsights(numericId);

      if (response.data) {
        // Wait a bit before refetching to allow backend to start processing
        setTimeout(() => {
          fetchInsights();
        }, 2000);
      } else if (response.error) {
        setError(response.error);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to regenerate AI insights');
    } finally {
      setIsRegenerating(false);
    }
  }, [meetingId, fetchInsights]);

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  return {
    insights,
    loading,
    error,
    isRegenerating,
    refetch: fetchInsights,
    regenerate: regenerateInsights,
  };
};
