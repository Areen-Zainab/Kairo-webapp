const prisma = require('../lib/prisma');
const NotificationService = require('./NotificationService');

/**
 * ReminderService - Manages task deadline reminders
 * 
 * Features:
 * - Schedules reminders for task deadlines
 * - Default reminders: 24h and 1h before deadline
 * - Customizable reminder intervals per user
 * - In-app notification system integration
 */
class ReminderService {
  /**
   * Default reminder intervals (in hours before deadline)
   */
  static DEFAULT_REMINDER_INTERVALS = [24, 1]; // 24h and 1h before

  /**
   * Check for tasks that need reminders and send notifications
   * This should be called by a cron job periodically (e.g., every 15 minutes)
   */
  static async checkAndSendReminders() {
    try {
      console.log('[ReminderService] Checking for tasks needing reminders...');
      
      const now = new Date();
      const remindersToSend = [];

      // Get all tasks with due dates that haven't been completed
      const tasks = await prisma.task.findMany({
        where: {
          dueDate: {
            gte: now, // Only future due dates
          },
          column: {
            name: {
              notIn: ['Done', 'Complete', 'Completed'] // Exclude completed tasks
            }
          }
        },
        include: {
          workspace: {
            include: {
              members: {
                include: {
                  user: true
                }
              }
            }
          },
          column: true
        }
      });

      // Check each task against reminder preferences
      for (const task of tasks) {
        const workspaceMembers = task.workspace.members;
        
        for (const member of workspaceMembers) {
          const userId = member.userId;
          
          // Get user's reminder preferences
          const preferences = await this.getUserReminderPreferences(userId);
          
          if (!preferences.enabled) continue;

          // Skip if currently within user's quiet hours
          if (this._isInQuietHours(preferences.quietHoursStart, preferences.quietHoursEnd)) {
            console.log(`[ReminderService] Skipping user ${userId} — quiet hours active (${preferences.quietHoursStart}–${preferences.quietHoursEnd} UTC)`);
            continue;
          }

          // Check if any reminder interval matches
          for (const interval of preferences.intervals) {
            const reminderTime = new Date(task.dueDate);
            reminderTime.setHours(reminderTime.getHours() - interval);

            // Check if we should send reminder (within 15-minute window)
            const timeDiff = reminderTime.getTime() - now.getTime();
            const fifteenMinutes = 15 * 60 * 1000;

            if (timeDiff > 0 && timeDiff <= fifteenMinutes) {
              // Check if reminder already sent
              const alreadySent = await this.wasReminderSent(task.id, userId, interval);
              
              if (!alreadySent) {
                remindersToSend.push({
                  task,
                  userId,
                  interval,
                  preferences
                });
              }
            }
          }
        }
      }

      // Send all reminders
      console.log(`[ReminderService] Sending ${remindersToSend.length} reminders...`);
      for (const reminder of remindersToSend) {
        await this.sendTaskReminder(reminder);
      }

      return {
        success: true,
        remindersSent: remindersToSend.length
      };
    } catch (error) {
      console.error('[ReminderService] Error checking reminders:', error);
      throw error;
    }
  }

  /**
   * Send a task deadline reminder notification
   */
  static async sendTaskReminder({ task, userId, interval, preferences }) {
    try {
      const timeText = this.formatReminderInterval(interval);
      
      await NotificationService.createNotification({
        userId,
        title: `Task Deadline Reminder: ${task.title}`,
        message: `Your task "${task.title}" is due in ${timeText}${task.assignee ? ` (Assigned to: ${task.assignee})` : ''}`,
        type: 'task_reminder',
        priority: this.getNotificationPriority(interval),
        workspace: task.workspace.name,
        actionRequired: true,
        relatedId: `task_${task.id}`
      });

      // Record that we sent this reminder
      await this.recordReminderSent(task.id, userId, interval);

      console.log(`[ReminderService] Sent reminder for task ${task.id} to user ${userId}`);
    } catch (error) {
      console.error('[ReminderService] Error sending task reminder:', error);
      throw error;
    }
  }

  /**
   * Get user's reminder preferences
   */
  static async getUserReminderPreferences(userId) {
    try {
      let prefs = await prisma.reminderPreferences.findUnique({
        where: { userId }
      });

      // If no preferences exist, create defaults
      if (!prefs) {
        prefs = await this.createDefaultReminderPreferences(userId);
      }

      return {
        enabled: prefs.enabled,
        intervals: prefs.reminderIntervals || this.DEFAULT_REMINDER_INTERVALS,
        quietHoursStart: prefs.quietHoursStart,
        quietHoursEnd: prefs.quietHoursEnd
      };
    } catch (error) {
      console.error('[ReminderService] Error getting reminder preferences:', error);
      // Return defaults on error
      return {
        enabled: true,
        intervals: this.DEFAULT_REMINDER_INTERVALS,
        quietHoursStart: null,
        quietHoursEnd: null
      };
    }
  }

  /**
   * Create default reminder preferences for a user
   */
  static async createDefaultReminderPreferences(userId) {
    try {
      return await prisma.reminderPreferences.create({
        data: {
          userId,
          enabled: true,
          reminderIntervals: this.DEFAULT_REMINDER_INTERVALS,
          quietHoursStart: null,
          quietHoursEnd: null
        }
      });
    } catch (error) {
      console.error('[ReminderService] Error creating default preferences:', error);
      throw error;
    }
  }

