const Notification = require('../models/Notification');
const prisma = require('../lib/prisma');

class NotificationService {
  /**
   * Create a notification for a single user
   */
  static async createNotification({
    userId,
    title,
    message,
    type,
    priority = 'medium',
    workspace = null,
    actionRequired = false,
    relatedId = null
  }) {
    try {
      return await Notification.create({
        userId,
        title,
        message,
        type,
        priority,
        workspace,
        actionRequired,
        relatedId
      });
    } catch (error) {
      console.error('[NotificationService] Error creating notification:', error);
      throw error;
    }
  }

  /**
   * Create notifications for multiple users
   */
  static async createBulkNotifications({
    userIds,
    title,
    message,
    type,
    priority = 'medium',
    workspace = null,
    actionRequired = false,
    relatedId = null
  }) {
    try {
      const notifications = userIds.map(userId => ({
        userId,
        title,
        message,
        type,
        priority,
        workspace,
        actionRequired,
        relatedId
      }));

      return await prisma.notification.createMany({
        data: notifications
      });
    } catch (error) {
      console.error('[NotificationService] Error creating bulk notifications:', error);
      throw error;
    }
  }

  // ============================================
  // MEETING NOTIFICATIONS
  // ============================================

  /**
   * Notify when meeting is created
   */
  static async notifyMeetingCreated(meeting, creatorId, workspaceName) {
    try {
      // Get all workspace members except the creator
      const members = await prisma.workspaceMember.findMany({
        where: {
          workspaceId: meeting.workspaceId,
          userId: { not: creatorId },
          isActive: true
        },
        select: { userId: true }
      });

      if (members.length === 0) return;

      const userIds = members.map(m => m.userId);

      await this.createBulkNotifications({
        userIds,
        title: 'New Meeting Created',
        message: `A new meeting "${meeting.title}" has been scheduled`,
        type: 'meeting_created',
        priority: 'medium',
        workspace: workspaceName,
        actionRequired: false,
        relatedId: String(meeting.id)
      });
    } catch (error) {
      console.error('[NotificationService] Error in notifyMeetingCreated:', error);
    }
  }

  /**
   * Notify when meeting ends
   */
  static async notifyMeetingEnded(meeting, workspaceName) {
    try {
      // Get all workspace members
      const members = await prisma.workspaceMember.findMany({
        where: {
          workspaceId: meeting.workspaceId,
          isActive: true
        },
        select: { userId: true }
      });

      if (members.length === 0) return;

      const userIds = members.map(m => m.userId);

      await this.createBulkNotifications({
        userIds,
        title: 'Meeting Ended',
        message: `"${meeting.title}" has ended. Transcript and insights are being processed.`,
        type: 'meeting_ended',
        priority: 'medium',
        workspace: workspaceName,
        actionRequired: false,
        relatedId: String(meeting.id)
      });
    } catch (error) {
      console.error('[NotificationService] Error in notifyMeetingEnded:', error);
    }
  }

  /**
   * Notify when AI insights are ready
   */
  static async notifyInsightsReady(meeting, workspaceName) {
    try {
      // Get all workspace members
      const members = await prisma.workspaceMember.findMany({
        where: {
          workspaceId: meeting.workspaceId,
          isActive: true
        },
        select: { userId: true }
      });

      if (members.length === 0) return;

      const userIds = members.map(m => m.userId);

      await this.createBulkNotifications({
        userIds,
        title: 'AI Insights Ready',
        message: `AI-generated insights for "${meeting.title}" are now available`,
        type: 'insights_ready',
        priority: 'high',
        workspace: workspaceName,
        actionRequired: true,
        relatedId: String(meeting.id)
      });
    } catch (error) {
      console.error('[NotificationService] Error in notifyInsightsReady:', error);
    }
  }

  /**
   * Notify participants when invited to a meeting
   */
  static async notifyMeetingInvite(meeting, participantUserIds, workspaceName) {
    try {
      if (!participantUserIds || participantUserIds.length === 0) return;

      await this.createBulkNotifications({
        userIds: participantUserIds,
        title: 'Meeting Invitation',
        message: `You've been invited to "${meeting.title}"`,
        type: 'meeting_invite',
        priority: 'high',
        workspace: workspaceName,
        actionRequired: true,
        relatedId: String(meeting.id)
      });
    } catch (error) {
      console.error('[NotificationService] Error in notifyMeetingInvite:', error);
    }
  }

  // ============================================
  // WORKSPACE NOTIFICATIONS
  // ============================================

  /**
   * Notify when workspace is created
   */
  static async notifyWorkspaceCreated(workspace, creatorId, memberIds = []) {
    try {
      // Notify the creator
      await this.createNotification({
        userId: creatorId,
        title: 'Workspace Created',
        message: `Your workspace "${workspace.name}" has been created successfully`,
        type: 'workspace_created',
        priority: 'medium',
        workspace: workspace.name,
        actionRequired: false,
        relatedId: String(workspace.id)
      });

      // Notify other members if any
      if (memberIds.length > 0) {
        await this.createBulkNotifications({
          userIds: memberIds,
          title: 'Added to Workspace',
          message: `You've been added to "${workspace.name}"`,
          type: 'workspace_invite',
          priority: 'high',
          workspace: workspace.name,
          actionRequired: true,
          relatedId: String(workspace.id)
        });
      }
    } catch (error) {
      console.error('[NotificationService] Error in notifyWorkspaceCreated:', error);
    }
  }

