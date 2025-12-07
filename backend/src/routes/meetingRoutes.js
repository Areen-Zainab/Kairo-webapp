const express = require("express");
const fs = require('fs');
const path = require('path');
const Meeting = require("../models/Meeting");
const MeetingFile = require("../models/MeetingFile");
const WorkspaceLog = require("../models/WorkspaceLog");
const MeetingNote = require("../models/MeetingNote");
const prisma = require("../lib/prisma");
const { authenticateToken } = require("../middleware/auth");
const { stopMeetingSession, getActiveSessions, removeFromActiveSessions, activeSessions } = require("../jobs/autoJoinMeetings");
const multer = require('multer');
const { saveMeetingFile, getFileBuffer, deleteMeetingFile, detectFileType, findCompleteAudioFile, getLiveTranscriptEntries, getDiarizedTranscript } = require("../utils/meetingFileStorage");
const { getMeetingStats } = require("../utils/meetingStats");

const router = express.Router();
const { spawn } = require('child_process');

// Configure multer for file uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

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

    // Validate that all participants are members of the workspace
    if (participantIds && participantIds.length > 0) {
      const workspaceMemberIds = await prisma.workspaceMember.findMany({
        where: {
          workspaceId: parseInt(workspaceId),
          userId: { in: participantIds }
        },
        select: { userId: true }
      });

      const validParticipantIds = new Set(workspaceMemberIds.map(m => m.userId));
      const invalidParticipants = participantIds.filter(id => !validParticipantIds.has(id));

      if (invalidParticipants.length > 0) {
        return res.status(400).json({ 
          error: `Cannot invite these participants. They must be members of the workspace first. Please ask them to join the workspace before inviting them to the meeting.`,
          details: `Invalid participant IDs: ${invalidParticipants.join(', ')}`
        });
      }
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

// Handle CORS preflight for audio endpoint
router.options("/:meetingId/audio", (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.sendStatus(200);
});

// Get meeting audio file (must be before /:id route to avoid route conflicts)
router.get("/:meetingId/audio", authenticateToken, async (req, res) => {
  try {
    const meetingId = parseInt(req.params.meetingId);

    if (isNaN(meetingId)) {
      return res.status(400).json({ error: "Invalid meeting ID" });
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
      return res.status(403).json({ error: "You do not have access to this meeting" });
    }

    // Find audio file
    const audioPath = findCompleteAudioFile(meetingId);
    if (!audioPath || !fs.existsSync(audioPath)) {
      return res.status(404).json({ error: "Audio file not found" });
    }

    // Determine content type based on file extension
    const ext = path.extname(audioPath).toLowerCase();
    let contentType = 'audio/mpeg'; // Default to MP3
    if (ext === '.webm') {
      contentType = 'audio/webm';
    } else if (ext === '.wav') {
      contentType = 'audio/wav';
    } else if (ext === '.m4a') {
      contentType = 'audio/mp4';
    } else if (ext === '.ogg') {
      contentType = 'audio/ogg';
    }

    // Get file stats for Content-Length header
    const stats = fs.statSync(audioPath);
    const fileSize = stats.size;

    // Set headers for audio streaming
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', fileSize);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Stream the file
    const fileStream = fs.createReadStream(audioPath);
    fileStream.pipe(res);
  } catch (error) {
    console.error("Get meeting audio error:", error);
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

    // Get transcript and audio stats if meeting is completed
    let stats = null;
    if (meeting.status === 'completed' || meeting.status === 'in-progress') {
      try {
        // Pass recordingUrl to getMeetingStats so it can use the exact path from database
        stats = await getMeetingStats(meetingId, meeting.recordingUrl);
      } catch (error) {
        console.error('Error getting meeting stats:', error);
        // Continue without stats if there's an error
      }
    }

    // Only check for audio file if meeting is completed (live meetings don't need audio playback)
    let audioUrl = null;
    if (meeting.status === 'completed') {
    const audioPath = findCompleteAudioFile(meetingId);
    console.log(`[Meeting ${meetingId}] Audio file check:`, {
      audioPath,
      found: !!audioPath,
      meetingStatus: meeting.status
    });
    if (audioPath) {
      // Construct URL for audio file
      audioUrl = `/api/meetings/${meetingId}/audio`;
      console.log(`[Meeting ${meetingId}] Audio URL set to:`, audioUrl);
    } else {
      console.log(`[Meeting ${meetingId}] No audio file found, audioUrl will be null`);
      }
    }

    // Add stats and audio URL to meeting metadata if available
    const meetingWithStats = {
      ...meeting,
      audioUrl: audioUrl || meeting.recordingUrl, // Use audioUrl if available, fallback to recordingUrl
      stats: stats || {
        transcriptLength: 0,
        audioDurationSeconds: 0,
        audioDurationMinutes: 0
      }
    };

    res.json({ meeting: meetingWithStats });
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

    // Validate that all participants are members of the workspace
    if (req.body.participantIds && req.body.participantIds.length > 0) {
      const workspaceMemberIds = await prisma.workspaceMember.findMany({
        where: {
          workspaceId: existingMeeting.workspaceId,
          userId: { in: req.body.participantIds }
        },
        select: { userId: true }
      });

      const validParticipantIds = new Set(workspaceMemberIds.map(m => m.userId));
      const invalidParticipants = req.body.participantIds.filter(id => !validParticipantIds.has(id));

      if (invalidParticipants.length > 0) {
        return res.status(400).json({ 
          error: `Cannot invite these participants. They must be members of the workspace first. Please ask them to join the workspace before inviting them to the meeting.`,
          details: `Invalid participant IDs: ${invalidParticipants.join(', ')}`
        });
      }
    }

    // Update meeting (pass updaterId for notification purposes)
    const updatedMeeting = await Meeting.update(meetingId, {
      ...req.body,
      updaterId: req.user.id
    });

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

    // Allow owner/admin or meeting creator to delete
    const isOwnerOrAdmin = membership.role === 'owner' || membership.role === 'admin';
    const isCreator = existingMeeting.createdById === req.user.id;
    if (!isOwnerOrAdmin && !isCreator) {
      return res.status(403).json({ error: "Only workspace owner, admin, or the meeting creator can delete this meeting" });
    }

    // Stop active bot session if any
    try {
      await stopMeetingSession(meetingId);
      console.log(`Stopped active bot session for deleted meeting ${meetingId}`);
    } catch (sessionError) {
      console.error(`Error stopping bot session for meeting ${meetingId}:`, sessionError);
      // Continue with deletion even if stopping session fails
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

    // Enforce permissions for cancellation and completion
    if (status === 'cancelled') {
      // Allow owner/admin or meeting creator
      const isOwnerOrAdmin = membership.role === 'owner' || membership.role === 'admin';
      const isCreator = meeting.createdById === req.user.id;
      if (!isOwnerOrAdmin && !isCreator) {
        return res.status(403).json({ error: "Only workspace owner, admin, or the meeting creator can cancel this meeting" });
      }
    }

    if (status === 'completed') {
      // Allow owner/admin or meeting creator
      const isOwnerOrAdmin = membership.role === 'owner' || membership.role === 'admin';
      const isCreator = meeting.createdById === req.user.id;
      if (!isOwnerOrAdmin && !isCreator) {
        return res.status(403).json({ error: "Only workspace owner, admin, or the meeting creator can mark this meeting as completed" });
      }
    }

    // Update meeting status first (respond quickly to frontend)
    const updatedMeeting = await Meeting.updateStatus(meetingId, status, req.user.id);

    // If meeting is being marked as completed or cancelled, stop the bot session
    if (status === 'completed' || status === 'cancelled') {
      console.log(`\n🛑 [ROUTE] Meeting ${meetingId} marked as ${status}, stopping bot session...`);
      console.log(`   Active sessions before stop: ${getActiveSessions().join(', ') || 'none'}`);
      
      // Stop active bot session in background (don't wait for this to complete)
      // This will close the browser and remove it from activeSessions
      stopMeetingSession(meetingId)
        .then((stopped) => {
          if (stopped) {
            console.log(`✅ [ROUTE] Stopped active bot session for ${status} meeting ${meetingId}`);
          } else {
            console.log(`⚠️ [ROUTE] No active session found to stop for meeting ${meetingId}`);
            console.log(`   This might be normal if bot was started via separate process (meetService.js)`);
          }
          console.log(`   Active sessions after stop: ${getActiveSessions().join(', ') || 'none'}`);
        })
        .catch((sessionError) => {
          console.error(`❌ [ROUTE] Error stopping bot session for meeting ${meetingId}:`, sessionError);
          console.error(sessionError.stack);
          // Even if stopping fails, remove from activeSessions to prevent auto-join
          removeFromActiveSessions(meetingId);
        });
    }

    // Log status change
    try {
      // Map status to user-friendly title with meeting name
      const statusTitles = {
        'completed': `Meeting completed: ${meeting.title}`,
        'cancelled': `Meeting cancelled: ${meeting.title}`,
        'in-progress': `Meeting started: ${meeting.title}`,
        'scheduled': `Meeting scheduled: ${meeting.title}`,
        'upcoming': `Meeting scheduled: ${meeting.title}`
      };
      
      const title = statusTitles[status] || `Meeting status changed: ${meeting.title}`;
      const description = status === 'completed' 
        ? `${meeting.title} meeting was completed`
        : status === 'cancelled'
        ? `${meeting.title} meeting was cancelled`
        : status === 'in-progress'
        ? `${meeting.title} meeting has started`
        : `${meeting.title} meeting status changed to ${status}`;

      await WorkspaceLog.create({
        workspaceId: meeting.workspaceId,
        userId: req.user.id,
        action: 'meeting_status_changed',
        title: title,
        description: description,
        metadata: { meetingId, title: meeting.title, status }
      });
    } catch (logError) {
      console.error("Error creating workspace log:", logError);
    }

    // Respond immediately to frontend
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

// Get notes for a meeting
router.get('/:id/notes', authenticateToken, async (req, res) => {
  try {
    const meetingId = parseInt(req.params.id);

    if (isNaN(meetingId)) {
      return res.status(400).json({ error: 'Invalid meeting ID' });
    }

    const meeting = await Meeting.findById(meetingId);

    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    // Access control: user must be a member of the workspace
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: meeting.workspaceId,
          userId: req.user.id
        }
      }
    });

    if (!membership) {
      return res.status(403).json({ error: 'You do not have access to this workspace' });
    }

    const notes = await MeetingNote.findByMeetingId(meetingId);
    res.json({ notes });
  } catch (error) {
    console.error('Get meeting notes error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new note for a meeting
router.post('/:id/notes', authenticateToken, async (req, res) => {
  try {
    const meetingId = parseInt(req.params.id);
    const { content, type = 'manual', timestamp = 0, color = '#3b82f6' } = req.body;

    if (isNaN(meetingId)) {
      return res.status(400).json({ error: 'Invalid meeting ID' });
    }

    if (!content || typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ error: 'Note content is required' });
    }

    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    // Access control: user must be a member of the workspace
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: meeting.workspaceId,
          userId: req.user.id
        }
      }
    });

    if (!membership) {
      return res.status(403).json({ error: 'You do not have access to this workspace' });
    }

    const note = await MeetingNote.create({
      meetingId,
      userId: req.user.id,
      content: content.trim(),
      type,
      timestamp: typeof timestamp === 'number' ? timestamp : 0,
      color: color || '#3b82f6',
      authorName: req.user.name
    });

    res.status(201).json({ note });
  } catch (error) {
    console.error('Create meeting note error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update a note (only the creator can update)
router.patch('/:meetingId/notes/:noteId', authenticateToken, async (req, res) => {
  try {
    const meetingId = parseInt(req.params.meetingId);
    const noteId = parseInt(req.params.noteId);

    if (isNaN(meetingId) || isNaN(noteId)) {
      return res.status(400).json({ error: 'Invalid meeting ID or note ID' });
    }

    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    // Access control: user must be a member of the workspace
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: meeting.workspaceId,
          userId: req.user.id
        }
      }
    });

    if (!membership) {
      return res.status(403).json({ error: 'You do not have access to this workspace' });
    }

    const existing = await prisma.meetingNote.findUnique({
      where: { id: noteId }
    });

    if (!existing || existing.meetingId !== meetingId) {
      return res.status(404).json({ error: 'Note not found' });
    }

    if (existing.userId !== req.user.id) {
      return res.status(403).json({ error: 'You can only edit your own notes' });
    }

    const updates = {};
    if (typeof req.body.content === 'string') {
      updates.content = req.body.content.trim();
    }
    if (typeof req.body.color === 'string' && req.body.color) {
      updates.color = req.body.color;
    }
    if (typeof req.body.timestamp === 'number') {
      updates.timestamp = req.body.timestamp;
    }

    const note = await MeetingNote.update(noteId, updates);
    res.json({ note });
  } catch (error) {
    console.error('Update meeting note error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a note (only the creator can delete)
router.delete('/:meetingId/notes/:noteId', authenticateToken, async (req, res) => {
  try {
    const meetingId = parseInt(req.params.meetingId);
    const noteId = parseInt(req.params.noteId);

    if (isNaN(meetingId) || isNaN(noteId)) {
      return res.status(400).json({ error: 'Invalid meeting ID or note ID' });
    }

    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    // Access control: user must be a member of the workspace
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: meeting.workspaceId,
          userId: req.user.id
        }
      }
    });

    if (!membership) {
      return res.status(403).json({ error: 'You do not have access to this workspace' });
    }

    const existing = await prisma.meetingNote.findUnique({
      where: { id: noteId }
    });

    if (!existing || existing.meetingId !== meetingId) {
      return res.status(404).json({ error: 'Note not found' });
    }

    if (existing.userId !== req.user.id) {
      return res.status(403).json({ error: 'You can only delete your own notes' });
    }

    await MeetingNote.delete(noteId);
    res.json({ message: 'Note deleted successfully' });
  } catch (error) {
    console.error('Delete meeting note error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Trigger bot to join a meeting (scoped route)
router.post('/:id/bot/join', authenticateToken, async (req, res) => {
  try {
    const meetingId = parseInt(req.params.id);
    if (isNaN(meetingId)) {
      return res.status(400).json({ error: 'Invalid meeting ID' });
    }

    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    // Access control: user must be a member of the workspace
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: meeting.workspaceId,
          userId: req.user.id
        }
      }
    });
    if (!membership) {
      return res.status(403).json({ error: 'You do not have access to this workspace' });
    }

    // Validate meeting link
    const meetingLink = req.body?.meetingLink || meeting.meetingLink;
    if (!meetingLink || typeof meetingLink !== 'string') {
      return res.status(400).json({ error: 'Meeting link is required' });
    }

    // Prevent for cancelled/completed
    if (['cancelled', 'completed'].includes(meeting.status)) {
      return res.status(400).json({ error: `Cannot join a ${meeting.status} meeting` });
    }

    // Check if bot is already active for this meeting
    const { getActiveSessions, activeSessions } = require("../jobs/autoJoinMeetings");
    const activeSessionIds = getActiveSessions();
    if (activeSessionIds.includes(meetingId)) {
      console.log(`⚠️ [ROUTE] Bot already active for meeting ${meetingId}`);
      return res.status(400).json({ error: 'Bot is already active for this meeting' });
    }

    // Use MeetingBot class (same as autoJoinMeetings) to ensure session is tracked
    const MeetingBot = require('../services/MeetingBot');
    
    // Calculate duration (from now until meeting end, minimum 5 minutes)
    const now = new Date();
    const meetingEndTime = new Date(meeting.endTime);
    const durationMs = Math.max(meetingEndTime.getTime() - now.getTime(), 5 * 60 * 1000);
    const durationMinutes = Math.ceil(durationMs / (60 * 1000));

    console.log(`\n🤖 [ROUTE] Joining meeting ${meetingId} via bot/join route...`);
    console.log(`   Meeting: ${meeting.title}`);
    console.log(`   Duration: ${durationMinutes} minutes`);
    console.log(`   Link: ${meetingLink.substring(0, 50)}...`);

    // Start bot in background (don't await - respond immediately to frontend)
    const bot = new MeetingBot({
      meetUrl: meetingLink,
      botName: process.env.BOT_NAME || 'Kairo Bot',
      durationMinutes: durationMinutes,
      meetingId: String(meeting.id),
      meetingTitle: meeting.title || ''
    });

    // Start bot and store session in activeSessions
    bot.start()
      .then((session) => {
        // Store session in activeSessions Map so it can be stopped later
        activeSessions.set(meetingId, session);
        console.log(`✅ [ROUTE] Bot session started and stored for meeting ${meetingId}`);
        console.log(`   Active sessions: ${Array.from(activeSessions.keys()).join(', ')}`);
      })
      .catch((error) => {
        console.error(`❌ [ROUTE] Error starting bot for meeting ${meetingId}:`, error);
        console.error(error.stack);
      });

    return res.status(200).json({
      message: 'Bot join triggered',
      data: { meetingId: meetingId }
    });
  } catch (error) {
    console.error('Bot join error:', error);
    return res.status(500).json({ error: 'Failed to trigger bot join' });
  }
});

