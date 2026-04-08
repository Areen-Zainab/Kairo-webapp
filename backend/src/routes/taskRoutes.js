const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const TaskCreationService = require('../services/TaskCreationService');
const Task = require('../models/Task');
const KanbanColumn = require('../models/KanbanColumn');
const Tag = require('../models/Tag');
const prisma = require('../lib/prisma');
const TaskContextService = require('../services/TaskContextService');
const NotificationService = require('../services/NotificationService');

/**
 * Helper function to check if user has access to workspace
 */
async function checkWorkspaceAccess(userId, workspaceId) {
  const member = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: parseInt(workspaceId),
        userId: userId
      }
    }
  });

  return member && member.isActive;
}

/**
 * Helper function to check if user is workspace owner or admin
 */
async function checkWorkspaceAdmin(userId, workspaceId) {
  const member = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: parseInt(workspaceId),
        userId: userId
      }
    }
  });

  return member && member.isActive && (member.role === 'owner' || member.role === 'admin');
}

// ==================== KANBAN COLUMNS ====================

/**
 * GET /api/workspaces/:workspaceId/kanban/columns
 * Get all kanban columns for a workspace with their tasks
 */
router.get('/workspaces/:workspaceId/kanban/columns', authenticateToken, async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const userId = req.user.id;

    // Check workspace access
    const hasAccess = await checkWorkspaceAccess(userId, workspaceId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this workspace' });
    }

    const columns = await TaskCreationService.getWorkspaceColumns(parseInt(workspaceId));

    res.json({ columns });
  } catch (error) {
    console.error('Error fetching kanban columns:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/workspaces/:workspaceId/kanban/columns
 * Create a new kanban column (owners/admins only)
 */
router.post('/workspaces/:workspaceId/kanban/columns', authenticateToken, async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { name } = req.body;
    const userId = req.user.id;

    // Validate input
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Column name is required' });
    }

    // Check if user is workspace admin
    const isAdmin = await checkWorkspaceAdmin(userId, workspaceId);
    if (!isAdmin) {
      return res.status(403).json({ error: 'Only workspace owners and admins can create columns' });
    }

    const column = await TaskCreationService.createColumn(parseInt(workspaceId), name.trim());

    res.status(201).json({ 
      message: 'Column created successfully',
      column 
    });
  } catch (error) {
    console.error('Error creating kanban column:', error);
    
    // Handle unique constraint violation
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'A column with this name already exists in this workspace' });
    }

    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /api/kanban/columns/:columnId
 * Update a kanban column (rename)
 */
router.patch('/kanban/columns/:columnId', authenticateToken, async (req, res) => {
  try {
    const { columnId } = req.params;
    const { name } = req.body;
    const userId = req.user.id;

    const column = await KanbanColumn.findById(parseInt(columnId));
    if (!column) {
      return res.status(404).json({ error: 'Column not found' });
    }

    // Check if user is workspace admin
    const isAdmin = await checkWorkspaceAdmin(userId, column.workspaceId);
    if (!isAdmin) {
      return res.status(403).json({ error: 'Only workspace owners and admins can modify columns' });
    }

    // Validate input
    if (name && name.trim().length === 0) {
      return res.status(400).json({ error: 'Column name cannot be empty' });
    }

    const updatedColumn = await TaskCreationService.renameColumn(
      parseInt(columnId),
      name.trim()
    );

    res.json({ 
      message: 'Column updated successfully',
      column: updatedColumn 
    });
  } catch (error) {
    console.error('Error updating kanban column:', error);
    
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'A column with this name already exists in this workspace' });
    }

    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/kanban/columns/:columnId
 * Delete a kanban column (owners/admins only, not default columns)
 */
