const { db } = require('../db/database');
const { parseCustomerMessage, checkForBillLookup } = require('./messageParser');
const { matchAllItems } = require('./matchingEngine');
const { calculateQuotationTotals, round2 } = require('./calculationService');
const { generateQuotationPDF } = require('./pdfService');
const { broadcastNotification } = require('./notificationService');
const { uploadPdfMedia, sendOfficialWhatsAppDocument } = require('./whatsappCloudService');
const { formatWhatsAppMessage } = require('./whatsappService');
const path = require('path');

let isProcessing = false;

function getSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const s = {};
  rows.forEach(r => { s[r.key] = r.value; });
  return s;
}

function getNextQuotationNumber() {
  const settings = getSettings();
  const prefix = settings.quote_prefix || 'UD';
  const year = new Date().getFullYear();
  const pattern = `${prefix}-${year}-%`;
  const latest = db.prepare(`
    SELECT quotation_number FROM quotations
    WHERE quotation_number LIKE ?
    ORDER BY id DESC LIMIT 1
  `).get(pattern);

  let nextSeq = 1;
  if (latest && latest.quotation_number) {
    const parts = latest.quotation_number.split('-');
    const lastNum = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastNum)) {
      nextSeq = lastNum + 1;
    }
  }

  const padded = String(nextSeq).padStart(4, '0');
  return `${prefix}-${year}-${padded}`;
}

function enqueueJob(jobType, referenceId, payload = {}) {
  const now = new Date().toISOString();
  const res = db.prepare(`
    INSERT INTO processing_jobs (job_type, reference_id, status, payload_json, attempts, created_at, updated_at)
    VALUES (?, ?, 'pending', ?, 0, ?, ?)
  `).run(jobType, String(referenceId), JSON.stringify(payload), now, now);

  setTimeout(processQueue, 50);
  return res.lastInsertRowid;
}

async function processQueue() {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const pendingJobs = db.prepare(`
      SELECT * FROM processing_jobs
      WHERE status = 'pending'
      ORDER BY id ASC
      LIMIT 5
    `).all();

    for (const job of pendingJobs) {
      await processSingleJob(job);
    }
  } catch (err) {
    console.error('[JobQueue] Error during queue cycle:', err);
  } finally {
    isProcessing = false;
  }
}

async function processSingleJob(job) {
  const now = new Date().toISOString();
  db.prepare(`UPDATE processing_jobs SET status = 'running', attempts = attempts + 1, updated_at = ? WHERE id = ?`).run(now, job.id);

  try {
    let result = null;
    if (job.job_type === 'incoming_message') {
      result = await handleIncomingMessageJob(job);
    } else if (job.job_type === 'whatsapp_send') {
      result = await handleWhatsAppSendJob(job);
    } else {
      result = { skipped: true, reason: 'Unknown job type' };
    }

    db.prepare(`
      UPDATE processing_jobs
      SET status = 'completed', result_json = ?, updated_at = ?
      WHERE id = ?
    `).run(JSON.stringify(result || {}), new Date().toISOString(), job.id);
  } catch (err) {
    console.error(`[JobQueue] Job ${job.id} (${job.job_type}) failed:`, err.message);
    const updatedAttempts = job.attempts + 1;
    const isDead = updatedAttempts >= (job.max_attempts || 3);
    db.prepare(`
      UPDATE processing_jobs
      SET status = ?, last_error = ?, updated_at = ?
      WHERE id = ?
    `).run(isDead ? 'dead_letter' : 'pending', err.message, new Date().toISOString(), job.id);
  }
}

