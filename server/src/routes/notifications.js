const express = require('express');
const router = express.Router();
const {
  addSSEClient,
  getRecentNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead
} = require('../services/notificationService');

/**
 * GET /api/notifications/stream
 * Server-Sent Events (SSE) real-time event streaming for operators
 */
router.get('/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader('Connection', 'keep-alive');
  if (typeof res.flushHeaders === 'function') res.flushHeaders();

  addSSEClient(res);
});

/**
 * GET /api/notifications
 * Lists recent notifications and unread count
 */
router.get('/', (req, res) => {
  try {
    const notifications = getRecentNotifications(40);
    const unreadCount = getUnreadCount();
    res.json({ success: true, notifications, unreadCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/notifications/:id/read
 * Marks single notification as read
 */
router.post('/:id/read', (req, res) => {
  try {
    markAsRead(req.params.id);
    const unreadCount = getUnreadCount();
    res.json({ success: true, unreadCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POSU /api/notifications/mark-all-read
 * Marks all notifications as read
 */
router.post('/mark-all-read', (req, res) => {
  try {
    markAllAsRead();
    res.json({ success: true, unreadCount: 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
