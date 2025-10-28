const express = require("express");
const Meeting = require("../models/Meeting");
const WorkspaceLog = require("../models/WorkspaceLog");
const prisma = require("../lib/prisma");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

// Create a new meeting
router.post("/", authenticateToken, async (req, res) => {
  try {
    const {
      workspaceId,
      title,
      description,
      meetingLink,
      platform,
      location,
      startTime,
      endTime,
      duration,
      meetingType,
      status,
      isRecurring,
      recurrenceRule,
      agenda,
      notes,
      metadata,
      meetingSource,
      participantIds
    } = req.body;

    // Validate required fields
    if (!workspaceId || !title || !startTime || !endTime || !duration) {
      return res.status(400).json({ 
        error: "Missing required fields: workspaceId, title, startTime, endTime, duration" 
      });
    }

    // Check if user is a member of the workspace
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: parseInt(workspaceId),
          userId: req.user.id
        }
      }
    });

    if (!membership) {
      return res.status(403).json({ error: "You are not a member of this workspace" });
    }

    // Create meeting
    const meeting = await Meeting.create({
      workspaceId: parseInt(workspaceId),
      title,
      description,
      meetingLink,
      platform,
      location,
      startTime,
      endTime,
      duration: parseInt(duration),
      meetingType,
      status: status || 'scheduled', // Default to 'scheduled' if not provided
      isRecurring,
      recurrenceRule,
      createdById: req.user.id,
      agenda,
      notes,
      metadata,
      meetingSource,
      participantIds: participantIds || []
    });

    // Log meeting creation
    try {
      await WorkspaceLog.create({
        workspaceId: parseInt(workspaceId),
        userId: req.user.id,
        action: 'meeting_created',
        title: 'Meeting Scheduled',
        description: `${title} meeting was scheduled for ${new Date(startTime).toLocaleString()}`,
        metadata: { meetingId: meeting.id, title, startTime }
      });
    } catch (logError) {
      console.error("Error creating workspace log:", logError);
    }

    // Fetch full meeting details
    const fullMeeting = await Meeting.findById(meeting.id);

    res.status(201).json({
      message: "Meeting created successfully",
      meeting: fullMeeting
    });
  } catch (error) {
    console.error("Create meeting error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get all meetings for a workspace
router.get("/workspace/:workspaceId", authenticateToken, async (req, res) => {
  try {
    const workspaceId = parseInt(req.params.workspaceId);

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

    // Get filter parameters
    const filters = {
      status: req.query.status,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      upcoming: req.query.upcoming === 'true'
    };

    const meetings = await Meeting.findByWorkspaceId(workspaceId, filters);

    res.json({ meetings });
  } catch (error) {
    console.error("Get meetings error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get upcoming meetings for a workspace
router.get("/workspace/:workspaceId/upcoming", authenticateToken, async (req, res) => {
  try {
    const workspaceId = parseInt(req.params.workspaceId);
    const limit = parseInt(req.query.limit) || 10;

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

    const meetings = await Meeting.getUpcomingMeetings(workspaceId, limit);

    res.json({ meetings });
  } catch (error) {
    console.error("Get upcoming meetings error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get today's meetings for a workspace
router.get("/workspace/:workspaceId/today", authenticateToken, async (req, res) => {
  try {
    const workspaceId = parseInt(req.params.workspaceId);

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

    const meetings = await Meeting.getTodaysMeetings(workspaceId);

    res.json({ meetings });
  } catch (error) {
    console.error("Get today's meetings error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get user's meetings across all workspaces
router.get("/my-meetings", authenticateToken, async (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      upcoming: req.query.upcoming === 'true'
    };

    const meetings = await Meeting.findByUserId(req.user.id, filters);

    res.json({ meetings });
  } catch (error) {
    console.error("Get user meetings error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get meeting by ID
router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const meetingId = parseInt(req.params.id);

    if (isNaN(meetingId)) {
      return res.status(400).json({ error: "Invalid meeting ID" });
    }

    const meeting = await Meeting.findById(meetingId);

    if (!meeting) {
      return res.status(404).json({ error: "Meeting not found" });
    }

    // Check if user has access to this meeting
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: meeting.workspaceId,
          userId: req.user.id
        }
      }
    });

    if (!membership) {
      return res.status(403).json({ error: "You do not have access to this meeting" });
    }

    res.json({ meeting });
  } catch (error) {
    console.error("Get meeting error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update meeting
router.put("/:id", authenticateToken, async (req, res) => {
  try {
    const meetingId = parseInt(req.params.id);

    if (isNaN(meetingId)) {
      return res.status(400).json({ error: "Invalid meeting ID" });
    }

    // Get existing meeting
    const existingMeeting = await Meeting.findById(meetingId);

    if (!existingMeeting) {
      return res.status(404).json({ error: "Meeting not found" });
    }

    // Check if user is the creator or a workspace admin/owner
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: existingMeeting.workspaceId,
          userId: req.user.id
        }
      }
    });

    if (!membership) {
      return res.status(403).json({ error: "You do not have access to this workspace" });
    }

    // Only creator, admin, or owner can update
    if (existingMeeting.createdById !== req.user.id && 
        membership.role !== 'admin' && 
        membership.role !== 'owner') {
      return res.status(403).json({ error: "Only the meeting creator or workspace admin can update this meeting" });
    }

    // Update meeting
    const updatedMeeting = await Meeting.update(meetingId, req.body);

    // Log meeting update
    try {
      await WorkspaceLog.create({
        workspaceId: existingMeeting.workspaceId,
        userId: req.user.id,
        action: 'meeting_updated',
        title: 'Meeting Updated',
        description: `${existingMeeting.title} meeting was updated`,
        metadata: { meetingId, title: existingMeeting.title }
      });
    } catch (logError) {
      console.error("Error creating workspace log:", logError);
    }

    // Fetch full updated meeting
    const fullMeeting = await Meeting.findById(meetingId);

    res.json({
      message: "Meeting updated successfully",
      meeting: fullMeeting
    });
  } catch (error) {
    console.error("Update meeting error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delete meeting
router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    const meetingId = parseInt(req.params.id);

    if (isNaN(meetingId)) {
      return res.status(400).json({ error: "Invalid meeting ID" });
    }

    // Get existing meeting
    const existingMeeting = await Meeting.findById(meetingId);

    if (!existingMeeting) {
      return res.status(404).json({ error: "Meeting not found" });
    }

    // Check if user is the creator or a workspace admin/owner
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: existingMeeting.workspaceId,
          userId: req.user.id
        }
      }
    });

    if (!membership) {
      return res.status(403).json({ error: "You do not have access to this workspace" });
    }

    // Only creator, admin, or owner can delete
    if (existingMeeting.createdById !== req.user.id && 
        membership.role !== 'admin' && 
        membership.role !== 'owner') {
      return res.status(403).json({ error: "Only the meeting creator or workspace admin can delete this meeting" });
    }

    await Meeting.delete(meetingId);

    // Log meeting deletion
    try {
      await WorkspaceLog.create({
        workspaceId: existingMeeting.workspaceId,
        userId: req.user.id,
        action: 'meeting_deleted',
        title: 'Meeting Deleted',
        description: `${existingMeeting.title} meeting was deleted`,
        metadata: { meetingId, title: existingMeeting.title }
      });
    } catch (logError) {
      console.error("Error creating workspace log:", logError);
    }

    res.json({ message: "Meeting deleted successfully" });
  } catch (error) {
    console.error("Delete meeting error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update meeting status (start, complete, cancel)
router.patch("/:id/status", authenticateToken, async (req, res) => {
  try {
    const meetingId = parseInt(req.params.id);
    const { status } = req.body;

    if (isNaN(meetingId)) {
      return res.status(400).json({ error: "Invalid meeting ID" });
    }

    if (!status || !['scheduled', 'in-progress', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: "Invalid status. Must be: scheduled, in-progress, completed, or cancelled" });
    }

    const meeting = await Meeting.findById(meetingId);

    if (!meeting) {
      return res.status(404).json({ error: "Meeting not found" });
    }

    // Check access
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: meeting.workspaceId,
          userId: req.user.id
        }
      }
    });

    if (!membership) {
      return res.status(403).json({ error: "You do not have access to this workspace" });
    }

    const updatedMeeting = await Meeting.updateStatus(meetingId, status);

    // Log status change
    try {
      await WorkspaceLog.create({
        workspaceId: meeting.workspaceId,
        userId: req.user.id,
        action: 'meeting_status_changed',
        title: 'Meeting Status Changed',
        description: `${meeting.title} meeting status changed to ${status}`,
        metadata: { meetingId, title: meeting.title, status }
      });
    } catch (logError) {
      console.error("Error creating workspace log:", logError);
    }

    res.json({
      message: "Meeting status updated successfully",
      meeting: updatedMeeting
    });
  } catch (error) {
    console.error("Update meeting status error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update participant status (accept, decline, tentative)
router.patch("/:id/participants/:userId/status", authenticateToken, async (req, res) => {
  try {
    const meetingId = parseInt(req.params.id);
    const participantUserId = parseInt(req.params.userId);
    const { status } = req.body;

    if (isNaN(meetingId) || isNaN(participantUserId)) {
      return res.status(400).json({ error: "Invalid meeting ID or user ID" });
    }

    // User can only update their own status
    if (participantUserId !== req.user.id) {
      return res.status(403).json({ error: "You can only update your own participation status" });
    }

    if (!status || !['invited', 'accepted', 'declined', 'tentative', 'attended'].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const updatedParticipant = await Meeting.updateParticipantStatus(meetingId, participantUserId, status);

    res.json({
      message: "Participant status updated successfully",
      participant: updatedParticipant
    });
  } catch (error) {
    console.error("Update participant status error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get meeting statistics for a workspace
router.get("/workspace/:workspaceId/statistics", authenticateToken, async (req, res) => {
  try {
    const workspaceId = parseInt(req.params.workspaceId);

    if (isNaN(workspaceId)) {
      return res.status(400).json({ error: "Invalid workspace ID" });
    }

    // Check access
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

    const statistics = await Meeting.getStatistics(
      workspaceId,
      req.query.startDate,
      req.query.endDate
    );

    res.json({ statistics });
  } catch (error) {
    console.error("Get meeting statistics error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;