router.delete('/kanban/columns/:columnId', authenticateToken, async (req, res) => {
  try {
    const { columnId } = req.params;
    const { force } = req.query; // ?force=true to move tasks to To-Do before deleting
    const userId = req.user.id;

    const column = await KanbanColumn.findById(parseInt(columnId));
    if (!column) {
      return res.status(404).json({ error: 'Column not found' });
    }

    // Check if user is workspace admin
    const isAdmin = await checkWorkspaceAdmin(userId, column.workspaceId);
    if (!isAdmin) {
      return res.status(403).json({ error: 'Only workspace owners and admins can delete columns' });
    }

    await TaskCreationService.deleteColumn(parseInt(columnId), force === 'true');

    res.json({ message: 'Column deleted successfully' });
  } catch (error) {
    console.error('Error deleting kanban column:', error);
    
    if (error.message.includes('Cannot delete')) {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== TASKS ====================

/**
 * GET /api/workspaces/:workspaceId/tasks
 * Get all tasks for a workspace
 */
router.get('/workspaces/:workspaceId/tasks', authenticateToken, async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const userId = req.user.id;

    // Check workspace access
    const hasAccess = await checkWorkspaceAccess(userId, workspaceId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this workspace' });
    }

    const tasks = await TaskCreationService.getWorkspaceTasks(parseInt(workspaceId));

    res.json({ tasks });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/tasks/:taskId
 * Get a specific task by ID
 */
router.get('/tasks/:taskId', authenticateToken, async (req, res) => {
  try {
    const { taskId } = req.params;
    const userId = req.user.id;

    const task = await Task.findById(parseInt(taskId));
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Check workspace access
    const hasAccess = await checkWorkspaceAccess(userId, task.workspaceId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ task });
  } catch (error) {
    console.error('Error fetching task:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/tasks/:taskId/context
 * Enriched meeting memory + micro-channel stats for TaskDetailModal (action-item-linked tasks only).
 */
router.get('/tasks/:taskId/context', authenticateToken, async (req, res) => {
  try {
    const { taskId } = req.params;
    const result = await TaskContextService.getTaskMeetingContext(taskId, req.user.id);
    if (result.status) {
      const code = result.status;
      const msg =
        result.error === 'not_found'
          ? 'Task not found'
          : result.error === 'forbidden'
            ? 'Access denied'
            : 'Bad request';
      return res.status(code).json({ error: msg });
    }
    res.json(result);
  } catch (error) {
    console.error('Error fetching task context:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/workspaces/:workspaceId/tasks
 * Create a new task manually
 */
router.post('/workspaces/:workspaceId/tasks', authenticateToken, async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { columnId, title, description, assignee, dueDate, priority } = req.body;
    const userId = req.user.id;

    // Check workspace access
    const hasAccess = await checkWorkspaceAccess(userId, workspaceId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this workspace' });
    }

    // Validate input
    if (!title || title.trim().length === 0) {
      return res.status(400).json({ error: 'Task title is required' });
    }

    if (!columnId) {
      return res.status(400).json({ error: 'Column ID is required' });
    }

    // Verify column belongs to workspace
    const column = await KanbanColumn.findById(parseInt(columnId));
    if (!column || column.workspaceId !== parseInt(workspaceId)) {
      return res.status(400).json({ error: 'Invalid column for this workspace' });
    }

    // Get the highest position in the column
    const maxPositionTask = await prisma.task.findFirst({
      where: { columnId: parseInt(columnId) },
      orderBy: { position: 'desc' },
      select: { position: true }
    });

    const newPosition = maxPositionTask ? maxPositionTask.position + 1 : 0;

    // Parse dueDate properly - handle YYYY-MM-DD format from frontend
    let parsedDueDate = null;
    if (dueDate) {
      try {
        // If it's just a date string (YYYY-MM-DD), append time to make it valid ISO
        const dateStr = dueDate.includes('T') ? dueDate : `${dueDate}T00:00:00.000Z`;
        parsedDueDate = new Date(dateStr);
        // Validate the date is actually valid
        if (isNaN(parsedDueDate.getTime())) {
          parsedDueDate = null;
        }
      } catch (e) {
        console.error('Error parsing date:', e);
        parsedDueDate = null;
      }
    }

    const task = await Task.create({
      workspaceId: parseInt(workspaceId),
      columnId: parseInt(columnId),
      title: title.trim(),
      description: description || null,
      assignee: assignee || null,
      dueDate: parsedDueDate,
      priority: priority || 'medium',
      position: newPosition,
      metadata: {
        createdBy: userId,
        createdManually: true
      }
    });

    const ws = await prisma.workspace.findUnique({
      where: { id: parseInt(workspaceId, 10) },
      select: { name: true }
    });
    await NotificationService.notifyTaskAssigned({
      task,
      workspaceId: parseInt(workspaceId, 10),
      workspaceName: ws?.name || 'Workspace',
      actorUserId: userId,
      previousAssignee: undefined
    });

    res.status(201).json({ 
      message: 'Task created successfully',
      task 
    });
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /api/tasks/:taskId
 * Update a task
 */
router.patch('/tasks/:taskId', authenticateToken, async (req, res) => {
  try {
    const { taskId } = req.params;
    const updates = req.body;
    const userId = req.user.id;

    const task = await Task.findById(parseInt(taskId));
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Check workspace access
    const hasAccess = await checkWorkspaceAccess(userId, task.workspaceId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // If moving to different column, verify it's in same workspace
    if (updates.columnId && updates.columnId !== task.columnId) {
      const newColumn = await KanbanColumn.findById(parseInt(updates.columnId));
      if (!newColumn || newColumn.workspaceId !== task.workspaceId) {
        return res.status(400).json({ error: 'Invalid column for this workspace' });
      }
    }

    const previousAssignee = task.assignee;
    const updatedTask = await TaskCreationService.updateTask(parseInt(taskId), updates);

    if (updates.assignee !== undefined) {
      const workspaceName = task.workspace?.name || 'Workspace';
      await NotificationService.notifyTaskAssigned({
        task: updatedTask,
        workspaceId: task.workspaceId,
        workspaceName,
        actorUserId: userId,
        previousAssignee
      });
    }

    res.json({ 
      message: 'Task updated successfully',
      task: updatedTask 
    });
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/tasks/:taskId/move
 * Move a task to a different column
 */
router.post('/tasks/:taskId/move', authenticateToken, async (req, res) => {
  try {
    const { taskId } = req.params;
    const { columnId, position } = req.body;
    const userId = req.user.id;

    const task = await Task.findById(parseInt(taskId));
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Check workspace access
    const hasAccess = await checkWorkspaceAccess(userId, task.workspaceId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Verify column belongs to same workspace
    const column = await KanbanColumn.findById(parseInt(columnId));
    if (!column || column.workspaceId !== task.workspaceId) {
      return res.status(400).json({ error: 'Invalid column for this workspace' });
    }

    const updatedTask = await TaskCreationService.moveTask(
      parseInt(taskId),
      parseInt(columnId),
      position !== undefined ? parseInt(position) : null
    );

    res.json({ 
      message: 'Task moved successfully',
      task: updatedTask 
    });
  } catch (error) {
    console.error('Error moving task:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/tasks/:taskId
 * Delete a task
 */
router.delete('/tasks/:taskId', authenticateToken, async (req, res) => {
  try {
    const { taskId } = req.params;
    const userId = req.user.id;

    const task = await Task.findById(parseInt(taskId));
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Check workspace access
    const hasAccess = await checkWorkspaceAccess(userId, task.workspaceId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await TaskCreationService.deleteTask(parseInt(taskId));

    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/action-items/:actionItemId/create-task
 * Manually convert an action item to a task
 */
router.post('/action-items/:actionItemId/create-task', authenticateToken, async (req, res) => {
  try {
    const { actionItemId } = req.params;
    const userId = req.user.id;

    // Get action item with meeting info
    const actionItem = await prisma.actionItem.findUnique({
      where: { id: parseInt(actionItemId) },
      include: {
        meeting: {
          include: {
            workspace: true
          }
        }
      }
    });

    if (!actionItem) {
      return res.status(404).json({ error: 'Action item not found' });
    }

    // Check workspace access
    const hasAccess = await checkWorkspaceAccess(userId, actionItem.meeting.workspaceId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if action item is confirmed
    if (actionItem.status !== 'confirmed') {
      return res.status(400).json({ error: 'Only confirmed action items can be converted to tasks' });
    }

    const task = await TaskCreationService.createTaskFromActionItem(
      parseInt(actionItemId),
      actionItem.meeting.workspaceId
    );

    res.status(201).json({ 
      message: 'Task created from action item successfully',
      task 
    });
  } catch (error) {
    console.error('Error creating task from action item:', error);
    
    if (error.message.includes('already has a task')) {
      return res.status(400).json({ error: 'This action item already has a task' });
    }

    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== TAGS ====================

/**
 * GET /api/workspaces/:workspaceId/tags
 * Get all tags for a workspace
 */
router.get('/workspaces/:workspaceId/tags', authenticateToken, async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const userId = req.user.id;

    // Check workspace access
    const hasAccess = await checkWorkspaceAccess(userId, workspaceId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this workspace' });
    }

    const tags = await Tag.findByWorkspaceId(parseInt(workspaceId));

    res.json({ tags });
  } catch (error) {
    console.error('Error fetching tags:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/workspaces/:workspaceId/tags
 * Create a new tag
 */
router.post('/workspaces/:workspaceId/tags', authenticateToken, async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { name, color } = req.body;
    const userId = req.user.id;

    // Check workspace access
    const hasAccess = await checkWorkspaceAccess(userId, workspaceId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this workspace' });
    }

    // Validate input
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Tag name is required' });
    }

    const tag = await Tag.create({
      workspaceId: parseInt(workspaceId),
      name: name.trim(),
      color: color || '#3b82f6'
    });

    res.status(201).json({ 
      message: 'Tag created successfully',
      tag 
    });
  } catch (error) {
    console.error('Error creating tag:', error);
    
    // Handle unique constraint violation
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'A tag with this name already exists in this workspace' });
    }

    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /api/tags/:tagId
 * Update a tag (rename or change color)
 */
router.patch('/tags/:tagId', authenticateToken, async (req, res) => {
  try {
    const { tagId } = req.params;
    const { name, color } = req.body;
    const userId = req.user.id;

    const tag = await Tag.findById(parseInt(tagId));
    if (!tag) {
      return res.status(404).json({ error: 'Tag not found' });
    }

    // Check workspace access
    const hasAccess = await checkWorkspaceAccess(userId, tag.workspaceId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updatedTag = await Tag.update(parseInt(tagId), { name, color });

    res.json({ 
      message: 'Tag updated successfully',
      tag: updatedTag 
    });
  } catch (error) {
    console.error('Error updating tag:', error);
    
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'A tag with this name already exists in this workspace' });
    }

    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/tags/:tagId
 * Delete a tag
 */
router.delete('/tags/:tagId', authenticateToken, async (req, res) => {
  try {
    const { tagId } = req.params;
    const userId = req.user.id;

    const tag = await Tag.findById(parseInt(tagId));
    if (!tag) {
      return res.status(404).json({ error: 'Tag not found' });
    }

    // Check workspace access
    const hasAccess = await checkWorkspaceAccess(userId, tag.workspaceId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await Tag.delete(parseInt(tagId));

    res.json({ message: 'Tag deleted successfully' });
  } catch (error) {
    console.error('Error deleting tag:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/tasks/:taskId/tags/:tagId
 * Assign a tag to a task
 */
router.post('/tasks/:taskId/tags/:tagId', authenticateToken, async (req, res) => {
  try {
    const { taskId, tagId } = req.params;
    const userId = req.user.id;

    const task = await Task.findById(parseInt(taskId));
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const tag = await Tag.findById(parseInt(tagId));
    if (!tag) {
      return res.status(404).json({ error: 'Tag not found' });
    }

    // Verify task and tag are in same workspace
    if (task.workspaceId !== tag.workspaceId) {
      return res.status(400).json({ error: 'Task and tag must be in the same workspace' });
    }

    // Check workspace access
    const hasAccess = await checkWorkspaceAccess(userId, task.workspaceId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await Tag.assignToTask(parseInt(taskId), parseInt(tagId));

    res.json({ 
      message: 'Tag assigned to task successfully',
      taskTag: result 
    });
  } catch (error) {
    console.error('Error assigning tag to task:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/tasks/:taskId/tags/:tagId
 * Remove a tag from a task
 */
router.delete('/tasks/:taskId/tags/:tagId', authenticateToken, async (req, res) => {
  try {
    const { taskId, tagId } = req.params;
    const userId = req.user.id;

    const task = await Task.findById(parseInt(taskId));
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Check workspace access
    const hasAccess = await checkWorkspaceAccess(userId, task.workspaceId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await Tag.removeFromTask(parseInt(taskId), parseInt(tagId));

    res.json({ message: 'Tag removed from task successfully' });
  } catch (error) {
    console.error('Error removing tag from task:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/tasks/:taskId/tags
 * Get all tags for a specific task
 */
router.get('/tasks/:taskId/tags', authenticateToken, async (req, res) => {
  try {
    const { taskId } = req.params;
    const userId = req.user.id;

    const task = await Task.findById(parseInt(taskId));
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Check workspace access
    const hasAccess = await checkWorkspaceAccess(userId, task.workspaceId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const tags = await Tag.getTaskTags(parseInt(taskId));

    res.json({ tags });
  } catch (error) {
    console.error('Error fetching task tags:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;


