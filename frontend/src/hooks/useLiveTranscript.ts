import { useEffect, useRef, useState, useCallback } from 'react';
import { apiService } from '../services/api';

export interface TranscriptEntry {
  id: string;
  speaker: string;
  text: string;
  timestamp: string;
  chunkIndex: number;
  rawTimestamp: string;
}

export const useLiveTranscript = (meetingId: number | null, pollInterval = 3000) => {
  const [entries, setEntries] = useState<TranscriptEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastTimestampRef = useRef<string | null>(null);
  const intervalRef = useRef<number | null>(null);

  const fetchTranscript = useCallback(async () => {
    if (!meetingId) return;
    setLoading(true);
    setError(null);

    try {
      const response = await apiService.getLiveTranscript(
        meetingId,
        lastTimestampRef.current || undefined
      );

      if (response.data?.entries) {
        const data = response.data;
        
        setEntries((prev) => {
          // Create a map of existing entries by id
          const map = new Map(prev.map((entry) => [entry.id, entry]));
          
          // Add or update new entries
          data.entries.forEach((entry: TranscriptEntry) => {
            map.set(entry.id, entry);
          });
          
          // Convert back to array and sort by chunkIndex
          return Array.from(map.values()).sort((a, b) => a.chunkIndex - b.chunkIndex);
        });

        if (data.latestTimestamp) {
          lastTimestampRef.current = data.latestTimestamp;
        }
      } else if (response.error) {
        setError(response.error);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch transcript');
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  useEffect(() => {
    if (!meetingId) return;
    fetchTranscript();
    intervalRef.current = setInterval(fetchTranscript, pollInterval);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [meetingId, pollInterval, fetchTranscript]);

  return {
    entries,
    loading,
    error,
    refresh: fetchTranscript
  };
};
