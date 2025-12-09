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
  generating?: boolean;
  progress?: number;
}

export const useAIInsights = (meetingId: number | string | null) => {
  const [insights, setInsights] = useState<AIInsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);

  // Poll for updates if actively regenerating
  useEffect(() => {
    let pollInterval: ReturnType<typeof setInterval>;

    if (isRegenerating || (generationProgress > 0 && generationProgress < 100)) {
      pollInterval = setInterval(() => {
        fetchInsights(true); // silent fetch
      }, 3000);
    }

    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [isRegenerating, generationProgress]);

  // Optimistic progress simulator
  useEffect(() => {
    let progressInterval: ReturnType<typeof setInterval>;

    if (isRegenerating) {
      if (generationProgress === 0) setGenerationProgress(10); // Start at 10% if fresh

      progressInterval = setInterval(() => {
        setGenerationProgress(prev => {
          // Cap at 90% until actually finished
          if (prev >= 90) return 90;
          // Slow down as we get closer to 90
          const increment = prev < 50 ? 10 : 5;
          return prev + increment;
        });
      }, 2000);
    }

    return () => {
      if (progressInterval) clearInterval(progressInterval);
    };
  }, [isRegenerating]);

  const fetchInsights = useCallback(async (silent = false) => {
    if (!meetingId) {
      setLoading(false);
      return;
    }

    if (!silent) setLoading(true);
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

        // Surface backend error/status to UI
        if (response.data.aiInsightsError) {
          setError(response.data.aiInsightsError);
        } else {
          setError(null);
        }

        // Handle server-side generation status
        if (response.data.generating) {
          setIsRegenerating(true);
          // Use server progress if available
          if (response.data.progress && response.data.progress > 0) {
            setGenerationProgress(response.data.progress);
          } else {
            // Ensure we show some progress if server doesn't have it yet
            setGenerationProgress(prev => prev === 0 || prev === 100 ? 10 : prev);
          }
        } else if (response.data.generated || (response.data.summary && response.data.keyDecisions.length > 0)) {
          // If we found insights and they are fully generated
          setGenerationProgress(100);
          setIsRegenerating(false);
        } else {
          // Neither generating nor generated (e.g. initial state or failed)
          // Don't force setIsRegenerating(false) here if we want to preserve local state, 
          // but usually if server says not generating, we should stop.
          // However, avoid interfering with optimistic start if distinct.
          // But here response.data.generating comes from DB, so it is the source of truth.
          if (!response.data.generating) {
            setIsRegenerating(false);
          }
        }
      } else if (response.error) {
        if (!silent) setError(response.error);
      }
    } catch (err: any) {
      if (!silent) setError(err.message || 'Failed to fetch AI insights');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [meetingId]);

  const regenerateInsights = useCallback(async () => {
    if (!meetingId) return;

    setIsRegenerating(true);
    setGenerationProgress(0);
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
        // Allow the polling effect to take over fetching
        setGenerationProgress(5);
      } else if (response.error) {
        setError(response.error);
        setIsRegenerating(false);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to regenerate AI insights');
      setIsRegenerating(false);
    }
    // Note: We deliberately don't set isRegenerating(false) here on success 
    // because we want the polling/progress state to persist until fetchInsights confirms it's done
  }, [meetingId]);

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  return {
    insights,
    loading,
    error,
    isRegenerating,
    generationProgress,
    refetch: fetchInsights,
    regenerate: regenerateInsights,
  };
};
