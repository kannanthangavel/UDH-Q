const express = require('express');
const router = express.Router();
const { db } = require('../db/database');

/**
 * GET /api/audit
 * Retrieves audit event log with search and type filters
 */
router.get('/', (req, res) => {
  try {
    const { eventType, search, page = 1, limit = 50 } = req.query;

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (eventType && eventType !== 'all') {
      whereClause += ' AND event_type = ?';
      params.push(eventType);
    }

    if (search && search.trim()) {
      whereClause += ' AND (details LIKE ? OR operator LIKE ?)';
      const s = `%${search.trim()}%`;
      params.push(s, s);
    }

    const totalCount = db.prepare(`SELECT COUNT(*) as count FROM audit_logs ${whereClause}`).get(...params).count;

    const offset = (Number(page) - 1) * Number(limit);
    const logs = db.prepare(`
      SELECT * FROM audit_logs
      ${whereClause}
      ORDER BY id DESC
      LIMIT ? OFFSET ?
    `).all(...params, Number(limit), offset);

    // Get list of distinct event types for filter dropdown
    const eventTypes = db.prepare(`
      SELECT DISTINCT event_type FROM audit_logs ORDER BY event_type ASC
    `).all().map(r => r.event_type);

    res.json({
      success: true,
      logs,
      total: totalCount,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(totalCount / Number(limit)),
      eventTypes
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
