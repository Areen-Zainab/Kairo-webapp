const express = require('express');
const ReminderService = require('../services/ReminderService');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/reminders/preferences
 * Get user's reminder preferences
 */
router.get('/preferences', authenticateToken, async (req, res) => {
  try {
    const preferences = await ReminderService.getUserReminderPreferences(req.user.id);
    
    res.json({
      success: true,
      preferences
    });
  } catch (error) {
    console.error('Get reminder preferences error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch reminder preferences' 
    });
  }
});

/**
 * PUT /api/reminders/preferences
 * Update user's reminder preferences
 */
router.put('/preferences', authenticateToken, async (req, res) => {
  try {
    const { enabled, reminderIntervals, quietHoursStart, quietHoursEnd } = req.body;

    // Validate reminder intervals
    if (reminderIntervals && !Array.isArray(reminderIntervals)) {
      return res.status(400).json({
        success: false,
        error: 'reminderIntervals must be an array'
      });
    }

    if (reminderIntervals && reminderIntervals.some(interval => typeof interval !== 'number' || interval < 0)) {
      return res.status(400).json({
        success: false,
        error: 'All reminder intervals must be positive numbers'
      });
    }

    // Validate quiet hours
    if (quietHoursStart !== undefined && quietHoursStart !== null) {
      if (typeof quietHoursStart !== 'number' || quietHoursStart < 0 || quietHoursStart > 23) {
        return res.status(400).json({
          success: false,
          error: 'quietHoursStart must be between 0 and 23'
        });
      }
    }

    if (quietHoursEnd !== undefined && quietHoursEnd !== null) {
      if (typeof quietHoursEnd !== 'number' || quietHoursEnd < 0 || quietHoursEnd > 23) {
        return res.status(400).json({
          success: false,
          error: 'quietHoursEnd must be between 0 and 23'
        });
      }
    }

    const preferences = await ReminderService.updateReminderPreferences(req.user.id, {
      enabled,
      reminderIntervals,
      quietHoursStart,
      quietHoursEnd
    });

    res.json({
      success: true,
      preferences
    });
  } catch (error) {
    console.error('Update reminder preferences error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update reminder preferences' 
    });
  }
});

/**
 * GET /api/reminders/upcoming
 * Get upcoming reminders for the user
 */
router.get('/upcoming', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    
    const upcomingReminders = await ReminderService.getUpcomingReminders(req.user.id, limit);

    res.json({
      success: true,
      reminders: upcomingReminders
    });
  } catch (error) {
    console.error('Get upcoming reminders error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch upcoming reminders' 
    });
  }
});

/**
 * POST /api/reminders/test
 * Test the reminder system (development only)
 */
router.post('/test', authenticateToken, async (req, res) => {
  try {
    // Only allow in development
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        success: false,
        error: 'Test endpoint not available in production'
      });
    }

    const result = await ReminderService.checkAndSendReminders();

    res.json({
      success: true,
      remindersSent: result.remindersSent
    });
  } catch (error) {
    console.error('Test reminders error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to test reminders' 
    });
  }
});

module.exports = router;

