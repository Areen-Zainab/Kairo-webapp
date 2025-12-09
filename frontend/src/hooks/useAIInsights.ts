import { useEffect, useState, useCallback, useRef } from 'react';
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
    id?: number;
    title: string;
    description?: string;
    assignee?: string;
    dueDate?: string;
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
  aiInsightsError?: string | null;
}

export const useAIInsights = (meetingId: number | string | null) => {
  const [insights, setInsights] = useState<AIInsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);

  // Track when generation started to detect stale states
  const [generationStartTime, setGenerationStartTime] = useState<number | null>(null);
  
  // Use ref to store latest fetchInsights to avoid circular dependency
  const fetchInsightsRef = useRef<((silent?: boolean) => Promise<void>) | null>(null);

  // Poll for updates if actively regenerating
  useEffect(() => {
    let pollInterval: ReturnType<typeof setInterval>;
    let staleCheckInterval: ReturnType<typeof setInterval>;

    if (isRegenerating || (generationProgress > 0 && generationProgress < 100)) {
      // Set start time if not set
      if (!generationStartTime) {
        setGenerationStartTime(Date.now());
      }

      pollInterval = setInterval(() => {
        if (fetchInsightsRef.current) {
          fetchInsightsRef.current(true); // silent fetch
        }
      }, 3000);

      // Check for stale state (generating for more than 15 minutes without completion)
      staleCheckInterval = setInterval(() => {
        if (generationStartTime) {
          const ageMs = Date.now() - generationStartTime;
          const STALE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
          
          if (ageMs > STALE_TIMEOUT_MS) {
            console.warn('⚠️ Generation state appears stale (15+ minutes), resetting...');
            setIsRegenerating(false);
            setGenerationProgress(0);
            setGenerationStartTime(null);
            if (fetchInsightsRef.current) {
              fetchInsightsRef.current(false); // Force refresh to get latest state
            }
          }
        }
      }, 30000); // Check every 30 seconds
    } else {
      // Reset start time when not generating
      if (generationStartTime) {
        setGenerationStartTime(null);
      }
    }

    return () => {
      if (pollInterval) clearInterval(pollInterval);
      if (staleCheckInterval) clearInterval(staleCheckInterval);
    };
  }, [isRegenerating, generationProgress, generationStartTime]);

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
        // Surface backend error/status to UI (access before type narrowing)
        const errorMessage = response.data.aiInsightsError;
        if (errorMessage) {
          setError(errorMessage);
        } else {
          setError(null);
        }

        setInsights(response.data);

        // Handle server-side generation status
        if (response.data.generating) {
          setIsRegenerating(true);
          // Reset start time if we're starting fresh
          setGenerationStartTime(prev => prev || Date.now());
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
          setGenerationStartTime(null); // Clear start time
        } else {
          // Neither generating nor generated (e.g. initial state or failed)
          // Server says not generating, so stop local state
          setIsRegenerating(false);
          setGenerationStartTime(null); // Clear start time
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

  // Update ref whenever fetchInsights changes
  useEffect(() => {
    fetchInsightsRef.current = fetchInsights;
  }, [fetchInsights]);

  const regenerateInsights = useCallback(async () => {
    console.log(`🎯 [useAIInsights] regenerateInsights() called`);
    console.log(`   meetingId:`, meetingId);
    console.log(`   meetingId type:`, typeof meetingId);
    console.log(`   meetingId is null/undefined:`, meetingId === null || meetingId === undefined);
    
    if (!meetingId) {
      console.warn(`⚠️ [useAIInsights] Exiting early: meetingId is null/undefined`);
      return;
    }

    console.log(`✅ [useAIInsights] meetingId exists, proceeding...`);
    setIsRegenerating(true);
    setGenerationProgress(0);
    setError(null);

    try {
      const numericId = typeof meetingId === 'string' ? parseInt(meetingId, 10) : meetingId;
      console.log(`   Converted to numericId:`, numericId);

      if (isNaN(numericId)) {
        console.error(`❌ [useAIInsights] Invalid meeting ID (NaN):`, numericId);
        setError('Invalid meeting ID');
        setIsRegenerating(false);
        return;
      }

      console.log(`🔄 [useAIInsights] Calling regenerateAIInsights for meeting ${numericId}`);
      const response = await apiService.regenerateAIInsights(numericId);
      console.log(`📥 [useAIInsights] Response received:`, response);

      if (response.data) {
        // Check if generation was successful
        if (response.data.success === false) {
          // Backend returned error in response.data.error
          setError(response.data.error || 'Failed to regenerate AI insights');
          setIsRegenerating(false);
        } else {
          // Success - backend will report progress via polling
          console.log(`   ✅ Generation started, polling will track progress`);
        }
      } else if (response.error) {
        // API request itself failed
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
