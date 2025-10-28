const express = require("express");
const Notification = require("../models/Notification");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

// Get all notifications for the current user
router.get("/", authenticateToken, async (req, res) => {
  try {
    const { isRead, type } = req.query;
    
    const filters = {};
    if (isRead !== undefined) {
      filters.isRead = isRead === 'true';
    }
    if (type) {
      filters.type = type;
    }

    const notifications = await Notification.findByUserId(req.user.id, filters);
    const unreadCount = await Notification.getUnreadCount(req.user.id);

    res.json({
      notifications,
      unreadCount
    });
  } catch (error) {
    console.error("Get notifications error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get unread count
router.get("/unread-count", authenticateToken, async (req, res) => {
  try {
    const unreadCount = await Notification.getUnreadCount(req.user.id);
    res.json({ unreadCount });
  } catch (error) {
    console.error("Get unread count error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Mark notification as read
router.put("/:id/read", authenticateToken, async (req, res) => {
  try {
    const notification = await Notification.markAsRead(req.params.id, req.user.id);
    res.json({
      message: "Notification marked as read",
      notification
    });
  } catch (error) {
    if (error.message === 'Notification not found') {
      return res.status(404).json({ error: error.message });
    }
    console.error("Mark as read error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Mark all notifications as read
router.put("/read-all", authenticateToken, async (req, res) => {
  try {
    const result = await Notification.markAllAsRead(req.user.id);
    res.json({
      message: "All notifications marked as read",
      count: result.count
    });
  } catch (error) {
    console.error("Mark all as read error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delete notification
router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    await Notification.delete(req.params.id, req.user.id);
    res.json({ message: "Notification deleted successfully" });
  } catch (error) {
    if (error.message === 'Notification not found') {
      return res.status(404).json({ error: error.message });
    }
    console.error("Delete notification error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;

