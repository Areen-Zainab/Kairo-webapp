const prisma = require('../lib/prisma');
const Notification = require('./Notification');
const { computeMeetingStatus } = require('../utils/meetingStatus');
const ModelPreloader = require('../services/ModelPreloader');

class Meeting {
  /**
   * Create a new meeting
   */
  static async create({
    workspaceId,
    title,
    description,
    meetingLink,
    platform,
    location,
    startTime,
    endTime,
    duration,
    meetingType = 'scheduled',
    status = 'scheduled',
    isRecurring = false,
    recurrenceRule,
    createdById,
    agenda,
    notes,
    metadata,
    meetingSource = 'kairo',
    participantIds = []
  }) {
    // Create meeting with participants in a transaction
    return await prisma.$transaction(async (tx) => {
      const meeting = await tx.meeting.create({
        data: {
          workspaceId,
          title,
          description,
          meetingLink,
          platform,
          location,
          startTime: new Date(startTime),
          endTime: new Date(endTime),
          duration,
          meetingType,
          status,
          isRecurring,
          recurrenceRule,
          createdById,
          agenda,
          notes,
          metadata,
          meetingSource
        }
      });

      // Add participants
      const uniqueParticipantIds = Array.from(new Set([...(participantIds || []), createdById]));
      const invitedParticipants = uniqueParticipantIds.filter(id => id !== createdById);
      
      if (uniqueParticipantIds.length > 0) {
        await tx.meetingParticipant.createMany({
          data: uniqueParticipantIds.map(userId => ({
            meetingId: meeting.id,
            userId,
            role: userId === createdById ? 'host' : 'participant',
            status: userId === createdById ? 'accepted' : 'invited'
          }))
        });
      }

      // Send notifications to invited participants (not the creator)
      if (invitedParticipants.length > 0) {
        // Get workspace details for notification
        const workspace = await tx.workspace.findUnique({
          where: { id: workspaceId },
          select: { name: true }
        });

        // Get creator details
        const creator = await tx.user.findUnique({
          where: { id: createdById },
          select: { name: true, email: true }
        });

        const notificationPromises = invitedParticipants.map(async (userId) => {
          try {
            const meetingDateTime = new Date(startTime).toLocaleString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit'
            });

            await Notification.create({
              userId,
              title: 'Meeting Invitation',
              message: `${creator.name || creator.email} invited you to "${title}" on ${meetingDateTime}`,
              type: 'meeting_invitation',
              priority: 'high',
              workspace: workspace?.name,
              actionRequired: true,
              relatedId: `meeting_${meeting.id}`
            });
          } catch (error) {
            console.error(`Error creating notification for user ${userId}:`, error);
            // Don't fail the transaction if notification creation fails
          }
        });

        await Promise.all(notificationPromises);
      }

      // Safety preload for very immediate meetings (fallback - global model should handle most cases)
      // Only preload if meeting starts within 1 minute as extra safety net
      const meetingStartTime = new Date(startTime);
      const now = new Date();
      const timeUntilStart = meetingStartTime.getTime() - now.getTime();
      const isInstantMeeting = status === 'in-progress' && timeUntilStart <= 60 * 1000; // Within 1 minute
      
      if (isInstantMeeting && meetingLink) {
        // Check if global model is available first - skip preload if it is
        if (ModelPreloader.isGlobalModelAvailable()) {
          console.log(`✅ Global model available, skipping safety preload for meeting ${meeting.id}`);
        } else {
          console.log(`🔄 Safety preload for immediate meeting ${meeting.id} (global model unavailable)`);
        // Preload in background (don't await - don't block meeting creation)
        ModelPreloader.preloadModel(meeting.id)
          .then(() => {
              console.log(`✅ Safety preload completed for meeting ${meeting.id}`);
          })
          .catch((error) => {
              console.warn(`⚠️  Safety preload failed (will use global model):`, error.message);
              // Don't fail meeting creation if preload fails - global model will handle it
          });
        }
        
        // DO NOT trigger auto-join for instant meetings - let the route handler handle it
        // This prevents duplicate bot instances when frontend calls the route handler
        // Auto-join is only for scheduled meetings that reach their start time
        if (meetingType !== 'instant') {
          // Only trigger auto-join for scheduled meetings, not instant ones
          const { triggerAutoJoinImmediately } = require('../config/cron');
          triggerAutoJoinImmediately()
            .then((result) => {
              if (result.success && result.triggered > 0) {
                console.log(`✅ Immediate auto-join triggered for meeting ${meeting.id}`);
              }
            })
            .catch((error) => {
              console.warn(`⚠️  Failed to trigger immediate auto-join for meeting ${meeting.id}:`, error.message);
              // Don't fail meeting creation - cron job will handle it
            });
        } else {
          console.log(`ℹ️  Skipping auto-join for instant meeting ${meeting.id} - route handler will handle bot join`);
        }
      }

      return meeting;
    });
  }

  /**
   * Get meeting by ID with full details
   */
  static async findById(id) {
    const meeting = await prisma.meeting.findUnique({
      where: { id },
      include: {
        workspace: {
          select: {
            id: true,
            name: true
          }
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            profilePictureUrl: true
          }
        },
        participants: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                profilePictureUrl: true
              }
            }
          }
        }
      }
    });
    
    if (meeting) {
      meeting.computedStatus = computeMeetingStatus(meeting);
    }
    
    return meeting;
  }

  /**
   * Get all meetings for a workspace
   */
  static async findByWorkspaceId(workspaceId, filters = {}) {
    const where = { workspaceId };

    // Add status filter
    if (filters.status) {
      where.status = filters.status;
    }

    // Add date range filter
    if (filters.startDate) {
      where.startTime = { gte: new Date(filters.startDate) };
    }
    if (filters.endDate) {
      where.endTime = { lte: new Date(filters.endDate) };
    }

    // Add upcoming meetings filter
    if (filters.upcoming) {
      where.startTime = { gte: new Date() };
      where.status = { in: ['scheduled', 'in-progress'] };
    }

    const meetings = await prisma.meeting.findMany({
      where,
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            profilePictureUrl: true
          }
        },
        participants: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                profilePictureUrl: true
              }
            }
          },
          take: 5 // Limit participants in list view
        },
        actionItems: true // Include action items for displaying task counts
      },
      orderBy: {
        startTime: 'asc'
      }
    });

    // Add computed status to each meeting
    return meetings.map(meeting => ({
      ...meeting,
      computedStatus: computeMeetingStatus(meeting)
    }));
  }

  /**
   * Get user's meetings across all workspaces
   */
  static async findByUserId(userId, filters = {}) {
    const where = {
      participants: {
        some: {
          userId
        }
      }
    };

    // Add status filter
    if (filters.status) {
      where.status = filters.status;
    }

    // Add upcoming meetings filter
    if (filters.upcoming) {
      where.startTime = { gte: new Date() };
      where.status = { in: ['scheduled', 'in-progress'] };
    }

    const meetings = await prisma.meeting.findMany({
      where,
      include: {
        workspace: {
          select: {
            id: true,
            name: true
          }
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            profilePictureUrl: true
          }
        },
        participants: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                profilePictureUrl: true
              }
            }
          },
          take: 5
        }
      },
      orderBy: {
        startTime: 'asc'
      }
    });

    // Add computed status to each meeting
    return meetings.map(meeting => ({
      ...meeting,
      computedStatus: computeMeetingStatus(meeting)
    }));
  }

  /**
   * Update meeting
   */
  static async update(id, updates) {
    const { participantIds, updaterId, ...meetingUpdates } = updates;

    // Convert date strings to Date objects
    if (meetingUpdates.startTime) {
      meetingUpdates.startTime = new Date(meetingUpdates.startTime);
    }
    if (meetingUpdates.endTime) {
      meetingUpdates.endTime = new Date(meetingUpdates.endTime);
    }

    const meeting = await prisma.$transaction(async (tx) => {
      // Get existing meeting to check old participants
      const existingMeeting = await tx.meeting.findUnique({
        where: { id },
        include: {
          participants: {
            select: { userId: true }
          }
        }
      });

      if (!existingMeeting) {
        throw new Error('Meeting not found');
      }

      // Update meeting
      const updatedMeeting = await tx.meeting.update({
        where: { id },
        data: meetingUpdates
      });

      // Send notifications to all participants about the update
      const allParticipants = await tx.meetingParticipant.findMany({
        where: { meetingId: id },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      });

      // Get workspace and updater details
      const workspace = await tx.workspace.findUnique({
        where: { id: updatedMeeting.workspaceId },
        select: { name: true }
      });

      // Get updater info (use updaterId if provided, otherwise use creator)
      const updaterUserId = updaterId || updatedMeeting.createdById;
      const updater = await tx.user.findUnique({
        where: { id: updaterUserId },
        select: { name: true, email: true }
      });

      // Determine what changed
      const changes = [];
      if (existingMeeting.title !== updatedMeeting.title) {
        changes.push(`title to "${updatedMeeting.title}"`);
      }
      if (new Date(existingMeeting.startTime).getTime() !== new Date(updatedMeeting.startTime).getTime()) {
        changes.push('start time');
      }
      if (new Date(existingMeeting.endTime).getTime() !== new Date(updatedMeeting.endTime).getTime()) {
        changes.push('end time');
      }
      if (existingMeeting.location !== updatedMeeting.location) {
        changes.push('location');
      }
      if (existingMeeting.meetingLink !== updatedMeeting.meetingLink) {
        changes.push('meeting link');
      }
      if (existingMeeting.description !== updatedMeeting.description) {
        changes.push('description');
      }

      let notificationMessage = '';
      if (changes.length > 0) {
        notificationMessage = `updated the ${changes.join(', ')}`;
      } else {
        notificationMessage = 'made updates to the meeting';
      }

      // Send notifications to all participants (except the updater)
      const notificationPromises = allParticipants
        .filter(p => p.user.id !== updaterUserId)
        .map(async (participant) => {
          try {
            await Notification.create({
              userId: participant.user.id,
              title: 'Meeting Updated',
              message: `${updater.name || updater.email} ${notificationMessage}: "${updatedMeeting.title}"`,
              type: 'meeting_updated',
              priority: 'medium',
              workspace: workspace?.name,
              actionRequired: false,
              relatedId: `meeting_${id}`
            });
          } catch (error) {
            console.error(`Error creating notification for user ${participant.user.id}:`, error);
          }
        });

      await Promise.all(notificationPromises);

      // Update participants if provided
      if (participantIds) {
        const existingUserIds = existingMeeting.participants.map(p => p.userId);
        const newParticipantIds = participantIds.filter(id => !existingUserIds.includes(id));
        const invitedParticipants = newParticipantIds.filter(userId => userId !== updatedMeeting.createdById);
        
        // Remove existing participants
        await tx.meetingParticipant.deleteMany({
          where: { meetingId: id }
        });

        // Add new participants
        if (participantIds.length > 0) {
          await tx.meetingParticipant.createMany({
            data: participantIds.map(userId => ({
              meetingId: id,
              userId,
              role: userId === updatedMeeting.createdById ? 'host' : 'participant',
              status: userId === updatedMeeting.createdById ? 'accepted' : 'invited'
            }))
          });
        }

        // Send notifications to newly invited participants
        if (invitedParticipants.length > 0) {
          const meetingDateTime = new Date(updatedMeeting.startTime).toLocaleString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
          });

          const newInvitePromises = invitedParticipants.map(async (userId) => {
            try {
              await Notification.create({
                userId,
                title: 'Meeting Invitation',
                message: `${updater.name || updater.email} invited you to "${updatedMeeting.title}" on ${meetingDateTime}`,
                type: 'meeting_invitation',
                priority: 'high',
                workspace: workspace?.name,
                actionRequired: true,
                relatedId: `meeting_${id}`
              });
            } catch (error) {
              console.error(`Error creating notification for user ${userId}:`, error);
            }
          });

          await Promise.all(newInvitePromises);
        }
      }

      return updatedMeeting;
    });

    // Add computed status
    meeting.computedStatus = computeMeetingStatus(meeting);
    
    return meeting;
  }

  /**
   * Delete meeting
   */
  static async delete(id) {
    return await prisma.meeting.delete({
      where: { id }
    });
  }

  /**
   * Update meeting status
   */
  static async updateStatus(id, status, updaterId = null) {
    const meeting = await prisma.$transaction(async (tx) => {
      // Get existing meeting
      const existingMeeting = await tx.meeting.findUnique({
        where: { id },
        include: {
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true
                }
              }
            }
          },
          workspace: {
            select: {
              name: true
            }
          }
        }
      });

      if (!existingMeeting) {
        throw new Error('Meeting not found');
      }

      const statusChanged = existingMeeting.status !== status;

      // Update status
      const updatedMeeting = await tx.meeting.update({
        where: { id },
        data: { status }
      });

      // Skip notifications if status did not change (idempotent PATCH) or if completion
      // is handled by NotificationService.notifyMeetingEnded in the status route (bulk workspace).
      if (!statusChanged) {
        return updatedMeeting;
      }

      if (status === 'completed') {
        return updatedMeeting;
      }

      // Determine status change message
      let statusMessage = '';
      switch (status) {
        case 'cancelled':
          statusMessage = 'cancelled';
          break;
        case 'in-progress':
          statusMessage = 'is now in progress';
          break;
        case 'scheduled':
          statusMessage = 'has been rescheduled';
          break;
        default:
          statusMessage = `status changed to ${status}`;
      }

      // Get updater info
      const updaterUserId = updaterId || existingMeeting.createdById;
      const updater = await tx.user.findUnique({
        where: { id: updaterUserId },
        select: { name: true, email: true }
      });

      // Send notifications to all participants (except the updater)
      const notificationPromises = existingMeeting.participants
        .filter(p => p.user.id !== updaterUserId)
        .map(async (participant) => {
          try {
            await Notification.create({
              userId: participant.user.id,
              title: 'Meeting Status Updated',
              message: `${updater.name || updater.email} ${statusMessage} the meeting "${existingMeeting.title}"`,
              type: 'meeting_status_changed',
              priority: status === 'cancelled' ? 'high' : 'medium',
              workspace: existingMeeting.workspace?.name,
              actionRequired: status === 'cancelled',
              relatedId: `meeting_${id}`
            });
          } catch (error) {
            console.error(`Error creating notification for user ${participant.user.id}:`, error);
          }
        });

      await Promise.all(notificationPromises);

      return updatedMeeting;
    });

    return meeting;
  }

  /**
   * Update participant status
   */
  static async updateParticipantStatus(meetingId, userId, status, responseTime = new Date()) {
    return await prisma.meetingParticipant.update({
      where: {
        meetingId_userId: {
          meetingId,
          userId
        }
      },
      data: {
        status,
        responseTime
      }
    });
  }

  /**
   * Record participant join time
   */
  static async recordParticipantJoin(meetingId, userId) {
    return await prisma.meetingParticipant.update({
      where: {
        meetingId_userId: {
          meetingId,
          userId
        }
      },
      data: {
        joinedAt: new Date(),
        status: 'attended'
      }
    });
  }

  /**
   * Record participant leave time
   */
  static async recordParticipantLeave(meetingId, userId) {
    return await prisma.meetingParticipant.update({
      where: {
        meetingId_userId: {
          meetingId,
          userId
        }
      },
      data: {
        leftAt: new Date()
      }
    });
  }

  /**
   * Get upcoming meetings for a workspace
   */
  static async getUpcomingMeetings(workspaceId, limit = 10) {
    return await this.findByWorkspaceId(workspaceId, {
      upcoming: true
    }).then(meetings => meetings.slice(0, limit));
  }

  /**
   * Get meetings happening today for a workspace
   */
  static async getTodaysMeetings(workspaceId) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const meetings = await prisma.meeting.findMany({
      where: {
        workspaceId,
        startTime: {
          gte: startOfDay,
          lte: endOfDay
        },
        status: { in: ['scheduled', 'in-progress'] }
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            profilePictureUrl: true
          }
        },
        participants: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                profilePictureUrl: true
              }
            }
          }
        }
      },
      orderBy: {
        startTime: 'asc'
      }
    });

    // Add computed status to each meeting
    return meetings.map(meeting => ({
      ...meeting,
      computedStatus: computeMeetingStatus(meeting)
    }));
  }

  /**
   * Get meeting statistics for a workspace
   */
  static async getStatistics(workspaceId, startDate, endDate) {
    const where = { workspaceId };
    
    if (startDate && endDate) {
      where.startTime = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    const total = await prisma.meeting.count({ where });
    const completed = await prisma.meeting.count({ 
      where: { ...where, status: 'completed' } 
    });
    const cancelled = await prisma.meeting.count({ 
      where: { ...where, status: 'cancelled' } 
    });
    const upcoming = await prisma.meeting.count({
      where: {
        ...where,
        startTime: { gte: new Date() },
        status: 'scheduled'
      }
    });

    return {
      total,
      completed,
      cancelled,
      upcoming
    };
  }
}

module.exports = Meeting;

