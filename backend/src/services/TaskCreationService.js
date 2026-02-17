const prisma = require('../lib/prisma');

/**
 * TaskCreationService - Handles creation of tasks from action items
 */
class TaskCreationService {
  /**
   * Create a task from a confirmed action item
   * @param {number} actionItemId - The action item ID
   * @param {number} workspaceId - The workspace ID
   * @returns {Promise<object>} The created task
   */
  static async createTaskFromActionItem(actionItemId, workspaceId) {
    try {
      // Get the action item with meeting details
      const actionItem = await prisma.actionItem.findUnique({
        where: { id: actionItemId },
        include: {
          meeting: true,
          task: true // Check if task already exists
        }
      });

      if (!actionItem) {
        throw new Error(`Action item ${actionItemId} not found`);
      }

      // Skip if already converted to task
      if (actionItem.task) {
        console.log(`Action item ${actionItemId} already has a task (ID: ${actionItem.task.id})`);
        return actionItem.task;
      }

      // Only convert confirmed action items
      if (actionItem.status !== 'confirmed') {
        throw new Error(`Action item ${actionItemId} is not confirmed (status: ${actionItem.status})`);
      }

      // Get the "to-do" column for this workspace
      const todoColumn = await prisma.kanbanColumn.findFirst({
        where: {
          workspaceId: workspaceId,
          name: 'To-Do'
        }
      });

      if (!todoColumn) {
        throw new Error(`To-Do column not found for workspace ${workspaceId}`);
      }

      // Get the highest position in the column
      const maxPositionTask = await prisma.task.findFirst({
        where: { columnId: todoColumn.id },
        orderBy: { position: 'desc' },
        select: { position: true }
      });

      const newPosition = maxPositionTask ? maxPositionTask.position + 1 : 0;

      // Parse priority from description or use default
      const priority = this._extractPriority(actionItem.description, actionItem.rawData);

      // Create the task
      const task = await prisma.task.create({
        data: {
          workspaceId: workspaceId,
          columnId: todoColumn.id,
          actionItemId: actionItem.id,
          title: actionItem.title,
          description: actionItem.description,
          assignee: actionItem.assignee,
          dueDate: actionItem.dueDate,
          priority: priority,
          position: newPosition,
          metadata: {
            createdFrom: 'action_item',
            meetingId: actionItem.meetingId,
            meetingTitle: actionItem.meeting.title,
            actionItemConfidence: actionItem.confidence,
            sourceChunk: actionItem.sourceChunk
          }
        }
      });

      console.log(`✅ Created task ${task.id} from action item ${actionItemId}`);
      return task;

    } catch (error) {
      console.error(`Error creating task from action item ${actionItemId}:`, error);
      throw error;
    }
  }

  /**
   * Create tasks from all confirmed action items of a completed meeting
   * @param {number} meetingId - The meeting ID
   * @returns {Promise<Array>} Array of created tasks
   */
  static async createTasksFromMeetingActionItems(meetingId) {
    try {
      console.log(`\n📋 Creating tasks from meeting ${meetingId} action items...`);

      // Get the meeting with workspace info
      const meeting = await prisma.meeting.findUnique({
        where: { id: meetingId },
        include: {
          workspace: true,
          actionItems: {
            where: { status: 'confirmed' },
            include: { task: true }
          }
        }
      });

      if (!meeting) {
        throw new Error(`Meeting ${meetingId} not found`);
      }

      // Ensure default kanban columns exist
      await this.ensureDefaultKanbanColumns(meeting.workspaceId);

      const createdTasks = [];
      const errors = [];

      // Create task for each confirmed action item that doesn't already have one
      for (const actionItem of meeting.actionItems) {
        try {
          // Skip if task already exists
          if (actionItem.task) {
            console.log(`   ⏭️ Skipping action item ${actionItem.id} - already has task ${actionItem.task.id}`);
            continue;
          }

          const task = await this.createTaskFromActionItem(actionItem.id, meeting.workspaceId);
          createdTasks.push(task);
          console.log(`   ✅ Created task "${task.title}" (ID: ${task.id})`);
        } catch (error) {
          console.error(`   ❌ Failed to create task from action item ${actionItem.id}:`, error.message);
          errors.push({
            actionItemId: actionItem.id,
            error: error.message
          });
        }
      }

      console.log(`\n📊 Task creation summary for meeting ${meetingId}:`);
      console.log(`   - Confirmed action items: ${meeting.actionItems.length}`);
      console.log(`   - Tasks created: ${createdTasks.length}`);
      console.log(`   - Errors: ${errors.length}`);

      return {
        tasks: createdTasks,
        errors: errors,
        summary: {
          totalActionItems: meeting.actionItems.length,
          tasksCreated: createdTasks.length,
          errors: errors.length
        }
      };

    } catch (error) {
      console.error(`Error creating tasks from meeting ${meetingId}:`, error);
      throw error;
    }
  }

