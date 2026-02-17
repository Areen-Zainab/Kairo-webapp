const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class Tag {
  /**
   * Create a new tag
   */
  static async create(data) {
    try {
      const tag = await prisma.tag.create({
        data: {
          workspaceId: data.workspaceId,
          name: data.name,
          color: data.color || '#3b82f6',
        },
      });
      return tag;
    } catch (error) {
      console.error('Error creating tag:', error);
      throw error;
    }
  }

  /**
   * Find tag by ID
   */
  static async findById(id) {
    try {
      const tag = await prisma.tag.findUnique({
        where: { id },
        include: {
          taskTags: {
            include: {
              task: true,
            },
          },
        },
      });
      return tag;
    } catch (error) {
      console.error('Error finding tag:', error);
      throw error;
    }
  }

  /**
   * Find all tags for a workspace
   */
  static async findByWorkspaceId(workspaceId) {
    try {
      const tags = await prisma.tag.findMany({
        where: { workspaceId },
        orderBy: { name: 'asc' },
        include: {
          _count: {
            select: { taskTags: true },
          },
        },
      });
      return tags;
    } catch (error) {
      console.error('Error finding tags by workspace:', error);
      throw error;
    }
  }

  /**
   * Update a tag
   */
  static async update(id, data) {
    try {
      const tag = await prisma.tag.update({
        where: { id },
        data: {
          ...(data.name && { name: data.name }),
          ...(data.color && { color: data.color }),
        },
      });
      return tag;
    } catch (error) {
      console.error('Error updating tag:', error);
      throw error;
    }
  }

  /**
   * Delete a tag
   */
  static async delete(id) {
    try {
      // TaskTags will be deleted automatically due to CASCADE
      await prisma.tag.delete({
        where: { id },
      });
      return { success: true };
    } catch (error) {
      console.error('Error deleting tag:', error);
      throw error;
    }
  }

  /**
   * Assign a tag to a task
   */
  static async assignToTask(taskId, tagId) {
    try {
      const taskTag = await prisma.taskTag.create({
        data: {
          taskId,
          tagId,
        },
        include: {
          tag: true,
        },
      });
      return taskTag;
    } catch (error) {
      // If it's a unique constraint violation, the tag is already assigned
      if (error.code === 'P2002') {
        return { success: true, message: 'Tag already assigned to task' };
      }
      console.error('Error assigning tag to task:', error);
      throw error;
    }
  }

  /**
   * Remove a tag from a task
   */
  static async removeFromTask(taskId, tagId) {
    try {
      await prisma.taskTag.deleteMany({
        where: {
          taskId,
          tagId,
        },
      });
      return { success: true };
    } catch (error) {
      console.error('Error removing tag from task:', error);
      throw error;
    }
  }

  /**
   * Get all tags for a specific task
   */
  static async getTaskTags(taskId) {
    try {
      const taskTags = await prisma.taskTag.findMany({
        where: { taskId },
        include: {
          tag: true,
        },
      });
      return taskTags.map(tt => tt.tag);
    } catch (error) {
      console.error('Error getting task tags:', error);
      throw error;
    }
  }
}

module.exports = Tag;

