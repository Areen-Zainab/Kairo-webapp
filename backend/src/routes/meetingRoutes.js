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
const { saveMeetingFile, getFileBuffer, deleteMeetingFile, detectFileType, findCompleteAudioFile, getLiveTranscriptEntries, getDiarizedTranscript, findMeetingDirectory } = require("../utils/meetingFileStorage");
const { getMeetingStats } = require("../utils/meetingStats");
const AIInsightsService = require("../services/AIInsightsService");
const NotificationService = require("../services/NotificationService");
const PrivacyModeService = require("../services/PrivacyModeService");

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

    // Send notifications
    try {
      const workspace = await prisma.workspace.findUnique({
        where: { id: parseInt(workspaceId) },
        select: { name: true }
      });

      // Notify workspace members about new meeting
      await NotificationService.notifyMeetingCreated(meeting, req.user.id, workspace?.name);

      // Notify invited participants
      if (participantIds && participantIds.length > 0) {
        await NotificationService.notifyMeetingInvite(meeting, participantIds, workspace?.name);
      }
    } catch (notifError) {
      console.error("Error sending meeting notifications:", notifError);
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
      console.log(`[Audio Endpoint] No audio file found for meeting ${meetingId}`);
      return res.status(404).json({ error: "Audio file not found" });
    }

    // Check if file is valid (has content and is not corrupted)
    const stats = fs.statSync(audioPath);
    const fileSize = stats.size;

    if (fileSize === 0) {
      console.error(`[Audio Endpoint] Audio file is empty for meeting ${meetingId}: ${audioPath}`);
      return res.status(404).json({ error: "Audio file is empty" });
    }

    // Validate file is readable and not corrupted by trying to open it
    try {
      const testStream = fs.createReadStream(audioPath, { start: 0, end: 100 });
      await new Promise((resolve, reject) => {
        testStream.on('data', () => {
          testStream.close();
          resolve();
        });
        testStream.on('error', reject);
      });
    } catch (readError) {
      console.error(`[Audio Endpoint] Audio file is corrupted or unreadable for meeting ${meetingId}:`, readError);
      return res.status(404).json({ error: "Audio file is corrupted" });
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

    console.log(`[Audio Endpoint] Serving audio for meeting ${meetingId}: ${audioPath} (${fileSize} bytes, ${contentType})`);

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
    fileStream.on('error', (streamError) => {
      console.error(`[Audio Endpoint] Error streaming audio for meeting ${meetingId}:`, streamError);
      if (!res.headersSent) {
        res.status(500).json({ error: "Error streaming audio file" });
      }
    });
    fileStream.pipe(res);
  } catch (error) {
    console.error("Get meeting audio error:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

// Get meetings related to a specific meeting (semantic similarity via embeddings)
// IMPORTANT: must appear before GET /:id to avoid Express route conflict
router.get("/:id/related", authenticateToken, async (req, res) => {
  try {
    const meetingId = parseInt(req.params.id);
    const limit = Math.min(parseInt(req.query.limit) || 5, 10); // cap at 10

    if (isNaN(meetingId)) {
      return res.status(400).json({ error: "Invalid meeting ID" });
    }

    // Get the meeting to know its workspace
    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res.status(404).json({ error: "Meeting not found" });
    }

    // Verify workspace membership
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

    const MeetingEmbeddingService = require("../services/MeetingEmbeddingService");
    const relatedMeetings = await MeetingEmbeddingService.findRelatedMeetings(
      meetingId,
      meeting.workspaceId,
      limit
    );

    res.json({
      success: true,
      meetingId,
      relatedMeetings
    });
  } catch (error) {
    console.error("Get related meetings error:", error);
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

    // Update meeting start/end times if we have actual stats and they differ significantly
    if (meeting.status === 'completed' && stats && stats.audioDurationSeconds > 0) {
      try {
        let updates = {};
        const durationMin = Math.ceil(stats.audioDurationSeconds / 60);

        // 1. Check Duration
        // Update if duration differs by more than 1 minute
        if (Math.abs(meeting.duration - durationMin) > 1) {
          updates.duration = durationMin;
        }

        // 2. Try to get actual Text Start Time from directory name
        const meetingDir = findMeetingDirectory(meetingId);
        let actualStartTime = null;
        if (meetingDir) {
          const dirName = path.basename(meetingDir);
          // Format: {id}_{title}_{YYYY-MM-DD}_{HH-mm-ss-SSS}
          // specific regex to capture date and time parts at the end
          const match = dirName.match(/_(\d{4}-\d{2}-\d{2})_(\d{2}-\d{2}-\d{2}-\d{3})$/);
          if (match) {
            const dateStr = match[1]; // 2025-12-08
            const timeStr = match[2].replace(/-/g, ':').replace(/:(\d{3})$/, '.$1'); // 20:32:48.288
            const isoString = `${dateStr}T${timeStr}`;
            const parsedDate = new Date(isoString);

            if (!isNaN(parsedDate.getTime())) {
              actualStartTime = parsedDate;
            }
          }
        }

        // 3. Determine Start Time to use (Actual or Stored)
        const startTimeToUse = actualStartTime || new Date(meeting.startTime);

        // Update Start Time if actual found and differs by > 2 mins
        if (actualStartTime && Math.abs(actualStartTime.getTime() - new Date(meeting.startTime).getTime()) > 2 * 60 * 1000) {
          updates.startTime = actualStartTime;
        }

        // 4. Calculate End Time
        const newEndTime = new Date(startTimeToUse.getTime() + stats.audioDurationSeconds * 1000);

        // Update End Time if differs by > 2 mins
        if (Math.abs(newEndTime.getTime() - new Date(meeting.endTime).getTime()) > 2 * 60 * 1000) {
          updates.endTime = newEndTime;
        }

        // Apply updates if any
        if (Object.keys(updates).length > 0) {
          console.log(`[Meeting ${meetingId}] Updating meeting times based on actual stats:`, updates);
          const updatedMeeting = await Meeting.update(meetingId, updates);

          // Update the meeting object to return
          Object.assign(meeting, updatedMeeting);
        }
      } catch (updateError) {
        console.error(`[Meeting ${meetingId}] Error auto-updating meeting times:`, updateError);
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

    // Send notification when meeting ends
    if (status === 'completed') {
      try {
        const workspace = await prisma.workspace.findUnique({
          where: { id: meeting.workspaceId },
          select: { name: true }
        });
        
        await NotificationService.notifyMeetingEnded(updatedMeeting, workspace?.name);
      } catch (notifError) {
        console.error("Error sending meeting ended notification:", notifError);
      }

      // Create tasks from confirmed action items (run in background)
      const TaskCreationService = require('../services/TaskCreationService');
      TaskCreationService.createTasksFromMeetingActionItems(meetingId)
        .then((result) => {
          if (result.tasks.length > 0) {
            console.log(`✅ Created ${result.tasks.length} task(s) from meeting ${meetingId} action items`);
          } else {
            console.log(`ℹ️ No tasks created from meeting ${meetingId} (no confirmed action items or already converted)`);
          }
        })
        .catch((taskError) => {
          console.error(`❌ Error creating tasks from meeting ${meetingId}:`, taskError);
          // Don't fail the request if task creation fails
        });
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

    // Atomic check and lock mechanism to prevent duplicate bot instances
    const { getActiveSessions, activeSessions, getJoinLocks, setJoinLock, clearJoinLock } = require("../jobs/autoJoinMeetings");

    // Check if bot is already active for this meeting (atomic check)
    const activeSessionIds = getActiveSessions();
    if (activeSessionIds.includes(meetingId)) {
      console.log(`⚠️ [ROUTE] Bot already active for meeting ${meetingId}`);
      return res.status(400).json({ error: 'Bot is already active for this meeting' });
    }

    // Atomic check-and-set lock to prevent concurrent joins
    // setJoinLock returns false if lock already exists, true if successfully set
    const lockSet = setJoinLock(meetingId);
    if (!lockSet) {
      console.log(`⚠️ [ROUTE] Bot join already in progress for meeting ${meetingId}`);
      return res.status(409).json({ error: 'Bot join is already in progress for this meeting' });
    }

    // Update database metadata IMMEDIATELY to prevent cron job from starting duplicate
    // This happens synchronously before bot.start() to ensure cron job sees it
    try {
      await prisma.meeting.update({
        where: { id: meetingId },
        data: {
          metadata: {
            ...(meeting.metadata || {}),
            botJoinTriggeredAt: new Date().toISOString(),
            botStatus: 'joining'
          }
        }
      });
      console.log(`📝 [ROUTE] Updated metadata with botJoinTriggeredAt (joining) for meeting ${meetingId}`);
    } catch (metadataError) {
      console.error(`⚠️ [ROUTE] Failed to update metadata for meeting ${meetingId}:`, metadataError);
      // Continue anyway - lock mechanism will still prevent duplicates
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
      .then(async (session) => {
        // Double-check before storing (atomic operation to prevent race conditions)
        if (!activeSessions.has(meetingId)) {
          // Store session in activeSessions Map so it can be stopped later
          activeSessions.set(meetingId, session);
          console.log(`✅ [ROUTE] Bot session started and stored for meeting ${meetingId}`);
          console.log(`   Active sessions: ${Array.from(activeSessions.keys()).join(', ')}`);

          // Update meeting status to in-progress and botStatus to joined
          try {
            await prisma.meeting.update({
              where: { id: meetingId },
              data: {
                status: 'in-progress',
                metadata: {
                  ...(meeting.metadata || {}),
                  botJoinTriggeredAt: new Date().toISOString(), // Keep this for history
                  botStatus: 'joined',
                  botJoinedAt: new Date().toISOString()
                }
              }
            });
            console.log(`✅ [ROUTE] Updated meeting ${meetingId} status to in-progress and botStatus to joined`);
          } catch (updateError) {
            console.error(`⚠️ [ROUTE] Failed to update status for meeting ${meetingId}:`, updateError);
          }

        } else {
          console.log(`⚠️ [ROUTE] Bot session already exists for meeting ${meetingId}, stopping duplicate`);
          // Stop the duplicate session if it was created
          if (session && session.stop) {
            session.stop().catch((err) => {
              console.error(`Error stopping duplicate bot session for meeting ${meetingId}:`, err);
            });
          }
        }
        // Clear lock after session is stored or duplicate is handled
        clearJoinLock(meetingId);
      })
      .catch((error) => {
        console.error(`❌ [ROUTE] Error starting bot for meeting ${meetingId}:`, error);
        console.error(error.stack);

        // Update metadata to indicate failure (allows cron job to retry if needed)
        prisma.meeting.update({
          where: { id: meetingId },
          data: {
            metadata: {
              ...(meeting.metadata || {}),
              botJoinError: error.message,
              botJoinFailedAt: new Date().toISOString(),
              botStatus: 'failed'
              // Keep botJoinTriggeredAt to prevent immediate retry by cron
            }
          }
        }).catch((updateErr) => {
          console.error(`⚠️ [ROUTE] Failed to update metadata on error for meeting ${meetingId}:`, updateErr);
        });

        // Clear lock on error
        clearJoinLock(meetingId);
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

    // Atomic check and lock mechanism to prevent duplicate bot instances (same as primary route)
    const { getActiveSessions, activeSessions, getJoinLocks, setJoinLock, clearJoinLock } = require("../jobs/autoJoinMeetings");

    // Check if bot is already active for this meeting (atomic check)
    const activeSessionIds = getActiveSessions();
    if (activeSessionIds.includes(meetingId)) {
      console.log(`⚠️ [ROUTE] Bot already active for meeting ${meetingId}`);
      return res.status(400).json({ error: 'Bot is already active for this meeting' });
    }

    // Atomic check-and-set lock to prevent concurrent joins
    // setJoinLock returns false if lock already exists, true if successfully set
    const lockSet = setJoinLock(meetingId);
    if (!lockSet) {
      console.log(`⚠️ [ROUTE] Bot join already in progress for meeting ${meetingId}`);
      return res.status(409).json({ error: 'Bot join is already in progress for this meeting' });
    }

    // Update database metadata IMMEDIATELY to prevent cron job from starting duplicate
    // This happens synchronously before bot.start() to ensure cron job sees it
    try {
      await prisma.meeting.update({
        where: { id: meetingId },
        data: {
          metadata: {
            ...(meeting.metadata || {}),
            botJoinTriggeredAt: new Date().toISOString(),
            botStatus: 'joining'
          }
        }
      });
      console.log(`📝 [ROUTE] Updated metadata with botJoinTriggeredAt (joining) for meeting ${meetingId}`);
    } catch (metadataError) {
      console.error(`⚠️ [ROUTE] Failed to update metadata for meeting ${meetingId}:`, metadataError);
      // Continue anyway - lock mechanism will still prevent duplicates
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
      .then(async (session) => {
        // Double-check before storing (atomic operation to prevent race conditions)
        if (!activeSessions.has(meetingId)) {
          // Store session in activeSessions Map so it can be stopped later
          activeSessions.set(meetingId, session);
          console.log(`✅ [ROUTE] Bot session started and stored for meeting ${meetingId}`);
          console.log(`   Active sessions: ${Array.from(activeSessions.keys()).join(', ')}`);

          // Update meeting status to in-progress and botStatus to joined
          try {
            await prisma.meeting.update({
              where: { id: meetingId },
              data: {
                status: 'in-progress',
                metadata: {
                  ...(meeting.metadata || {}),
                  botJoinTriggeredAt: new Date().toISOString(), // Keep this
                  botStatus: 'joined',
                  botJoinedAt: new Date().toISOString()
                }
              }
            });
            console.log(`✅ [ROUTE] Updated meeting ${meetingId} status to in-progress and botStatus to joined`);
          } catch (updateError) {
            console.error(`⚠️ [ROUTE] Failed to update status for meeting ${meetingId}:`, updateError);
          }
        } else {
          console.log(`⚠️ [ROUTE] Bot session already exists for meeting ${meetingId}, stopping duplicate`);
          // Stop the duplicate session if it was created
          if (session && session.stop) {
            session.stop().catch((err) => {
              console.error(`Error stopping duplicate bot session for meeting ${meetingId}:`, err);
            });
          }
        }
        // Clear lock after session is stored or duplicate is handled
        clearJoinLock(meetingId);
      })
      .catch((error) => {
        console.error(`❌ [ROUTE] Error starting bot for meeting ${meetingId}:`, error);
        console.error(error.stack);

        // Update metadata to indicate failure (allows cron job to retry if needed)
        prisma.meeting.update({
          where: { id: meetingId },
          data: {
            metadata: {
              ...(meeting.metadata || {}),
              botJoinError: error.message,
              botJoinFailedAt: new Date().toISOString(),
              botStatus: 'failed'
              // Keep botJoinTriggeredAt to prevent immediate retry by cron
            }
          }
        }).catch((updateErr) => {
          console.error(`⚠️ [ROUTE] Failed to update metadata on error for meeting ${meetingId}:`, updateErr);
        });

        // Clear lock on error
        clearJoinLock(meetingId);
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

    // Get diarized transcript (preferred for post-meeting view)
    let entries = getDiarizedTranscript(meetingId);

    // Fallback to live transcript entries if diarized is empty or not available
    // This ensures users see transcription even if diarization hasn't completed
    if (!entries || entries.length === 0) {
      console.log(`Diarized transcript not available for meeting ${meetingId}, falling back to live transcript entries`);
      entries = getLiveTranscriptEntries(meetingId);
    }

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

    // Fetch all insights for this meeting using Prisma's type-safe query
    let insightsRows = [];
    try {
      insightsRows = await prisma.aiInsight.findMany({
        where: {
          meetingId: meetingIdStr
        },
        select: {
          insightType: true,
          content: true,
          confidenceScore: true,
          createdAt: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      });
    } catch (dbError) {
      // If table doesn't exist or other DB error, log it and return empty
      console.error("Database error fetching AI insights:", dbError);
      // Check if it's a table not found error (PostgreSQL error code 42P01)
      if (dbError.code === 'P2010' || (dbError.meta && dbError.meta.code === '42P01') ||
        (dbError.message && dbError.message.includes('does not exist'))) {
        console.error("❌ ai_insights table does not exist in database!");
        console.error("   To fix this, run: cd backend && npx prisma migrate dev");
        console.error("   Or if in production: npx prisma migrate deploy");
      }
      // Return empty structure instead of crashing
      return res.json({
        summary: null,
        keyDecisions: [],
        actionItems: [],
        sentiment: null,
        topics: [],
        participants: [],
        generated: false,
        generating: isGenerating,
        progress: progress
      });
    }

    // Check generation status from in-memory store (not DB)
    // This ensures if backend restarts, status returns to 'idle' automatically
    const generationStatus = AIInsightsService.getGenerationStatus(meetingId);
    const isGenerating = generationStatus.isActive && generationStatus.status === 'generating';
    const progress = generationStatus.progress;
    
    // For completed/failed states, check DB metadata
    let aiInsightsError = generationStatus.error;
    if (!isGenerating && meeting.metadata?.aiInsightsError) {
      aiInsightsError = meeting.metadata.aiInsightsError;
    }

    // If no insights found, return empty structure
    if (!insightsRows || insightsRows.length === 0) {
      return res.json({
        summary: null,
        keyDecisions: [],
        actionItems: [],
        sentiment: null,
        topics: [],
        participants: [],
        generated: false,
        generating: isGenerating,
        progress: progress,
        aiInsightsStatus: isGenerating ? 'generating' : (meeting.metadata?.aiInsightsStatus || 'idle'),
        aiInsightsError
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
      generated: true,
      generating: isGenerating,
      progress: progress,
      aiInsightsStatus: isGenerating ? 'generating' : (meeting.metadata?.aiInsightsStatus || 'completed'),
      aiInsightsError
    };

    for (const row of insightsRows) {
      try {
        const content = typeof row.content === 'string'
          ? JSON.parse(row.content)
          : row.content;

        // Use insightType (camelCase from Prisma) instead of insight_type
        switch (row.insightType) {
          case 'summary':
            // Transform agent format to frontend format (including layered summaries)
            insights.summary = {
              paragraph: content.paragraph_summary || content.overview || '',
              bullets: content.key_points || [],
              confidence: content.confidence,
              // Layered summaries from Mistral (new format)
              executive_summary: content.executive_summary || null,
              detailed_summary: content.detailed_summary || null,
              bullet_summary: content.bullet_summary || null
            };
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
  console.log(`📥 [POST /meetings/:id/ai-insights/regenerate] Request received`);
  console.log(`   Meeting ID param: ${req.params.id}`);
  console.log(`   User ID: ${req.user?.id}`);
  console.log(`   Request body:`, req.body);
  
  try {
    const meetingId = parseInt(req.params.id);
    console.log(`   Parsed meeting ID: ${meetingId}`);

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
    // Delete existing insights and reset flag in a transaction
    // Delete existing insights and reset flag + set generating status in a transaction
    const meetingIdStr = String(meetingId);
    await prisma.$transaction(async (tx) => {
      // Delete existing insights
      try {
        await tx.aiInsight.deleteMany({
          where: { meetingId: meetingIdStr }
        });
      } catch (e) {
        // Fallback or ignore if table issues
        await tx.$executeRaw`DELETE FROM ai_insights WHERE meeting_id = ${meetingIdStr}`;
      }

      // Update metadata to indicate generation is in progress
      // We need to fetch current metadata first to preserve other fields
      const currentMeeting = await tx.meeting.findUnique({
        where: { id: meetingId },
        select: { metadata: true }
      });

      const currentMetadata = currentMeeting?.metadata || {};

      await tx.meeting.update({
        where: { id: meetingId },
        data: {
          updatedAt: new Date(),
          metadata: {
            ...currentMetadata,
            aiInsightsStatus: 'generating',
            aiInsightsStartTime: new Date().toISOString(),
            aiInsightsError: null,
            aiInsightsProgress: 0
          }
        }
      });

      // Reset the legacy flag if it exists (using raw SQL to avoid schema errors if column missing)
      try {
        await tx.$executeRaw`
          UPDATE meetings 
          SET ai_insights_generated = FALSE
          WHERE id = ${meetingId}
        `;
      } catch (error) {
        // Field might not exist yet - that's okay
      }
    });

    // Ensure transaction is committed before starting generation
    // Add a small delay to ensure database state is consistent
    await new Promise(resolve => setTimeout(resolve, 100));

    // Generate new insights (fire-and-forget to prevent request timeouts)
    try {
      console.log(`🚀 Starting AI insights generation for meeting ${meetingId} (force regenerate)`);
      
      // Start generation asynchronously with forceRegenerate=true to always regenerate
      // Don't await to prevent request timeout, but catch any immediate errors
      const generationPromise = AIInsightsService.generateInsights(meetingId, true); // forceRegenerate = true
      
      generationPromise
        .then((result) => {
          if (result && result.success) {
            if (result.skipped) {
              console.log(`ℹ️ AI insights regeneration skipped for meeting ${meetingId}: ${result.message}`);
            } else {
              console.log(`✅ AI insights regeneration completed for meeting ${meetingId}`);
            }
          } else {
            const errorMsg = result?.error || 'Unknown error';
            console.error(`⚠️ AI insights regeneration failed for meeting ${meetingId}: ${errorMsg}`);
            // Update status to failed
            prisma.meeting.update({
              where: { id: meetingId },
              data: {
                metadata: {
                  aiInsightsStatus: 'failed',
                  aiInsightsError: errorMsg,
                  aiInsightsProgress: 0
                }
              }
            }).catch(e => console.error(`Failed to update error status: ${e.message}`));
          }
        })
        .catch((err) => {
          console.error(`❌ AI insights regeneration error for meeting ${meetingId}:`, err.message);
          console.error(`   Stack:`, err.stack);
          // Update status to failed
          prisma.meeting.update({
            where: { id: meetingId },
            data: {
              metadata: {
                aiInsightsStatus: 'failed',
                aiInsightsError: err.message || 'Generation failed',
                aiInsightsProgress: 0
              }
            }
          }).catch(e => console.error(`Failed to update error status: ${e.message}`));
        });

      // Return immediately - frontend will poll for status updates
      console.log(`✅ Regeneration request accepted for meeting ${meetingId}, generation started in background`);
      return res.json({
        success: true,
        message: "AI insights generation started. Status will be updated as generation progresses."
      });
    } catch (err) {
      // Only catch synchronous errors (e.g., validation)
      console.error(`⚠️ Failed to start AI insights regeneration for meeting ${meetingId}:`, err.message);
      // Reset status on synchronous error - fetch current metadata first
      try {
        const currentMeeting = await prisma.meeting.findUnique({
          where: { id: meetingId },
          select: { metadata: true }
        });
        await prisma.meeting.update({
          where: { id: meetingId },
          data: {
            metadata: {
              ...(currentMeeting?.metadata || {}),
              aiInsightsStatus: 'idle',
              aiInsightsError: err.message || 'Failed to start generation',
              aiInsightsProgress: 0,
              aiInsightsStartTime: null
            }
          }
        });
      } catch (metaErr) {
        console.error(`Failed to reset status on error: ${metaErr.message}`);
      }
      return res.status(500).json({
        success: false,
        error: err.message || 'Failed to start AI insights generation'
      });
    }
  } catch (error) {
    console.error(`❌ [POST /meetings/:id/ai-insights/regenerate] Outer catch block - Error:`, error);
    console.error(`   Error message:`, error.message);
    console.error(`   Error stack:`, error.stack);
    res.status(500).json({ 
      success: false,
      error: error.message || "Internal server error" 
    });
  }
});

// Trigger Whisper Mode Micro-Recap
router.post("/:id/whisper/trigger", authenticateToken, async (req, res) => {
  try {
    const meetingId = parseInt(req.params.id);
    if (isNaN(meetingId)) {
      return res.status(400).json({ error: "Invalid meeting ID" });
    }

    const excludeTranscript = !!req.body?.excludeTranscript;

    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      select: { id: true, status: true, endTime: true, metadata: true, workspaceId: true }
    });

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

    const MicroSummaryService = require('../services/MicroSummaryService');
    const svc = new MicroSummaryService();
    
    // Bypass the min interval check for manual triggers
    const result = await svc.maybeGenerateMicroRecap(meetingId, meeting, true, { excludeTranscript });
    
    if (result.generated && result.recapText) {
      return res.json({ success: true, message: "Whisper recap generated", recapText: result.recapText });
    } else {
      return res.json({ success: false, message: result.reason || "Skipped generation", skipped: result.skipped });
    }
  } catch (error) {
    console.error("Manual Whisper trigger error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Toggle privacy mode for live transcription (without disrupting audio/websocket)
router.patch("/:id/privacy-mode", authenticateToken, async (req, res) => {
  try {
    const meetingId = parseInt(req.params.id, 10);
    const { enabled } = req.body || {};

    if (Number.isNaN(meetingId)) {
      return res.status(400).json({ error: "Invalid meeting ID" });
    }
    if (typeof enabled !== "boolean") {
      return res.status(400).json({ error: "enabled must be a boolean" });
    }

    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res.status(404).json({ error: "Meeting not found" });
    }

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

    const state = await PrivacyModeService.setState(meetingId, enabled);
    return res.json({
      success: true,
      privacyMode: {
        enabled: state.enabled,
        intervals: state.intervals
      }
    });
  } catch (error) {
    console.error("Update privacy mode error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;