  /**
   * Ensure default kanban columns exist for a workspace
   * @param {number} workspaceId - The workspace ID
   * @returns {Promise<Array>} Array of kanban columns
   */
  static async ensureDefaultKanbanColumns(workspaceId) {
    try {
      const defaultColumns = [
        { name: 'To-Do', position: 0, isDefault: true },
        { name: 'In-Progress', position: 1, isDefault: true },
        { name: 'Complete', position: 2, isDefault: true }
      ];

      const existingColumns = await prisma.kanbanColumn.findMany({
        where: { workspaceId: workspaceId }
      });

      const createdColumns = [];

      for (const columnDef of defaultColumns) {
        const exists = existingColumns.find(col => col.name === columnDef.name);
        
        if (!exists) {
          const column = await prisma.kanbanColumn.create({
            data: {
              workspaceId: workspaceId,
              name: columnDef.name,
              position: columnDef.position,
              isDefault: columnDef.isDefault
            }
          });
          createdColumns.push(column);
          console.log(`   ✅ Created default kanban column: ${column.name}`);
        }
      }

      if (createdColumns.length > 0) {
        console.log(`✅ Ensured ${createdColumns.length} default kanban columns for workspace ${workspaceId}`);
      }

      return existingColumns.length > 0 ? existingColumns : createdColumns;

    } catch (error) {
      console.error(`Error ensuring default kanban columns for workspace ${workspaceId}:`, error);
      throw error;
    }
  }

  /**
   * Extract priority from action item data
   * @private
   */
  static _extractPriority(description, rawData) {
    // Check for priority keywords in description
    const descLower = (description || '').toLowerCase();
    
    if (descLower.includes('urgent') || descLower.includes('asap') || descLower.includes('critical')) {
      return 'urgent';
    }
    if (descLower.includes('high priority') || descLower.includes('important')) {
      return 'high';
    }
    if (descLower.includes('low priority') || descLower.includes('when possible')) {
      return 'low';
    }

    // Check rawData if available
    if (rawData && typeof rawData === 'object') {
      const priority = rawData.priority;
      if (priority && ['low', 'medium', 'high', 'urgent'].includes(priority.toLowerCase())) {
        return priority.toLowerCase();
      }
    }

    return 'medium'; // default
  }

  /**
   * Move a task to a different column
   * @param {number} taskId - The task ID
   * @param {number} columnId - The target column ID
   * @param {number} position - Optional position in the new column
   */
  static async moveTask(taskId, columnId, position = null) {
    try {
      const task = await prisma.task.findUnique({
        where: { id: taskId }
      });

      if (!task) {
        throw new Error(`Task ${taskId} not found`);
      }

      // If no position specified, add to end of column
      let newPosition = position;
      if (newPosition === null) {
        const maxPositionTask = await prisma.task.findFirst({
          where: { columnId: columnId },
          orderBy: { position: 'desc' },
          select: { position: true }
        });
        newPosition = maxPositionTask ? maxPositionTask.position + 1 : 0;
      }

      // Update task
      const updatedTask = await prisma.task.update({
        where: { id: taskId },
        data: {
          columnId: columnId,
          position: newPosition
        }
      });

      return updatedTask;

    } catch (error) {
      console.error(`Error moving task ${taskId}:`, error);
      throw error;
    }
  }

  /**
   * Update task details
   * @param {number} taskId - The task ID
   * @param {object} updates - Fields to update
   */
  static async updateTask(taskId, updates) {
    try {
      const allowedFields = ['title', 'description', 'assignee', 'dueDate', 'priority', 'metadata'];
      const updateData = {};

      for (const field of allowedFields) {
        if (updates[field] !== undefined) {
          // Special handling for dueDate
          if (field === 'dueDate' && updates[field]) {
            try {
              // If it's just a date string (YYYY-MM-DD), append time to make it valid ISO
              const dateStr = updates[field].includes('T') ? updates[field] : `${updates[field]}T00:00:00.000Z`;
              const parsedDate = new Date(dateStr);
              // Validate the date is actually valid
              if (!isNaN(parsedDate.getTime())) {
                updateData[field] = parsedDate;
              }
            } catch (e) {
              console.error('Error parsing date during update:', e);
            }
          } else {
            updateData[field] = updates[field];
          }
        }
      }

      const updatedTask = await prisma.task.update({
        where: { id: taskId },
        data: updateData
      });

      return updatedTask;

    } catch (error) {
      console.error(`Error updating task ${taskId}:`, error);
      throw error;
    }
  }

