const prisma = require('../lib/prisma');
const AgentProcessingService = require('./AgentProcessingService');
const crypto = require('crypto');

class ActionItemService {
  /**
   * Generate canonical key for deduplication.
   * Normalizes text to match similar action items.
   */
  static _generateCanonicalKey(actionItem) {
    const normalize = (text) => {
      if (!text) return '';
      return text
        .toLowerCase()
        .trim()
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, ' ')
        .substring(0, 100);
    };

    const title = normalize(actionItem.title || actionItem.description || '');
    const assignee = normalize(actionItem.assignee || actionItem.assigned_to || '');
    const combined = `${title}|${assignee}`;

    return crypto.createHash('sha256').update(combined).digest('hex').substring(0, 16);
  }

  /**
   * Merge new information into an existing action item.
   * Appends to description and updates differing fields.
   */
  static _mergeActionItem(existing, newItem) {
    const historyEntry = {
      timestamp: new Date().toISOString(),
      changes: {}
    };

    const updates = {
      lastSeenAt: new Date()
    };

    const existingTitle = existing.title || '';
    const existingDescription = existing.description || '';

    let hasChanges = false;

    // Update title if new one is more detailed (longer and different)
    if (newItem.title && newItem.title !== existing.title) {
      if (newItem.title.length > existingTitle.length && 
          !existingTitle.toLowerCase().includes(newItem.title.toLowerCase()) &&
          !newItem.title.toLowerCase().includes(existingTitle.toLowerCase())) {
        updates.title = newItem.title;
        historyEntry.changes.title = `updated from "${existing.title}" to "${newItem.title}"`;
        hasChanges = true;
      }
    }

    // Append description if different and not already contained.
    if (newItem.description && newItem.description !== existing.description) {
      const existingDesc = existingDescription.toLowerCase();
      const newDesc = (newItem.description || '').toLowerCase();

      // Check if new description adds meaningful information
      if (!existingDesc.includes(newDesc) && !newDesc.includes(existingDesc)) {
        const timestamp = new Date().toLocaleString('en-US', { 
          month: 'short', 
          day: 'numeric', 
          hour: '2-digit', 
          minute: '2-digit' 
        });
        updates.description = `${existing.description || ''}\n\n[Updated ${timestamp}]: ${newItem.description}`.trim();
        historyEntry.changes.description = 'appended new information';
        hasChanges = true;
      } else if (newItem.description.length > (existing.description || '').length) {
        // New description is more detailed, replace it
        updates.description = newItem.description;
        historyEntry.changes.description = 'replaced with more detailed version';
        hasChanges = true;
      }
    }

    // Update assignee if different.
    if (newItem.assignee && newItem.assignee !== existing.assignee) {
      const oldAssignee = existing.assignee || 'unassigned';
      updates.assignee = newItem.assignee;
      historyEntry.changes.assignee = `changed from "${oldAssignee}" to "${newItem.assignee}"`;
      hasChanges = true;
    }

    // Update due date if different.
    if (newItem.dueDate) {
      const newDueDate = new Date(newItem.dueDate);
      const existingDueDate = existing.dueDate ? new Date(existing.dueDate) : null;

      if (!existingDueDate || existingDueDate.getTime() !== newDueDate.getTime()) {
        updates.dueDate = newDueDate;
        historyEntry.changes.dueDate = `changed from "${existingDueDate?.toISOString() || 'none'}" to "${newDueDate.toISOString()}"`;
        hasChanges = true;
      }
    }

    // Update confidence if higher.
    if (newItem.confidence && newItem.confidence > (existing.confidence || 0)) {
      updates.confidence = newItem.confidence;
      historyEntry.changes.confidence = `increased from ${existing.confidence || 0} to ${newItem.confidence}`;
      hasChanges = true;
    }

    // Only add history entry if there were actual changes
    if (hasChanges) {
      updates.updateHistory = [...(existing.updateHistory || []), historyEntry];
    } else {
      // Just update lastSeenAt without adding history
      updates.updateHistory = existing.updateHistory || [];
    }

    return { updates, hasChanges };
  }

  static _normalizeTranscriptText(transcriptText) {
    if (!transcriptText || typeof transcriptText !== 'string') {
      return '';
    }

    return transcriptText
      .replace(/^Kairo (?:Complete )?Transcript.*$/gim, '')
      .replace(/^=+$/gim, '')
      .replace(/^\[Chunk\s+\d+\]\s*\[[^\]]+\]\s*/gim, '')
      .replace(/^\[[^\]]+\]\s*/gim, '')
      .replace(/\[(?:UNKNOWN|SPEAKER_\d+)\]\s*/gim, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  static _extractHeuristicActionItems(transcriptText) {
    const text = this._normalizeTranscriptText(transcriptText);
    if (!text) {
      return [];
    }

    const sentences = text.split(/(?<=[.!?])\s+/);
    const cuePattern = /\b(i will|i'll|i can|i'll take|let me|we need to|we should|we must|we have to|let's|someone needs to|someone should|please|can you|could you|action:|todo:|follow up:|next steps?:)\b/i;

    const items = [];

    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (trimmed.length < 20) {
        continue;
      }

      if (!cuePattern.test(trimmed)) {
        continue;
      }

      const cleaned = trimmed
        .replace(/^\[.*?\]\s*/g, '')
        .replace(/\b(i will|i'll|i can|i'll take|let me|we need to|we should|we must|we have to|let's|someone needs to|someone should|please|can you|could you|action:|todo:|follow up:|next steps?:)\b\s*/i, '')
        .trim();

      const titleSource = cleaned || trimmed;
      const title = titleSource
        .replace(/[\r\n]+/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/[.?!]+$/, '')
        .slice(0, 100);

      if (!title) {
        continue;
      }

      items.push({
        id: items.length,
        title,
        description: trimmed,
        assignee: null,
        dueDate: null,
        confidence: 0.35
      });
    }

    return items;
  }

  static async createActionItem(meetingId, actionItemData, sourceChunk = null) {
    meetingId = parseInt(meetingId, 10);
    if (isNaN(meetingId)) {
      throw new Error('Invalid meetingId: must be a number');
    }

    const title = this._cleanActionItemText(actionItemData?.title || actionItemData?.text || actionItemData?.description || '');
    const description = this._cleanActionItemText(actionItemData?.description || actionItemData?.text || title);

    if (!title) {
      throw new Error('Action item title is required');
    }

    const normalizedItem = {
      title,
      description,
      assignee: actionItemData?.assignee || actionItemData?.assigned_to || null,
      dueDate: actionItemData?.dueDate || actionItemData?.due_date ? new Date(actionItemData.dueDate || actionItemData.due_date) : null,
      confidence: Number.isFinite(actionItemData?.confidence) ? actionItemData.confidence : 0.5
    };

    const canonicalKey = this._generateCanonicalKey(normalizedItem);
    const existing = await prisma.actionItem.findFirst({
      where: {
        meetingId,
        canonicalKey,
        status: 'pending'
      }
    });

    if (existing) {
      const { updates } = this._mergeActionItem(existing, {
        ...normalizedItem,
        sourceChunk
      });

      const updated = await prisma.actionItem.update({
        where: { id: existing.id },
        data: updates
      });

      try {
        const WebSocketServer = require('./WebSocketServer');
        WebSocketServer.broadcastActionItems(meetingId, [this._toDTO(updated)]);
      } catch (wsError) {
        console.warn('⚠️ Failed to broadcast action item creation update via WebSocket:', wsError.message);
      }

      return updated;
    }

    const created = await prisma.actionItem.create({
      data: {
        meetingId,
        title: normalizedItem.title,
        description: normalizedItem.description,
        assignee: normalizedItem.assignee,
        dueDate: normalizedItem.dueDate,
        canonicalKey,
        confidence: normalizedItem.confidence,
        sourceChunk,
        status: 'pending',
        rawData: { manual: true, ...actionItemData },
        updateHistory: [],
        firstSeenAt: new Date(),
        lastSeenAt: new Date()
      }
    });

    try {
      const WebSocketServer = require('./WebSocketServer');
      WebSocketServer.broadcastActionItems(meetingId, [this._toDTO(created)]);
    } catch (wsError) {
      console.warn('⚠️ Failed to broadcast action item creation via WebSocket:', wsError.message);
    }

    return created;
  }

  /**
   * Extract and process action items from transcript.
   * Called periodically during meeting.
   */
  static async extractAndUpdateActionItems(meetingId, transcriptText, sourceChunk = null, isIncremental = false) {
    try {
      meetingId = parseInt(meetingId, 10);
      if (isNaN(meetingId)) {
        throw new Error('Invalid meetingId: must be a number');
      }

      const normalizedTranscript = this._normalizeTranscriptText(transcriptText);

      if (!normalizedTranscript || normalizedTranscript.trim().length < 50) {
        console.log(`⚠️ [ActionItemService] Transcript too short: ${transcriptText?.trim().length || 0} chars`);
        return { added: 0, updated: 0, items: [] };
      }

      console.log(`🔍 [ActionItemService] Extracting action items from ${normalizedTranscript.length} chars (${isIncremental ? 'incremental' : 'full'})...`);
      let extractedItems = await AgentProcessingService.extractActionItems(normalizedTranscript);
      console.log(`🔍 [ActionItemService] AI returned ${extractedItems?.length || 0} action items`);

      if (!Array.isArray(extractedItems) || extractedItems.length === 0) {
        const heuristicItems = this._extractHeuristicActionItems(normalizedTranscript);
        if (heuristicItems.length > 0) {
          console.log(`🔍 [ActionItemService] Heuristic fallback produced ${heuristicItems.length} action items`);
          extractedItems = heuristicItems;
        }
      }

      if (!Array.isArray(extractedItems) || extractedItems.length === 0) {
        console.log(`⚠️ [ActionItemService] No action items extracted from AI`);
        return { added: 0, updated: 0, items: [] };
      }

      // Filter by confidence threshold to reduce noise
      // Lower threshold for incremental processing to catch items early
      const CONFIDENCE_THRESHOLD = isIncremental ? 0.3 : 0.45;
      console.log(`🔍 [ActionItemService] Filtering with confidence threshold: ${CONFIDENCE_THRESHOLD}`);
      const highConfidenceItems = extractedItems.filter(item => {
        const confidence = Number.isFinite(item?.confidence) ? item.confidence : 0.5;
        return confidence >= CONFIDENCE_THRESHOLD;
      });

      if (highConfidenceItems.length === 0) {
        console.log(`⚠️ [ActionItemService] No high-confidence items (${extractedItems.length} items below threshold)`);
        return { added: 0, updated: 0, items: [] };
      }
      
      console.log(`✅ [ActionItemService] ${highConfidenceItems.length} high-confidence items to process`);

      // Filter out placeholder/dummy action items
      const realActionItems = highConfidenceItems.filter(item => {
        const title = (item.title || '').toLowerCase();
        const description = (item.description || '').toLowerCase();
        const action = (item.action || '').toLowerCase();
        
        // Filter out common placeholder patterns
        const placeholderPatterns = [
          'no action items detected',
          'no actionable items',
          'no action items found',
          'no tasks identified',
          'no follow-up items',
          'no action items were identified',
          'no specific action items'
        ];
        
        return !placeholderPatterns.some(pattern => 
          title.includes(pattern) || 
          description.includes(pattern) || 
          action.includes(pattern)
        );
      });

      if (realActionItems.length === 0) {
        console.log(`⚠️ [ActionItemService] All items were placeholders - no real action items to process`);
        return { added: 0, updated: 0, items: [] };
      }

      console.log(`✅ [ActionItemService] ${realActionItems.length} real action items after filtering placeholders`);

      const existingItems = await prisma.actionItem.findMany({
        where: {
          meetingId,
          status: 'pending'
        }
      });

      const existingMap = new Map();
      existingItems.forEach((item) => {
        existingMap.set(item.canonicalKey, item);
      });

      let added = 0;
      let updated = 0;
      const processedItems = [];
      const itemsToUpdate = [];

      for (const item of realActionItems) {
        const normalizedItem = {
          title: item.title || item.description?.substring(0, 100) || 'Untitled Action Item',
          description: item.description || item.title || '',
          assignee: item.assignee || item.assigned_to || item.assignee_name || null,
          dueDate: item.dueDate || item.due_date ? new Date(item.dueDate || item.due_date) : null,
          confidence: Number.isFinite(item.confidence) ? item.confidence : 0.5
        };

        const canonicalKey = this._generateCanonicalKey(normalizedItem);
        const existing = existingMap.get(canonicalKey);

        if (existing) {
          const { updates, hasChanges } = this._mergeActionItem(existing, {
            ...normalizedItem,
            sourceChunk
          });

          // Only update if there are actual changes (not just lastSeenAt)
          if (hasChanges) {
            const updatedItem = await prisma.actionItem.update({
              where: { id: existing.id },
              data: updates
            });

            processedItems.push(updatedItem);
            itemsToUpdate.push(updatedItem);
            updated++;
          } else {
            // Just update lastSeenAt without broadcasting
            await prisma.actionItem.update({
              where: { id: existing.id },
              data: { lastSeenAt: new Date() }
            });
          }
        } else {
          const newItem = await prisma.actionItem.create({
            data: {
              meetingId,
              title: normalizedItem.title,
              description: normalizedItem.description,
              assignee: normalizedItem.assignee,
              dueDate: normalizedItem.dueDate,
              canonicalKey,
              confidence: normalizedItem.confidence,
              sourceChunk,
              status: 'pending',
              rawData: item,
              updateHistory: [],
              firstSeenAt: new Date(),
              lastSeenAt: new Date()
            }
          });

          processedItems.push(newItem);
          itemsToUpdate.push(newItem);
          added++;
        }
      }

      // Broadcast action items via WebSocket if any were added or updated
      if ((added > 0 || updated > 0) && itemsToUpdate.length > 0) {
        try {
          const WebSocketServer = require('./WebSocketServer');
          const formattedItems = itemsToUpdate.map((item) => this._toDTO(item));
          WebSocketServer.broadcastActionItems(meetingId, formattedItems);
        } catch (wsError) {
          // Don't fail the extraction if WebSocket broadcast fails
          console.warn('⚠️ Failed to broadcast action items via WebSocket:', wsError.message);
        }
      }

      return { added, updated, items: processedItems };
    } catch (error) {
      console.error('Error extracting action items:', error);
      return { added: 0, updated: 0, items: [], error: error.message };
    }
  }

  /**
   * Get action items for a meeting.
   */
  static async getByMeetingId(meetingId, status = null) {
    meetingId = parseInt(meetingId, 10);
    if (isNaN(meetingId)) {
      throw new Error('Invalid meetingId: must be a number');
    }

    const where = { meetingId };
    if (status) {
      where.status = status;
    }

    return prisma.actionItem.findMany({
      where,
      orderBy: [
        { lastSeenAt: 'desc' },
        { createdAt: 'desc' }
      ],
      include: {
        confirmedByUser: {
          select: { id: true, name: true, email: true }
        },
        rejectedByUser: {
          select: { id: true, name: true, email: true }
        },
        task: {
          select: { id: true, title: true }
        }
      }
    });
  }

  static _cleanActionItemText(text) {
    if (!text || typeof text !== 'string') {
      return '';
    }

    return text
      .replace(/^Kairo (?:Complete )?Transcript.*$/gim, '')
      .replace(/^=+$/gim, '')
      .replace(/^\[Chunk\s+\d+\]\s*\[[^\]]+\]\s*/gim, '')
      .replace(/^\[[^\]]+\]\s*/gim, '')
      .replace(/\[(?:UNKNOWN|SPEAKER_\d+)\]\s*/gim, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Confirm an action item.
   */
  static async confirm(id, userId) {
    const updated = await prisma.actionItem.update({
      where: { id },
      data: {
        status: 'confirmed',
        confirmedAt: new Date(),
        confirmedBy: userId
      },
      include: {
        confirmedByUser: {
          select: { id: true, name: true, email: true }
        },
        meeting: {
          select: { id: true }
        }
      }
    });

    // Broadcast update via WebSocket
    try {
      const WebSocketServer = require('./WebSocketServer');
      const formattedItem = this._toDTO(updated);
      WebSocketServer.broadcastActionItems(updated.meeting.id, [formattedItem]);
    } catch (wsError) {
      console.warn('⚠️ Failed to broadcast action item confirmation via WebSocket:', wsError.message);
    }

    return updated;
  }

  /**
   * Reject an action item.
   */
  static async reject(id, userId) {
    const updated = await prisma.actionItem.update({
      where: { id },
      data: {
        status: 'rejected',
        rejectedAt: new Date(),
        rejectedBy: userId
      },
      include: {
        rejectedByUser: {
          select: { id: true, name: true, email: true }
        },
        meeting: {
          select: { id: true }
        }
      }
    });

    // Broadcast update via WebSocket
    try {
      const WebSocketServer = require('./WebSocketServer');
      const formattedItem = this._toDTO(updated);
      WebSocketServer.broadcastActionItems(updated.meeting.id, [formattedItem]);
    } catch (wsError) {
      console.warn('⚠️ Failed to broadcast action item rejection via WebSocket:', wsError.message);
    }

    return updated;
  }

  /**
   * Get pending items for post-meeting confirmation.
   */
  static async getPendingForMeeting(meetingId) {
    meetingId = parseInt(meetingId, 10);
    if (isNaN(meetingId)) {
      throw new Error('Invalid meetingId: must be a number');
    }

    return prisma.actionItem.findMany({
      where: {
        meetingId,
        status: 'pending'
      },
      orderBy: { lastSeenAt: 'desc' }
    });
  }

  /**
   * Format action item for API response.
   */
  static _toDTO(item) {
    return {
      id: item.id,
      meetingId: item.meetingId,
      title: item.title,
      description: item.description,
      assignee: item.assignee,
      dueDate: item.dueDate,
      status: item.status,
      confidence: item.confidence,
      sourceChunk: item.sourceChunk,
      firstSeenAt: item.firstSeenAt,
      lastSeenAt: item.lastSeenAt,
      updateHistory: item.updateHistory,
      confirmedAt: item.confirmedAt,
      rejectedAt: item.rejectedAt,
      confirmedBy: item.confirmedByUser
        ? {
          id: item.confirmedByUser.id,
          name: item.confirmedByUser.name,
          email: item.confirmedByUser.email
        }
        : null,
      rejectedBy: item.rejectedByUser
        ? {
          id: item.rejectedByUser.id,
          name: item.rejectedByUser.name,
          email: item.rejectedByUser.email
        }
        : null,
      task: item.task
        ? { id: item.task.id, title: item.task.title }
        : null
    };
  }
}

module.exports = ActionItemService;