async function handleIncomingMessageJob(job) {
  const messageId = parseInt(job.reference_id, 10);
  const msg = db.prepare('SELECT * FROM whatsapp_messages WHERE id = ?').get(messageId);
  if (!msg) throw new Error(`Message ${messageId} not found.`);

  const now = new Date().toISOString();
  const rawContent = msg.raw_content || '';
  const senderPhone = msg.sender_phone;
  const senderName = msg.sender_name || 'Valued Customer';
  const settings = getSettings();

  // 1. Intent Check: Bill or invoice inquiry
  const billCheck = checkForBillLookup(rawContent);
  if (billCheck.isBillLookup) {
    db.prepare(`
      UPDATE whatsapp_messages
      SET intent = 'bill_lookup', processing_status = 'needs_clarification', error_message = ?, processed_at = ?
      WHERE id = ?
    `).run(billCheck.warning, now, msg.id);

    broadcastNotification({
      type: 'clarification_needed',
      title: 'Existing Bill / Invoice Inquiry',
      message: `Customer ${senderName} (${senderPhone}) requested bill reference: ${billCheck.detectedRef}`,
      referenceType: 'message',
      referenceId: msg.id,
      metadata: { phone: senderPhone, billRef: billCheck.detectedRef }
    });

    return { intent: 'bill_lookup', detectedRef: billCheck.detectedRef };
  }

  // 2. Correlation Check: Follow-up revision to recent draft (past 24h)
  const recentDraft = db.prepare(`
    SELECT * FROM quotations
    WHERE customer_phone = ? AND status = 'draft' AND created_at > datetime('now', '-1 day')
    ORDER BY id DESC LIMIT 1
  `).get(senderPhone);

  const isCorrection = /(?:change|modify|increase|decrease|make it|add|extra|only|a4|a5|gst|without gst|correction)/i.test(rawContent);

  if (recentDraft && isCorrection) {
    db.prepare(`
      UPDATE whatsapp_messages
      SET intent = 'correction', quotation_id = ?, processed_at = ?
      WHERE id = ?
    `).run(recentDraft.id, now, msg.id);

    // Re-parse and update draft items
    const parsed = parseCustomerMessage(rawContent);
    const activePriceList = db.prepare('SELECT id FROM price_lists WHERE is_active = 1 LIMIT 1').get();
    const matchedItems = matchAllItems(parsed.items, activePriceList?.id);

    if (matchedItems.length > 0) {
      let rowOrder = db.prepare('SELECT MAX(row_order) as m FROM quotation_items WHERE quotation_id = ?').get(recentDraft.id)?.m || 0;
      for (const item of matchedItems) {
        rowOrder++;
        const prod = item.matchedProduct;
        const rate = prod && prod.sales_rate ? prod.sales_rate : (item.salesRate || 0);
        const gst = prod && prod.gst_rate !== undefined ? prod.gst_rate : (item.gstRate || 18);
        const itemUnit = item.unit || (prod ? prod.unit : 'Nos');
        const calcItem = calculateQuotationTotals(
          [{
            quantity: item.quantity || 1,
            unitPrice: rate,
            discountPercent: 0,
            gstRate: gst,
            isTaxInclusive: prod ? (prod.is_tax_inclusive !== 0) : true
          }],
          recentDraft.document_type || 'gst_quotation',
          0, 0
        );

        db.prepare(`
          INSERT INTO quotation_items (
            quotation_id, row_order, product_id, item_code, product_name, specification,
            hsn_code, quantity, unit, unit_price, discount_percent, taxable_amount,
            gst_rate, gst_amount, line_total, match_status, raw_query
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          recentDraft.id,
          rowOrder,
          prod?.id || null,
          prod?.item_code || item.itemCode || null,
          prod?.product_name || item.productName || item.rawPhrase,
          prod?.specification || item.specification || '',
          prod?.hsn_code || item.hsnCode || '',
          item.quantity || 1,
          itemUnit,
          rate,
          0,
          calcItem.items[0]?.taxableAmount || 0,
          gst,
          calcItem.items[0]?.gstAmount || 0,
          calcItem.items[0]?.lineTotal || 0,
          item.matchStatus || 'Needs Review',
          item.rawPhrase || ''
        );
      }

      // Recalculate quotation totals
      const allItems = db.prepare('SELECT * FROM quotation_items WHERE quotation_id = ? ORDER BY row_order ASC').all(recentDraft.id);
      const calcResult = calculateQuotationTotals(
        allItems.map(it => ({
          quantity: it.quantity,
          unitPrice: it.unit_price,
          discountPercent: it.discount_percent || 0,
          gstRate: it.gst_rate || 18,
          isTaxInclusive: true
        })),
        recentDraft.document_type,
        recentDraft.delivery_charges || 0,
        recentDraft.other_charges || 0
      );

      const pdfRes = await generateQuotationPDF(
        { ...recentDraft, grand_total: calcResult.grand_total },
        allItems,
        settings
      );

      db.prepare(`
        UPDATE quotations
        SET subtotal = ?, taxable_amount = ?, tax_total = ?, grand_total = ?, amount_in_words = ?,
            pdf_filename = ?, is_stale_pdf = 0, updated_at = ?
        WHERE id = ?
      `).run(
        calcResult.subtotal,
        calcResult.taxable_amount,
        calcResult.tax_total,
        calcResult.grand_total,
        calcResult.amount_in_words,
        pdfRes.filename,
        now,
        recentDraft.id
      );

      db.prepare(`
        UPDATE whatsapp_messages
        SET processing_status = 'draft_ready', processed_at = ?
        WHERE id = ?
      `).run(now, msg.id);

      broadcastNotification({
        type: 'draft_prepared',
        title: `Draft Updated: ${recentDraft.quotation_number}`,
        message: `Customer ${senderName} sent follow-up correction. Items updated in draft ${recentDraft.quotation_number}.`,
        referenceType: 'quotation',
        referenceId: recentDraft.id,
        metadata: { quotationNumber: recentDraft.quotation_number, phone: senderPhone }
      });

      return {
        success: true,
        intent: 'correction',
        status: 'draft_ready',
        quotationId: recentDraft.id,
        quotationNumber: recentDraft.quotation_number,
        updatedItemsCount: matchedItems.length
      };
    }
  }

  // 3. Normal Path: Automatic extraction, matching, and quotation drafting
  const parsed = parseCustomerMessage(rawContent);
  const matchedItems = matchAllItems(parsed.items);
  const activePriceList = db.prepare('SELECT id FROM price_lists WHERE is_active = 1 LIMIT 1').get();

  let exactMatches = 0;
  let unresolvedMatches = 0;
  matchedItems.forEach(it => {
    const rate = it.matchedProduct?.sales_rate ?? (it.salesRate || 0);
    if ((it.matchStatus === 'Exact Match' || it.confidence >= 80) && rate > 0) {
      exactMatches++;
    } else {
      unresolvedMatches++;
    }
  });

  const docType = parsed.documentType || settings.default_doc_type || 'gst_quotation';
  const paperSize = parsed.paperSize || settings.default_paper_size || 'A5';
  const customerNameFinal = parsed.customerDetails?.customerName || senderName;
  const quoteNumber = getNextQuotationNumber();

  // Calculate provisional line items and totals
  const calcItemsInput = matchedItems.map(item => {
    const prod = item.matchedProduct;
    return {
      quantity: item.quantity || 1,
      unitPrice: prod && prod.sales_rate ? prod.sales_rate : (item.salesRate || 0),
      discountPercent: 0,
      gstRate: prod && prod.gst_rate !== undefined ? prod.gst_rate : (item.gstRate || 18),
      isTaxInclusive: prod ? (prod.is_tax_inclusive !== 0) : true
    };
  });

  const calcResult = calculateQuotationTotals(calcItemsInput, docType, 0, 0);

  // Insert Draft Quotation
  const insertQuote = db.prepare(`
    INSERT INTO quotations (
      quotation_number, revision, status, document_type, paper_size,
      customer_name, customer_phone, price_list_id, subtotal, discount_total,
      taxable_amount, tax_total, grand_total, amount_in_words, raw_whatsapp_message,
      whatsapp_message_id, approval_status, logo_source, is_stale_pdf, whatsapp_status,
      created_at, updated_at
    ) VALUES (
      ?, 1, 'draft', ?, ?,
      ?, ?, ?, ?, 0,
      ?, ?, ?, ?, ?,
      ?, 'pending', 'default', 0, 'draft_ready',
      ?, ?
    )
  `);

  const primaryPriceListId = matchedItems.find(it => it.matchedProduct?.price_list_id)?.matchedProduct?.price_list_id || activePriceList?.id || null;

  const quoteRes = insertQuote.run(
    quoteNumber,
    docType,
    paperSize,
    customerNameFinal,
    senderPhone,
    primaryPriceListId,
    calcResult.subtotal,
    calcResult.taxable_amount,
    calcResult.tax_total,
    calcResult.grand_total,
    calcResult.amount_in_words,
    rawContent,
    msg.id,
    now,
    now
  );
  const quoteId = quoteRes.lastInsertRowid;

  // Insert Line Items
  const insertItem = db.prepare(`
    INSERT INTO quotation_items (
      quotation_id, row_order, product_id, item_code, product_name, specification,
      hsn_code, quantity, unit, unit_price, discount_percent, taxable_amount,
      gst_rate, gst_amount, line_total, match_status, raw_query
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  matchedItems.forEach((item, idx) => {
    const lineCalc = calcResult.items[idx] || {};
    const prod = item.matchedProduct;
    const rate = prod && prod.sales_rate ? prod.sales_rate : (item.salesRate || 0);
    const gst = prod && prod.gst_rate !== undefined ? prod.gst_rate : (item.gstRate || 18);
    const itemUnit = item.unit || (prod ? prod.unit : 'Nos');

    insertItem.run(
      quoteId,
      idx + 1,
      prod?.id || null,
      prod?.item_code || item.itemCode || null,
      prod?.product_name || item.productName || item.rawPhrase,
      prod?.specification || item.specification || '',
      prod?.hsn_code || item.hsnCode || '',
      item.quantity || 1,
      itemUnit,
      rate,
      0,
      lineCalc.taxableAmount || 0,
      gst,
      lineCalc.gstAmount || 0,
      lineCalc.lineTotal || 0,
      item.matchStatus || 'Needs Review',
      item.rawPhrase || ''
    );
  });

  // Generate initial PDF preview
  let pdfFilename = null;
  try {
    const loadedQuote = db.prepare('SELECT * FROM quotations WHERE id = ?').get(quoteId);
    const loadedItems = db.prepare('SELECT * FROM quotation_items WHERE quotation_id = ? ORDER BY row_order ASC').all(quoteId);
    const pdfRes = await generateQuotationPDF(loadedQuote, loadedItems, settings);
    pdfFilename = pdfRes.filename;
    db.prepare('UPDATE quotations SET pdf_filename = ?, pdf_generated_at = ? WHERE id = ?').run(pdfFilename, now, quoteId);
  } catch (pdfErr) {
    console.warn('[JobQueue] Preview PDF generation warning:', pdfErr.message);
  }

  // Determine final processing status for WhatsApp message
  let finalStatus = 'draft_ready';
  if (matchedItems.length === 0) {
    finalStatus = 'needs_clarification';
  } else if (unresolvedMatches > 0) {
    finalStatus = 'needs_review';
  }

  db.prepare(`
    UPDATE whatsapp_messages
    SET quotation_id = ?, processing_status = ?, unresolved_items_count = ?,
        extracted_json = ?, processed_at = ?
    WHERE id = ?
  `).run(
    quoteId,
    finalStatus,
    unresolvedMatches,
    JSON.stringify({ items: matchedItems, calcResult }),
    now,
    msg.id
  );

  // Broadcast real-time notification to operator
  const isAllExact = unresolvedMatches === 0 && matchedItems.length > 0;
  broadcastNotification({
    type: isAllExact ? 'draft_prepared' : 'match_review',
    title: isAllExact ? `Quotation Draft Ready: ${quoteNumber}` : `Quotation Needs Review: ${quoteNumber}`,
    message: isAllExact
      ? `${customerNameFinal} requested ${matchedItems.length} items. Draft prepared automatically.`
      : `${customerNameFinal} requested items with ${unresolvedMatches} item(s) requiring matching review.`,
    referenceType: 'quotation',
    referenceId: quoteId,
    metadata: {
      quotationNumber: quoteNumber,
      customerName: customerNameFinal,
      phone: senderPhone,
      unresolvedCount: unresolvedMatches,
      itemCount: matchedItems.length,
      grandTotal: calcResult.grand_total
    }
  });

  // Audit log
  db.prepare(`
    INSERT INTO audit_logs (event_type, quotation_id, operator, outcome, details, metadata_json, created_at)
    VALUES (?, ?, 'AutomationEngine', 'success', ?, ?, ?)
  `).run(
    'AUTOMATED_DRAFT_CREATED',
    quoteId,
    `Automatic quotation draft ${quoteNumber} generated from WhatsApp message by ${customerNameFinal}.`,
    JSON.stringify({ quoteNumber, senderPhone, itemCount: matchedItems.length, status: finalStatus }),
    now
  );

  return {
    success: true,
    quotationId: quoteId,
    quotationNumber: quoteNumber,
    itemsCount: matchedItems.length,
    unresolvedMatches,
    status: finalStatus,
    pdfFilename
  };
}

async function handleWhatsAppSendJob(job) {
  const quoteId = parseInt(job.reference_id, 10);
  const quotation = db.prepare('SELECT * FROM quotations WHERE id = ?').get(quoteId);
  if (!quotation) throw new Error(`Quotation ${quoteId} not found.`);

  const settings = getSettings();
  const phoneNumberId = settings.meta_phone_number_id;
  const accessToken = settings.meta_access_token;
  const apiVersion = settings.meta_api_version || 'v21.0';

  if (!phoneNumberId || !accessToken) {
    throw new Error('Official WhatsApp credentials not configured. Please switch to manual sharing.');
  }

  const items = db.prepare('SELECT * FROM quotation_items WHERE quotation_id = ? ORDER BY row_order ASC').all(quoteId);
  const pdfPath = path.join(__dirname, '..', '..', 'storage', 'pdfs', quotation.pdf_filename);
  const caption = formatWhatsAppMessage(quotation, items, settings);

  // 1. Upload media
  const mediaId = await uploadPdfMedia(phoneNumberId, accessToken, pdfPath, quotation.pdf_filename, apiVersion);

  // 2. Send Document
  const sendRes = await sendOfficialWhatsAppDocument({
    phoneNumberId,
    accessToken,
    recipientPhone: quotation.customer_phone,
    mediaId,
    filename: `${quotation.quotation_number}_Udhayam.pdf`,
    caption,
    apiVersion
  });

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE quotations
    SET outbound_wamid = ?, delivery_status = 'sent', updated_at = ?
    WHERE id = ?
  `).run(sendRes.providerMessageId, now, quoteId);

  broadcastNotification({
    type: 'send_success',
    title: `Quotation Sent: ${quotation.quotation_number}`,
    message: `PDF document delivered via WhatsApp to ${quotation.customer_phone}.`,
    referenceType: 'quotation',
    referenceId: quoteId,
    metadata: { wamid: sendRes.providerMessageId }
  });

  return { success: true, wamid: sendRes.providerMessageId };
}

// Background poller interval every 5 seconds
setInterval(processQueue, 5000);

module.exports = {
  enqueueJob,
  processQueue,
  handleIncomingMessageJob
};
