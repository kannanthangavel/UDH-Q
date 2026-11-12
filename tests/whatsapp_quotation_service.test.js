const test = require('node:test');
const assert = require('node:assert/strict');
const { WhatsAppQuotationService } = require('../backend/src/services/whatsappQuotationService');

test('WhatsAppQuotationService: Ambiguous request triggers clarification with numbered options', async () => {
  const service = new WhatsAppQuotationService();
  const testPhone = '+9199' + Math.floor(10000000 + Math.random() * 90000000);
  const messageId = `test_msg_${Date.now()}_1`;

  const res = await service.processIncomingMessage({
    customer: { phone: testPhone, name: 'Senthil' },
    message: {
      id: messageId,
      type: 'text',
      text: 'golden brown 1ltr 5pcs',
      normalizedText: 'golden brown 1ltr 5pcs',
      timestamp: new Date().toISOString()
    },
    baseUrl: 'http://localhost:5000'
  });

  assert.equal(res.success, true);
  assert.equal(res.action, 'clarification_required');
  assert.ok(res.message.includes('Which brand do you need'));
  assert.ok(Array.isArray(res.options));
  assert.ok(res.options.length >= 2);
});

test('WhatsAppQuotationService: Replying with option number resolves clarification and creates quotation', async () => {
  const service = new WhatsAppQuotationService();
  const testPhone = '+9199' + Math.floor(10000000 + Math.random() * 90000000);
  const messageId1 = `test_msg_${Date.now()}_2a`;
  const messageId2 = `test_msg_${Date.now()}_2b`;

  // Step 1: Initial query
  await service.processIncomingMessage({
    customer: { phone: testPhone, name: 'Kannan' },
    message: {
      id: messageId1,
      type: 'text',
      text: 'golden brown 1ltr 5pcs',
      normalizedText: 'golden brown 1ltr 5pcs',
      timestamp: new Date().toISOString()
    },
    baseUrl: 'http://localhost:5000'
  });

  // Step 2: Reply "1" (Selects Asian Paints)
  const res2 = await service.processIncomingMessage({
    customer: { phone: testPhone, name: 'Kannan' },
    message: {
      id: messageId2,
      type: 'text',
      text: '1',
      normalizedText: '1',
      timestamp: new Date().toISOString()
    },
    baseUrl: 'http://localhost:5000'
  });

  assert.equal(res2.success, true);
  assert.equal(res2.action, 'quotation_generated');
  assert.ok(res2.quotation);
  assert.ok(res2.quotation.quotationNumber.startsWith('UDQ-'));
  assert.equal(res2.quotation.total, 3500); // 5 x 700
  assert.ok(res2.quotation.pdfUrl.includes('/api/quotations/'));
});

test('WhatsAppQuotationService: Idempotency check returns already_processed for duplicate message IDs', async () => {
  const service = new WhatsAppQuotationService();
  const testPhone = '+919999900003';
  const duplicateId = `wamid.DUP_${Date.now()}`;

  // First dispatch
  const first = await service.processIncomingMessage({
    customer: { phone: testPhone, name: 'Duplicate Tester' },
    message: {
      id: duplicateId,
      type: 'text',
      text: 'asian golden brown 1ltr 5pcs',
      normalizedText: 'asian golden brown 1ltr 5pcs',
      timestamp: new Date().toISOString()
    },
    baseUrl: 'http://localhost:5000'
  });

  assert.equal(first.action, 'quotation_generated');

  // Second dispatch with identical message ID
  const second = await service.processIncomingMessage({
    customer: { phone: testPhone, name: 'Duplicate Tester' },
    message: {
      id: duplicateId,
      type: 'text',
      text: 'asian golden brown 1ltr 5pcs',
      normalizedText: 'asian golden brown 1ltr 5pcs',
      timestamp: new Date().toISOString()
    },
    baseUrl: 'http://localhost:5000'
  });

  assert.equal(second.action, 'already_processed');
  assert.equal(second.messageId, duplicateId);
});

test('WhatsAppQuotationService: Explicit brand messages generate quotation directly without clarification', async () => {
  const service = new WhatsAppQuotationService();
  const testPhone = '+919999900004';
  const messageId = `test_msg_${Date.now()}_4`;

  const res = await service.processIncomingMessage({
    customer: { phone: testPhone, name: 'Direct Customer' },
    message: {
      id: messageId,
      type: 'text',
      text: 'asian golden brown 1ltr 5pcs',
      normalizedText: 'asian golden brown 1ltr 5pcs',
      timestamp: new Date().toISOString()
    },
    baseUrl: 'http://localhost:5000'
  });

  assert.equal(res.success, true);
  assert.equal(res.action, 'quotation_generated');
  assert.equal(res.quotation.total, 3500);
});
