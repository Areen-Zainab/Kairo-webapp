import { useState, useEffect } from 'react';
import { apiService } from '../services/api';

interface AIInsights {
    summary: {
        paragraph: string;
        bullets: string[];
        confidence?: number;
    } | null;
    actionItems: Array<{
        id?: number;
        title: string;
        description?: string;
        assignee?: string | null;
        dueDate?: string | null;
        confidence?: number;
    }>;
    keyDecisions: Array<{
        decision: string;
        context?: string;
        impact?: string;
        rationale?: string;
        participants?: string[];
        timestamp?: number | string;
        confidence?: number;
    }>;
    topics: Array<{
        name: string;
        mentions: number;
        sentiment?: string;
    }>;
    sentiment: {
        overall: string;
        confidence?: number;
    } | null;
    participants: any[];
    generated: boolean;
    aiInsightsError?: string | null;
}

export const useLiveAIInsights = (meetingId: string | undefined, pollingInterval: number = 10000) => {
    const [insights, setInsights] = useState<AIInsights | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!meetingId) {
            setLoading(false);
            return;
        }

        const fetchInsights = async () => {
            try {
                const response = await apiService.getAIInsights(parseInt(meetingId));
                setInsights(response.data ?? null);
                setError(null);
            } catch (err: any) {
                console.error('Error fetching AI insights:', err);
                setError(err.message || 'Failed to fetch insights');
            } finally {
                setLoading(false);
            }
        };

        // Initial fetch
        fetchInsights();

        // Poll for updates
        const intervalId = setInterval(fetchInsights, pollingInterval);

        return () => clearInterval(intervalId);
    }, [meetingId, pollingInterval]);

    return { insights, loading, error };
};