  /**
   * Update user's reminder preferences
   */
  static async updateReminderPreferences(userId, preferences) {
    try {
      const existing = await prisma.reminderPreferences.findUnique({
        where: { userId }
      });

      if (existing) {
        return await prisma.reminderPreferences.update({
          where: { userId },
          data: {
            enabled: preferences.enabled !== undefined ? preferences.enabled : existing.enabled,
            reminderIntervals: preferences.reminderIntervals || existing.reminderIntervals,
            quietHoursStart: preferences.quietHoursStart !== undefined ? preferences.quietHoursStart : existing.quietHoursStart,
            quietHoursEnd: preferences.quietHoursEnd !== undefined ? preferences.quietHoursEnd : existing.quietHoursEnd
          }
        });
      } else {
        return await prisma.reminderPreferences.create({
          data: {
            userId,
            enabled: preferences.enabled !== undefined ? preferences.enabled : true,
            reminderIntervals: preferences.reminderIntervals || this.DEFAULT_REMINDER_INTERVALS,
            quietHoursStart: preferences.quietHoursStart || null,
            quietHoursEnd: preferences.quietHoursEnd || null
          }
        });
      }
    } catch (error) {
      console.error('[ReminderService] Error updating preferences:', error);
      throw error;
    }
  }

  /**
   * Check if a reminder was already sent
   */
  static async wasReminderSent(taskId, userId, interval) {
    try {
      const sent = await prisma.sentReminder.findFirst({
        where: {
          taskId,
          userId,
          reminderInterval: interval
        }
      });
      return !!sent;
    } catch (error) {
      console.error('[ReminderService] Error checking sent reminder:', error);
      return false; // Default to not sent on error
    }
  }

  /**
   * Record that a reminder was sent
   */
  static async recordReminderSent(taskId, userId, interval) {
    try {
      await prisma.sentReminder.create({
        data: {
          taskId,
          userId,
          reminderInterval: interval,
          sentAt: new Date()
        }
      });
    } catch (error) {
      console.error('[ReminderService] Error recording sent reminder:', error);
      // Don't throw - this is not critical
    }
  }

  /**
   * Clean up old sent reminder records (older than 30 days)
   */
  static async cleanupOldReminders() {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const result = await prisma.sentReminder.deleteMany({
        where: {
          sentAt: {
            lt: thirtyDaysAgo
          }
        }
      });

      console.log(`[ReminderService] Cleaned up ${result.count} old reminder records`);
      return result;
    } catch (error) {
      console.error('[ReminderService] Error cleaning up old reminders:', error);
      throw error;
    }
  }

  /**
   * Format reminder interval to human-readable text
   */
  static formatReminderInterval(hours) {
    if (hours < 1) {
      const minutes = Math.round(hours * 60);
      return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    } else if (hours < 24) {
      return `${hours} hour${hours !== 1 ? 's' : ''}`;
    } else {
      const days = Math.round(hours / 24);
      return `${days} day${days !== 1 ? 's' : ''}`;
    }
  }

  /**
   * Get notification priority based on reminder interval
   */
  static getNotificationPriority(hours) {
    if (hours <= 1) return 'high';
    if (hours <= 24) return 'medium';
    return 'low';
  }

  /**
   * Get upcoming reminders for a user
   */
  static async getUpcomingReminders(userId, limit = 10) {
    try {
      const now = new Date();
      const preferences = await this.getUserReminderPreferences(userId);

      if (!preferences.enabled) {
        return [];
      }

      // Get user's workspaces
      const workspaces = await prisma.workspaceMember.findMany({
        where: { userId },
        select: { workspaceId: true }
      });

      const workspaceIds = workspaces.map(w => w.workspaceId);

      // Get tasks with upcoming deadlines
      const tasks = await prisma.task.findMany({
        where: {
          workspaceId: {
            in: workspaceIds
          },
          dueDate: {
            gte: now
          },
          column: {
            name: {
              notIn: ['Done', 'Complete', 'Completed']
            }
          }
        },
        include: {
          workspace: true,
          column: true
        },
        orderBy: {
          dueDate: 'asc'
        },
        take: limit
      });

      return tasks.map(task => ({
        taskId: task.id,
        title: task.title,
        dueDate: task.dueDate,
        workspace: task.workspace.name,
        nextReminderIn: this.calculateNextReminderTime(task.dueDate, preferences.intervals)
      }));
    } catch (error) {
      console.error('[ReminderService] Error getting upcoming reminders:', error);
      throw error;
    }
  }

  /**
   * Calculate when the next reminder will be sent
   */
  static calculateNextReminderTime(dueDate, intervals) {
    const now = new Date();
    const dueDateMs = new Date(dueDate).getTime();
    
    for (const interval of intervals.sort((a, b) => b - a)) {
      const reminderTime = new Date(dueDateMs - interval * 60 * 60 * 1000);
      if (reminderTime > now) {
        const hoursUntil = (reminderTime.getTime() - now.getTime()) / (1000 * 60 * 60);
        return this.formatReminderInterval(hoursUntil);
      }
    }
    
    return 'Past due';
  }
  /**
   * Check if the current UTC time falls within the user's configured quiet hours.
   * Handles overnight ranges (e.g. quietHoursStart=22, quietHoursEnd=7).
   *
   * @param {number|null} start - Quiet hours start (UTC hour, 0–23), or null if not set
   * @param {number|null} end   - Quiet hours end   (UTC hour, 0–23), or null if not set
   * @returns {boolean} true if reminders should be suppressed right now
   */
  static _isInQuietHours(start, end) {
    if (start == null || end == null) return false; // not configured — always allow

    const currentHour = new Date().getUTCHours();

    if (start <= end) {
      // Normal range: e.g. 09:00–18:00
      return currentHour >= start && currentHour < end;
    } else {
      // Overnight range: e.g. 22:00–07:00
      return currentHour >= start || currentHour < end;
    }
  }
}

module.exports = ReminderService;