  /**
   * Notify when workspace is archived
   */
  static async notifyWorkspaceArchived(workspace) {
    try {
      // Get all workspace members
      const members = await prisma.workspaceMember.findMany({
        where: {
          workspaceId: workspace.id,
          isActive: true
        },
        select: { userId: true }
      });

      if (members.length === 0) return;

      const userIds = members.map(m => m.userId);

      await this.createBulkNotifications({
        userIds,
        title: 'Workspace Archived',
        message: `The workspace "${workspace.name}" has been archived`,
        type: 'workspace_archived',
        priority: 'medium',
        workspace: workspace.name,
        actionRequired: false,
        relatedId: String(workspace.id)
      });
    } catch (error) {
      console.error('[NotificationService] Error in notifyWorkspaceArchived:', error);
    }
  }

  /**
   * Notify when workspace is unarchived
   */
  static async notifyWorkspaceUnarchived(workspace) {
    try {
      // Get all workspace members
      const members = await prisma.workspaceMember.findMany({
        where: {
          workspaceId: workspace.id,
          isActive: true
        },
        select: { userId: true }
      });

      if (members.length === 0) return;

      const userIds = members.map(m => m.userId);

      await this.createBulkNotifications({
        userIds,
        title: 'Workspace Restored',
        message: `The workspace "${workspace.name}" has been restored from archive`,
        type: 'workspace_unarchived',
        priority: 'medium',
        workspace: workspace.name,
        actionRequired: false,
        relatedId: String(workspace.id)
      });
    } catch (error) {
      console.error('[NotificationService] Error in notifyWorkspaceUnarchived:', error);
    }
  }

  /**
   * Resolve assignee string (email, full name, or first name) to a workspace member user id.
   * @returns {Promise<number|null>}
   */
  static async resolveAssigneeToUserId(assigneeString, workspaceId) {
    if (!assigneeString || !String(assigneeString).trim()) return null;
    const norm = (s) => String(s).trim().toLowerCase();
    const a = norm(assigneeString);

    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId: parseInt(String(workspaceId), 10), isActive: true },
      include: {
        user: { select: { id: true, email: true, name: true } }
      }
    });

    for (const m of members) {
      const u = m.user;
      if (!u) continue;
      if (norm(u.email) === a) return u.id;
      if (u.name && norm(u.name) === a) return u.id;
      const first = (u.name || '').split(/\s+/)[0];
      if (first && norm(first) === a) return u.id;
    }
    return null;
  }

  /**
   * In-app notification when a user is assigned a task (create or assignee change).
   * Skips self-assignment, unresolved assignee strings, and duplicate assignee on update.
   */
  static async notifyTaskAssigned({
    task,
    workspaceId,
    workspaceName,
    actorUserId,
    previousAssignee
  }) {
    try {
      const assigneeStr = task.assignee;
      if (!assigneeStr || !String(assigneeStr).trim()) return;

      const norm = (s) => (s == null || s === '' ? '' : String(s).trim().toLowerCase());
      const prev = previousAssignee === undefined ? null : norm(previousAssignee);
      const next = norm(assigneeStr);
      if (prev !== null && prev === next) return;

      const assigneeUserId = await this.resolveAssigneeToUserId(assigneeStr, workspaceId);
      if (!assigneeUserId) return;

      if (actorUserId != null && assigneeUserId === actorUserId) return;

      const settings = await prisma.notificationSettings.findUnique({
        where: { userId: assigneeUserId }
      });
      if (settings && settings.inAppSharedWithYou === false) return;

      await this.createNotification({
        userId: assigneeUserId,
        title: 'Task assigned to you',
        message: `You were assigned "${task.title || 'Task'}" in ${workspaceName || 'your workspace'}`,
        type: 'task_assigned',
        priority: 'high',
        workspace: workspaceName || null,
        actionRequired: true,
        relatedId: `task_${task.id}`
      });
    } catch (error) {
      console.error('[NotificationService] notifyTaskAssigned:', error);
    }
  }

  /**
   * Notify when workspace is deleted
   */
  static async notifyWorkspaceDeleted(workspace) {
    try {
      // Get all workspace members before deletion
      const members = await prisma.workspaceMember.findMany({
        where: {
          workspaceId: workspace.id,
          isActive: true
        },
        select: { userId: true }
      });

      if (members.length === 0) return;

      const userIds = members.map(m => m.userId);

      await this.createBulkNotifications({
        userIds,
        title: 'Workspace Deleted',
        message: `The workspace "${workspace.name}" has been permanently deleted`,
        type: 'workspace_deleted',
        priority: 'high',
        workspace: workspace.name,
        actionRequired: false,
        relatedId: String(workspace.id)
      });
    } catch (error) {
      console.error('[NotificationService] Error in notifyWorkspaceDeleted:', error);
    }
  }
}

module.exports = NotificationService;


