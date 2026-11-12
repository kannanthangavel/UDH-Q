const express = require('express');
const router = express.Router();
const { db } = require('../db/database');
const { verifyWebhookSignature, parseMetaWebhook } = require('../services/whatsappCloudService');
const { enqueueJob, processQueue } = require('../services/jobQueueService');
const { broadcastNotification } = require('../services/notificationService');

function getSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const s = {};
  rows.forEach(r => { s[r.key] = r.value; });
  return s;
}

/**
 * GET /api/whatsapp/webhook
 * Handles Meta Webhook Verification Challenge
 */
router.get('/webhook', (req, res) => {
  try {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const settings = getSettings();
    const expectedToken = settings.meta_webhook_verify_token || 'udhayam_secure_webhook_token_2026';

    if (mode === 'subscribe' && token === expectedToken) {
      console.log('[Meta Webhook] Webhook verified successfully!');
      return res.status(200).send(challenge);
    } else {
      console.warn('[Meta Webhook] Verification challenge failed. Token mismatch.');
      return res.status(403).json({ error: 'Verification token mismatch.' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/whatsapp/webhook
 * Receives incoming WhatsApp messages & delivery statuses from Meta
 */
router.post('/webhook', (req, res) => {
  try {
    const settings = getSettings();
    const signature = req.headers['x-hub-signature-256'];
    const rawBody = req.rawBody || JSON.stringify(req.body);

    // Verify signature in live mode
    if (settings.whatsapp_integration_mode === 'live' && settings.meta_app_secret) {
      const isValid = verifyWebhookSignature(rawBody, signature, settings.meta_app_secret);
      if (!isValid) {
        console.warn('[Meta Webhook] Signature verification failed.');
        return res.status(401).json({ error: 'Invalid webhook signature.' });
      }
    }

    const now = new Date().toISOString();
    db.prepare("UPDATE settings SET value = ?, updated_at = ? WHERE key = 'last_webhook_received_at'").run(now, now);

    const events = parseMetaWebhook(req.body);

    // 1. Process incoming customer messages
    for (const msg of events.messages) {
      // Deduplication by provider_message_id
      const existing = db.prepare('SELECT id FROM whatsapp_messages WHERE provider_message_id = ?').get(msg.providerMessageId);
      if (existing) {
        console.log(`[Meta Webhook] Message ${msg.providerMessageId} already received. Skipping duplicate.`);
        continue;
      }

      const insertRes = db.prepare(`
        INSERT INTO whatsapp_messages (
          provider_message_id, sender_phone, sender_name, business_phone_id,
          message_type, raw_content, media_id, media_mime_type, media_filename,
          processing_status, received_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'received', ?)
      `).run(
        msg.providerMessageId,
        msg.senderPhone,
        msg.senderName,
        msg.businessPhoneId,
        msg.messageType,
        msg.rawContent,
        msg.mediaId,
        msg.mediaMimeType,
        msg.mediaFilename,
        msg.timestamp || now
      );

      const messageId = insertRes.lastInsertRowid;
      db.prepare("UPDATE settings SET value = ?, updated_at = ? WHERE key = 'last_processed_message_at'").run(now, now);

      // Enqueue async extraction & draft preparation job
      enqueueJob('incoming_message', messageId, { senderPhone: msg.senderPhone, rawContent: msg.rawContent });
    }

    // 2. Process message delivery statuses
    for (const st of events.statuses) {
      if (st.providerMessageId) {
        const quote = db.prepare('SELECT id, quotation_number FROM quotations WHERE outbound_wamid = ?').get(st.providerMessageId);
        if (quote) {
          db.prepare(`
            UPDATE quotations
            SET delivery_status = ?, updated_at = ?
            WHERE id = ?
          `).run(st.status, now, quote.id);

          broadcastNotification({
            type: 'status_update',
            title: `Quotation Status: ${st.status.toUpperCase()}`,
            message: `Quotation ${quote.quotation_number} status changed to ${st.status}.`,
            referenceType: 'quotation',
            referenceId: quote.id,
            metadata: { wamid: st.providerMessageId, status: st.status }
          });
        }
      }
    }

    // Acknowledge receipt to Meta promptly
    res.status(200).json({ status: 'EVENT_RECEIVED' });
  } catch (err) {
    console.error('[Meta Webhook] Processing error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/whatsapp/inbox
 * Lists customer conversations with processing status, unread count, and linked quotations
 */
router.get('/inbox', (req, res) => {
  try {
    const { status = 'all', search } = req.query;

    let filter = 'WHERE 1=1';
    const params = [];

    if (status !== 'all') {
      filter += ' AND wm.processing_status = ?';
      params.push(status);
    }

    if (search && search.trim()) {
      filter += ' AND (wm.sender_phone LIKE ? OR wm.sender_name LIKE ? OR wm.raw_content LIKE ?)';
      const s = `%${search.trim()}%`;
      params.push(s, s, s);
    }

    const messages = db.prepare(`
      SELECT wm.*,
             q.quotation_number,
             q.grand_total as quotation_grand_total,
             q.status as quotation_status,
             q.approval_status as quotation_approval_status,
             q.document_type as quotation_doc_type,
             q.paper_size as quotation_paper_size,
             q.pdf_filename
      FROM whatsapp_messages wm
      LEFT JOIN quotations q ON wm.quotation_id = q.id
      ${filter}
      ORDER BY wm.id DESC
      LIMIT 100
    `).all(...params);

    res.json({ success: true, messages });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/whatsapp/conversations/:phone
 * Returns full message thread for a specific customer
 */
router.get('/conversations/:phone', (req, res) => {
  try {
    const phone = req.params.phone;
    const messages = db.prepare(`
      SELECT wm.*,
             q.quotation_number,
             q.grand_total,
             q.status as quotation_status,
             q.pdf_filename
      FROM whatsapp_messages wm
      LEFT JOIN quotations q ON wm.quotation_id = q.id
      WHERE wm.sender_phone = ? OR wm.sender_phone LIKE ?
      ORDER BY wm.id ASC
    `).all(phone, `%${phone.slice(-10)}`);

    res.json({ success: true, phone, messages });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/whatsapp/simulate-incoming
 * Interactive Simulator endpoint to test incoming WhatsApp messages and trigger real automatic draft generation
 */
router.post('/simulate-incoming', async (req, res) => {
  try {
    const { message, senderPhone = '9715622499', senderName = 'Ramesh Kumar' } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message content is required.' });
    }

    const cleanPhone = senderPhone.replace(/[^\d]/g, '');
    const now = new Date().toISOString();
    const providerMsgId = `sim_wamid_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    const insertRes = db.prepare(`
      INSERT INTO whatsapp_messages (
        provider_message_id, sender_phone, sender_name, business_phone_id,
        message_type, raw_content, processing_status, received_at
      ) VALUES (?, ?, ?, 'UDHAYAM_SIM_DEV', 'text', ?, 'received', ?)
    `).run(providerMsgId, cleanPhone, senderName, message.trim(), now);

    const messageId = insertRes.lastInsertRowid;

    // Update settings timestamp
    db.prepare("UPDATE settings SET value = ?, updated_at = ? WHERE key = 'last_processed_message_at'").run(now, now);

    // Queue and immediately trigger processing
    enqueueJob('incoming_message', messageId, { senderPhone: cleanPhone, rawContent: message.trim() });
    await processQueue();

    // Fetch the updated message with generated quotation reference
    const updated = db.prepare(`
      SELECT wm.*,
             q.quotation_number,
             q.grand_total,
             q.status as quotation_status,
             q.pdf_filename
      FROM whatsapp_messages wm
      LEFT JOIN quotations q ON wm.quotation_id = q.id
      WHERE wm.id = ?
    `).get(messageId);

    res.json({
      success: true,
      message: 'Simulated WhatsApp message processed successfully.',
      data: updated
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to simulate incoming message.' });
  }
});

/**
 * GET /api/whatsapp/status
 * Health & connection status of WhatsApp Business API
 */
router.get('/status', (req, res) => {
  try {
    const settings = getSettings();
    const mode = settings.whatsapp_integration_mode || 'demo';
    const isConfigured = Boolean(settings.meta_phone_number_id && settings.meta_access_token);

    const totalReceived = db.prepare('SELECT COUNT(*) as count FROM whatsapp_messages').get()?.count || 0;
    const draftsReady = db.prepare("SELECT COUNT(*) as count FROM whatsapp_messages WHERE processing_status = 'draft_ready'").get()?.count || 0;
    const needsReview = db.prepare("SELECT COUNT(*) as count FROM whatsapp_messages WHERE processing_status = 'needs_review'").get()?.count || 0;

    let connectionState = 'demo_mode';
    if (mode === 'live') {
      connectionState = isConfigured ? 'connected' : 'configuration_incomplete';
    }

    res.json({
      success: true,
      mode,
      connectionState,
      isConfigured,
      phoneNumberId: settings.meta_phone_number_id ? `${settings.meta_phone_number_id.slice(0, 4)}...${settings.meta_phone_number_id.slice(-4)}` : null,
      wabaId: settings.meta_waba_id ? `${settings.meta_waba_id.slice(0, 4)}...${settings.meta_waba_id.slice(-4)}` : null,
      businessPhone: settings.meta_business_phone || '+91 97156 22499',
      webhookVerifyToken: settings.meta_webhook_verify_token || 'udhayam_secure_webhook_token_2026',
      webhookUrl: '/api/whatsapp/webhook',
      lastWebhookReceivedAt: settings.last_webhook_received_at || null,
      lastProcessedMessageAt: settings.last_processed_message_at || null,
      lastIntegrationError: settings.last_integration_error || null,
      metrics: {
        totalReceived,
        draftsReady,
        needsReview
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
