const prisma = require('../lib/prisma');

const privacyCache = new Map(); // meetingId -> { enabled, intervals }

function normalizeIntervals(intervals) {
  if (!Array.isArray(intervals)) return [];
  return intervals
    .map((i) => ({
      start: i?.start || null,
      end: i?.end || null
    }))
    .filter((i) => !!i.start);
}

class PrivacyModeService {
  static async getState(meetingId) {
    const id = parseInt(meetingId, 10);
    if (Number.isNaN(id)) {
      return { enabled: false, intervals: [] };
    }

    if (privacyCache.has(id)) {
      return privacyCache.get(id);
    }

    const meeting = await prisma.meeting.findUnique({
      where: { id },
      select: { metadata: true }
    });

    const privacy = meeting?.metadata?.privacyMode || {};
    const state = {
      enabled: !!privacy.enabled,
      intervals: normalizeIntervals(privacy.intervals)
    };
    privacyCache.set(id, state);
    return state;
  }

  static async setState(meetingId, enabled) {
    const id = parseInt(meetingId, 10);
    if (Number.isNaN(id)) {
      throw new Error('Invalid meeting ID');
    }

    const meeting = await prisma.meeting.findUnique({
      where: { id },
      select: { metadata: true }
    });

    if (!meeting) {
      throw new Error('Meeting not found');
    }

    const metadata = meeting.metadata || {};
    const privacy = metadata.privacyMode || {};
    const intervals = normalizeIntervals(privacy.intervals);
    const nowIso = new Date().toISOString();

    if (enabled) {
      const last = intervals[intervals.length - 1];
      if (!last || last.end) {
        intervals.push({ start: nowIso, end: null });
      }
    } else {
      const last = intervals[intervals.length - 1];
      if (last && !last.end) {
        last.end = nowIso;
      }
    }

    const nextPrivacy = {
      enabled: !!enabled,
      intervals,
      lastToggledAt: nowIso
    };

    await prisma.meeting.update({
      where: { id },
      data: {
        metadata: {
          ...metadata,
          privacyMode: nextPrivacy
        }
      }
    });

    const state = { enabled: !!enabled, intervals };
    privacyCache.set(id, state);
    return state;
  }

  static async isEnabled(meetingId) {
    const state = await this.getState(meetingId);
    return !!state.enabled;
  }
}

module.exports = PrivacyModeService;
