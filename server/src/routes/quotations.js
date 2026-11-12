const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { db, pdfsDir, logosDir, snapshotsDir } = require('../db/database');
const multer = require('multer');
const { calculateQuotationTotals, round2 } = require('../services/calculationService');
const { generateQuotationPDF } = require('../services/pdfService');
const { formatWhatsAppMessage, generateWhatsAppShareLink, WhatsAppBusinessAdapter } = require('../services/whatsappService');
const { sendQuotationEmail, formatEmailContent } = require('../services/emailService');
const { uploadPdfMedia, sendOfficialWhatsAppDocument } = require('../services/whatsappCloudService');

// Multer storage for quotation-specific custom logo uploads
const quoteLogoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, logosDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    const cleanExt = ['.png', '.jpg', '.jpeg', '.webp'].includes(ext) ? ext : '.png';
    cb(null, `quote_logo_${req.params.id || 'new'}_${Date.now()}${cleanExt}`);
  }
});

const uploadQuoteLogo = multer({
  storage: quoteLogoStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (allowed.includes(file.mimetype.toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('Invalid image format. Supported formats: PNG, JPG, WebP.'));
    }
  }
});

/**
 * Helper to fetch all application settings as an object
 */
function getSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = {};
  rows.forEach(r => {
    settings[r.key] = r.value;
  });
  return settings;
}

/**
 * Generates next sequential unique quotation number: e.g. UDQ-2026-0001
 */
