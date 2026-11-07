const express = require('express');
const router = express.Router();
const { processWhatsAppMessage } = require('../services/smartParser');
const { db, logAudit } = require('../db/database');

// POST /api/whatsapp/parse - Parse unstructured customer WhatsApp message
router.post('/parse', (req, res) => {
  const { message } = req.body;
  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'Please paste a customer WhatsApp message to parse.' });
  }

  try {
    const result = processWhatsAppMessage(message);
    res.json(result);
  } catch (err) {
    console.error('Parser error:', err);
    res.status(500).json({ error: 'Failed to parse message: ' + err.message });
  }
});

// GET /api/whatsapp/config - Get WhatsApp integration settings
router.get('/config', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings WHERE key LIKE "meta_%" OR key LIKE "whatsapp_%"').all();
  const config = {};
  rows.forEach(r => config[r.key] = r.value);
  res.json({ config });
});

// POST /api/whatsapp/config - Save WhatsApp API settings
router.post('/config', (req, res) => {
  const updates = req.body;
  const upsert = db.prepare(`
    INSERT INTO settings (key, value, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
  `);

  const transaction = db.transaction(() => {
    for (const [k, v] of Object.entries(updates)) {
      if (k.startsWith('meta_') || k.startsWith('whatsapp_')) {
        upsert.run(k, String(v ?? ''));
      }
    }
    logAudit(
      req.user?.id || 1,
      req.user?.email || 'kids@udhayam.com',
      req.user?.role || 'admin',
      'UPDATE_WHATSAPP_CONFIG',
      'SETTINGS',
      'whatsapp',
      'Updated WhatsApp Cloud API settings'
    );
  });

  transaction();
  res.json({ success: true, message: 'WhatsApp configuration saved' });
});

module.exports = router;
