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
      lastSeenAt: new Date(),
      updateHistory: [...(existing.updateHistory || []), historyEntry]
    };

    // Append description if different and not already contained.
    if (newItem.description && newItem.description !== existing.description) {
      const existingDesc = existing.description || '';
      const newDesc = newItem.description || '';

      if (!existingDesc.includes(newDesc) && !newDesc.includes(existingDesc)) {
        updates.description = `${existingDesc}\n\n[Updated ${new Date().toLocaleString()}]: ${newDesc}`;
        historyEntry.changes.description = 'appended';
      }
    }

    // Update assignee if different.
    if (newItem.assignee && newItem.assignee !== existing.assignee) {
      const oldAssignee = existing.assignee || 'unassigned';
      updates.assignee = newItem.assignee;
      historyEntry.changes.assignee = `changed from "${oldAssignee}" to "${newItem.assignee}"`;
    }

    // Update due date if different.
    if (newItem.dueDate) {
      const newDueDate = new Date(newItem.dueDate);
      const existingDueDate = existing.dueDate ? new Date(existing.dueDate) : null;

      if (!existingDueDate || existingDueDate.getTime() !== newDueDate.getTime()) {
        updates.dueDate = newDueDate;
        historyEntry.changes.dueDate = `changed from "${existingDueDate?.toISOString() || 'none'}" to "${newDueDate.toISOString()}"`;
      }
    }

    // Update confidence if higher.
    if (newItem.confidence && newItem.confidence > (existing.confidence || 0)) {
      updates.confidence = newItem.confidence;
      historyEntry.changes.confidence = `increased from ${existing.confidence || 0} to ${newItem.confidence}`;
    }

    return updates;
  }

  /**
   * Extract and process action items from transcript.
   * Called periodically during meeting.
   */
  static async extractAndUpdateActionItems(meetingId, transcriptText, sourceChunk = null) {
    try {
      meetingId = parseInt(meetingId, 10);
      if (isNaN(meetingId)) {
        throw new Error('Invalid meetingId: must be a number');
      }

      if (!transcriptText || transcriptText.trim().length < 50) {
        return { added: 0, updated: 0, items: [] };
      }

      const extractedItems = await AgentProcessingService.extractActionItems(transcriptText);

      if (!Array.isArray(extractedItems) || extractedItems.length === 0) {
        return { added: 0, updated: 0, items: [] };
      }

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

      for (const item of extractedItems) {
        const normalizedItem = {
          title: item.title || item.description?.substring(0, 100) || 'Untitled Action Item',
          description: item.description || item.title || '',
          assignee: item.assignee || item.assigned_to || item.assignee_name || null,
          dueDate: item.dueDate || item.due_date ? new Date(item.dueDate || item.due_date) : null,
          confidence: item.confidence || 0.5
        };

        const canonicalKey = this._generateCanonicalKey(normalizedItem);
        const existing = existingMap.get(canonicalKey);

        if (existing) {
          const updates = this._mergeActionItem(existing, {
            ...normalizedItem,
            sourceChunk
          });

          const updatedItem = await prisma.actionItem.update({
            where: { id: existing.id },
            data: updates
          });

          processedItems.push(updatedItem);
          updated++;
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
              updateHistory: []
            }
          });

          processedItems.push(newItem);
          added++;
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
        }
      }
    });
  }

  /**
   * Confirm an action item.
   */
  static async confirm(id, userId) {
    return prisma.actionItem.update({
      where: { id },
      data: {
        status: 'confirmed',
        confirmedAt: new Date(),
        confirmedBy: userId
      },
      include: {
        confirmedByUser: {
          select: { id: true, name: true, email: true }
        }
      }
    });
  }

  /**
   * Reject an action item.
   */
  static async reject(id, userId) {
    return prisma.actionItem.update({
      where: { id },
      data: {
        status: 'rejected',
        rejectedAt: new Date(),
        rejectedBy: userId
      },
      include: {
        rejectedByUser: {
          select: { id: true, name: true, email: true }
        }
      }
    });
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
        : null
    };
  }
}

module.exports = ActionItemService;
