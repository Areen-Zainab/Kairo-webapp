const express = require("express");
const prisma = require("../lib/prisma");
const Notification = require("../models/Notification");
const WorkspaceInvite = require("../models/WorkspaceInvite");
const WorkspaceLog = require("../models/WorkspaceLog");
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
    const workspaces = await prisma.workspaceMember.findMany({
      where: {
        userId: req.user.id,
        isActive: true,
        workspace: {
          isActive: true  // Only return active workspaces
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

