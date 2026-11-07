const express = require('express');
const router = express.Router();
const { db } = require('../db/database');
const { requireAdmin } = require('../middleware/auth');

// GET /api/audit - List audit logs (Admin only)
router.get('/', requireAdmin, (req, res) => {
  const { action, entity, page = 1, limit = 50 } = req.query;

  let sql = 'SELECT * FROM audit_logs WHERE 1=1';
  const params = [];

  if (action && action.trim()) {
    sql += ' AND action = ?';
    params.push(action.trim());
  }

  if (entity && entity.trim()) {
    sql += ' AND entity = ?';
    params.push(entity.trim());
  }

  const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total');
  const countRow = db.prepare(countSql).get(...params);
  const total = countRow ? countRow.total : 0;

  sql += ' ORDER BY id DESC';

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
  const offset = (pageNum - 1) * limitNum;
  sql += ' LIMIT ? OFFSET ?';
  params.push(limitNum, offset);

  const logs = db.prepare(sql).all(...params);

  res.json({
    logs,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum)
  });
});

module.exports = router;
