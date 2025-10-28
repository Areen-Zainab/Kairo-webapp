/**
 * Utility function to compute the real-time status of a meeting
 * @param {Object} meeting - Meeting object with startTime, endTime, and status
 * @returns {string} - The computed status ('scheduled', 'in-progress', 'completed', or original status if cancelled)
 */
function computeMeetingStatus(meeting) {
  const now = new Date();
  
  // Don't modify cancelled or already completed meetings
  if (meeting.status === 'cancelled' || meeting.status === 'completed') {
    return meeting.status;
  }
  
  const startTime = new Date(meeting.startTime);
  const endTime = new Date(meeting.endTime);
  
  // Meeting has ended - set to completed (regardless of current status)
  if (endTime < now) {
    return 'completed';
  }
  
  // Meeting is currently in progress
  if (startTime <= now && now <= endTime) {
    return 'in-progress';
  }
  
  // Meeting is scheduled for the future
  return 'scheduled';
}

/**
 * Apply computeMeetingStatus to an array of meetings
 * @param {Array} meetings - Array of meeting objects
 * @returns {Array} - Array of meetings with computed statuses
 */
function computeMeetingStatuses(meetings) {
  return meetings.map(meeting => ({
    ...meeting,
    computedStatus: computeMeetingStatus(meeting)
  }));
}

module.exports = {
  computeMeetingStatus,
  computeMeetingStatuses
};

