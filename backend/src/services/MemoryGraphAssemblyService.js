const prisma = require("../lib/prisma");

// Assembled graph data is cached per workspace for this duration to avoid
// rebuilding on every request (both /graph and /graph/stats share the cache).
const CACHE_TTL_MS = 60 * 1000;

/**
 * Builds the Memory Graph response from existing DB tables at query-time.
 * The frontend currently expects nodes/edges shaped like:
 * - node: { id, type, label, summary, data, position, size, color, opacity }
 * - edge: { id, source, target, type, weight, color, opacity, curved }
 */
class MemoryGraphAssemblyService {
  constructor() {
    // key -> { data, expiresAt }
    this._cache = new Map();
  }

  _cacheKey(workspaceId, options) {
    const m = options.limitMeetings != null ? parseInt(options.limitMeetings, 10) : 10;
    const n = options.limitNodes != null ? parseInt(options.limitNodes, 10) : 220;
    const a = options.limitActions != null ? parseInt(options.limitActions, 10) : 30;
    return `graph:${workspaceId}:${m}:${n}:${a}`;
  }

  _getCached(key) {
    const entry = this._cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this._cache.delete(key);
      return null;
    }
    return entry.data;
  }

  _setCache(key, data) {
    this._cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  }

  // Evict all cached entries for a workspace (call after data changes).
  clearCache(workspaceId) {
    const prefix = `graph:${workspaceId}:`;
    for (const key of this._cache.keys()) {
      if (key.startsWith(prefix)) this._cache.delete(key);
    }
  }

  normalizeName(name) {
    return String(name || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "");
  }

  safeString(v) {
    return typeof v === "string" ? v : v == null ? "" : String(v);
  }

  pickDecisionLabel(decisionItem) {
    if (!decisionItem) return "Decision";
    if (typeof decisionItem === "string") return decisionItem;
    if (typeof decisionItem !== "object") return this.safeString(decisionItem);

    return (
      decisionItem.decision ||
      decisionItem.title ||
      decisionItem.label ||
      decisionItem.text ||
      this.safeString(decisionItem)
    );
  }

  pickDecisionImpact(decisionItem) {
    if (!decisionItem || typeof decisionItem !== "object") return undefined;
    const raw = decisionItem.impact || decisionItem.impact_level || decisionItem.impactLevel;
    if (!raw) return undefined;

    const s = this.safeString(raw).toLowerCase();
    if (s.includes("urgent") || s.includes("high")) return "high";
    if (s.includes("medium") || s.includes("med")) return "medium";
    if (s.includes("low")) return "low";
    return undefined;
  }

  pickDecisionStatus(decisionItem) {
    if (!decisionItem || typeof decisionItem !== "object") return undefined;
    return this.safeString(decisionItem.decisionStatus || decisionItem.status || "").toLowerCase() || undefined;
  }

  nodeBaseLayout(nodeType) {
    // Deterministic “type columns” to keep the graph stable.
    const columns = {
      meeting: { x: 260 },
      topic: { x: 580 },
      decision: { x: 820 },
      action: { x: 510 },
      member: { x: 80 }
    };

    const colors = {
      meeting: "#3B82F6",
      topic: "#8B5CF6",
      decision: "#10B981",
      action: "#F59E0B",
      member: "#F97316"
    };

    const sizes = {
      meeting: 20,
      topic: 25,
      decision: 18,
      action: 15,
      member: 18
    };

    const c = columns[nodeType] || { x: 200 };
    return { x: c.x, color: colors[nodeType] || "#64748B", size: sizes[nodeType] || 16, opacity: 1 };
  }

  buildPositions(nodes) {
    // Assign y positions by type, in the order nodes were added.
    const yByType = {
      meeting: 70,
      topic: 80,
      decision: 110,
      action: 420,
      member: 60
    };

    const yStepByType = {
      meeting: 130,
      topic: 85,
      decision: 80,
      action: 80,
      member: 95
    };

    return nodes.map((n) => {
      const layout = this.nodeBaseLayout(n.type);
      const y = yByType[n.type] ?? 100;
      yByType[n.type] = y + (yStepByType[n.type] ?? 90);
      return {
        ...n,
        position: { x: layout.x, y },
        color: layout.color,
        size: layout.size,
        opacity: layout.opacity
      };
    });
  }

  async buildWorkspaceGraph(workspaceId, options = {}) {
    const workspaceIdInt = parseInt(workspaceId, 10);
    if (Number.isNaN(workspaceIdInt)) {
      return { nodes: [], edges: [] };
    }

    const cacheKey = this._cacheKey(workspaceId, options);
    const cached = this._getCached(cacheKey);
    if (cached) return cached;

    const limitMeetings = options.limitMeetings != null ? parseInt(options.limitMeetings, 10) : 10;
    const limitNodes = options.limitNodes != null ? parseInt(options.limitNodes, 10) : 220;
    const limitActions = options.limitActions != null ? parseInt(options.limitActions, 10) : 30;

    const meetingsCtx = await prisma.meetingMemoryContext.findMany({
      where: { meeting: { workspaceId: workspaceIdInt } },
      take: Math.max(1, limitMeetings),
      include: {
        meeting: {
          select: {
            id: true,
            title: true,
            startTime: true,
            endTime: true,
            duration: true
          }
        }
      },
      orderBy: {
        meeting: { startTime: "desc" }
      }
    });

    const meetingIds = meetingsCtx.map((m) => m.meetingId);

    const participantsSet = new Set();
    for (const ctx of meetingsCtx) {
      const p = Array.isArray(ctx.participants) ? ctx.participants : [];
      for (const name of p) participantsSet.add(String(name));
    }

    const topicSetByMeeting = new Map(); // meetingId -> topics[]
    const topicsAll = new Set();
    for (const ctx of meetingsCtx) {
      const topics = Array.isArray(ctx.keyTopics) ? ctx.keyTopics : [];
      topicSetByMeeting.set(ctx.meetingId, topics);
      for (const t of topics) topicsAll.add(String(t));
    }

    const rawActionItems = await prisma.actionItem.findMany({
      where: { meetingId: { in: meetingIds }, status: "pending" },
      orderBy: { lastSeenAt: "desc" },
      take: Math.max(0, limitActions)
    });

    for (const ai of rawActionItems) {
      if (ai.assignee) participantsSet.add(String(ai.assignee));
    }

    // Transcript snippet: grab the earliest transcript chunk per meeting.
    // (N+1 is acceptable here because limitMeetings is capped.)
    const transcriptSnippetByMeeting = {};
    for (const meetingId of meetingIds) {
      const chunk = await prisma.meetingEmbedding.findFirst({
        where: { meetingId: meetingId, contentType: "transcript" },
        select: { content: true },
        orderBy: { chunkIndex: "asc" }
      });
      const text = typeof chunk?.content === "string" ? chunk.content : "";
      transcriptSnippetByMeeting[meetingId] = text
        ? text.length > 200 ? `${text.slice(0, 200)}...` : text
        : null;
    }

    // Build nodes (meetings/topics/decisions/actions/members)
    const nodes = [];
    const edges = [];

    const memberIds = new Set();
    const topicIds = new Set();
    const decisionIds = new Set();

    const nodeIdMeeting = (meetingId) => `meeting:${meetingId}`;
    const nodeIdTopic = (topic) => `topic:${workspaceIdInt}:${this.normalizeName(topic)}`;
    const nodeIdDecision = (meetingId, index) => `decision:${meetingId}:${index}`;
    const nodeIdAction = (actionItemId) => `action:${actionItemId}`;
    const nodeIdMember = (name) => `member:${this.normalizeName(name)}`;

    // Keep deterministic ordering for stable layout.
    for (let i = 0; i < meetingsCtx.length; i++) {
      const ctx = meetingsCtx[i];
      const meeting = ctx.meeting;
      if (!meeting) continue;

      const meetingNodeId = nodeIdMeeting(meeting.id);
      const meetingSummary = this.safeString(ctx.meetingContext);

      const start = meeting.startTime ? new Date(meeting.startTime).toISOString() : undefined;
      const durationLabel = meeting.duration != null ? `${meeting.duration}m` : undefined;

      const participants = Array.isArray(ctx.participants) ? ctx.participants.map(String) : [];
      const transcriptSnippet = transcriptSnippetByMeeting[meeting.id] || undefined;

      nodes.push({
        id: meetingNodeId,
        type: "meeting",
        label: this.safeString(meeting.title) || `Meeting ${meeting.id}`,
        summary: meetingSummary ? (meetingSummary.length > 160 ? meetingSummary.slice(0, 160) + "..." : meetingSummary) : "",
        data: {
          date: start,
          duration: durationLabel,
          participants,
          transcriptSnippet
        }
      });

      // meeting -> topic edges + nodes
      const topics = topicSetByMeeting.get(ctx.meetingId) || [];
      for (let t = 0; t < topics.length; t++) {
        const topic = topics[t];
        const topicNodeId = nodeIdTopic(topic);
        if (!topicIds.has(topicNodeId)) {
          topicIds.add(topicNodeId);
          nodes.push({
            id: topicNodeId,
            type: "topic",
            label: this.safeString(topic),
            summary: this.safeString(topic),
            data: {
              keywords: [this.safeString(topic)],
              lastDiscussed: start
            }
          });
        }

        edges.push({
          id: `e:${meetingNodeId}:${topicNodeId}:meeting-topic`,
          source: meetingNodeId,
          target: topicNodeId,
          type: "meeting-topic",
          weight: 0.8,
          color: "#64748B",
          opacity: 0.6,
          curved: true
        });
      }

      // decisions: create nodes per meeting memory context
      const rawKeyDecisions = ctx.keyDecisions;
      const decisionsArr = Array.isArray(rawKeyDecisions) ? rawKeyDecisions : [];
      for (let d = 0; d < decisionsArr.length; d++) {
        const decisionItem = decisionsArr[d];
        const decisionNodeId = nodeIdDecision(meeting.id, d);
        if (!decisionIds.has(decisionNodeId)) {
          decisionIds.add(decisionNodeId);
          const label = this.pickDecisionLabel(decisionItem);
          nodes.push({
            id: decisionNodeId,
            type: "decision",
            label: this.safeString(label) || `Decision ${d + 1}`,
            summary: this.safeString(
              (decisionItem && typeof decisionItem === "object" && (decisionItem.rationale || decisionItem.description || decisionItem.reason)) ||
                (decisionItem && typeof decisionItem === "object" && decisionItem.decision) ||
                this.pickDecisionLabel(decisionItem)
            ),
            data: {
              decisionStatus: this.pickDecisionStatus(decisionItem),
              impact: this.pickDecisionImpact(decisionItem)
            }
          });
        }

        edges.push({
          id: `e:${meetingNodeId}:${decisionNodeId}:meeting-decision`,
          source: meetingNodeId,
          target: decisionNodeId,
          type: "meeting-decision",
          weight: 0.85,
          color: "#64748B",
          opacity: 0.6,
          curved: true
        });
      }

      // meeting -> member edges (participants)
      for (const pName of participants) {
        const memberNodeId = nodeIdMember(pName);
        if (!memberIds.has(memberNodeId)) {
          memberIds.add(memberNodeId);
          nodes.push({
            id: memberNodeId,
            type: "member",
            label: this.safeString(pName),
            summary: this.safeString(pName),
            data: {}
          });
        }

        edges.push({
          id: `e:${meetingNodeId}:${memberNodeId}:meeting-member`,
          source: meetingNodeId,
          target: memberNodeId,
          type: "meeting-member",
          weight: 0.7,
          color: "#64748B",
          opacity: 0.5,
          curved: true
        });
      }
    }

    // action nodes + action-member edges
    const actionNodes = [];
    for (let i = 0; i < rawActionItems.length; i++) {
      const ai = rawActionItems[i];
      if (!ai) continue;
      const actionNodeId = nodeIdAction(ai.id);
      const meetingNodeId = nodeIdMeeting(ai.meetingId);

      const dueDate = ai.dueDate ? new Date(ai.dueDate).toISOString() : undefined;
      const assignee = ai.assignee ? String(ai.assignee) : undefined;

      actionNodes.push({
        id: actionNodeId,
        type: "action",
        label: this.safeString(ai.title) || `Action ${ai.id}`,
        summary: this.safeString(ai.description) || "",
        data: {
          assignee,
          dueDate,
          priority: "medium",
          actionStatus: ai.status === "pending" ? "todo" : "todo"
        }
      });

      edges.push({
        id: `e:${meetingNodeId}:${actionNodeId}:meeting-action`,
        source: meetingNodeId,
        target: actionNodeId,
        type: "meeting-action",
        weight: 0.9,
        color: "#64748B",
        opacity: 0.65,
        curved: true
      });

      if (assignee) {
        const memberNodeId = nodeIdMember(assignee);
        if (!memberIds.has(memberNodeId)) {
          memberIds.add(memberNodeId);
          nodes.push({
            id: memberNodeId,
            type: "member",
            label: this.safeString(assignee),
            summary: this.safeString(assignee),
            data: {}
          });
        }

        edges.push({
          id: `e:${actionNodeId}:${memberNodeId}:action-member`,
          source: actionNodeId,
          target: memberNodeId,
          type: "action-member",
          weight: 0.9,
          color: "#64748B",
          opacity: 0.6,
          curved: true
        });
      }
    }
    nodes.push(...actionNodes);

    // Apply a hard cap to avoid overwhelming the canvas.
    // Keep edges consistent by capping nodes first then filtering edges.
    const limitedNodes = nodes.slice(0, Math.max(1, limitNodes));
    const limitedNodeIds = new Set(limitedNodes.map((n) => n.id));

    const limitedEdges = edges.filter((e) => limitedNodeIds.has(e.source) && limitedNodeIds.has(e.target));

    // Remove isolated non-meeting nodes so the rendered graph does not show
    // disconnected fragments after limit-based truncation.
    const connectedNodeIds = new Set();
    for (const e of limitedEdges) {
      connectedNodeIds.add(e.source);
      connectedNodeIds.add(e.target);
    }

    const prunedNodes = limitedNodes.filter((n) => connectedNodeIds.has(n.id) || n.type === "meeting");
    const prunedNodeIds = new Set(prunedNodes.map((n) => n.id));
    const prunedEdges = limitedEdges.filter((e) => prunedNodeIds.has(e.source) && prunedNodeIds.has(e.target));

    // Add visual layout properties (position/size/color/opacity)
    const visualNodes = this.buildPositions(prunedNodes);

    const result = { nodes: visualNodes, edges: prunedEdges };
    this._setCache(cacheKey, result);
    return result;
  }

  /**
   * Return a node and its neighbours up to `depth` hops via BFS.
   * Re-uses the cached graph so it is cheap to call repeatedly.
   * Returns null if the nodeId is not found in the workspace graph.
   */
  async getNodeNeighbours(workspaceId, nodeId, depth = 1) {
    const graph = await this.buildWorkspaceGraph(workspaceId);
    const { nodes: allNodes, edges: allEdges } = graph;

    const centerNode = allNodes.find((n) => n.id === nodeId);
    if (!centerNode) return null;

    // BFS to collect all node IDs within `depth` hops.
    const visited = new Set([nodeId]);
    let frontier = [nodeId];

    for (let d = 0; d < depth; d++) {
      const nextFrontier = [];
      for (const currentId of frontier) {
        for (const edge of allEdges) {
          let neighbourId = null;
          if (edge.source === currentId && !visited.has(edge.target)) {
            neighbourId = edge.target;
          } else if (edge.target === currentId && !visited.has(edge.source)) {
            neighbourId = edge.source;
          }
          if (neighbourId) {
            visited.add(neighbourId);
            nextFrontier.push(neighbourId);
          }
        }
      }
      frontier = nextFrontier;
    }

    const neighbourNodes = allNodes.filter((n) => visited.has(n.id) && n.id !== nodeId);
    // Only include edges where both endpoints are in the subgraph.
    const neighbourEdges = allEdges.filter(
      (e) => visited.has(e.source) && visited.has(e.target)
    );

    return {
      node: centerNode,
      depth,
      neighbours: { nodes: neighbourNodes, edges: neighbourEdges }
    };
  }

  async getWorkspaceStats(workspaceId, graphData) {
    const workspaceIdInt = parseInt(workspaceId, 10);
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceIdInt },
      select: { id: true, name: true }
    });

    const nodes = graphData?.nodes || [];
    const edges = graphData?.edges || [];

    const countByType = (type) => nodes.filter((n) => n.type === type).length;

    return {
      id: String(workspaceIdInt),
      name: workspace?.name || "Workspace",
      lastUpdate: new Date().toISOString(),
      totalNodes: nodes.length,
      totalEdges: edges.length,
      topics: countByType("topic"),
      meetings: countByType("meeting"),
      decisions: countByType("decision"),
      actions: countByType("action"),
      members: countByType("member")
    };
  }
}

module.exports = new MemoryGraphAssemblyService();

