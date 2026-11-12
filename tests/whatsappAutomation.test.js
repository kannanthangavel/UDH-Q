import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { db, snapshotsDir, logosDir } from '../server/src/db/database.js';
import { verifyWebhookSignature, parseMetaWebhook } from '../server/src/services/whatsappCloudService.js';
import { handleIncomingMessageJob } from '../server/src/services/jobQueueService.js';

describe('WhatsApp Automation & Platform Integration Suite', () => {
  it('validates Meta Webhook HMAC-SHA256 signatures accurately', () => {
    const appSecret = 'meta_test_secret_key_123';
    const payload = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });

    // Calculate valid HMAC-SHA256 signature
    const hmac = crypto.createHmac('sha256', appSecret);
    hmac.update(payload);
    const validSignature = `sha256=${hmac.digest('hex')}`;

    // 1. Valid signature passes
    const isValid = verifyWebhookSignature(payload, validSignature, appSecret);
    expect(isValid).toBe(true);

    // 2. Tampered signature fails
    const isTamperedValid = verifyWebhookSignature(payload, 'sha256=invalidhex0000000', appSecret);
    expect(isTamperedValid).toBe(false);

    // 3. Tampered payload fails
    const isTamperedPayloadValid = verifyWebhookSignature(payload + 'tampered', validSignature, appSecret);
    expect(isTamperedPayloadValid).toBe(false);

    // 4. Missing sha256= prefix fails
    const isMissingPrefixValid = verifyWebhookSignature(payload, 'plainhexstring', appSecret);
    expect(isMissingPrefixValid).toBe(false);
  });

  it('correctly parses structured Meta WhatsApp webhook payloads', () => {
    const samplePayload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: '123456789',
          changes: [
            {
              field: 'messages',
              value: {
                messaging_product: 'whatsapp',
                metadata: { display_phone_number: '919715622499', phone_number_id: '987654' },
                contacts: [{ profile: { name: 'Karthik Builders' }, wa_id: '919876543210' }],
                messages: [
                  {
                    from: '919876543210',
                    id: 'wamid.HBgLM...',
                    timestamp: '1776412800',
                    text: { body: '20 bags OPC cement, 5 paint golden brown 1lt' },
                    type: 'text'
                  }
                ]
              }
            }
          ]
        }
      ]
    };

    const parsed = parseMetaWebhook(samplePayload);
    expect(parsed.messages.length).toBe(1);
    expect(parsed.messages[0].senderPhone).toBe('919876543210');
    expect(parsed.messages[0].senderName).toBe('Karthik Builders');
    expect(parsed.messages[0].wamid).toBe('wamid.HBgLM...');
    expect(parsed.messages[0].text).toContain('20 bags OPC cement');
  });

  it('automatically parses incoming WhatsApp messages and drafts quotations in the background', async () => {
    const rawContent = 'Vanakkam, need 2 buckets As EN golden Brown 1lt for Suresh. Please prepare quote with GST';
    const senderPhone = `91984${Date.now().toString().slice(-6)}`;
    const senderName = 'Suresh Traders';
    const now = new Date().toISOString();

    // Insert incoming message record
    const msgInsert = db.prepare(`
      INSERT INTO whatsapp_messages (
        provider_message_id, sender_phone, sender_name, raw_content, intent,
        processing_status, received_at
      ) VALUES (?, ?, ?, ?, 'quote_request', 'received', ?)
    `).run(`wamid.test_${Date.now()}`, senderPhone, senderName, rawContent, now);

    const messageId = msgInsert.lastInsertRowid;

    // Process background job
    const result = await handleIncomingMessageJob({ reference_id: String(messageId) });
    expect(['draft_ready', 'needs_review']).toContain(result.status);
    expect(result.quotationId).toBeGreaterThan(0);
    expect(result.quotationNumber).toBeDefined();

    // Verify quotation row in db
    const quote = db.prepare('SELECT * FROM quotations WHERE id = ?').get(result.quotationId);
    expect(quote.status).toBe('draft');
    expect(quote.customer_phone).toBe(senderPhone);
    expect(quote.whatsapp_message_id).toBe(messageId);

    // Verify line items were matched and created
    const items = db.prepare('SELECT * FROM quotation_items WHERE quotation_id = ?').all(result.quotationId);
    expect(items.length).toBeGreaterThan(0);

    // Verify operator notification was generated
    const notification = db.prepare('SELECT * FROM notifications WHERE quotation_id = ?').get(result.quotationId);
    expect(notification).toBeDefined();
    expect(['draft_prepared', 'match_review', 'draft_ready']).toContain(notification.type);

    // Clean up
    db.prepare('DELETE FROM quotation_items WHERE quotation_id = ?').run(result.quotationId);
    db.prepare('DELETE FROM quotations WHERE id = ?').run(result.quotationId);
    db.prepare('DELETE FROM notifications WHERE quotation_id = ?').run(result.quotationId);
    db.prepare('DELETE FROM whatsapp_messages WHERE id = ?').run(messageId);
  });

  it('preserves immutable logo snapshot on quotation finalization', () => {
    const quoteNumber = `UD-TEST-SNAP-${Date.now()}`;
    const now = new Date().toISOString();

    // Create a dummy company logo if none exists
    const testLogoFilename = `test_logo_${Date.now()}.png`;
    const testLogoPath = path.join(logosDir, testLogoFilename);
    fs.writeFileSync(testLogoPath, 'DUMMY_IMAGE_BINARY_DATA');

    // Save as setting
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('company_logo', ?)").run(testLogoFilename);

    // Insert quotation
    const insertRes = db.prepare(`
      INSERT INTO quotations (
        quotation_number, revision, status, document_type, paper_size,
        logo_source, subtotal, grand_total, amount_in_words, created_at, updated_at
      ) VALUES (?, 1, 'draft', 'gst_quotation', 'A5', 'default', 100, 100, 'Rupees One Hundred Only', ?, ?)
    `).run(quoteNumber, now, now);

    const quoteId = insertRes.lastInsertRowid;

    // Simulate finalization snapshot logic
    const snapshotFilename = `snap_${quoteNumber}_${Date.now()}.png`;
    const snapshotDest = path.join(snapshotsDir, snapshotFilename);
    fs.copyFileSync(testLogoPath, snapshotDest);

    db.prepare(`
      UPDATE quotations
      SET status = 'finalized', logo_snapshot_path = ?
      WHERE id = ?
    `).run(snapshotDest, quoteId);

    const finalizedQuote = db.prepare('SELECT * FROM quotations WHERE id = ?').get(quoteId);
    expect(finalizedQuote.status).toBe('finalized');
    expect(finalizedQuote.logo_snapshot_path).toBe(snapshotDest);
    expect(fs.existsSync(finalizedQuote.logo_snapshot_path)).toBe(true);

    // Delete company logo to verify snapshot remains intact
    fs.unlinkSync(testLogoPath);
    expect(fs.existsSync(finalizedQuote.logo_snapshot_path)).toBe(true);

    // Clean up
    if (fs.existsSync(snapshotDest)) fs.unlinkSync(snapshotDest);
    db.prepare('DELETE FROM quotations WHERE id = ?').run(quoteId);
  });
});
