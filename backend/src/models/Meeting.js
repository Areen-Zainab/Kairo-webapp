const prisma = require('../lib/prisma');

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
      if (participantIds.length > 0) {
        await tx.meetingParticipant.createMany({
          data: participantIds.map(userId => ({
            meetingId: meeting.id,
            userId,
            role: userId === createdById ? 'host' : 'participant',
            status: 'invited'
          }))
        });
      }

      return meeting;
    });
  }

  /**
   * Get meeting by ID with full details
   */
  static async findById(id) {
    return await prisma.meeting.findUnique({
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

    return await prisma.meeting.findMany({
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
        }
      },
      orderBy: {
        startTime: 'asc'
      }
    });
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

    return await prisma.meeting.findMany({
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
  }

  /**
   * Update meeting
   */
  static async update(id, updates) {
    const { participantIds, ...meetingUpdates } = updates;

    // Convert date strings to Date objects
    if (meetingUpdates.startTime) {
      meetingUpdates.startTime = new Date(meetingUpdates.startTime);
    }
    if (meetingUpdates.endTime) {
      meetingUpdates.endTime = new Date(meetingUpdates.endTime);
    }

    return await prisma.$transaction(async (tx) => {
      // Update meeting
      const meeting = await tx.meeting.update({
        where: { id },
        data: meetingUpdates
      });

      // Update participants if provided
      if (participantIds) {
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
              role: userId === meeting.createdById ? 'host' : 'participant',
              status: 'invited'
            }))
          });
        }
      }

      return meeting;
    });
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
  static async updateStatus(id, status) {
    return await prisma.meeting.update({
      where: { id },
      data: { status }
    });
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

    return await prisma.meeting.findMany({
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

