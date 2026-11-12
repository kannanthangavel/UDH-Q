const express = require('express');
const router = express.Router();
const { WhatsAppService } = require('../integrations/whatsapp/whatsapp.service');
const { handleWebhookVerification, parseIncomingMessage } = require('../integrations/whatsapp/whatsapp.webhook');
const { db, logAudit } = require('../db/database');

const waService = new WhatsAppService();

// POST /api/whatsapp/parse - Parse unstructured customer WhatsApp message
router.post('/parse', (req, res) => {
  const { message } = req.body;
  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'Please paste a customer WhatsApp message to parse.' });
  }

  try {
    const result = waService.parseMessage(message);
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

// GET /api/whatsapp/webhook - Webhook Verification for Meta Cloud API
router.get('/webhook', handleWebhookVerification);

// POST /api/whatsapp/webhook - Incoming webhook from Meta WhatsApp Cloud API / n8n
router.post('/webhook', (req, res) => {
  const parsed = parseIncomingMessage(req.body);
  if (parsed && parsed.text) {
    console.log(`[WhatsApp Webhook] Received message from ${parsed.from}: "${parsed.text.slice(0, 50)}..."`);
    // Pass to smart parser for automated parsing
    try {
      const matchResult = waService.parseMessage(parsed.text);
      return res.json({ status: 'received', parsed: matchResult });
    } catch (e) {
      console.warn('[WhatsApp Webhook] Auto-parsing error:', e.message);
    }
  }
  res.json({ status: 'received' });
});

// POST /api/whatsapp/send - Outbound dispatch message
router.post('/send', async (req, res) => {
  const { to, message, pdfUrl, quotationNumber } = req.body;
  if (!to) {
    return res.status(400).json({ error: 'Recipient phone number is required.' });
  }

  try {
    if (pdfUrl) {
      const sent = await waService.sendQuotationPdf(to, pdfUrl, quotationNumber, message);
      return res.json({ success: true, result: sent });
    }
    const sent = await waService.sendQuotationSummary(to, message);
    res.json({ success: true, result: sent });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
