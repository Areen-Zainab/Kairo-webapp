import type { MemorySearchHit } from '../components/workspace/memory/types';

const PREFIX = 'kairo.memorySearch.v1';
const TTL_MS = 45 * 60 * 1000;

export function persistWorkspaceMemorySearch(
  workspaceId: number,
  query: string,
  hits: MemorySearchHit[]
): void {
  try {
    sessionStorage.setItem(
      `${PREFIX}.${workspaceId}`,
      JSON.stringify({ query: query.trim(), hits, ts: Date.now() })
    );
  } catch {
    /* ignore quota / private mode */
  }
}

export function loadWorkspaceMemorySearch(workspaceId: number): {
  query: string;
  hits: MemorySearchHit[];
} | null {
  try {
    const raw = sessionStorage.getItem(`${PREFIX}.${workspaceId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { query?: string; hits?: MemorySearchHit[]; ts?: number };
    if (Date.now() - (parsed.ts || 0) > TTL_MS) return null;
    if (typeof parsed.query !== 'string' || !Array.isArray(parsed.hits)) return null;
    return { query: parsed.query, hits: parsed.hits };
  } catch {
    return null;
  }
}

export function clearWorkspaceMemorySearch(workspaceId: number): void {
  try {
    sessionStorage.removeItem(`${PREFIX}.${workspaceId}`);
  } catch {
    /* ignore */
  }
}
