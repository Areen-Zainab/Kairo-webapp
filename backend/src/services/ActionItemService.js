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

    // Update description if different and meaningfully new.
    if (newItem.description && newItem.description !== existing.description) {
      const existingDesc = existingDescription.toLowerCase();
      const newDesc = (newItem.description || '').toLowerCase();

      // Compute word-level Jaccard similarity to detect near-duplicate descriptions.
      // Voice-transcription enrichments often rephrase the same content with noise.
      const existingWords = new Set(existingDesc.split(/\s+/).filter(w => w.length > 3));
      const newWords = new Set(newDesc.split(/\s+/).filter(w => w.length > 3));
      const intersection = new Set([...existingWords].filter(w => newWords.has(w)));
      const union = new Set([...existingWords, ...newWords]);
      const similarity = union.size > 0 ? intersection.size / union.size : 0;

      if (existingDesc.includes(newDesc) || newDesc.includes(existingDesc)) {
        // Exact subset — already captured, skip
      } else if (similarity >= 0.60) {
        // Near-duplicate (>= 60% word overlap) — likely voice transcription noise.
        // Only replace if the new version is notably longer (adds >=20% more words).
        const newWordCount = newDesc.split(/\s+/).length;
        const existingWordCount = existingDesc.split(/\s+/).length;
        if (newWordCount > existingWordCount * 1.20) {
          updates.description = newItem.description;
          historyEntry.changes.description = 'replaced with more complete version';
          hasChanges = true;
        }
        // Otherwise skip — not meaningfully different
      } else {
        // Genuinely new information — append with timestamp
        const timestamp = new Date().toLocaleString('en-US', { 
          month: 'short', 
          day: 'numeric', 
          hour: '2-digit', 
          minute: '2-digit' 
        });
        updates.description = `${existing.description || ''}\n\n[Updated ${timestamp}]: ${newItem.description}`.trim();
        historyEntry.changes.description = 'appended new information';
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

      // 1. Fetch existing items so the LLM has context to enrich rather than duplicate
      const existingItems = await prisma.actionItem.findMany({
        where: { meetingId, status: { in: ['pending', 'confirmed'] } }
      });

      const existingContext = existingItems.map(i => ({
        id: i.id,
        title: i.title,
        description: i.description || '',
        status: i.status
      }));

      const agentContext = existingContext.length > 0 ? { existingActionItems: existingContext } : null;

      console.log(`🔍 [ActionItemService] Extracting action items from ${normalizedTranscript.length} chars (${isIncremental ? 'incremental' : 'full'}), ${existingItems.length} existing item(s) passed as context...`);

      // 2. Call the agent — with or without context
      let agentResponse = await AgentProcessingService.extractActionItems(normalizedTranscript, agentContext);

      // 3. Detect response format: {enrichments, new_items} vs flat array
      let enrichments = [];
      let newItems = [];

      if (agentResponse && typeof agentResponse === 'object' && !Array.isArray(agentResponse)
          && ('enrichments' in agentResponse || 'new_items' in agentResponse)) {
        // Context-aware response from LLM
        enrichments = Array.isArray(agentResponse.enrichments) ? agentResponse.enrichments : [];
        newItems = Array.isArray(agentResponse.new_items) ? agentResponse.new_items : [];
        console.log(`🔍 [ActionItemService] LLM returned ${enrichments.length} enrichment(s) + ${newItems.length} new item(s)`);
      } else {
        // Flat list path (no context / fallback)
        let flatItems = Array.isArray(agentResponse) ? agentResponse : [];
        if (flatItems.length === 0) {
          const heuristicItems = this._extractHeuristicActionItems(normalizedTranscript);
          if (heuristicItems.length > 0) {
            console.log(`🔍 [ActionItemService] Heuristic fallback produced ${heuristicItems.length} action item(s)`);
            flatItems = heuristicItems;
          }
        }
        newItems = flatItems;
        console.log(`🔍 [ActionItemService] LLM returned flat list of ${newItems.length} item(s)`);
      }

      // 4. Confidence + placeholder filters for new items
      const CONFIDENCE_THRESHOLD = isIncremental ? 0.3 : 0.45;
      const placeholderPatterns = [
        'no action items detected', 'no actionable items', 'no action items found',
        'no tasks identified', 'no follow-up items', 'no action items were identified',
        'no specific action items'
      ];

      const realNewItems = newItems.filter(item => {
        const confidence = Number.isFinite(item?.confidence) ? item.confidence : 0.5;
        if (confidence < CONFIDENCE_THRESHOLD) return false;
        const title = (item.title || '').toLowerCase();
        const description = (item.description || '').toLowerCase();
        return !placeholderPatterns.some(p => title.includes(p) || description.includes(p));
      });

      // Build lookup maps
      const existingMap = new Map(existingItems.map(i => [i.canonicalKey, i]));
      const existingIdMap = new Map(existingItems.map(i => [i.id, i]));

      let added = 0;
      let updated = 0;
      const itemsToUpdate = [];

      // 5. Apply enrichments to existing items
      for (const enr of enrichments) {
        const existing = existingIdMap.get(enr.id);
        if (!existing) continue;

        // Only merge fields that are genuinely changing
        const partial = {
          title: enr.title || existing.title,
          description: enr.description || existing.description,
          assignee: enr.assignee || existing.assignee,
          dueDate: enr.dueDate || existing.dueDate,
          confidence: enr.confidence || existing.confidence
        };

        const { updates, hasChanges } = this._mergeActionItem(existing, { ...partial, sourceChunk });

        if (hasChanges) {
          // Preserve confirmed/rejected status — only update description/title/etc
          const safeUpdates = { ...updates };
          if (existing.status !== 'pending') {
            delete safeUpdates.status; // Never override a user decision
          }
          const updatedItem = await prisma.actionItem.update({
            where: { id: existing.id },
            data: safeUpdates
          });
          itemsToUpdate.push(updatedItem);
          updated++;
        } else {
          await prisma.actionItem.update({ where: { id: existing.id }, data: { lastSeenAt: new Date() } });
        }
      }

      // 6. Insert genuinely new items (exact canonical key as safety net)
      for (const item of realNewItems) {
        const normalizedItem = {
          title: item.title || item.description?.substring(0, 100) || 'Untitled Action Item',
          description: item.description || item.title || '',
          assignee: item.assignee || item.assigned_to || item.assignee_name || null,
          dueDate: item.dueDate || item.due_date ? new Date(item.dueDate || item.due_date) : null,
          confidence: Number.isFinite(item.confidence) ? item.confidence : 0.5
        };

        const canonicalKey = this._generateCanonicalKey(normalizedItem);
        const exactMatch = existingMap.get(canonicalKey);

        if (exactMatch) {
          // Exact duplicate — merge silently
          const { updates, hasChanges } = this._mergeActionItem(exactMatch, { ...normalizedItem, sourceChunk });
          if (hasChanges) {
            const updatedItem = await prisma.actionItem.update({ where: { id: exactMatch.id }, data: updates });
            itemsToUpdate.push(updatedItem);
            updated++;
          } else {
            await prisma.actionItem.update({ where: { id: exactMatch.id }, data: { lastSeenAt: new Date() } });
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
          itemsToUpdate.push(newItem);
          added++;
        }
      }

      // 7. Broadcast via WebSocket
      if ((added > 0 || updated > 0) && itemsToUpdate.length > 0) {
        try {
          const WebSocketServer = require('./WebSocketServer');
          WebSocketServer.broadcastActionItems(meetingId, itemsToUpdate.map(i => this._toDTO(i)));
        } catch (wsError) {
          console.warn('⚠️ Failed to broadcast action items via WebSocket:', wsError.message);
        }
      }

      console.log(`✅ [ActionItemService] Processed: ${added} added, ${updated} updated`);
      return { added, updated, items: itemsToUpdate };
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