// Generic route: POST /meetings/bot/join { meetingId, meetingLink }
router.post('/bot/join', authenticateToken, async (req, res) => {
  try {
    const meetingId = parseInt(req.body?.meetingId);
    const meetingLink = req.body?.meetingLink;

    if (!meetingId || isNaN(meetingId)) {
      return res.status(400).json({ error: 'meetingId is required' });
    }

    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    // Access control
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: meeting.workspaceId,
          userId: req.user.id
        }
      }
    });
    if (!membership) {
      return res.status(403).json({ error: 'You do not have access to this workspace' });
    }

    // Determine link (prefer body, fallback to meeting record)
    const link = typeof meetingLink === 'string' && meetingLink ? meetingLink : meeting.meetingLink;
    if (!link) {
      return res.status(400).json({ error: 'Meeting link is required' });
    }

    if (['cancelled', 'completed'].includes(meeting.status)) {
      return res.status(400).json({ error: `Cannot join a ${meeting.status} meeting` });
    }

    // Check if bot is already active for this meeting
    const activeSessionIds = getActiveSessions();
    if (activeSessionIds.includes(meetingId)) {
      console.log(`⚠️ [ROUTE] Bot already active for meeting ${meetingId}`);
      return res.status(400).json({ error: 'Bot is already active for this meeting' });
    }

    // Use MeetingBot class (same as autoJoinMeetings) to ensure session is tracked
    const MeetingBot = require('../services/MeetingBot');
    
    // Calculate duration (from now until meeting end, minimum 5 minutes)
    const now = new Date();
    const meetingEndTime = new Date(meeting.endTime);
    const durationMs = Math.max(meetingEndTime.getTime() - now.getTime(), 5 * 60 * 1000);
    const durationMinutes = Math.ceil(durationMs / (60 * 1000));

    console.log(`\n🤖 [ROUTE] Joining meeting ${meetingId} via /bot/join route...`);
    console.log(`   Meeting: ${meeting.title}`);
    console.log(`   Duration: ${durationMinutes} minutes`);
    console.log(`   Link: ${link.substring(0, 50)}...`);

    // Start bot in background (don't await - respond immediately to frontend)
    const bot = new MeetingBot({
      meetUrl: link,
      botName: process.env.BOT_NAME || 'Kairo Bot',
      durationMinutes: durationMinutes,
      meetingId: String(meeting.id),
      meetingTitle: meeting.title || ''
    });

    // Start bot and store session in activeSessions
    bot.start()
      .then((session) => {
        // Store session in activeSessions Map so it can be stopped later
        activeSessions.set(meetingId, session);
        console.log(`✅ [ROUTE] Bot session started and stored for meeting ${meetingId}`);
        console.log(`   Active sessions: ${Array.from(activeSessions.keys()).join(', ')}`);
      })
      .catch((error) => {
        console.error(`❌ [ROUTE] Error starting bot for meeting ${meetingId}:`, error);
        console.error(error.stack);
      });

    return res.status(200).json({
      message: 'Bot join triggered',
      data: { meetingId: meetingId }
    });
  } catch (error) {
    console.error('Bot join error:', error);
    return res.status(500).json({ error: 'Failed to trigger bot join' });
  }
});

