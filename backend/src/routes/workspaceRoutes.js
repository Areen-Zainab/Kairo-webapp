const express = require("express");
const prisma = require("../lib/prisma");
const Notification = require("../models/Notification");
const WorkspaceInvite = require("../models/WorkspaceInvite");
const WorkspaceLog = require("../models/WorkspaceLog");
const NotificationService = require("../services/NotificationService");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

// Create workspace
router.post("/", authenticateToken, async (req, res) => {
  try {
    const { name, description, members = [] } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: "Workspace name is required" });
    }

    // Generate unique workspace code in format NAME-1234-XYZ
    const generateCode = (workspaceName) => {
      // Get first word of workspace name only
      const firstWord = workspaceName.split(' ')[0].toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
      
      // Generate random 4-digit number (1000-9999)
      const randomNum = Math.floor(Math.random() * 9000 + 1000).toString();
      
      // Generate random 3 uppercase letters
      const randomLetters = Array.from({ length: 3 }, () => 
        String.fromCharCode(65 + Math.floor(Math.random() * 26))
      ).join('');
      
      return `${firstWord}-${randomNum}-${randomLetters}`;
    };

    let code = generateCode(name);
    
    // Ensure code is unique
    let exists = await prisma.workspace.findUnique({ where: { code } });
    while (exists) {
      code = generateCode(name);
      exists = await prisma.workspace.findUnique({ where: { code } });
    }

    // Generate random color from available palette
    const availableColors = ['#9333ea', '#3b82f6', '#10b981', '#ec4899', '#f97316', '#14b8a6'];
    const randomColor = availableColors[Math.floor(Math.random() * availableColors.length)];

    // Create workspace
    // 1️⃣ You create the workspace and set ownerId
    const workspace = await prisma.workspace.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        code,
        colorTheme: randomColor,
        ownerId: req.user.id,  // <-- assigns the user as the owner
      },
    });

    // 2️⃣ You then add the owner as a member again
    // Add owner as workspace member (only if not already added)
    await prisma.workspaceMember.upsert({
      where: {
        workspaceId_userId: {
          workspaceId: workspace.id,
          userId: req.user.id,
        },
      },
      update: {}, // nothing to update if already exists
      create: {
        workspaceId: workspace.id,
        userId: req.user.id,
        role: 'owner',
      },
    });

    // Create workspace setup notification
    try {
      await Notification.create({
        userId: req.user.id,
        title: "Workspace Created! 🚀",
        message: `Finish setting up your "${workspace.name}" workspace to start collaborating with your team.`,
        type: "workspace",
        priority: "high",
        workspace: workspace.name,
        actionRequired: true,
        relatedId: workspace.id.toString()
      });
    } catch (notifError) {
      console.error("Error creating workspace notification:", notifError);
      // Don't fail the workspace creation if notification creation fails
    }

    // Create default kanban columns for task management
    try {
      const TaskCreationService = require('../services/TaskCreationService');
      await TaskCreationService.ensureDefaultKanbanColumns(workspace.id);
      console.log(`✅ Created default kanban columns for workspace ${workspace.id}`);
    } catch (error) {
      console.error(`⚠️ Failed to create default kanban columns for workspace ${workspace.id}:`, error);
      // Don't fail workspace creation if kanban columns fail
    }

    // Log workspace creation
    try {
      await WorkspaceLog.logWorkspaceCreated(workspace.id, req.user.id, workspace.name);
    } catch (logError) {
      console.error("Error creating workspace log:", logError);
    }

    res.status(201).json({
      message: "Workspace created successfully",
      workspace: {
        id: workspace.id,
        name: workspace.name,
        description: workspace.description,
        code: workspace.code,  // The generated invitation code
        ownerId: workspace.ownerId,
        owner: workspace.owner,
        createdAt: workspace.createdAt,
      }
    });
  } catch (error) {
    console.error("Create workspace error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get user's workspaces
router.get("/", authenticateToken, async (req, res) => {
  try {
    const { includeArchived } = req.query;
    const showArchived = includeArchived === 'true';

    const workspaces = await prisma.workspaceMember.findMany({
      where: {
        userId: req.user.id,
        isActive: true,
        workspace: {
          isActive: true,  // Only return active (not deleted) workspaces
          ...(showArchived ? {} : { isArchived: false })  // Filter out archived unless requested
        }
      },
      include: {
        workspace: {
          include: {
            owner: {
              select: {
                id: true,
                name: true,
                email: true,
              }
            },
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                  }
                }
              }
            }
          }
        }
      },
      orderBy: {
        workspace: {
          createdAt: 'desc'
        }
      }
    });

    const formattedWorkspaces = workspaces.map(wm => ({
      id: wm.workspace.id,
      name: wm.workspace.name,
      description: wm.workspace.description,
      code: wm.workspace.code,
      colorTheme: wm.workspace.colorTheme,
      role: wm.role,
      ownerId: wm.workspace.ownerId,
      owner: wm.workspace.owner,
      memberCount: wm.workspace.members.length,
      createdAt: wm.workspace.createdAt,
      joinedAt: wm.joinedAt,
      isArchived: wm.workspace.isArchived,
      archivedAt: wm.workspace.archivedAt,
    }));

    res.json({ workspaces: formattedWorkspaces });
  } catch (error) {
    console.error("Get workspaces error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ============ USER INVITATION ROUTES (must come before /:id routes) ============

// Get user's pending invitations
router.get("/invites", authenticateToken, async (req, res) => {
  try {
    const invites = await WorkspaceInvite.getPendingInvites(req.user.id);

    res.json({ invites });
  } catch (error) {
    console.error("Get invites error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Accept workspace invitation
router.post("/invites/:inviteId/accept", authenticateToken, async (req, res) => {
  try {
    const { inviteId } = req.params;
    const inviteIdInt = parseInt(inviteId);

    if (!inviteIdInt || isNaN(inviteIdInt)) {
      return res.status(400).json({ error: "Invalid invitation ID" });
    }

    const invite = await WorkspaceInvite.findById(inviteIdInt);

    if (!invite) {
      return res.status(404).json({ error: "Invitation not found" });
    }

    // Verify the invite is for this user
    if (invite.invitedUserId !== req.user.id) {
      return res.status(403).json({ error: "This invitation is not for you" });
    }

    const result = await WorkspaceInvite.accept(inviteIdInt, req.user.id);

    // Update notification to mark as read
    try {
      const notification = await prisma.notification.findFirst({
        where: {
          userId: req.user.id,
          type: 'workspace',
          relatedId: inviteId.toString()
        }
      });

      if (notification) {
        await Notification.markAsRead(notification.id);
      }
    } catch (notifError) {
      console.error("Error updating notification:", notifError);
    }

    // Log invitation acceptance
    try {
      await WorkspaceLog.logInviteAccepted(invite.workspaceId, req.user.id, req.user.name);
    } catch (logError) {
      console.error("Error creating workspace log:", logError);
    }

    res.json({
      message: "Invitation accepted successfully",
      workspace: invite.workspace,
      member: result.member
    });

  } catch (error) {
    console.error("Accept invite error:", error);
    
    if (error.message === 'Invitation not found' || 
        error.message === 'Invitation is no longer pending' ||
        error.message === 'Invitation has expired' ||
        error.message === 'User is already a member of this workspace') {
      return res.status(400).json({ error: error.message });
    }
    
    res.status(500).json({ error: "Internal server error" });
  }
});

// Reject workspace invitation
router.post("/invites/:inviteId/reject", authenticateToken, async (req, res) => {
  try {
    const { inviteId } = req.params;
    const inviteIdInt = parseInt(inviteId);

    if (!inviteIdInt || isNaN(inviteIdInt)) {
      return res.status(400).json({ error: "Invalid invitation ID" });
    }

    const invite = await WorkspaceInvite.findById(inviteIdInt);

    if (!invite) {
      return res.status(404).json({ error: "Invitation not found" });
    }

    // Verify the invite is for this user
    if (invite.invitedUserId !== req.user.id) {
      return res.status(403).json({ error: "This invitation is not for you" });
    }

    await WorkspaceInvite.reject(inviteIdInt);

    // Update notification to mark as read
    try {
      const notification = await prisma.notification.findFirst({
        where: {
          userId: req.user.id,
          type: 'workspace',
          relatedId: inviteId.toString()
        }
      });

      if (notification) {
        await Notification.markAsRead(notification.id);
      }
    } catch (notifError) {
      console.error("Error updating notification:", notifError);
    }

    // Log invitation rejection
    try {
      await WorkspaceLog.logInviteRejected(invite.workspaceId, req.user.id, req.user.name);
    } catch (logError) {
      console.error("Error creating workspace log:", logError);
    }

    res.json({
      message: "Invitation rejected"
    });

  } catch (error) {
    console.error("Reject invite error:", error);
    
    if (error.message === 'Invitation not found' || 
        error.message === 'Invitation is no longer pending') {
      return res.status(400).json({ error: error.message });
    }
    
    res.status(500).json({ error: "Internal server error" });
  }
});

// ============ WORKSPACE-SPECIFIC ROUTES ============

// Get workspace analytics
router.get("/:id/analytics", authenticateToken, async (req, res) => {
  try {
    const workspaceId = parseInt(req.params.id);
    const { timeRange = 'month' } = req.query;
    
    if (isNaN(workspaceId)) {
      return res.status(400).json({ error: "Invalid workspace ID" });
    }

    // Check if user is a member of the workspace
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: req.user.id
        }
      }
    });

    if (!membership) {
      return res.status(403).json({ error: "You are not a member of this workspace" });
    }

    // Calculate date range based on timeRange parameter
    const now = new Date();
    let startDate = null;
    
    switch (timeRange) {
      case 'week':
        startDate = new Date();
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate = new Date();
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'quarter':
        startDate = new Date();
        startDate.setMonth(now.getMonth() - 3);
        break;
      case 'year':
        startDate = new Date();
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      case 'all':
        startDate = null; // No date filter for "all time"
        break;
      default:
        startDate = null; // Default to all time to show all data
    }

    // Build the where clause
    const whereClause = {
      workspaceId,
      ...(startDate ? { createdAt: { gte: startDate } } : {})
    };

    // Debug logging
    console.log(`📊 [Analytics] Fetching analytics for workspace ${workspaceId}`);
    console.log(`📊 [Analytics] Time range: ${timeRange}`);
    console.log(`📊 [Analytics] Start date: ${startDate}`);
    console.log(`📊 [Analytics] Where clause:`, whereClause);

    // Get all meetings in the time range with full details
    const meetings = await prisma.meeting.findMany({
      where: whereClause,
      include: {
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
        },
        actionItems: {
          select: {
            id: true, status: true,
            confirmedAt: true, rejectedAt: true, sourceChunk: true,
            createdAt: true, lastSeenAt: true
          }
        }
      }
    });

    console.log(`📊 [Analytics] Found ${meetings.length} meetings`);

    // ===== BASIC STATS =====
    const totalMeetings = meetings.length;
    const completedMeetings = meetings.filter(m => m.status === 'completed').length;

    // Identified action items (AI-extracted from meetings)
    // sourceChunk !== null  →  identified during live session
    // sourceChunk === null  →  identified post-meeting
    const allActionItems = meetings.flatMap(m => m.actionItems || []);
    const totalActionItems       = allActionItems.length;
    const completedActionItems   = allActionItems.filter(ai => ai.status === 'completed').length;
    const confirmedActionItems   = allActionItems.filter(ai => ai.confirmedAt !== null).length;
    const rejectedActionItems    = allActionItems.filter(ai => ai.rejectedAt  !== null).length;
    const pendingActionItems     = allActionItems.filter(
      ai => ai.status === 'pending' && ai.confirmedAt === null && ai.rejectedAt === null
    ).length;
    const liveActionItems        = allActionItems.filter(ai => ai.sourceChunk !== null).length;
    const postMeetingActionItems = allActionItems.filter(ai => ai.sourceChunk === null).length;

    // Tasks (Kanban board)
    let taskStats = {
      total: 0, completedTasks: 0, pendingTasks: 0, overdueTasks: 0,
      tasksFromActionItems: 0, byColumn: [], byPriority: {}, byAssignee: []
    };
    try {
      const now = new Date();
      const [tasks, columns] = await Promise.all([
        prisma.task.findMany({
          where: { workspaceId },
          select: { id: true, priority: true, columnId: true, dueDate: true, actionItemId: true, assignee: true }
        }),
        prisma.kanbanColumn.findMany({
          where: { workspaceId },
          select: { id: true, name: true, isDefault: true },
          orderBy: { position: 'asc' }
        })
      ]);

      // Any column whose name contains "done", "complete", "finish" is treated as a completed column
      const completeColIds = new Set(
        columns
          .filter(c => /done|complet|finish/i.test(c.name))
          .map(c => c.id)
      );

      const columnMap = {};
      columns.forEach(c => { columnMap[c.id] = c.name; });

      const colCounts = {};
      const priCounts = {};
      const assigneeMap = {};
      let completedTasks = 0, pendingTasks = 0, overdueTasks = 0, tasksFromActionItems = 0;

      tasks.forEach(t => {
        const isComplete = completeColIds.has(t.columnId);
        const isOverdue  = !isComplete && t.dueDate && new Date(t.dueDate) < now;

        if (isComplete)      completedTasks++;
        else if (isOverdue)  overdueTasks++;
        else                 pendingTasks++;

        if (t.actionItemId) tasksFromActionItems++;

        const col = columnMap[t.columnId] || 'Unknown';
        colCounts[col] = (colCounts[col] || 0) + 1;
        priCounts[t.priority || 'medium'] = (priCounts[t.priority || 'medium'] || 0) + 1;

        if (t.assignee) {
          if (!assigneeMap[t.assignee]) {
            assigneeMap[t.assignee] = { assignee: t.assignee, total: 0, completed: 0, pending: 0, overdue: 0 };
          }
          assigneeMap[t.assignee].total++;
          if (isComplete)     assigneeMap[t.assignee].completed++;
          else if (isOverdue) assigneeMap[t.assignee].overdue++;
          else                assigneeMap[t.assignee].pending++;
        }
      });

      taskStats = {
        total: tasks.length,
        completedTasks,
        pendingTasks,
        overdueTasks,
        tasksFromActionItems,
        byColumn: Object.entries(colCounts).map(([name, count]) => ({ name, count })),
        byPriority: priCounts,
        byAssignee: Object.values(assigneeMap)
      };
    } catch (_e) {
      // Non-critical
    }

    // Get member count
    const memberCount = await prisma.workspaceMember.count({
      where: { workspaceId, isActive: true }
    });

    // ===== TRANSCRIPT COVERAGE =====
    const meetingsWithTranscripts = meetings.filter(m => m.transcriptUrl !== null && m.transcriptUrl !== '').length;
    const transcriptCoverage = totalMeetings > 0 ? (meetingsWithTranscripts / totalMeetings) * 100 : 0;

    // ===== MEETING DURATION ANALYSIS =====
    const completedMeetingsWithDuration = meetings.filter(m => m.status === 'completed' && m.endTime);
    const durations = completedMeetingsWithDuration.map(m => 
      (new Date(m.endTime).getTime() - new Date(m.startTime).getTime()) / 60000
    );
    const averageDuration = durations.length > 0
      ? durations.reduce((sum, d) => sum + d, 0) / durations.length
      : 0;
    
    // Duration trend over time (comparing first half vs second half of time range)
    let durationTrend = 0;
    let avgDurationFirstHalf = 0;
    let avgDurationSecondHalf = 0;
    
    if (startDate && completedMeetingsWithDuration.length > 0) {
      const midPoint = new Date(startDate.getTime() + (now.getTime() - startDate.getTime()) / 2);
      const firstHalfMeetings = completedMeetingsWithDuration.filter(m => new Date(m.createdAt) < midPoint);
      const secondHalfMeetings = completedMeetingsWithDuration.filter(m => new Date(m.createdAt) >= midPoint);
      
      avgDurationFirstHalf = firstHalfMeetings.length > 0
        ? firstHalfMeetings.reduce((sum, m) => sum + (new Date(m.endTime).getTime() - new Date(m.startTime).getTime()) / 60000, 0) / firstHalfMeetings.length
        : 0;
      avgDurationSecondHalf = secondHalfMeetings.length > 0
        ? secondHalfMeetings.reduce((sum, m) => sum + (new Date(m.endTime).getTime() - new Date(m.startTime).getTime()) / 60000, 0) / secondHalfMeetings.length
        : 0;
      
      durationTrend = avgDurationFirstHalf > 0 
        ? ((avgDurationSecondHalf - avgDurationFirstHalf) / avgDurationFirstHalf) * 100
        : 0;
    }

    // ===== PARTICIPANT ANALYTICS =====
    const participantStats = {};
    meetings.forEach(meeting => {
      meeting.participants?.forEach(participant => {
        const userId = participant.userId;
        if (!participantStats[userId]) {
          participantStats[userId] = {
            userId,
            name: participant.user?.name || 'Unknown',
            email: participant.user?.email,
            profilePictureUrl: participant.user?.profilePictureUrl,
            meetingsAttended: 0,
            totalMeetings: 0,
            hostedMeetings: 0
          };
        }
        participantStats[userId].totalMeetings++;
        if (participant.role === 'host') participantStats[userId].hostedMeetings++;
        // Count as attended if: explicitly marked attended, joined a live session,
        // or the meeting completed and they were accepted (not declined)
        const didAttend = participant.status === 'attended'
          || participant.joinedAt !== null
          || (meeting.status === 'completed' && participant.status !== 'declined');
        if (didAttend) {
          participantStats[userId].meetingsAttended++;
        }
      });
    });

    const allParticipantsWithRate = Object.values(participantStats).map(p => ({
      ...p,
      attendanceRate: p.totalMeetings > 0 ? (p.meetingsAttended / p.totalMeetings) * 100 : 0
    }));
    const participantsWithAttendance = allParticipantsWithRate.filter(p => p.meetingsAttended > 0).length;
    const averageAttendanceRate =
      allParticipantsWithRate.length > 0
        ? Math.round(
            (allParticipantsWithRate.reduce((s, p) => s + p.attendanceRate, 0) /
              allParticipantsWithRate.length) *
              10
          ) / 10
        : 0;

    const topParticipants = [...allParticipantsWithRate]
      .sort((a, b) => b.meetingsAttended - a.meetingsAttended)
      .slice(0, 10);

    // ===== TIME PATTERNS =====
    const hourDistribution = Array(24).fill(0);
    const dayDistribution = Array(7).fill(0); // 0 = Sunday, 6 = Saturday
    
    meetings.forEach(m => {
      const meetingDate = new Date(m.startTime);
      hourDistribution[meetingDate.getHours()]++;
      dayDistribution[meetingDate.getDay()]++;
    });

    const peakHour = hourDistribution.indexOf(Math.max(...hourDistribution));
    const peakDay = dayDistribution.indexOf(Math.max(...dayDistribution));
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    const timePatternData = {
      hourly: hourDistribution.map((count, hour) => ({
        hour: `${hour}:00`,
        value: count
      })),
      daily: dayDistribution.map((count, day) => ({
        day: dayNames[day],
        value: count
      })),
      peakHour: `${peakHour}:00`,
      peakDay: dayNames[peakDay]
    };

    // ===== ACTION ITEM TRENDS & TIME SERIES DATA =====
    // For "all time", use last 30 days for trends; for specific ranges, use the range
    const daysCount = timeRange === 'all' ? 30 : 
                     timeRange === 'week' ? 7 : 
                     timeRange === 'month' ? 30 : 
                     timeRange === 'quarter' ? 90 :
                     timeRange === 'year' ? 365 : 30;
    
    const actionItemTrends = [];
    const timeSeriesData = [];
    
    for (let i = daysCount - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);
      
      const dayMeetings = meetings.filter(m => {
        const meetingDate = new Date(m.createdAt);
        return meetingDate >= date && meetingDate < nextDate;
      });
      
      // Action item trends
      const created = dayMeetings.reduce((sum, m) => sum + (m.actionItems?.length || 0), 0);
      const completed = dayMeetings.reduce((sum, m) => 
        sum + (m.actionItems?.filter(ai => ai.status === 'completed' && new Date(ai.lastSeenAt) >= date && new Date(ai.lastSeenAt) < nextDate).length || 0), 0
      );
      
      actionItemTrends.push({
        date: date.toISOString().split('T')[0],
        created,
        completed,
        label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      });
      
      // Time series data (meetings per day)
      timeSeriesData.push({
        date: date.toISOString().split('T')[0],
        value: dayMeetings.length,
        label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      });
    }

    // ===== KNOWLEDGE, TOPICS & SENTIMENT (from AiInsight records) =====
    let richTopics = [];  // [{label, mentions, sentiment, meetingCount}]
    let sentimentData = { positive: 0, neutral: 0, negative: 0, total: 0, overall: 'neutral' };
    let totalDecisions = 0;
    let meetingsWithAI = 0;
    let recentDecisions = []; // [{ text, meetingId, meetingTitle, createdAt }]
    let recentInsightEvents = []; // [{ insightType, meetingId, meetingTitle, createdAt }]

    try {
      const meetingIdStrings = meetings.map(m => String(m.id));
      const meetingTitleById = {};
      meetings.forEach(m => {
        meetingTitleById[String(m.id)] = m.title;
      });

      if (meetingIdStrings.length > 0) {
        // Count meetings that have any AI insight (proxy for AI-processed)
        const aiInsightCounts = await prisma.aiInsight.groupBy({
          by: ['meetingId'],
          where: { meetingId: { in: meetingIdStrings } }
        });
        meetingsWithAI = aiInsightCounts.length;

        // ── Decisions ──────────────────────────────────────────────────────
        const decisionInsights = await prisma.aiInsight.findMany({
          where: { meetingId: { in: meetingIdStrings }, insightType: 'decisions' },
          select: { content: true }
        });
        decisionInsights.forEach(di => {
          try {
            const parsed = JSON.parse(di.content);
            const list = Array.isArray(parsed) ? parsed : (parsed.decisions || []);
            const realDecisions = list.filter(d => {
              const text = (d.decision || d.title || d.text || '').toLowerCase();
              return text && text !== 'no decisions identified.' && text !== 'no decisions made';
            });
            totalDecisions += realDecisions.length;
          } catch (_) {}
        });

        // ── Sentiment ─────────────────────────────────────────────────────
        const sentimentInsights = await prisma.aiInsight.findMany({
          where: { meetingId: { in: meetingIdStrings }, insightType: 'sentiment' },
          select: { content: true }
        });
        sentimentInsights.forEach(si => {
          try {
            const data = JSON.parse(si.content);
            const raw = String(data.overall_sentiment || data.overall || data.sentiment || '').toLowerCase();
            if (raw.includes('positive')) { sentimentData.positive++; sentimentData.total++; }
            else if (raw.includes('negative')) { sentimentData.negative++; sentimentData.total++; }
            else if (raw) { sentimentData.neutral++; sentimentData.total++; }
          } catch (_) {}
        });
        if (sentimentData.total > 0) {
          if (sentimentData.positive >= sentimentData.negative && sentimentData.positive >= sentimentData.neutral) {
            sentimentData.overall = 'positive';
          } else if (sentimentData.negative >= sentimentData.positive && sentimentData.negative >= sentimentData.neutral) {
            sentimentData.overall = 'negative';
          } else {
            sentimentData.overall = 'neutral';
          }
        }

        // ── Topics (from AiInsight — structured, not JSON strings) ────────
        const topicInsights = await prisma.aiInsight.findMany({
          where: { meetingId: { in: meetingIdStrings }, insightType: 'topics' },
          select: { content: true }
        });
        const topicMap = {};
        topicInsights.forEach(ti => {
          try {
            const topics = JSON.parse(ti.content);
            if (!Array.isArray(topics)) return;
            topics.forEach(t => {
              if (!t || typeof t !== 'object') return;
              const name = String(t.name || t.topic || t.title || t.label || '').trim();
              if (!name || name.length < 2) return;
              const key = name.toLowerCase();
              const mentions = typeof t.mentions === 'number' ? t.mentions : 1;
              const sentiment = String(t.sentiment || 'neutral').toLowerCase();
              if (!topicMap[key]) {
                topicMap[key] = { label: name, mentions: 0, sentiment, meetingCount: 0 };
              }
              topicMap[key].mentions += mentions;
              topicMap[key].meetingCount++;
              if (t.sentiment) topicMap[key].sentiment = sentiment;
            });
          } catch (_) {}
        });
        richTopics = Object.values(topicMap)
          .sort((a, b) => b.mentions - a.mentions)
          .slice(0, 15);

        // Recent decision snippets (for dashboards)
        const decisionRows = await prisma.aiInsight.findMany({
          where: { meetingId: { in: meetingIdStrings }, insightType: "decisions" },
          orderBy: { createdAt: "desc" },
          take: 12,
          select: { content: true, meetingId: true, createdAt: true }
        });
        recentDecisions = decisionRows
          .map(row => {
            let text = "";
            try {
              const parsed = JSON.parse(row.content);
              const list = Array.isArray(parsed) ? parsed : parsed.decisions || [];
              const first = list.find(d => {
                const t = (d.decision || d.title || d.text || "").trim();
                return t && !/^no decisions/i.test(t);
              });
              text = (first?.decision || first?.title || first?.text || "").trim();
            } catch (_) {}
            const clipped = text.slice(0, 180);
            return {
              text: clipped,
              meetingId: row.meetingId,
              meetingTitle: meetingTitleById[row.meetingId] || "Meeting",
              createdAt: row.createdAt
            };
          })
          .filter(r => r.text.length > 0)
          .slice(0, 8);

        // Recent AI insight saves (for activity feeds)
        const insightRows = await prisma.aiInsight.findMany({
          where: { meetingId: { in: meetingIdStrings } },
          orderBy: { createdAt: "desc" },
          take: 25,
          select: { insightType: true, meetingId: true, createdAt: true }
        });
        recentInsightEvents = insightRows.map(row => ({
          insightType: row.insightType,
          meetingId: row.meetingId,
          meetingTitle: meetingTitleById[row.meetingId] || "Meeting",
          createdAt: row.createdAt
        }));
      }
    } catch (_e) {
      // Non-critical — skip if AI insights are unavailable
    }

    // ===== MEETINGS BY PLATFORM =====
    const platformDistribution = {};
    meetings.forEach(m => {
      const platform = m.platform || 'other';
      platformDistribution[platform] = (platformDistribution[platform] || 0) + 1;
    });

    const meetingTypesData = Object.entries(platformDistribution).map(([platform, count], index) => {
      const colors = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'];
      return {
        label: platform.charAt(0).toUpperCase() + platform.slice(1),
        value: count,
        color: colors[index % colors.length]
      };
    });

    // ===== RESPONSE =====
    res.json({
      analytics: {
        // Basic stats
        totalMembers: memberCount,
        totalMeetings,
        completedMeetings,
        // Identified action items
        totalActionItems,
        completedActionItems,
        confirmedActionItems,
        rejectedActionItems,
        pendingActionItems,
        liveActionItems,
        postMeetingActionItems,
        // Tasks (Kanban)
        taskStats,
        averageDuration: Math.round(averageDuration),
        engagementRate: Math.round(((completedMeetings / (totalMeetings || 1)) * 100) * 10) / 10,
        
        // Transcript coverage
        transcriptCoverage: Math.round(transcriptCoverage * 10) / 10,
        meetingsWithTranscripts,
        
        // Duration analysis
        durationTrend: Math.round(durationTrend * 10) / 10,
        avgDurationFirstHalf: Math.round(avgDurationFirstHalf),
        avgDurationSecondHalf: Math.round(avgDurationSecondHalf),
        
        // Participant analytics
        topParticipants,
        totalParticipants: Object.keys(participantStats).length,
        participantsWithAttendance,
        averageAttendanceRate,
        
        // Time patterns
        timePatterns: timePatternData,
        
        // Trends
        actionItemTrends,
        timeSeriesData,
        meetingTypesData,

        // Knowledge, topics & sentiment
        richTopics,
        sentimentData,
        totalDecisions,
        meetingsWithAI,
        recentDecisions,
        recentInsightEvents
      }
    });
  } catch (error) {
    console.error("Get workspace analytics error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get workspace dashboard stats (optional ?period=today|week|month|quarter|all — filters by meeting startTime)
router.get("/:id/dashboard", authenticateToken, async (req, res) => {
  try {
    const workspaceId = parseInt(req.params.id);
    const allowedPeriods = new Set(["today", "week", "month", "quarter", "all"]);
    const period = allowedPeriods.has(String(req.query.period))
      ? String(req.query.period)
      : "all";

    if (isNaN(workspaceId)) {
      return res.status(400).json({ error: "Invalid workspace ID" });
    }

    // Check if user is a member of the workspace
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: req.user.id
        }
      }
    });

    if (!membership) {
      return res.status(403).json({ error: "You are not a member of this workspace" });
    }

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId }
    });

    if (!workspace) {
      return res.status(404).json({ error: "Workspace not found" });
    }

    const now = new Date();

    /** @returns {Record<string, unknown>} Prisma where fragment on Meeting (startTime) */
    const getMeetingStartTimeFilter = () => {
      switch (period) {
        case "today": {
          const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const end = new Date(start);
          end.setDate(end.getDate() + 1);
          return { startTime: { gte: start, lt: end } };
        }
        case "week": {
          const start = new Date(now);
          start.setDate(now.getDate() - now.getDay());
          start.setHours(0, 0, 0, 0);
          const end = new Date(start);
          end.setDate(end.getDate() + 7);
          return { startTime: { gte: start, lt: end } };
        }
        case "month": {
          const start = new Date(now.getFullYear(), now.getMonth(), 1);
          const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
          return { startTime: { gte: start, lt: end } };
        }
        case "quarter": {
          const start = new Date(now);
          start.setMonth(now.getMonth() - 3);
          start.setHours(0, 0, 0, 0);
          return { startTime: { gte: start } };
        }
        case "all":
        default:
          return {};
      }
    };

    const startFilter = getMeetingStartTimeFilter();
    const meetingBaseWhere = { workspaceId, ...startFilter };

    const periodLabels = {
      today: "Today",
      week: "This week",
      month: "This month",
      quarter: "Last 3 months",
      all: "All time"
    };

    const [totalMeetings, completedMeetings, totalActionItems, confirmedActionItems, totalMembers] =
      await Promise.all([
        prisma.meeting.count({ where: meetingBaseWhere }),
        prisma.meeting.count({
          where: { ...meetingBaseWhere, status: "completed" }
        }),
        prisma.actionItem.count({
          where: {
            meeting: meetingBaseWhere
          }
        }),
        prisma.actionItem.count({
          where: {
            confirmedAt: { not: null },
            meeting: meetingBaseWhere
          }
        }),
        prisma.workspaceMember.count({
          where: { workspaceId, isActive: true }
        })
      ]);

    const completionRate =
      totalActionItems > 0 ? Math.round((confirmedActionItems / totalActionItems) * 100) : 0;

    res.json({
      stats: {
        period: ["today", "week", "month", "quarter", "all"].includes(period) ? period : "all",
        periodLabel: periodLabels[period] || periodLabels.all,
        totalMeetings,
        completedMeetings,
        totalMembers,
        totalActionItems,
        confirmedActionItems,
        completionRate
      }
    });
  } catch (error) {
    console.error("Get workspace dashboard error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get workspace activity logs (must be before /:id route)
router.get("/:id/logs", authenticateToken, async (req, res) => {
  try {
    const workspaceId = parseInt(req.params.id);
    
    if (isNaN(workspaceId)) {
      return res.status(400).json({ error: "Invalid workspace ID" });
    }

    // Check if user is a member of the workspace
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: req.user.id
        }
      }
    });

    if (!membership) {
      return res.status(403).json({ error: "You are not a member of this workspace" });
    }

    // Get pagination parameters
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;

    // Fetch logs with user information
    const logs = await WorkspaceLog.findByWorkspaceIdWithUser(workspaceId, limit, offset);
    const totalCount = await WorkspaceLog.getCount(workspaceId);

    res.json({
      logs,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + logs.length < totalCount
      }
    });
  } catch (error) {
    console.error("Get workspace logs error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get workspace by ID
router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const workspaceId = parseInt(id);

    if (!workspaceId || isNaN(workspaceId)) {
      return res.status(400).json({ error: "Invalid workspace ID" });
    }

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            profilePictureUrl: true,
          }
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                profilePictureUrl: true,
              }
            }
          }
        }
      }
    });

    if (!workspace) {
      return res.status(404).json({ error: "Workspace not found" });
    }

    // Check if workspace is active
    if (!workspace.isActive) {
      return res.status(410).json({ error: "Workspace has been deleted" });
    }

    // Check if user is a member
    const isMember = workspace.members.some(m => m.userId === req.user.id);
    if (!isMember) {
      return res.status(403).json({ error: "Access denied" });
    }

    res.json({ workspace });
  } catch (error) {
    console.error("Get workspace error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update workspace
router.put("/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, colorTheme } = req.body;
    const workspaceId = parseInt(id);

    if (!workspaceId || isNaN(workspaceId)) {
      return res.status(400).json({ error: "Invalid workspace ID" });
    }

    // Check if user is owner or admin
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        members: {
          where: { userId: req.user.id }
        }
      }
    });

    if (!workspace) {
      return res.status(404).json({ error: "Workspace not found" });
    }

    const isOwner = workspace.ownerId === req.user.id;
    const isAdmin = workspace.members[0]?.role === 'admin';
    
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: "Only owner or admin can update workspace" });
    }

    const changes = {};
    if (name && name.trim() !== workspace.name) {
      changes.name = { from: workspace.name, to: name.trim() };
    }
    if (description !== undefined && description.trim() !== workspace.description) {
      changes.description = { from: workspace.description, to: description.trim() };
    }
    if (colorTheme !== undefined && colorTheme !== workspace.colorTheme) {
      changes.colorTheme = { from: workspace.colorTheme, to: colorTheme };
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description.trim();
    if (colorTheme !== undefined) updateData.colorTheme = colorTheme;

    const updatedWorkspace = await prisma.workspace.update({
      where: { id: workspaceId },
      data: updateData
    });

    // Log workspace update
    if (Object.keys(changes).length > 0) {
      try {
        await WorkspaceLog.logWorkspaceUpdated(workspaceId, req.user.id, changes);
      } catch (logError) {
        console.error("Error creating workspace log:", logError);
      }
    }

    res.json({
      message: "Workspace updated successfully",
      workspace: updatedWorkspace
    });
  } catch (error) {
    console.error("Update workspace error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Archive workspace
router.patch("/:id/archive", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const workspaceId = parseInt(id);

    if (!workspaceId || isNaN(workspaceId)) {
      return res.status(400).json({ error: "Invalid workspace ID" });
    }

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId }
    });

    if (!workspace) {
      return res.status(404).json({ error: "Workspace not found" });
    }

    if (workspace.ownerId !== req.user.id) {
      return res.status(403).json({ error: "Only owner can archive workspace" });
    }

    if (workspace.isArchived) {
      return res.status(400).json({ error: "Workspace is already archived" });
    }

    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { 
        isArchived: true,
        archivedAt: new Date(),
        archivedBy: req.user.id
      }
    });

    // Log workspace archiving
    try {
      await WorkspaceLog.create({
        workspaceId: workspaceId,
        userId: req.user.id,
        action: 'workspace_archived',
        title: 'Workspace Archived',
        description: `${workspace.name} workspace was archived`,
        metadata: { workspaceName: workspace.name }
      });
    } catch (logError) {
      console.error("Error creating workspace log:", logError);
    }

    // Notify workspace members
    try {
      await NotificationService.notifyWorkspaceArchived(workspace);
    } catch (notifError) {
      console.error("Error sending archive notification:", notifError);
    }

    res.json({ message: "Workspace archived successfully" });
  } catch (error) {
    console.error("Archive workspace error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Unarchive workspace
router.patch("/:id/unarchive", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const workspaceId = parseInt(id);

    if (!workspaceId || isNaN(workspaceId)) {
      return res.status(400).json({ error: "Invalid workspace ID" });
    }

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId }
    });

    if (!workspace) {
      return res.status(404).json({ error: "Workspace not found" });
    }

    if (workspace.ownerId !== req.user.id) {
      return res.status(403).json({ error: "Only owner can unarchive workspace" });
    }

    if (!workspace.isArchived) {
      return res.status(400).json({ error: "Workspace is not archived" });
    }

    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { 
        isArchived: false,
        archivedAt: null,
        archivedBy: null
      }
    });

    // Log workspace unarchiving
    try {
      await WorkspaceLog.create({
        workspaceId: workspaceId,
        userId: req.user.id,
        action: 'workspace_unarchived',
        title: 'Workspace Restored',
        description: `${workspace.name} workspace was restored from archive`,
        metadata: { workspaceName: workspace.name }
      });
    } catch (logError) {
      console.error("Error creating workspace log:", logError);
    }

    // Notify workspace members
    try {
      await NotificationService.notifyWorkspaceUnarchived(workspace);
    } catch (notifError) {
      console.error("Error sending unarchive notification:", notifError);
    }

    res.json({ message: "Workspace restored successfully" });
  } catch (error) {
    console.error("Unarchive workspace error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delete workspace
router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const workspaceId = parseInt(id);

    if (!workspaceId || isNaN(workspaceId)) {
      return res.status(400).json({ error: "Invalid workspace ID" });
    }

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId }
    });

    if (!workspace) {
      return res.status(404).json({ error: "Workspace not found" });
    }

    if (workspace.ownerId !== req.user.id) {
      return res.status(403).json({ error: "Only owner can delete workspace" });
    }

    // Notify workspace members BEFORE deletion
    try {
      await NotificationService.notifyWorkspaceDeleted(workspace);
    } catch (notifError) {
      console.error("Error sending deletion notification:", notifError);
    }

    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { isActive: false }
    });

    // Log workspace deletion
    try {
      await WorkspaceLog.create({
        workspaceId: workspaceId,
        userId: req.user.id,
        action: 'workspace_deleted',
        title: 'Workspace Deleted',
        description: `${workspace.name} workspace was deactivated`,
        metadata: { workspaceName: workspace.name }
      });
    } catch (logError) {
      console.error("Error creating workspace log:", logError);
    }

    res.json({ message: "Workspace deleted successfully" });
  } catch (error) {
    console.error("Delete workspace error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Join workspace by code
router.post("/join", authenticateToken, async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: "Workspace code is required" });
    }

    const workspace = await prisma.workspace.findUnique({
      where: { code }
    });

    if (!workspace) {
      return res.status(404).json({ error: "Invalid workspace code" });
    }

    if (!workspace.isActive) {
      return res.status(400).json({ error: "Workspace is no longer active" });
    }

    // Check if already a member
    const existingMember = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: workspace.id,
          userId: req.user.id
        }
      }
    });

    if (existingMember) {
      // User is already a member - return success with informational message
      return res.json({
        message: "You are already a member of this workspace",
        workspace: {
          id: workspace.id,
          name: workspace.name,
          description: workspace.description,
          code: workspace.code
        },
        alreadyMember: true
      });
    }

    // Add user as member
    await prisma.workspaceMember.create({
      data: {
        workspaceId: workspace.id,
        userId: req.user.id,
        role: 'member',
      }
    });

    // Log member joining via code
    try {
      await WorkspaceLog.logMemberJoined(workspace.id, req.user.id, req.user.name, 'member');
    } catch (logError) {
      console.error("Error creating workspace log:", logError);
    }

    res.json({
      message: "Successfully joined workspace",
      workspace: {
        id: workspace.id,
        name: workspace.name,
        description: workspace.description,
        code: workspace.code
      }
    });
  } catch (error) {
    console.error("Join workspace error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ============ INVITATION ROUTES ============

// Send workspace invitations
router.post("/:id/invite", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { emails, role = 'member' } = req.body;
    const workspaceId = parseInt(id);

    if (!workspaceId || isNaN(workspaceId)) {
      return res.status(400).json({ error: "Invalid workspace ID" });
    }

    // Validate inputs
    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ error: "Email list is required" });
    }

    // Check workspace exists and user has permission
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        owner: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    if (!workspace) {
      return res.status(404).json({ error: "Workspace not found" });
    }

    // Check if user is owner or admin
    const userMembership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: workspace.id,
          userId: req.user.id
        }
      }
    });

    if (!userMembership || (userMembership.role !== 'owner' && userMembership.role !== 'admin')) {
      return res.status(403).json({ error: "Only workspace owners and admins can send invitations" });
    }

    const results = [];

    for (const email of emails) {
      const trimmedEmail = email.trim().toLowerCase();

      try {
        // Check if email format is valid
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(trimmedEmail)) {
          results.push({
            email: trimmedEmail,
            status: 'error',
            message: 'Invalid email format'
          });
          continue;
        }

        // Find user by email
        const invitedUser = await prisma.user.findUnique({
          where: { email: trimmedEmail }
        });

        if (!invitedUser) {
          results.push({
            email: trimmedEmail,
            status: 'error',
            message: 'User not found. They need to create an account first.'
          });
          continue;
        }

        // Check if already a member
        const existingMember = await prisma.workspaceMember.findUnique({
          where: {
            workspaceId_userId: {
              workspaceId: workspace.id,
              userId: invitedUser.id
            }
          }
        });

        if (existingMember) {
          results.push({
            email: trimmedEmail,
            status: 'error',
            message: 'Already a member'
          });
          continue;
        }

        // Check if invite already exists
        const existingInvite = await WorkspaceInvite.findExisting(workspace.id, trimmedEmail);

        if (existingInvite && existingInvite.status === 'pending') {
          results.push({
            email: trimmedEmail,
            status: 'info',
            message: 'Already invited'
          });
          continue;
        }

        // Create or update invitation
        const invite = await WorkspaceInvite.create({
          workspaceId: workspace.id,
          invitedEmail: trimmedEmail,
          invitedUserId: invitedUser.id,
          invitedBy: req.user.id,
          role: role,
          expiresInDays: 7
        });

        // Create notification
        await Notification.create({
          userId: invitedUser.id,
          title: "Workspace Invitation! 🎉",
          message: `${req.user.name || 'Someone'} invited you to join "${workspace.name}". Accept the invitation to start collaborating!`,
          type: "workspace",
          priority: "high",
          workspace: workspace.name,
          actionRequired: true,
          relatedId: invite.id.toString()
        });

        // Log member invitation
        try {
          await WorkspaceLog.logMemberInvited(workspace.id, req.user.id, trimmedEmail, role);
        } catch (logError) {
          console.error("Error creating workspace log:", logError);
        }

        results.push({
          email: trimmedEmail,
          status: 'success',
          message: 'Invitation sent'
        });

      } catch (error) {
        console.error(`Error inviting ${trimmedEmail}:`, error);
        results.push({
          email: trimmedEmail,
          status: 'error',
          message: 'Failed to send invitation'
        });
      }
    }

    res.json({
      message: "Invitations processed",
      results
    });

  } catch (error) {
    console.error("Send invites error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get workspace invitations (for workspace admins)
router.get("/:id/invites", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.query;
    const workspaceId = parseInt(id);

    if (!workspaceId || isNaN(workspaceId)) {
      return res.status(400).json({ error: "Invalid workspace ID" });
    }

    // Check workspace exists and user has permission
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId }
    });

    if (!workspace) {
      return res.status(404).json({ error: "Workspace not found" });
    }

    // Check if user is workspace owner
    const isOwner = workspace.ownerId === req.user.id;
    
    // Check if user is a member with owner or admin role
    const userMembership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: workspaceId,
          userId: req.user.id
        }
      }
    });

    const isAdmin = userMembership && (userMembership.role === 'owner' || userMembership.role === 'admin');

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: "Only workspace owners and admins can view invitations" });
    }

    const invites = await WorkspaceInvite.getWorkspaceInvites(workspaceId, status);

    res.json({ invites });
  } catch (error) {
    console.error("Get workspace invites error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Search for workspace members by email (for adding participants to meetings)
router.get("/:id/members/search", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { email } = req.query;
    const workspaceId = parseInt(id);

    if (!workspaceId || isNaN(workspaceId)) {
      return res.status(400).json({ error: "Invalid workspace ID" });
    }

    // Check if user is a member of the workspace
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: req.user.id
        }
      }
    });

    if (!membership) {
      return res.status(403).json({ error: "You are not a member of this workspace" });
    }

    // Get all workspace members for autocomplete
    const allMembers = await prisma.workspaceMember.findMany({
      where: { workspaceId },
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
    });

    // If email is provided, search for exact match first
    if (email && email.trim()) {
      const emailLower = email.trim().toLowerCase();
      
      // Try exact match first
      const exactMatch = allMembers.find(m => 
        m.user.email.toLowerCase() === emailLower
      );

      if (exactMatch) {
        return res.json({
          members: [exactMatch.user],
          allMembers: allMembers.map(m => m.user)
        });
      }

      // If no exact match, try fuzzy match (contains)
      const fuzzyMatches = allMembers.filter(m => 
        m.user.email.toLowerCase().includes(emailLower)
      );

      if (fuzzyMatches.length > 0) {
        return res.json({
          members: fuzzyMatches.map(m => m.user),
          allMembers: allMembers.map(m => m.user)
        });
      }

      // If user not found in workspace, check if they exist in the system
      const userExists = await prisma.user.findUnique({
        where: { email: emailLower },
        select: {
          id: true,
          name: true,
          email: true,
          profilePictureUrl: true
        }
      });

      if (userExists) {
        // User exists but is not a workspace member
        return res.json({
          members: [],
          allMembers: allMembers.map(m => m.user),
          userExistsButNotMember: true,
          user: userExists
        });
      }

      // User doesn't exist at all
      return res.json({
        members: [],
        allMembers: allMembers.map(m => m.user),
        userExistsButNotMember: false
      });
    }

    // If no email provided, return all members
    res.json({
      members: [],
      allMembers: allMembers.map(m => m.user)
    });
  } catch (error) {
    console.error("Search workspace members error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;

