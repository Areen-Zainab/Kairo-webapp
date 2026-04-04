/**
 * Optional in-memory TTL cache for Memory Engine read endpoints (context / related).
 * Set MEMORY_CONTEXT_CACHE_TTL_MS > 0 to enable (default 0 = disabled).
 */
const TTL_MS = parseInt(process.env.MEMORY_CONTEXT_CACHE_TTL_MS || "0", 10);

const contextCache = new Map();
const relatedCache = new Map();

function getContext(meetingId) {
  if (TTL_MS <= 0) return null;
  const e = contextCache.get(meetingId);
  if (!e || Date.now() > e.expiresAt) {
    contextCache.delete(meetingId);
    return null;
  }
  return e.value;
}

function setContext(meetingId, value) {
  if (TTL_MS <= 0) return;
  contextCache.set(meetingId, { value, expiresAt: Date.now() + TTL_MS });
}

function getRelated(meetingId, limit) {
  if (TTL_MS <= 0) return null;
  const key = `${meetingId}:${limit}`;
  const e = relatedCache.get(key);
  if (!e || Date.now() > e.expiresAt) {
    relatedCache.delete(key);
    return null;
  }
  return e.value;
}

function setRelated(meetingId, limit, value) {
  if (TTL_MS <= 0) return;
  const key = `${meetingId}:${limit}`;
  relatedCache.set(key, { value, expiresAt: Date.now() + TTL_MS });
}

function invalidateMeeting(meetingId) {
  contextCache.delete(meetingId);
  const id = String(meetingId);
  for (const k of relatedCache.keys()) {
    if (String(k).startsWith(`${id}:`)) relatedCache.delete(k);
  }
}

module.exports = {
  TTL_MS,
  getContext,
  setContext,
  getRelated,
  setRelated,
  invalidateMeeting
};