  /**
   * Delete a task
   * @param {number} taskId - The task ID
   */
  static async deleteTask(taskId) {
    try {
      await prisma.task.delete({
        where: { id: taskId }
      });

      console.log(`✅ Deleted task ${taskId}`);
      return { success: true };

    } catch (error) {
      console.error(`Error deleting task ${taskId}:`, error);
      throw error;
    }
  }

  /**
   * Get all tasks for a workspace
   * @param {number} workspaceId - The workspace ID
   */
  static async getWorkspaceTasks(workspaceId) {
    try {
      const tasks = await prisma.task.findMany({
        where: { workspaceId: workspaceId },
        include: {
          column: true,
          actionItem: {
            include: {
              meeting: {
                select: { id: true, title: true, startTime: true }
              }
            }
          }
        },
        orderBy: [
          { column: { position: 'asc' } },
          { position: 'asc' }
        ]
      });

      return tasks;

    } catch (error) {
      console.error(`Error getting tasks for workspace ${workspaceId}:`, error);
      throw error;
    }
  }

  /**
   * Get all kanban columns for a workspace
   * @param {number} workspaceId - The workspace ID
   */
  static async getWorkspaceColumns(workspaceId) {
    try {
      const columns = await prisma.kanbanColumn.findMany({
        where: { workspaceId: workspaceId },
        include: {
          tasks: {
            orderBy: { position: 'asc' },
            include: {
              actionItem: {
                include: {
                  meeting: {
                    select: { id: true, title: true, startTime: true }
                  }
                }
              }
            }
          }
        },
        orderBy: { position: 'asc' }
      });

      return columns;

    } catch (error) {
      console.error(`Error getting columns for workspace ${workspaceId}:`, error);
      throw error;
    }
  }

  /**
   * Create a new kanban column (for workspace owners/admins)
   * @param {number} workspaceId - The workspace ID
   * @param {string} name - Column name
   */
  static async createColumn(workspaceId, name) {
    try {
      // Get the highest position
      const maxPositionColumn = await prisma.kanbanColumn.findFirst({
        where: { workspaceId: workspaceId },
        orderBy: { position: 'desc' },
        select: { position: true }
      });

      const newPosition = maxPositionColumn ? maxPositionColumn.position + 1 : 0;

      const column = await prisma.kanbanColumn.create({
        data: {
          workspaceId: workspaceId,
          name: name,
          position: newPosition,
          isDefault: false
        }
      });

      console.log(`✅ Created kanban column "${name}" (ID: ${column.id})`);
      return column;

    } catch (error) {
      console.error(`Error creating column for workspace ${workspaceId}:`, error);
      throw error;
    }
  }

  /**
   * Delete a kanban column (only if not default and has no tasks)
   * @param {number} columnId - The column ID
   * @param {boolean} force - Force delete even if has tasks (move tasks to To-Do)
   */
  static async deleteColumn(columnId, force = false) {
    try {
      const column = await prisma.kanbanColumn.findUnique({
        where: { id: columnId },
        include: { tasks: true }
      });

      if (!column) {
        throw new Error(`Column ${columnId} not found`);
      }

      // Cannot delete default columns
      if (column.isDefault) {
        throw new Error(`Cannot delete default column "${column.name}"`);
      }

      // Check if column has tasks
      if (column.tasks.length > 0 && !force) {
        throw new Error(`Column "${column.name}" has ${column.tasks.length} task(s). Use force=true to move them to To-Do and delete.`);
      }

      // If force, move tasks to To-Do column
      if (column.tasks.length > 0 && force) {
        const todoColumn = await prisma.kanbanColumn.findFirst({
          where: {
            workspaceId: column.workspaceId,
            name: 'To-Do'
          }
        });

        if (!todoColumn) {
          throw new Error('To-Do column not found for moving tasks');
        }

        // Move all tasks to To-Do
        for (const task of column.tasks) {
          await this.moveTask(task.id, todoColumn.id);
        }

        console.log(`   📦 Moved ${column.tasks.length} task(s) to To-Do column`);
      }

      // Delete the column
      await prisma.kanbanColumn.delete({
        where: { id: columnId }
      });

      console.log(`✅ Deleted kanban column "${column.name}" (ID: ${columnId})`);
      return { success: true };

    } catch (error) {
      console.error(`Error deleting column ${columnId}:`, error);
      throw error;
    }
  }

  /**
   * Rename a kanban column
   * @param {number} columnId - The column ID
   * @param {string} newName - New column name
   */
  static async renameColumn(columnId, newName) {
    try {
      const column = await prisma.kanbanColumn.update({
        where: { id: columnId },
        data: { name: newName }
      });

      console.log(`✅ Renamed column ${columnId} to "${newName}"`);
      return column;

    } catch (error) {
      console.error(`Error renaming column ${columnId}:`, error);
      throw error;
    }
  }
}

module.exports = TaskCreationService;


