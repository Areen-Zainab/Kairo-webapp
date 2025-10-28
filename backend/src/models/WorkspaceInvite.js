const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const prisma = new PrismaClient();

class WorkspaceInvite {
  /**
   * Create a new workspace invitation
   */
  static async create({ workspaceId, invitedEmail, invitedUserId, invitedBy, role = 'member', expiresInDays = 7 }) {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    return await prisma.workspaceInvite.create({
      data: {
        workspaceId,
        invitedEmail: invitedEmail.toLowerCase(),
        invitedUserId,
        invitedBy,
        role,
        token,
        expiresAt,
        status: 'pending'
      },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            description: true
          }
        },
        inviter: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });
  }

  /**
   * Find invite by ID
   */
  static async findById(id) {
    return await prisma.workspaceInvite.findUnique({
      where: { id },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            description: true
          }
        },
        inviter: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });
  }

  /**
   * Find invite by token
   */
  static async findByToken(token) {
    return await prisma.workspaceInvite.findUnique({
      where: { token },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            description: true,
            ownerId: true
          }
        },
        inviter: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });
  }

  /**
   * Find existing invite for email and workspace
   */
  static async findExisting(workspaceId, invitedEmail) {
    return await prisma.workspaceInvite.findUnique({
      where: {
        workspaceId_invitedEmail: {
          workspaceId,
          invitedEmail: invitedEmail.toLowerCase()
        }
      }
    });
  }

  /**
   * Get all pending invites for a user
   */
  static async getPendingInvites(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true }
    });

    if (!user) return [];

    return await prisma.workspaceInvite.findMany({
      where: {
        OR: [
          { invitedUserId: userId },
          { invitedEmail: user.email.toLowerCase() }
        ],
        status: 'pending',
        expiresAt: {
          gt: new Date()
        }
      },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            description: true,
            colorTheme: true
          }
        },
        inviter: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        sentAt: 'desc'
      }
    });
  }

  /**
   * Get all invites for a workspace
   */
  static async getWorkspaceInvites(workspaceId, status = null) {
    const where = { workspaceId };
    if (status) {
      where.status = status;
    }

    return await prisma.workspaceInvite.findMany({
      where,
      include: {
        inviter: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        invitedUser: {
          select: {
            id: true,
            name: true,
            email: true,
            profilePictureUrl: true
          }
        }
      },
      orderBy: {
        sentAt: 'desc'
      }
    });
  }

  /**
   * Accept an invitation
   */
  static async accept(inviteId, userId) {
    const invite = await this.findById(inviteId);
    
    if (!invite) {
      throw new Error('Invitation not found');
    }

    if (invite.status !== 'pending') {
      throw new Error('Invitation is no longer pending');
    }

    if (invite.expiresAt && new Date() > invite.expiresAt) {
      await this.expire(inviteId);
      throw new Error('Invitation has expired');
    }

    // Check if user is already a member
    const existingMember = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: invite.workspaceId,
          userId: userId
        }
      }
    });

    if (existingMember) {
      throw new Error('User is already a member of this workspace');
    }

    // Use transaction to ensure both operations succeed or fail together
    return await prisma.$transaction(async (tx) => {
      // Update invite status
      const updatedInvite = await tx.workspaceInvite.update({
        where: { id: inviteId },
        data: {
          status: 'accepted',
          respondedAt: new Date(),
          invitedUserId: userId
        }
      });

      // Add user to workspace members
      const member = await tx.workspaceMember.create({
        data: {
          workspaceId: invite.workspaceId,
          userId: userId,
          role: invite.role,
          isActive: true
        }
      });

      return { invite: updatedInvite, member };
    });
  }

  /**
   * Reject an invitation
   */
  static async reject(inviteId) {
    const invite = await this.findById(inviteId);
    
    if (!invite) {
      throw new Error('Invitation not found');
    }

    if (invite.status !== 'pending') {
      throw new Error('Invitation is no longer pending');
    }

    return await prisma.workspaceInvite.update({
      where: { id: inviteId },
      data: {
        status: 'rejected',
        respondedAt: new Date()
      }
    });
  }

  /**
   * Expire an invitation
   */
  static async expire(inviteId) {
    return await prisma.workspaceInvite.update({
      where: { id: inviteId },
      data: {
        status: 'expired'
      }
    });
  }

  /**
   * Cancel/delete an invitation
   */
  static async cancel(inviteId) {
    return await prisma.workspaceInvite.delete({
      where: { id: inviteId }
    });
  }

  /**
   * Check and expire old invitations
   */
  static async expireOldInvitations() {
    return await prisma.workspaceInvite.updateMany({
      where: {
        status: 'pending',
        expiresAt: {
          lt: new Date()
        }
      },
      data: {
        status: 'expired'
      }
    });
  }
}

module.exports = WorkspaceInvite;

