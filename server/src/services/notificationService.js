const { db } = require('../db/database');

/**
 * Real-Time SSE Notification Service
 * Broadcasts operational events to connected clients
 */
const clients = new Set();

// Send SSE heartbeat every 25 seconds to keep connection alive
setInterval(() => {
  const count = getUnreadCount();
  const heartbeatMsg = `data: ${JSON.stringify({ type: 'heartbeat', timestamp: new Date().toISOString(), unreadCount: count })}\n\n`;
  for (const client of clients) {
    try {
      client.write(heartbeatMsg);
    } catch (_) {
      clients.delete(client);
    }
  }
}, 25000);

/**
 * Registers a new SSE HTTP response stream
 */
function addClient(res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  const count = getUnreadCount();
  res.write(`data: ${JSON.stringify({ type: 'connected', unreadCount: count })}\n\n`);

  clients.add(res);

  res.on('close', () => {
    clients.delete(res);
  });
}

/**
 * Counts total unread notifications
 */
function getUnreadCount() {
  try {
    const row = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE is_read = 0').get();
    return row ? row.count : 0;
  } catch (_) {
    return 0;
  }
}

/**
 * Persists and broadcasts an operational notification event
 */
function broadcastNotification({
  type = 'info',
  title,
  message,
  referenceType = null,
  referenceId = null,
  quotationId = null,
  metadata = {}
}) {
  const now = new Date().toISOString();
  let insertId = null;

  try {
    const result = db.prepare(`
      INSERT INTO notifications (
        type, title, message, reference_type, reference_id,
        is_read, metadata_json, created_at, quotation_id
      ) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)
    `).run(
      type,
      title,
      message,
      referenceType,
      referenceId ? String(referenceId) : null,
      JSON.stringify(metadata || {}),
      now,
      quotationId || (referenceType === 'quotation' ? referenceId : null)
    );
    insertId = result.lastInsertRowid;
  } catch (err) {
    console.error('[NotificationService] Failed to persist notification:', err.message);
  }

  const notificationObj = {
    id: insertId,
    type,
    title,
    message,
    reference_type: referenceType,
    reference_id: referenceId,
    quotation_id: quotationId,
    is_read: 0,
    metadata,
    created_at: now
  };

  const payload = `data: ${JSON.stringify({
    type: 'notification',
    notification: notificationObj,
    unreadCount: getUnreadCount()
  })}\n\n`;

  for (const client of clients) {
    try {
      client.write(payload);
    } catch (_) {
      clients.delete(client);
    }
  }

  return notificationObj;
}

module.exports = {
  addClient,
  broadcastNotification,
  getUnreadCount
};