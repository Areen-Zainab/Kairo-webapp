const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const ActionItemService = require('../services/ActionItemService');
const AIInsightsService = require('../services/AIInsightsService');
const Meeting = require('../models/Meeting');
const prisma = require('../lib/prisma');

const router = express.Router();

// Get all action items for a meeting (optional status filter)
router.get('/meetings/:meetingId', authenticateToken, async (req, res) => {
  try {
    const meetingId = parseInt(req.params.meetingId, 10);
    const { status } = req.query;

    if (Number.isNaN(meetingId)) {
      return res.status(400).json({ error: 'Invalid meeting ID' });
    }

    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
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
      return res.status(403).json({ error: 'Access denied' });
    }

    if (status && !['pending', 'confirmed', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status filter' });
    }

    let items = await ActionItemService.getByMeetingId(meetingId, status || null);
    let formattedItems = items.map((item) => ActionItemService._toDTO(item));

    // If no action items exist, trigger action-item-only regeneration once (best-effort)
    if (formattedItems.length === 0) {
      try {
        console.log(`No action items found for meeting ${meetingId}; triggering action-item-only regeneration...`);
        const regenResult = await AIInsightsService.regenerateActionItemsOnly(meetingId);
        if (regenResult.success) {
          // Re-fetch after successful regen
          items = await ActionItemService.getByMeetingId(meetingId, status || null);
          formattedItems = items.map((item) => ActionItemService._toDTO(item));
        } else {
          console.warn(`Action item regeneration returned no items: ${regenResult.error || 'unknown error'}`);
        }
      } catch (regenErr) {
        console.error(`Action item regeneration threw for meeting ${meetingId}:`, regenErr.message);
      }
    }

    return res.json({
      actionItems: formattedItems,
      count: formattedItems.length,
      pending: formattedItems.filter((i) => i.status === 'pending').length,
      confirmed: formattedItems.filter((i) => i.status === 'confirmed').length,
      rejected: formattedItems.filter((i) => i.status === 'rejected').length
    });
  } catch (error) {
    console.error('Get action items error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Confirm an action item
router.post('/:id/confirm', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);

    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid action item ID' });
    }

    const item = await prisma.actionItem.findUnique({
      where: { id },
      include: { meeting: true }
    });

    if (!item) {
      return res.status(404).json({ error: 'Action item not found' });
    }

    if (item.status === 'confirmed') {
      return res.status(400).json({ error: 'Action item already confirmed' });
    }
    if (item.status === 'rejected') {
      return res.status(400).json({ error: 'Cannot confirm rejected action item' });
    }

    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: item.meeting.workspaceId,
          userId: req.user.id
        }
      }
    });

    if (!membership) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updated = await ActionItemService.confirm(id, req.user.id);
    return res.json({ actionItem: ActionItemService._toDTO(updated) });
  } catch (error) {
    console.error('Confirm action item error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Reject an action item
router.post('/:id/reject', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);

    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid action item ID' });
    }

    const item = await prisma.actionItem.findUnique({
      where: { id },
      include: { meeting: true }
    });

    if (!item) {
      return res.status(404).json({ error: 'Action item not found' });
    }

    if (item.status === 'rejected') {
      return res.status(400).json({ error: 'Action item already rejected' });
    }
    if (item.status === 'confirmed') {
      return res.status(400).json({ error: 'Cannot reject confirmed action item' });
    }

    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: item.meeting.workspaceId,
          userId: req.user.id
        }
      }
    });

    if (!membership) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updated = await ActionItemService.reject(id, req.user.id);
    return res.json({ actionItem: ActionItemService._toDTO(updated) });
  } catch (error) {
    console.error('Reject action item error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get pending action items for post-meeting confirmation
router.get('/meetings/:meetingId/pending', authenticateToken, async (req, res) => {
  try {
    const meetingId = parseInt(req.params.meetingId, 10);

    if (Number.isNaN(meetingId)) {
      return res.status(400).json({ error: 'Invalid meeting ID' });
    }

    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
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
      return res.status(403).json({ error: 'Access denied' });
    }

    const pendingItems = await ActionItemService.getPendingForMeeting(meetingId);
    const formattedItems = pendingItems.map((item) => ActionItemService._toDTO(item));

    return res.json({ actionItems: formattedItems, count: formattedItems.length });
  } catch (error) {
    console.error('Get pending action items error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Live polling endpoint for action items
router.get('/meetings/:meetingId/live', authenticateToken, async (req, res) => {
  try {
    console.log(`📡 [GET /action-items/meetings/:meetingId/live] Request received:`, {
      meetingId: req.params.meetingId,
      since: req.query.since,
      userId: req.user?.id
    });
    
    const meetingId = parseInt(req.params.meetingId, 10);
    const { since } = req.query;

    if (Number.isNaN(meetingId)) {
      console.error(`❌ [GET /action-items/meetings/:meetingId/live] Invalid meeting ID: ${req.params.meetingId}`);
      return res.status(400).json({ error: 'Invalid meeting ID' });
    }

    console.log(`🔍 [GET /action-items/meetings/${meetingId}/live] Fetching meeting...`);
    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      console.error(`❌ [GET /action-items/meetings/${meetingId}/live] Meeting not found`);
      return res.status(404).json({ error: 'Meeting not found' });
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
      return res.status(403).json({ error: 'Access denied' });
    }

    console.log(`📋 [GET /action-items/meetings/${meetingId}/live] Fetching action items...`);
    const items = await ActionItemService.getByMeetingId(meetingId, null);
    console.log(`📋 [GET /action-items/meetings/${meetingId}/live] Found ${items.length} action items`);

    let filteredItems = items;
    if (since) {
      const sinceDate = new Date(since);
      filteredItems = items.filter(
        (item) =>
          new Date(item.lastSeenAt) > sinceDate ||
          new Date(item.confirmedAt || 0) > sinceDate ||
          new Date(item.rejectedAt || 0) > sinceDate
      );
      console.log(`🔍 [GET /action-items/meetings/${meetingId}/live] Filtered to ${filteredItems.length} items since ${since}`);
    }

    const formattedItems = filteredItems.map((item) => ActionItemService._toDTO(item));
    const latestUpdate =
      items.length > 0 ? Math.max(...items.map((i) => new Date(i.lastSeenAt).getTime())) : null;

    console.log(`✅ [GET /action-items/meetings/${meetingId}/live] Returning ${formattedItems.length} action items`);
    return res.json({
      actionItems: formattedItems,
      count: formattedItems.length,
      latestUpdate: latestUpdate ? new Date(latestUpdate).toISOString() : null,
      serverTime: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get live action items error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