function getNextQuotationNumber() {
  const settings = getSettings();
  const prefix = settings.quote_prefix || 'UDQ';
  const year = new Date().getFullYear();

  // Find the highest number matching this prefix and year
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

/**
 * GET /api/quotations
 * Lists quotations with filtering and pagination
 */
router.get('/', (req, res) => {
  try {
    const { status, docType, paperSize, search, page = 1, limit = 20 } = req.query;

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (status && status !== 'all') {
      whereClause += ' AND status = ?';
      params.push(status);
    }
    if (docType && docType !== 'all') {
      whereClause += ' AND document_type = ?';
      params.push(docType);
    }
    if (paperSize && paperSize !== 'all') {
      whereClause += ' AND paper_size = ?';
      params.push(paperSize);
    }
    if (search && search.trim()) {
      whereClause += ' AND (quotation_number LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ?)';
      const s = `%${search.trim()}%`;
      params.push(s, s, s);
    }

    const countRow = db.prepare(`SELECT COUNT(*) as count FROM quotations ${whereClause}`).get(...params);
    const totalCount = countRow ? countRow.count : 0;

    const offset = (Number(page) - 1) * Number(limit);
    const rows = db.prepare(`
      SELECT q.*,
             (SELECT COUNT(*) FROM quotation_items WHERE quotation_id = q.id) as item_count,
             pl.filename as price_list_filename,
             pl.version as price_list_version
      FROM quotations q
      LEFT JOIN price_lists pl ON q.price_list_id = pl.id
      ${whereClause}
      ORDER BY q.id DESC
      LIMIT ? OFFSET ?
    `).all(...params, Number(limit), offset);

    res.json({
      success: true,
      quotations: rows,
      total: totalCount,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(totalCount / Number(limit))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/quotations/queue
 * Fetches priority operator queue of draft quotations awaiting review
 */
router.get('/queue', (req, res) => {
  try {
    const { status = 'all' } = req.query;
    let filter = "WHERE q.status = 'draft'";
    if (status === 'ready') {
      filter += " AND (q.approval_status IS NULL OR q.approval_status != 'approved')";
    } else if (status === 'approved') {
      filter += " AND q.approval_status = 'approved'";
    }

    const rows = db.prepare(`
      SELECT q.*,
             (SELECT COUNT(*) FROM quotation_items WHERE quotation_id = q.id) as item_count,
             (SELECT COUNT(*) FROM quotation_items WHERE quotation_id = q.id AND (match_status != 'Exact Match' OR unit_price <= 0)) as review_items_count,
             wm.sender_phone as incoming_phone,
             wm.sender_name as incoming_sender_name,
             wm.received_at as incoming_received_at,
             wm.intent as message_intent
      FROM quotations q
      LEFT JOIN whatsapp_messages wm ON q.whatsapp_message_id = wm.id
      ${filter}
      ORDER BY q.id DESC
    `).all();

    res.json({ success: true, queue: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/quotations/:id
 * Fetches a single quotation and its line items
 */
router.get('/:id', (req, res) => {
  try {
    const id = req.params.id;
    const quotation = db.prepare(`
      SELECT q.*,
             pl.filename as price_list_filename,
             pl.version as price_list_version,
             pl.is_demo as price_list_is_demo
      FROM quotations q
      LEFT JOIN price_lists pl ON q.price_list_id = pl.id
      WHERE q.id = ?
    `).get(id);

    if (!quotation) {
      return res.status(404).json({ error: 'Quotation not found.' });
    }

    const items = db.prepare(`
      SELECT * FROM quotation_items
      WHERE quotation_id = ?
      ORDER BY row_order ASC, id ASC
    `).all(id);

    res.json({
      success: true,
      quotation,
      items
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/quotations
 * Creates a new quotation (draft or finalized)
 */
router.post('/', async (req, res) => {
  try {
    const {
      status = 'draft',
      document_type = 'gst_quotation',
      paper_size = 'A5',
      customer_name,
      customer_phone,
      customer_company,
      customer_address,
      customer_gstin,
      reference_no,
      delivery_location,
      notes,
      validity_days = 7,
      payment_terms = 'Immediate / Against Delivery',
      delivery_terms = 'Ex-Shop / Standard Delivery',
      delivery_charges = 0,
      other_charges = 0,
      price_list_id,
      raw_whatsapp_message,
      items = []
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Quotation must have at least one line item.' });
    }

    // Check if finalizing: make sure no items have missing price
    if (status === 'finalized') {
      const hasMissingPrice = items.some(it => !it.unit_price || Number(it.unit_price) <= 0);
      if (hasMissingPrice) {
        return res.status(400).json({ error: 'Cannot finalize quotation with unresolved or zero-priced items.' });
      }
    }

    const quoteNumber = getNextQuotationNumber();
    const now = new Date().toISOString();

    // Calculate totals
    const calc = calculateQuotationTotals(items, {
      isTaxInclusive: true,
      deliveryCharges: delivery_charges,
      otherCharges: other_charges
    });

    const createTx = db.transaction(() => {
      const insertQuote = db.prepare(`
        INSERT INTO quotations (
          quotation_number, revision, status, document_type, paper_size,
          customer_name, customer_phone, customer_company, customer_address, customer_gstin,
          reference_no, delivery_location, notes, validity_days, payment_terms, delivery_terms,
          price_list_id, subtotal, discount_total, taxable_amount, tax_total,
          delivery_charges, other_charges, grand_total, amount_in_words,
          raw_whatsapp_message, is_stale_pdf, whatsapp_status, created_at, updated_at
        ) VALUES (
          ?, 1, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, 0, 'not_started', ?, ?
        )
      `);

      const result = insertQuote.run(
        quoteNumber,
        status,
        document_type,
        paper_size,
        customer_name || 'Valued Customer',
        customer_phone || '',
        customer_company || '',
        customer_address || '',
        customer_gstin || '',
        reference_no || '',
        delivery_location || '',
        notes || '',
        Number(validity_days),
        payment_terms,
        delivery_terms,
        price_list_id || null,
        calc.subtotal,
        calc.discount_total,
        calc.taxable_amount,
        calc.tax_total,
        calc.delivery_charges,
        calc.other_charges,
        calc.grand_total,
        calc.amount_in_words,
        raw_whatsapp_message || '',
        now,
        now
      );

      const quotationId = result.lastInsertRowid;

      const insertItem = db.prepare(`
        INSERT INTO quotation_items (
          quotation_id, row_order, product_id, item_code, product_name,
          specification, hsn_code, quantity, unit, unit_price,
          is_override_price, override_reason, discount_percent, discount_amount,
          taxable_amount, gst_rate, gst_amount, line_total, match_status, raw_query
        ) VALUES (
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?
        )
      `);

      calc.items.forEach((item, index) => {
        insertItem.run(
          quotationId,
          index + 1,
          item.product_id || null,
          item.item_code || '',
          item.product_name,
          item.specification || '',
          item.hsn_code || '',
          item.quantity,
          item.unit || 'Nos',
          item.unit_price,
          item.is_override_price ? 1 : 0,
          item.override_reason || '',
          item.discount_percent || 0,
          item.discount_amount || 0,
          item.taxable_amount,
          item.gst_rate || 18,
          item.gst_amount,
          item.line_total,
          item.match_status || 'Exact Match',
          item.raw_query || ''
        );
      });

      // Audit log
      db.prepare(`
        INSERT INTO audit_logs (event_type, quotation_id, operator, outcome, details, metadata_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        status === 'finalized' ? 'QUOTATION_FINALIZED' : 'QUOTATION_DRAFT_CREATED',
        quotationId,
        'Operator',
        'success',
        `Quotation ${quoteNumber} (${status}) created with ${items.length} items. Grand total: ${calc.grand_total}`,
        JSON.stringify({ quotationNumber: quoteNumber, grandTotal: calc.grand_total }),
        now
      );

      return quotationId;
    });

    const quotationId = createTx();

    // If finalizing or requested, generate PDF
    const createdQuote = db.prepare('SELECT * FROM quotations WHERE id = ?').get(quotationId);
    const createdItems = db.prepare('SELECT * FROM quotation_items WHERE quotation_id = ? ORDER BY row_order ASC').all(quotationId);
    const settings = getSettings();

    let pdfResult = null;
    try {
      pdfResult = await generateQuotationPDF(createdQuote, createdItems, settings);
      db.prepare(`
        UPDATE quotations
        SET pdf_filename = ?, pdf_generated_at = ?, is_stale_pdf = 0, whatsapp_status = 'pdf_generated'
        WHERE id = ?
      `).run(pdfResult.filename, now, quotationId);
    } catch (pdfErr) {
      console.error('PDF Generation error:', pdfErr);
    }

    res.json({
      success: true,
      quotationId,
      quotationNumber: quoteNumber,
      status,
      grandTotal: calc.grand_total,
      pdfFilename: pdfResult ? pdfResult.filename : null
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to create quotation.' });
  }
});

/**
 * PUT /api/quotations/:id
 * Updates an existing draft quotation
 */
router.put('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const existing = db.prepare('SELECT * FROM quotations WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Quotation not found.' });
    }

    const {
      status,
      document_type,
      paper_size,
      customer_name,
      customer_phone,
      customer_company,
      customer_address,
      customer_gstin,
      reference_no,
      delivery_location,
      notes,
      validity_days,
      payment_terms,
      delivery_terms,
      delivery_charges = 0,
      other_charges = 0,
      items = []
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Quotation must have at least one line item.' });
    }

    const now = new Date().toISOString();
    const newStatus = status || existing.status;

    // Calculate totals
    const calc = calculateQuotationTotals(items, {
      isTaxInclusive: true,
      deliveryCharges: delivery_charges,
      otherCharges: other_charges
    });

    const updateTx = db.transaction(() => {
      db.prepare(`
        UPDATE quotations
        SET status = ?,
            document_type = ?,
            paper_size = ?,
            customer_name = ?,
            customer_phone = ?,
            customer_company = ?,
            customer_address = ?,
            customer_gstin = ?,
            reference_no = ?,
            delivery_location = ?,
            notes = ?,
            validity_days = ?,
            payment_terms = ?,
            delivery_terms = ?,
            subtotal = ?,
            discount_total = ?,
            taxable_amount = ?,
            tax_total = ?,
            delivery_charges = ?,
            other_charges = ?,
            grand_total = ?,
            amount_in_words = ?,
            is_stale_pdf = 1,
            updated_at = ?
        WHERE id = ?
      `).run(
        newStatus,
        document_type || existing.document_type,
        paper_size || existing.paper_size,
        customer_name !== undefined ? customer_name : existing.customer_name,
        customer_phone !== undefined ? customer_phone : existing.customer_phone,
        customer_company !== undefined ? customer_company : existing.customer_company,
        customer_address !== undefined ? customer_address : existing.customer_address,
        customer_gstin !== undefined ? customer_gstin : existing.customer_gstin,
        reference_no !== undefined ? reference_no : existing.reference_no,
        delivery_location !== undefined ? delivery_location : existing.delivery_location,
        notes !== undefined ? notes : existing.notes,
        Number(validity_days || existing.validity_days),
        payment_terms || existing.payment_terms,
        delivery_terms || existing.delivery_terms,
        calc.subtotal,
        calc.discount_total,
        calc.taxable_amount,
        calc.tax_total,
        calc.delivery_charges,
        calc.other_charges,
        calc.grand_total,
        calc.amount_in_words,
        now,
        id
      );

      // Replace items
      db.prepare('DELETE FROM quotation_items WHERE quotation_id = ?').run(id);

      const insertItem = db.prepare(`
        INSERT INTO quotation_items (
          quotation_id, row_order, product_id, item_code, product_name,
          specification, hsn_code, quantity, unit, unit_price,
          is_override_price, override_reason, discount_percent, discount_amount,
          taxable_amount, gst_rate, gst_amount, line_total, match_status, raw_query
        ) VALUES (
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?
        )
      `);

      calc.items.forEach((item, index) => {
        insertItem.run(
          id,
          index + 1,
          item.product_id || null,
          item.item_code || '',
          item.product_name,
          item.specification || '',
          item.hsn_code || '',
          item.quantity,
          item.unit || 'Nos',
          item.unit_price,
          item.is_override_price ? 1 : 0,
          item.override_reason || '',
          item.discount_percent || 0,
          item.discount_amount || 0,
          item.taxable_amount,
          item.gst_rate || 18,
          item.gst_amount,
          item.line_total,
          item.match_status || 'Exact Match',
          item.raw_query || ''
        );
      });

      db.prepare(`
        INSERT INTO audit_logs (event_type, quotation_id, operator, outcome, details, metadata_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        'QUOTATION_UPDATED',
        id,
        'Operator',
        'success',
        `Quotation ${existing.quotation_number} updated. New grand total: ${calc.grand_total}`,
        JSON.stringify({ quotationNumber: existing.quotation_number, grandTotal: calc.grand_total }),
        now
      );
    });

    updateTx();

    res.json({
      success: true,
      message: 'Quotation updated successfully.',
      is_stale_pdf: 1,
      grandTotal: calc.grand_total
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/quotations/:id/finalize
 * Converts a draft quotation into an immutable finalized snapshot and generates its PDF
 */
router.post('/:id/finalize', async (req, res) => {
  try {
    const id = req.params.id;
    const quotation = db.prepare('SELECT * FROM quotations WHERE id = ?').get(id);
    if (!quotation) {
      return res.status(404).json({ error: 'Quotation not found.' });
    }

    const items = db.prepare('SELECT * FROM quotation_items WHERE quotation_id = ? ORDER BY row_order ASC').all(id);
    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Quotation has no items to finalize.' });
    }

    const hasMissingPrice = items.some(it => !it.unit_price || Number(it.unit_price) <= 0);
    if (hasMissingPrice) {
      return res.status(400).json({ error: 'Cannot finalize quotation with unresolved or zero-priced items.' });
    }

    const now = new Date().toISOString();
    const settings = getSettings();

    // Create an immutable logo snapshot upon finalization so future logo updates never alter this PDF
    let logoSnapshotFile = quotation.logo_snapshot_path || null;
    if (!logoSnapshotFile) {
      let sourceFile = null;
      if (quotation.logo_source === 'custom' && quotation.custom_logo_path) {
        sourceFile = path.isAbsolute(quotation.custom_logo_path) ? quotation.custom_logo_path : path.join(logosDir, quotation.custom_logo_path);
      } else if (quotation.logo_source !== 'none' && settings.company_logo) {
        sourceFile = path.isAbsolute(settings.company_logo) ? settings.company_logo : path.join(logosDir, settings.company_logo);
      }

      if (sourceFile && fs.existsSync(sourceFile)) {
        const snapName = `snap_${quotation.quotation_number.replace(/[^\w\-]/g, '_')}_${Date.now()}${path.extname(sourceFile)}`;
        const targetSnap = path.join(snapshotsDir, snapName);
        try {
          fs.copyFileSync(sourceFile, targetSnap);
          logoSnapshotFile = snapName;
        } catch (snapErr) {
          console.warn('[Finalize] Failed to copy logo snapshot:', snapErr.message);
        }
      }
    }

    // Generate fresh PDF with finalized snapshot
    const updatedQuote = { ...quotation, status: 'finalized', logo_snapshot_path: logoSnapshotFile };
    const pdfResult = await generateQuotationPDF(updatedQuote, items, settings);

    db.prepare(`
      UPDATE quotations
      SET status = 'finalized',
          pdf_filename = ?,
          pdf_generated_at = ?,
          logo_snapshot_path = ?,
          is_stale_pdf = 0,
          approval_status = CASE WHEN approval_status = 'approved' THEN approval_status ELSE 'approved' END,
          approved_at = COALESCE(approved_at, ?),
          approved_by = COALESCE(approved_by, 'Operator'),
          whatsapp_status = 'pdf_generated',
          updated_at = ?
      WHERE id = ?
    `).run(pdfResult.filename, now, logoSnapshotFile, now, now, id);

    db.prepare(`
      INSERT INTO audit_logs (event_type, quotation_id, operator, outcome, details, metadata_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      'QUOTATION_FINALIZED',
      id,
      'Operator',
      'success',
      `Quotation ${quotation.quotation_number} finalized with immutable snapshot. PDF: ${pdfResult.filename}`,
      JSON.stringify({ quotationNumber: quotation.quotation_number, filename: pdfResult.filename, logoSnapshot: logoSnapshotFile }),
      now
    );

    res.json({
      success: true,
      message: `Quotation ${quotation.quotation_number} finalized successfully.`,
      pdfFilename: pdfResult.filename,
      logoSnapshot: logoSnapshotFile
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to finalize quotation.' });
  }
});

/**
 * POST /api/quotations/:id/approve
 * Explicit human approval of quotation draft
 */
router.post('/:id/approve', (req, res) => {
  try {
    const id = req.params.id;
    const { operator = 'Operator', notes = '' } = req.body || {};
    const quotation = db.prepare('SELECT * FROM quotations WHERE id = ?').get(id);
    if (!quotation) {
      return res.status(404).json({ error: 'Quotation not found.' });
    }

    const now = new Date().toISOString();
    db.prepare(`
      UPDATE quotations
      SET approval_status = 'approved',
          approved_by = ?,
          approved_at = ?,
          updated_at = ?
      WHERE id = ?
    `).run(operator, now, now, id);

    db.prepare(`
      INSERT INTO audit_logs (event_type, quotation_id, operator, outcome, details, metadata_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      'QUOTATION_APPROVED',
      id,
      operator,
      'success',
      `Quotation ${quotation.quotation_number} explicitly approved by operator.`,
      JSON.stringify({ quotationNumber: quotation.quotation_number, operator, notes }),
      now
    );

    res.json({
      success: true,
      message: `Quotation ${quotation.quotation_number} approved successfully.`,
      approval_status: 'approved',
      approved_at: now,
      approved_by: operator
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/quotations/:id/custom-logo
 * Uploads quotation-specific logo override
 */
router.post('/:id/custom-logo', (req, res) => {
  uploadQuoteLogo.single('logo')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Please choose an image file to upload.' });
    }

    try {
      const id = req.params.id;
      const filename = req.file.filename;
      const now = new Date().toISOString();

      db.prepare(`
        UPDATE quotations
        SET logo_source = 'custom',
            custom_logo_path = ?,
            is_stale_pdf = 1,
            updated_at = ?
        WHERE id = ?
      `).run(filename, now, id);

      res.json({
        success: true,
        message: 'Custom quotation logo uploaded successfully.',
        logoSource: 'custom',
        filename,
        logoUrl: `/api/settings/logo/${encodeURIComponent(filename)}`
      });
    } catch (saveErr) {
      res.status(500).json({ error: saveErr.message });
    }
  });
});

/**
 * PUT /api/quotations/:id/logo-source
 * Switches quotation logo source: 'default' | 'custom' | 'none'
 */
router.put('/:id/logo-source', (req, res) => {
  try {
    const id = req.params.id;
    const { logoSource } = req.body;
    if (!['default', 'custom', 'none'].includes(logoSource)) {
      return res.status(400).json({ error: "Invalid logoSource. Must be 'default', 'custom', or 'none'." });
    }

    const now = new Date().toISOString();
    db.prepare(`
      UPDATE quotations
      SET logo_source = ?,
          is_stale_pdf = 1,
          updated_at = ?
      WHERE id = ?
    `).run(logoSource, now, id);

    res.json({
      success: true,
      message: `Logo source changed to ${logoSource}.`,
      logoSource
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/quotations/:id/duplicate
 * Duplicates a quotation as a new draft
 */
router.post('/:id/duplicate', (req, res) => {
  try {
    const id = req.params.id;
    const original = db.prepare('SELECT * FROM quotations WHERE id = ?').get(id);
    if (!original) {
      return res.status(404).json({ error: 'Original quotation not found.' });
    }

    const originalItems = db.prepare('SELECT * FROM quotation_items WHERE quotation_id = ? ORDER BY row_order ASC').all(id);
    const newQuoteNum = getNextQuotationNumber();
    const now = new Date().toISOString();

    const dupTx = db.transaction(() => {
      const insertQuote = db.prepare(`
        INSERT INTO quotations (
          quotation_number, revision, status, document_type, paper_size,
          customer_name, customer_phone, customer_company, customer_address, customer_gstin,
          reference_no, delivery_location, notes, validity_days, payment_terms, delivery_terms,
          price_list_id, subtotal, discount_total, taxable_amount, tax_total,
          delivery_charges, other_charges, grand_total, amount_in_words,
          raw_whatsapp_message, is_stale_pdf, whatsapp_status, created_at, updated_at
        ) VALUES (
          ?, 1, 'draft', ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, 0, 'not_started', ?, ?
        )
      `);

      const result = insertQuote.run(
        newQuoteNum,
        original.document_type,
        original.paper_size,
        original.customer_name,
        original.customer_phone,
        original.customer_company,
        original.customer_address,
        original.customer_gstin,
        `DUP of ${original.quotation_number}`,
        original.delivery_location,
        original.notes,
        original.validity_days,
        original.payment_terms,
        original.delivery_terms,
        original.price_list_id,
        original.subtotal,
        original.discount_total,
        original.taxable_amount,
        original.tax_total,
        original.delivery_charges,
        original.other_charges,
        original.grand_total,
        original.amount_in_words,
        original.raw_whatsapp_message,
        now,
        now
      );

      const newId = result.lastInsertRowid;

      const insertItem = db.prepare(`
        INSERT INTO quotation_items (
          quotation_id, row_order, product_id, item_code, product_name,
          specification, hsn_code, quantity, unit, unit_price,
          is_override_price, override_reason, discount_percent, discount_amount,
          taxable_amount, gst_rate, gst_amount, line_total, match_status, raw_query
        ) VALUES (
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?
        )
      `);

      originalItems.forEach(item => {
        insertItem.run(
          newId,
          item.row_order,
          item.product_id,
          item.item_code,
          item.product_name,
          item.specification,
          item.hsn_code,
          item.quantity,
          item.unit,
          item.unit_price,
          item.is_override_price,
          item.override_reason,
          item.discount_percent,
          item.discount_amount,
          item.taxable_amount,
          item.gst_rate,
          item.gst_amount,
          item.line_total,
          item.match_status,
          item.raw_query
        );
      });

      db.prepare(`
        INSERT INTO audit_logs (event_type, quotation_id, operator, outcome, details, metadata_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        'QUOTATION_DUPLICATED',
        newId,
        'Operator',
        'success',
        `Duplicated ${original.quotation_number} into new draft ${newQuoteNum}`,
        JSON.stringify({ originalQuoteNumber: original.quotation_number, newQuoteNumber: newQuoteNum }),
        now
      );

      return newId;
    });

    const newQuotationId = dupTx();

    res.json({
      success: true,
      message: `Quotation duplicated as ${newQuoteNum}.`,
      newQuotationId,
      newQuotationNumber: newQuoteNum
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/quotations/:id/pdf
 * Generates or regenerates PDF for a quotation
 */
router.post('/:id/pdf', async (req, res) => {
  try {
    const id = req.params.id;
    const quotation = db.prepare('SELECT * FROM quotations WHERE id = ?').get(id);
    if (!quotation) {
      return res.status(404).json({ error: 'Quotation not found.' });
    }

    const items = db.prepare('SELECT * FROM quotation_items WHERE quotation_id = ? ORDER BY row_order ASC').all(id);
    const settings = getSettings();
    const now = new Date().toISOString();

    const pdfResult = await generateQuotationPDF(quotation, items, settings);

    db.prepare(`
      UPDATE quotations
      SET pdf_filename = ?, pdf_generated_at = ?, is_stale_pdf = 0, whatsapp_status = 'pdf_generated'
      WHERE id = ?
    `).run(pdfResult.filename, now, id);

    db.prepare(`
      INSERT INTO audit_logs (event_type, quotation_id, operator, outcome, details, metadata_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      'PDF_GENERATED',
      id,
      'Operator',
      'success',
      `Generated PDF ${pdfResult.filename} for quotation ${quotation.quotation_number} (${quotation.paper_size})`,
      JSON.stringify({ quotationNumber: quotation.quotation_number, filename: pdfResult.filename, paperSize: quotation.paper_size }),
      now
    );

    res.json({
      success: true,
      filename: pdfResult.filename,
      fileSize: pdfResult.fileSize
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to generate PDF.' });
  }
});

/**
 * GET /api/quotations/:id/pdf
 * Dynamically generates and streams fresh PDF file with robust headers
 */
router.get('/:id/pdf', async (req, res) => {
  try {
    const id = req.params.id;
    const quotation = db.prepare('SELECT * FROM quotations WHERE id = ?').get(id);
    if (!quotation) {
      return res.status(404).json({ error: 'Quotation not found.' });
    }

    const items = db.prepare('SELECT * FROM quotation_items WHERE quotation_id = ? ORDER BY row_order ASC').all(id);
    const settings = getSettings();

    // Check if regenerating is required:
    // We regenerate if pdf_filename is missing, or file doesn't exist on disk,
    // OR if is_stale_pdf is set, OR if query param ?refresh=true is provided
    let filePath = quotation.pdf_filename ? path.join(pdfsDir, quotation.pdf_filename) : null;
    const needsRegen = !filePath || !fs.existsSync(filePath) || quotation.is_stale_pdf || req.query.refresh === 'true';

    if (needsRegen) {
      const pdfResult = await generateQuotationPDF(quotation, items, settings);
      filePath = pdfResult.filePath;
      db.prepare(`
        UPDATE quotations
        SET pdf_filename = ?, is_stale_pdf = 0, pdf_generated_at = ?, updated_at = ?
        WHERE id = ?
      `).run(pdfResult.filename, new Date().toISOString(), new Date().toISOString(), id);
    }

    const stat = fs.statSync(filePath);
    const download = req.query.download === 'true';

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader(
      'Content-Disposition',
      download ? `attachment; filename="${quotation.quotation_number}.pdf"` : 'inline'
    );

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  } catch (err) {
    console.error('PDF delivery error:', err);
    res.status(500).json({ error: err.message || 'Failed to serve PDF.' });
  }
});

/**
 * POST /api/quotations/:id/whatsapp-share
 * Prepares WhatsApp text with embedded public PDF download link, wa.me sharing URL, and records tracking status
 */
router.post('/:id/whatsapp-share', (req, res) => {
  try {
    const id = req.params.id;
    const quotation = db.prepare('SELECT * FROM quotations WHERE id = ?').get(id);
    if (!quotation) {
      return res.status(404).json({ error: 'Quotation not found.' });
    }

    const items = db.prepare('SELECT * FROM quotation_items WHERE quotation_id = ? ORDER BY row_order ASC').all(id);
    const settings = getSettings();
    const now = new Date().toISOString();

    // Construct public PDF URL for recipient
    let baseUrl = settings.public_app_url || process.env.APP_URL || '';
    if (!baseUrl) {
      const host = req.get('host') || `localhost:${process.env.PORT || 5000}`;
      const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
      baseUrl = `${protocol}://${host}`;
    }
    const pdfUrl = `${baseUrl.replace(/\/$/, '')}/api/quotations/${id}/pdf?download=true`;

    const formattedMessage = formatWhatsAppMessage(quotation, items, settings, { pdfUrl });
    const shareLink = generateWhatsAppShareLink(quotation.customer_phone, formattedMessage);

    // Update tracking status
    db.prepare(`
      UPDATE quotations
      SET whatsapp_status = 'whatsapp_opened', updated_at = ?
      WHERE id = ?
    `).run(now, id);

    db.prepare(`
      INSERT INTO audit_logs (event_type, quotation_id, operator, outcome, details, metadata_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      'WHATSAPP_SHARE_INITIATED',
      id,
      'Operator',
      'success',
      `WhatsApp share initiated for quotation ${quotation.quotation_number} (Customer: ${quotation.customer_phone || 'None'})`,
      JSON.stringify({ quotationNumber: quotation.quotation_number, phone: quotation.customer_phone, pdfUrl }),
      now
    );

    res.json({
      success: true,
      messageText: formattedMessage,
      shareLink,
      pdfUrl,
      whatsappStatus: 'whatsapp_opened',
      instructions: '1. Click "Download PDF" to save the file or use Web Share API.\n2. WhatsApp will open with the prefilled message and direct PDF download link.'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/quotations/:id/send-whatsapp
 * Dispatches quotation PDF to customer via Official Meta Cloud API or triggers fallback
 */
router.post('/:id/send-whatsapp', async (req, res) => {
  try {
    const id = req.params.id;
    const { recipientPhone, messageText } = req.body || {};
    const quotation = db.prepare('SELECT * FROM quotations WHERE id = ?').get(id);
    if (!quotation) {
      return res.status(404).json({ error: 'Quotation not found.' });
    }

    const settings = getSettings();
    const phone = (recipientPhone || quotation.customer_phone || '').trim();
    if (!phone) {
      return res.status(400).json({ error: 'Recipient phone number is required.' });
    }

    const mode = settings.whatsapp_integration_mode || 'trial_simulator';
    const isMetaConfigured = mode === 'official_meta_api' &&
      settings.meta_phone_number_id &&
      settings.meta_access_token;

    if (!isMetaConfigured) {
      return res.json({
        success: true,
        mode: 'fallback_web',
        message: 'Operating in trial/desktop mode. Please use WhatsApp Web to send.'
      });
    }

    // Ensure PDF file exists
    const items = db.prepare('SELECT * FROM quotation_items WHERE quotation_id = ? ORDER BY row_order ASC').all(id);
    let filePath = quotation.pdf_filename ? path.join(pdfsDir, quotation.pdf_filename) : null;
    const now = new Date().toISOString();
    if (!filePath || !fs.existsSync(filePath)) {
      const pdfResult = await generateQuotationPDF(quotation, items, settings);
      filePath = pdfResult.filePath;
      db.prepare(`
        UPDATE quotations
        SET pdf_filename = ?, is_stale_pdf = 0, pdf_generated_at = ?, updated_at = ?
        WHERE id = ?
      `).run(pdfResult.filename, now, now, id);
    }

    // 1. Upload PDF media to Meta
    const mediaId = await uploadPdfMedia(
      settings.meta_phone_number_id,
      settings.meta_access_token,
      filePath,
      quotation.pdf_filename || `${quotation.quotation_number}.pdf`,
      settings.meta_api_version || 'v21.0'
    );

    // 2. Send official WhatsApp document message
    const sendResult = await sendOfficialWhatsAppDocument({
      phoneNumberId: settings.meta_phone_number_id,
      accessToken: settings.meta_access_token,
      recipientPhone: phone,
      mediaId,
      filename: `${quotation.quotation_number}_Udhayam.pdf`,
      caption: messageText || `Quotation ${quotation.quotation_number} from Udhayam Agencies`,
      apiVersion: settings.meta_api_version || 'v21.0'
    });

    // 3. Update quotation status
    db.prepare(`
      UPDATE quotations
      SET outbound_wamid = ?, delivery_status = 'sent', whatsapp_status = 'sent', updated_at = ?
      WHERE id = ?
    `).run(sendResult.providerMessageId, now, id);

    db.prepare(`
      INSERT INTO audit_logs (event_type, quotation_id, operator, outcome, details, metadata_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      'OFFICIAL_WHATSAPP_SENT',
      id,
      'Operator',
      'success',
      `Delivered quotation ${quotation.quotation_number} to ${phone} via Meta WhatsApp Cloud API (WAMID: ${sendResult.providerMessageId})`,
      JSON.stringify({ quotationNumber: quotation.quotation_number, wamid: sendResult.providerMessageId, phone }),
      now
    );

    res.json({
      success: true,
      mode: 'official_meta_api',
      wamid: sendResult.providerMessageId,
      recipient: sendResult.recipient
    });
  } catch (err) {
    console.error('Failed to send official WhatsApp:', err);
    res.status(500).json({ error: err.message || 'Failed to send WhatsApp document.' });
  }
});

/**
 * POST /api/quotations/:id/email-share
 * Prepares and sends quotation email with PDF attachment (SMTP or 1-Click Client Fallback)
 */
router.post('/:id/email-share', async (req, res) => {
  try {
    const id = req.params.id;
    const { recipientEmail, recipientName, note } = req.body || {};

    const quotation = db.prepare('SELECT * FROM quotations WHERE id = ?').get(id);
    if (!quotation) {
      return res.status(404).json({ error: 'Quotation not found.' });
    }

    const items = db.prepare('SELECT * FROM quotation_items WHERE quotation_id = ? ORDER BY row_order ASC').all(id);
    const settings = getSettings();
    const now = new Date().toISOString();

    // Ensure PDF file exists on disk
    let filePath = quotation.pdf_filename ? path.join(pdfsDir, quotation.pdf_filename) : null;
    if (!filePath || !fs.existsSync(filePath)) {
      const pdfResult = await generateQuotationPDF(quotation, items, settings);
      filePath = pdfResult.filePath;
      db.prepare(`
        UPDATE quotations
        SET pdf_filename = ?, is_stale_pdf = 0, pdf_generated_at = ?, updated_at = ?
        WHERE id = ?
      `).run(pdfResult.filename, now, now, id);
    }

    const targetEmail = (recipientEmail || quotation.customer_email || '').trim();

    // Persist email in quotation if provided
    if (targetEmail && targetEmail !== quotation.customer_email) {
      db.prepare('UPDATE quotations SET customer_email = ?, updated_at = ? WHERE id = ?').run(targetEmail, now, id);
    }

    // Public PDF URL for online link inside email
    let baseUrl = settings.public_app_url || process.env.APP_URL || '';
    if (!baseUrl) {
      const host = req.get('host') || `localhost:${process.env.PORT || 5000}`;
      const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
      baseUrl = `${protocol}://${host}`;
    }
    const pdfUrl = `${baseUrl.replace(/\/$/, '')}/api/quotations/${id}/pdf?download=true`;

    const result = await sendQuotationEmail({
      quotation: { ...quotation, customer_email: targetEmail },
      items,
      settings,
      recipientEmail: targetEmail,
      recipientName: recipientName || quotation.customer_name,
      pdfFilePath: filePath,
      options: { pdfUrl, note }
    });

    db.prepare(`
      INSERT INTO audit_logs (event_type, quotation_id, operator, outcome, details, metadata_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      'EMAIL_SHARE_INITIATED',
      id,
      'Operator',
      result.success ? 'success' : 'warning',
      `Email share processed for quotation ${quotation.quotation_number} to ${targetEmail || 'No Email'} (Mode: ${result.mode})`,
      JSON.stringify({ quotationNumber: quotation.quotation_number, recipient: targetEmail, mode: result.mode, status: result.status }),
      now
    );

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to process email share.' });
  }
});

/**
 * POST /api/quotations/:id/whatsapp-status
 * Updates delivery status manually or from provider webhook
 */
router.post('/:id/whatsapp-status', (req, res) => {
  try {
    const id = req.params.id;
    const { status } = req.body;
    const allowed = ['pdf_generated', 'pdf_downloaded', 'whatsapp_opened', 'awaiting_manual_send', 'sent'];

    if (!allowed.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Allowed values: ${allowed.join(', ')}` });
    }

    const quotation = db.prepare('SELECT quotation_number FROM quotations WHERE id = ?').get(id);
    if (!quotation) {
      return res.status(404).json({ error: 'Quotation not found.' });
    }

    const now = new Date().toISOString();
    db.prepare('UPDATE quotations SET whatsapp_status = ?, updated_at = ? WHERE id = ?').run(status, now, id);

    db.prepare(`
      INSERT INTO audit_logs (event_type, quotation_id, operator, outcome, details, metadata_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      'WHATSAPP_STATUS_UPDATED',
      id,
      'Operator',
      'success',
      `WhatsApp status for quotation ${quotation.quotation_number} updated to "${status}".`,
      JSON.stringify({ quotationNumber: quotation.quotation_number, newStatus: status }),
      now
    );

    res.json({ success: true, whatsappStatus: status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
