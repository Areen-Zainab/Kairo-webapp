const prisma = require("../lib/prisma");

class Notification {
  // Create a notification
  static async create(data) {
    return await prisma.notification.create({
      data: {
        userId: data.userId,
        title: data.title,
        message: data.message,
        type: data.type,
        priority: data.priority || 'medium',
        workspace: data.workspace || null,
        actionRequired: data.actionRequired || false,
        relatedId: data.relatedId || null,
      }
    });
  }

  // Get all notifications for a user
  static async findByUserId(userId, filters = {}) {
    const where = { userId };

    if (filters.isRead !== undefined) {
      where.isRead = filters.isRead;
    }

    if (filters.type) {
      where.type = filters.type;
    }

    return await prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });
  }

  // Get a single notification by ID
  static async findById(id) {
    return await prisma.notification.findUnique({
      where: { id: parseInt(id) }
    });
  }

  // Mark notification as read
  static async markAsRead(id, userId) {
    const notification = await prisma.notification.findFirst({
      where: { 
        id: parseInt(id),
        userId: userId
      }
    });

    if (!notification) {
      throw new Error('Notification not found');
    }

    return await prisma.notification.update({
      where: { id: parseInt(id) },
      data: { isRead: true }
    });
  }

  // Mark all notifications as read for a user
  static async markAllAsRead(userId) {
    return await prisma.notification.updateMany({
      where: { 
        userId: userId,
        isRead: false
      },
      data: { isRead: true }
    });
  }

  // Delete a notification
  static async delete(id, userId) {
    const notification = await prisma.notification.findFirst({
      where: { 
        id: parseInt(id),
        userId: userId
      }
    });

    if (!notification) {
      throw new Error('Notification not found');
    }

    return await prisma.notification.delete({
      where: { id: parseInt(id) }
    });
  }

  // Get unread count for a user
  static async getUnreadCount(userId) {
    return await prisma.notification.count({
      where: { 
        userId: userId,
        isRead: false
      }
    });
  }
}

module.exports = Notification;

