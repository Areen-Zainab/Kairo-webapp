const prisma = require('../lib/prisma');

class WorkspaceLog {
  /**
   * Create a new workspace log entry
   */
  static async create({ workspaceId, userId, action, title, description, metadata = null }) {
    return await prisma.workspaceLog.create({
      data: {
        workspaceId,
        userId,
        action,
        title,
        description,
        metadata
      }
    });
  }

  /**
   * Get all logs for a workspace
   */
  static async findByWorkspaceId(workspaceId, limit = 100, offset = 0) {
    return await prisma.workspaceLog.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      select: {
        id: true,
        action: true,
        title: true,
        description: true,
        metadata: true,
        createdAt: true,
        userId: true
      }
    });
  }

  /**
   * Get logs with user information
   */
  static async findByWorkspaceIdWithUser(workspaceId, limit = 100, offset = 0) {
    const logs = await prisma.workspaceLog.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    });

    // Get unique user IDs
    const userIds = [...new Set(logs.filter(log => log.userId).map(log => log.userId))];
    
    // Fetch user information
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        name: true,
        email: true,
        profilePictureUrl: true
      }
    });

    // Create a user map for quick lookup
    const userMap = {};
    users.forEach(user => {
      userMap[user.id] = user;
    });

    // Attach user information to logs
    return logs.map(log => ({
      id: log.id,
      action: log.action,
      title: log.title,
      description: log.description,
      metadata: log.metadata,
      createdAt: log.createdAt,
      user: log.userId ? userMap[log.userId] || null : null
    }));
  }

  /**
   * Get count of logs for a workspace
   */
  static async getCount(workspaceId) {
    return await prisma.workspaceLog.count({
      where: { workspaceId }
    });
  }

  /**
   * Delete logs older than a certain date
   */
  static async deleteOlderThan(workspaceId, date) {
    return await prisma.workspaceLog.deleteMany({
      where: {
        workspaceId,
        createdAt: { lt: date }
      }
    });
  }

  /**
   * Get logs by action type
   */
  static async findByAction(workspaceId, action, limit = 50) {
    return await prisma.workspaceLog.findMany({
      where: {
        workspaceId,
        action
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });
  }

  // ============ Helper methods for creating specific log types ============

  static async logWorkspaceCreated(workspaceId, userId, workspaceName) {
    return await this.create({
      workspaceId,
      userId,
      action: 'workspace_created',
      title: 'Workspace Created',
      description: `${workspaceName} workspace was created`,
      metadata: { workspaceName }
    });
  }

  static async logWorkspaceUpdated(workspaceId, userId, changes) {
    const changedFields = Object.keys(changes).join(', ');
    return await this.create({
      workspaceId,
      userId,
      action: 'workspace_updated',
      title: 'Workspace Updated',
      description: `Workspace settings were updated: ${changedFields}`,
      metadata: { changes }
    });
  }

  static async logMemberInvited(workspaceId, inviterId, invitedEmail, role) {
    return await this.create({
      workspaceId,
      userId: inviterId,
      action: 'member_invited',
      title: 'Member Invited',
      description: `${invitedEmail} was invited to join as ${role}`,
      metadata: { invitedEmail, role }
    });
  }

  static async logMemberJoined(workspaceId, userId, userName, role) {
    return await this.create({
      workspaceId,
      userId,
      action: 'member_joined',
      title: 'Member Joined',
      description: `${userName} joined the workspace as ${role}`,
      metadata: { userName, role }
    });
  }

  static async logMemberRemoved(workspaceId, removedById, removedUserName) {
    return await this.create({
      workspaceId,
      userId: removedById,
      action: 'member_removed',
      title: 'Member Removed',
      description: `${removedUserName} was removed from the workspace`,
      metadata: { removedUserName }
    });
  }

  static async logInviteAccepted(workspaceId, userId, userName) {
    return await this.create({
      workspaceId,
      userId,
      action: 'invite_accepted',
      title: 'Invitation Accepted',
      description: `${userName} accepted the workspace invitation`,
      metadata: { userName }
    });
  }

  static async logInviteRejected(workspaceId, userId, userName) {
    return await this.create({
      workspaceId,
      userId,
      action: 'invite_rejected',
      title: 'Invitation Rejected',
      description: `${userName} declined the workspace invitation`,
      metadata: { userName }
    });
  }

  static async logRoleChanged(workspaceId, changedById, targetUserName, oldRole, newRole) {
    return await this.create({
      workspaceId,
      userId: changedById,
      action: 'role_changed',
      title: 'Role Changed',
      description: `${targetUserName}'s role was changed from ${oldRole} to ${newRole}`,
      metadata: { targetUserName, oldRole, newRole }
    });
  }
}

module.exports = WorkspaceLog;

