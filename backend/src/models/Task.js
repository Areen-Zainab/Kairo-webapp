const prisma = require('../lib/prisma');

class Task {
  static async create(taskData) {
    const {
      workspaceId,
      columnId,
      actionItemId,
      title,
      description,
      assignee,
      dueDate,
      priority,
      position,
      metadata
    } = taskData;

    return await prisma.task.create({
      data: {
        workspaceId,
        columnId,
        actionItemId: actionItemId || null,
        title,
        description: description || null,
        assignee: assignee || null,
        dueDate: dueDate || null,
        priority: priority || 'medium',
        position: position !== undefined ? position : 0,
        metadata: metadata || null
      }
    });
  }

  static async findById(id) {
    return await prisma.task.findUnique({
      where: { id },
      include: {
        workspace: true,
        column: true,
        actionItem: {
          include: {
            meeting: true
          }
        },
        tags: {
          include: {
            tag: true
          }
        }
      }
    });
  }

  static async findByWorkspace(workspaceId) {
    return await prisma.task.findMany({
      where: { workspaceId },
      include: {
        column: true,
        actionItem: {
          include: {
            meeting: {
              select: { id: true, title: true, startTime: true }
            }
          }
        },
        tags: {
          include: {
            tag: true
          }
        }
      },
      orderBy: [
        { column: { position: 'asc' } },
        { position: 'asc' }
      ]
    });
  }

  static async findByColumn(columnId) {
    return await prisma.task.findMany({
      where: { columnId },
      include: {
        actionItem: {
          include: {
            meeting: {
              select: { id: true, title: true, startTime: true }
            }
          }
        },
        tags: {
          include: {
            tag: true
          }
        }
      },
      orderBy: { position: 'asc' }
    });
  }

  static async update(id, updateData) {
    const allowedFields = ['columnId', 'title', 'description', 'assignee', 'dueDate', 'priority', 'position', 'metadata'];
    const filteredData = Object.keys(updateData)
      .filter(key => allowedFields.includes(key))
      .reduce((obj, key) => {
        // Special handling for dueDate
        if (key === 'dueDate' && updateData[key]) {
          try {
            // If it's just a date string (YYYY-MM-DD), append time to make it valid ISO
            const dateStr = updateData[key].includes('T') ? updateData[key] : `${updateData[key]}T00:00:00.000Z`;
            const parsedDate = new Date(dateStr);
            // Validate the date is actually valid
            if (!isNaN(parsedDate.getTime())) {
              obj[key] = parsedDate;
            }
          } catch (e) {
            console.error('Error parsing date during update:', e);
          }
        } else {
          obj[key] = updateData[key];
        }
        return obj;
      }, {});

    return await prisma.task.update({
      where: { id },
      data: filteredData
    });
  }

  static async delete(id) {
    return await prisma.task.delete({
      where: { id }
    });
  }

  static async move(id, columnId, position) {
    return await prisma.task.update({
      where: { id },
      data: {
        columnId,
        position
      }
    });
  }

  static async reorder(columnId, taskId, newPosition) {
    // Get all tasks in the column
    const tasks = await prisma.task.findMany({
      where: { columnId },
      orderBy: { position: 'asc' }
    });

    // Find the task being moved
    const taskIndex = tasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) {
      throw new Error('Task not found in column');
    }

    // Remove task from its current position
    const [task] = tasks.splice(taskIndex, 1);

    // Insert at new position
    tasks.splice(newPosition, 0, task);

    // Update positions in database
    const updates = tasks.map((t, index) =>
      prisma.task.update({
        where: { id: t.id },
        data: { position: index }
      })
    );

    await Promise.all(updates);

    return await this.findById(taskId);
  }
}

module.exports = Task;