// ==================== Meeting Files Routes ====================

// Get all files for a meeting
router.get("/:id/files", authenticateToken, async (req, res) => {
  try {
    const meetingId = parseInt(req.params.id);

    if (isNaN(meetingId)) {
      return res.status(400).json({ error: "Invalid meeting ID" });
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
      return res.status(403).json({ error: "You do not have access to this meeting" });
    }

    const files = await MeetingFile.findByMeetingId(meetingId);
    res.json({ files });
  } catch (error) {
    console.error("Get meeting files error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Upload a file for a meeting
router.post("/:id/files", authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const meetingId = parseInt(req.params.id);

    if (isNaN(meetingId)) {
      return res.status(400).json({ error: "Invalid meeting ID" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res.status(404).json({ error: "Meeting not found" });
    }

    // Check workspace membership
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

    // Check if user is workspace owner/admin OR a meeting participant
    const isOwnerOrAdmin = membership.role === 'owner' || membership.role === 'admin';
    
    if (!isOwnerOrAdmin) {
      // Check if user is a participant of this meeting
      const participant = await prisma.meetingParticipant.findUnique({
        where: {
          meetingId_userId: {
            meetingId: meetingId,
            userId: req.user.id
          }
        }
      });

      if (!participant) {
        return res.status(403).json({ 
          error: "Only workspace owners/admins and meeting participants can upload files" 
        });
      }
    }

    // Get user info for uploader name
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { name: true, email: true }
    });

    // Save file to disk
    const { filepath, filename } = await saveMeetingFile(
      meetingId,
      req.file.buffer,
      req.file.originalname
    );

    // Detect file type
    const fileType = detectFileType(req.file.mimetype, req.file.originalname);

    // Create database record
    const file = await MeetingFile.create({
      meetingId,
      userId: req.user.id,
      filename: req.file.originalname, // Store original filename
      filepath, // Store relative path
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      fileType,
      uploaderName: user?.name || user?.email || 'Unknown'
    });

    res.status(201).json({
      message: "File uploaded successfully",
      file
    });
  } catch (error) {
    console.error("Upload meeting file error:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

// Download a meeting file
router.get("/:meetingId/files/:fileId/download", authenticateToken, async (req, res) => {
  try {
    const meetingId = parseInt(req.params.meetingId);
    const fileId = parseInt(req.params.fileId);

    if (isNaN(meetingId) || isNaN(fileId)) {
      return res.status(400).json({ error: "Invalid meeting ID or file ID" });
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
      return res.status(403).json({ error: "You do not have access to this meeting" });
    }

    const file = await MeetingFile.findById(fileId);
    if (!file || file.meetingId !== meetingId) {
      return res.status(404).json({ error: "File not found" });
    }

    // Get file buffer
    const buffer = getFileBuffer(file.filepath);

    // Set headers for download
    res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    res.setHeader('Content-Length', file.fileSize);

    res.send(buffer);
  } catch (error) {
    console.error("Download meeting file error:", error);
    if (error.message === 'File not found') {
      return res.status(404).json({ error: "File not found" });
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delete a meeting file
router.delete("/:meetingId/files/:fileId", authenticateToken, async (req, res) => {
  try {
    const meetingId = parseInt(req.params.meetingId);
    const fileId = parseInt(req.params.fileId);

    if (isNaN(meetingId) || isNaN(fileId)) {
      return res.status(400).json({ error: "Invalid meeting ID or file ID" });
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
      return res.status(403).json({ error: "You do not have access to this meeting" });
    }

    const file = await MeetingFile.findById(fileId);
    if (!file || file.meetingId !== meetingId) {
      return res.status(404).json({ error: "File not found" });
    }

    // Only file owner or workspace admin/owner can delete
    const isOwner = file.uploadedBy.id === req.user.id;
    const isAdminOrOwner = membership.role === 'admin' || membership.role === 'owner';
    
    if (!isOwner && !isAdminOrOwner) {
      return res.status(403).json({ error: "You can only delete your own files" });
    }

    // Delete physical file
    try {
      deleteMeetingFile(file.filepath);
    } catch (fileError) {
      console.error("Error deleting physical file:", fileError);
      // Continue with DB deletion even if file deletion fails
    }

    // Delete database record
    await MeetingFile.delete(fileId);

    res.json({ message: "File deleted successfully" });
  } catch (error) {
    console.error("Delete meeting file error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get live transcript entries for a meeting
router.get("/:id/transcript/live", authenticateToken, async (req, res) => {
  try {
    const meetingId = parseInt(req.params.id);
    const { since } = req.query;

    if (isNaN(meetingId)) {
      return res.status(400).json({ error: "Invalid meeting ID" });
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
      return res.status(403).json({ error: "You do not have access to this meeting" });
    }

    // Get transcript entries (filtered by since if provided)
    const entries = getLiveTranscriptEntries(meetingId, since || null);

    // Get latest timestamp from entries
    const latestTimestamp = entries.length > 0
      ? entries[entries.length - 1].rawTimestamp
      : (since || new Date().toISOString());

    res.json({
      entries,
      latestTimestamp,
      hasMore: false
    });
  } catch (error) {
    console.error("Get live transcript error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get diarized transcript for a completed meeting
router.get("/:id/transcript", authenticateToken, async (req, res) => {
  try {
    const meetingId = parseInt(req.params.id);

    if (isNaN(meetingId)) {
      return res.status(400).json({ error: "Invalid meeting ID" });
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
      return res.status(403).json({ error: "You do not have access to this meeting" });
    }

    // Get diarized transcript entries
    const entries = getDiarizedTranscript(meetingId);

    res.json({
      transcript: entries
    });
  } catch (error) {
    console.error("Get transcript error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get AI insights for a meeting
router.get("/:id/ai-insights", authenticateToken, async (req, res) => {
  try {
    const meetingId = parseInt(req.params.id);

    if (isNaN(meetingId)) {
      return res.status(400).json({ error: "Invalid meeting ID" });
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
      return res.status(403).json({ error: "You do not have access to this meeting" });
    }

    // Convert meetingId to string for database query
    const meetingIdStr = String(meetingId);

    // Fetch all insights for this meeting
    const insightsRows = await prisma.$queryRaw`
      SELECT insight_type, content, confidence_score, created_at
      FROM ai_insights
      WHERE meeting_id = ${meetingIdStr}
      ORDER BY created_at DESC
    `;

    // If no insights found, return empty structure
    if (!insightsRows || insightsRows.length === 0) {
      return res.json({
        summary: null,
        keyDecisions: [],
        actionItems: [],
        sentiment: null,
        topics: [],
        participants: [],
        generated: false
      });
    }

    // Parse and organize insights by type
    const insights = {
      summary: null,
      keyDecisions: [],
      actionItems: [],
      sentiment: null,
      topics: [],
      participants: [],
      generated: true
    };

    for (const row of insightsRows) {
      try {
        const content = typeof row.content === 'string' 
          ? JSON.parse(row.content) 
          : row.content;

        switch (row.insight_type) {
          case 'summary':
            insights.summary = content;
            break;
          case 'decisions':
            // Handle both array and single decision
            if (Array.isArray(content)) {
              insights.keyDecisions = content;
            } else if (content.decisions && Array.isArray(content.decisions)) {
              insights.keyDecisions = content.decisions;
            } else {
              insights.keyDecisions = [content];
            }
            break;
          case 'action_items':
            // Handle both array and single action item
            if (Array.isArray(content)) {
              insights.actionItems = content;
            } else if (content.action_items && Array.isArray(content.action_items)) {
              insights.actionItems = content.action_items;
            } else {
              insights.actionItems = [content];
            }
            break;
          case 'sentiment':
            insights.sentiment = content;
            break;
          case 'topics':
            // Handle both array and single topic
            if (Array.isArray(content)) {
              insights.topics = content;
            } else if (content.topics && Array.isArray(content.topics)) {
              insights.topics = content.topics;
            } else {
              insights.topics = [content];
            }
            break;
          case 'other':
            // 'other' type is used for participants
            if (Array.isArray(content)) {
              insights.participants = content;
            } else if (content.participants && Array.isArray(content.participants)) {
              insights.participants = content.participants;
            } else {
              insights.participants = [content];
            }
            break;
        }
      } catch (parseError) {
        console.error(`Error parsing insight content for type ${row.insight_type}:`, parseError);
        // Continue with other insights even if one fails to parse
      }
    }

    res.json(insights);
  } catch (error) {
    console.error("Get AI insights error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Regenerate AI insights for a meeting
router.post("/:id/ai-insights/regenerate", authenticateToken, async (req, res) => {
  try {
    const meetingId = parseInt(req.params.id);

    if (isNaN(meetingId)) {
      return res.status(400).json({ error: "Invalid meeting ID" });
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
      return res.status(403).json({ error: "You do not have access to this meeting" });
    }

    // Check if user has permission (optional: only organizer or admin)
    // For now, any workspace member can regenerate

    // Trigger insights regeneration
    const AIInsightsService = require('../services/AIInsightsService');
    
    // Delete existing insights first
    const meetingIdStr = String(meetingId);
    await prisma.$executeRaw`
      DELETE FROM ai_insights WHERE meeting_id = ${meetingIdStr}
    `;

    // Generate new insights (async, don't wait for completion)
    AIInsightsService.generateInsights(meetingId)
      .then((result) => {
        if (result.success) {
          console.log(`✅ AI insights regeneration completed for meeting ${meetingId}`);
        } else {
          console.error(`⚠️ AI insights regeneration failed for meeting ${meetingId}: ${result.error}`);
        }
      })
      .catch((err) => {
        console.error(`⚠️ AI insights regeneration error for meeting ${meetingId}:`, err.message);
      });

    // Return immediately (regeneration happens in background)
    res.json({
      success: true,
      message: "AI insights regeneration started. Please refresh the page in a few moments to see updated insights."
    });
  } catch (error) {
    console.error("Regenerate AI insights error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;

