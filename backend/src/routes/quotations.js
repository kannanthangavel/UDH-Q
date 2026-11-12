const express = require('express');
const router = express.Router();
const { db, getNextQuotationNumber, logAudit } = require('../db/database');
const { generateQuotationPdf } = require('../services/pdfService');

// POST /api/quotations - Create Quotation
router.post('/', (req, res) => {
  const {
    customer_id,
    customer_name,
    customer_phone,
    customer_email = '',
    customer_address = '',
    items = [],
    discount_percent = 0,
    gst_rate = 18,
    is_tax_inclusive = true,
    delivery_charges = 0,
    paper_format = 'A4',
    validity_date,
    notes = '',
    status = 'Created'
  } = req.body;

  // Validate Customer
  if (!customer_name || !customer_name.trim()) {
    return res.status(400).json({ error: 'Customer name is required' });
  }
  if (!customer_phone || !customer_phone.trim()) {
    return res.status(400).json({ error: 'Customer phone number is required' });
  }
  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'At least one product item is required to create a quotation' });
  }

  const userId = req.user?.id || 1;
  const userEmail = req.user?.email || 'kids@udhayam.com';
  const userName = req.user?.name || 'Kids';
  const userRole = req.user?.role || 'admin';

  let finalCustomerId = customer_id;

  // Handle customer persistence / auto-link
  if (!finalCustomerId) {
    const existingCust = db.prepare('SELECT id FROM customers WHERE phone = ?').get(customer_phone.trim());
    if (existingCust) {
      finalCustomerId = existingCust.id;
    } else {
      const newCust = db.prepare(`
        INSERT INTO customers (name, phone, email, address)
        VALUES (?, ?, ?, ?)
      `).run(customer_name.trim(), customer_phone.trim(), customer_email.trim(), customer_address.trim());
      finalCustomerId = newCust.lastInsertRowid;
    }
  }

  // Consolidate duplicate products by product_id to ensure complete data integrity
  const consolidatedItems = [];
  const seenProductIds = new Map();

  for (const it of items) {
    if (it.product_id && seenProductIds.has(it.product_id)) {
      const existing = seenProductIds.get(it.product_id);
      const addQty = Math.max(0.01, parseFloat(it.quantity) || 1);
      existing.quantity = Math.round(((parseFloat(existing.quantity) || 1) + addQty) * 100) / 100;
      if (it.details && !existing.details.includes(it.details)) {
        existing.details = existing.details ? `${existing.details}; ${it.details}` : it.details;
      }
    } else {
      const cloned = { ...it };
      consolidatedItems.push(cloned);
      if (it.product_id) {
        seenProductIds.set(it.product_id, cloned);
      }
    }
  }

  // Calculate Line Items and Totals
  let calculatedSubtotal = 0;
  const processedItems = [];
  const priceOverrides = [];

  const getProduct = db.prepare('SELECT id, item_name, details, sale_rate, hsn_sac, main_unit FROM products WHERE id = ?');

  for (const it of consolidatedItems) {
    const rawQty = parseFloat(it.quantity);
    const qty = (!isNaN(rawQty) && isFinite(rawQty) && rawQty > 0) ? Math.round(rawQty * 100) / 100 : 1;
    let catalogRate = null;
    let originalProduct = null;

    if (it.product_id) {
      originalProduct = getProduct.get(it.product_id);
      if (originalProduct) {
        catalogRate = originalProduct.sale_rate;
      }
    }

    let finalSaleRate = parseFloat(it.sale_rate);
    if (isNaN(finalSaleRate) || finalSaleRate < 0) {
      finalSaleRate = catalogRate != null ? catalogRate : 0;
    }

    let isOverridden = 0;
    if (catalogRate != null && Math.abs(catalogRate - finalSaleRate) > 0.001) {
      isOverridden = 1;
      priceOverrides.push({
        item: it.item_name || originalProduct?.item_name,
        catalogRate,
        overriddenRate: finalSaleRate
      });
    }

    const lineTotal = Math.round(qty * finalSaleRate * 100) / 100;
    calculatedSubtotal += lineTotal;

    processedItems.push({
      product_id: it.product_id || null,
      item_name: it.item_name || originalProduct?.item_name || 'Item',
      details: it.details || originalProduct?.details || '',
      hsn_sac: it.hsn_sac || originalProduct?.hsn_sac || '',
      unit: it.unit || originalProduct?.main_unit || 'Nos',
      quantity: qty,
      sale_rate: finalSaleRate,
      line_total: lineTotal,
      is_price_overridden: isOverridden,
      original_sale_rate: catalogRate
    });
  }

  // Summary Calculations (Tax Inclusive by Default for Udhayam rate sheet)
  const subtotal = Math.round(calculatedSubtotal * 100) / 100;
  const discPercent = Math.min(100, Math.max(0, parseFloat(discount_percent) || 0));
  const discountAmount = Math.round((subtotal * discPercent / 100) * 100) / 100;
  const discountedNet = Math.max(0, subtotal - discountAmount);

  const gstRateVal = parseFloat(gst_rate) || 0;
  let gstAmount = 0;
  let taxableValue = discountedNet;
  let grandTotal = 0;

  const deliveryVal = Math.max(0, parseFloat(delivery_charges) || 0);

  if (is_tax_inclusive) {
    // Tax Inclusive: Sale rate already includes GST
    if (gstRateVal > 0) {
      taxableValue = Math.round((discountedNet / (1 + (gstRateVal / 100))) * 100) / 100;
      gstAmount = Math.round((discountedNet - taxableValue) * 100) / 100;
    } else {
      taxableValue = discountedNet;
      gstAmount = 0;
    }
    grandTotal = Math.round((discountedNet + deliveryVal) * 100) / 100;
  } else {
    // Tax Exclusive: GST is added on top
    taxableValue = discountedNet;
    gstAmount = Math.round((discountedNet * gstRateVal / 100) * 100) / 100;
    grandTotal = Math.round((discountedNet + gstAmount + deliveryVal) * 100) / 100;
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const validUntilStr = validity_date || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  let quotationId = null;
  let quoteNumber = null;

  const transaction = db.transaction(() => {
    quoteNumber = getNextQuotationNumber();

    const insertQuote = db.prepare(`
      INSERT INTO quotations (
        quotation_number, customer_id, customer_name, customer_phone, customer_email, customer_address,
        created_by, quotation_date, validity_date, status, subtotal, discount_percent, discount_amount,
        gst_rate, gst_amount, delivery_charges, grand_total, paper_format, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = insertQuote.run(
      quoteNumber,
      finalCustomerId,
      customer_name.trim(),
      customer_phone.trim(),
      customer_email.trim(),
      customer_address.trim(),
      userName,
      todayStr,
      validUntilStr,
      status,
      subtotal,
      discPercent,
      discountAmount,
      gstRateVal,
      gstAmount,
      deliveryVal,
      grandTotal,
      paper_format === 'A5' ? 'A5' : 'A4',
      notes
    );

    quotationId = result.lastInsertRowid;

    const insertItem = db.prepare(`
      INSERT INTO quotation_items (
        quotation_id, product_id, item_name, details, hsn_sac, unit, quantity, sale_rate, line_total, is_price_overridden, original_sale_rate
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const item of processedItems) {
      insertItem.run(
        quotationId,
        item.product_id,
        item.item_name,
        item.details || '',
        item.hsn_sac,
        item.unit,
        item.quantity,
        item.sale_rate,
        item.line_total,
        item.is_price_overridden,
        item.original_sale_rate
      );
    }

    logAudit(
      userId,
      userEmail,
      userRole,
      'CREATE_QUOTATION',
      'QUOTATION',
      quotationId,
      `Created quote ${quoteNumber} for ${customer_name} (Total: ₹${grandTotal.toFixed(2)})`
    );
  });

  transaction();

  const createdQuote = db.prepare('SELECT * FROM quotations WHERE id = ?').get(quotationId);
  const createdItems = db.prepare('SELECT * FROM quotation_items WHERE quotation_id = ? ORDER BY id ASC').all(quotationId);
  const fullQuotation = { ...createdQuote, items: createdItems };

  res.json({
    success: true,
    id: quotationId,
    quotation_number: quoteNumber,
    customer_id: finalCustomerId,
    grand_total: grandTotal,
    quotation: fullQuotation,
    message: `Quotation ${quoteNumber} created successfully`
  });
});

// GET /api/quotations - List quotations with search & filters
router.get('/', (req, res) => {
  const { search, status, page = 1, limit = 20 } = req.query;

  let sql = 'SELECT * FROM quotations WHERE 1=1';
  const params = [];

  if (status && status !== 'all') {
    sql += ' AND status = ?';
    params.push(status);
  }

  if (search && search.trim()) {
    const q = `%${search.trim()}%`;
    sql += ' AND (quotation_number LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ?)';
    params.push(q, q, q);
  }

  const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total');
  const countRow = db.prepare(countSql).get(...params);
  const total = countRow ? countRow.total : 0;

  sql += ' ORDER BY id DESC';

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (pageNum - 1) * limitNum;
  sql += ' LIMIT ? OFFSET ?';
  params.push(limitNum, offset);

  const quotations = db.prepare(sql).all(...params);

  res.json({
    quotations,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum)
  });
});

// GET /api/quotations/:id - Get single quotation with line items
router.get('/:id', (req, res) => {
  const quote = db.prepare('SELECT * FROM quotations WHERE id = ? OR quotation_number = ?').get(req.params.id, req.params.id);
  if (!quote) {
    return res.status(404).json({ error: 'Quotation not found' });
  }

  const items = db.prepare('SELECT * FROM quotation_items WHERE quotation_id = ? ORDER BY id ASC').all(quote.id);
  res.json({ quotation: { ...quote, items } });
});

// PATCH /api/quotations/:id/status - Update quotation status
router.patch('/:id/status', (req, res) => {
  const { status } = req.body;
  const validStatuses = ['Draft', 'Created', 'Shared', 'Accepted', 'Rejected', 'Expired'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
  }

  const quote = db.prepare('SELECT id, quotation_number FROM quotations WHERE id = ?').get(req.params.id);
  if (!quote) {
    return res.status(404).json({ error: 'Quotation not found' });
  }

  db.prepare("UPDATE quotations SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, quote.id);

  logAudit(
    req.user?.id || 1,
    req.user?.email || 'admin@udhayam.com',
    req.user?.role || 'admin',
    'UPDATE_STATUS',
    'QUOTATION',
    quote.id,
    `Updated status of ${quote.quotation_number} to "${status}"`
  );

  res.json({ success: true, status });
});

// PUT /api/quotations/:id - Edit existing quotation
router.put('/:id', (req, res) => {
  const quote = db.prepare('SELECT * FROM quotations WHERE id = ?').get(req.params.id);
  if (!quote) {
    return res.status(404).json({ error: 'Quotation not found' });
  }

  const {
    customer_id,
    customer_name,
    customer_phone,
    customer_email = '',
    customer_address = '',
    items = [],
    discount_percent = 0,
    gst_rate = 18,
    is_tax_inclusive = true,
    delivery_charges = 0,
    paper_format = 'A4',
    validity_date,
    notes = '',
    status = quote.status || 'Created'
  } = req.body;

  if (!customer_name || !customer_name.trim()) {
    return res.status(400).json({ error: 'Customer name is required' });
  }
  if (!customer_phone || !customer_phone.trim()) {
    return res.status(400).json({ error: 'Customer phone number is required' });
  }
  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'At least one product item is required to update a quotation' });
  }

  const userId = req.user?.id || 1;
  const userEmail = req.user?.email || 'kids@udhayam.com';
  const userName = req.user?.name || 'Kids';
  const userRole = req.user?.role || 'admin';

  let finalCustomerId = customer_id;
  if (!finalCustomerId) {
    const existingCust = db.prepare('SELECT id FROM customers WHERE phone = ?').get(customer_phone.trim());
    if (existingCust) {
      finalCustomerId = existingCust.id;
    } else {
      const newCust = db.prepare(`
        INSERT INTO customers (name, phone, email, address)
        VALUES (?, ?, ?, ?)
      `).run(customer_name.trim(), customer_phone.trim(), customer_email.trim(), customer_address.trim());
      finalCustomerId = newCust.lastInsertRowid;
    }
  }

  // Consolidate duplicate products by product_id
  const consolidatedItems = [];
  const seenProductIds = new Map();

  for (const it of items) {
    if (it.product_id && seenProductIds.has(it.product_id)) {
      const existing = seenProductIds.get(it.product_id);
      const addQty = Math.max(0.01, parseFloat(it.quantity) || 1);
      existing.quantity = Math.round(((parseFloat(existing.quantity) || 1) + addQty) * 100) / 100;
      if (it.details && !existing.details.includes(it.details)) {
        existing.details = existing.details ? `${existing.details}; ${it.details}` : it.details;
      }
    } else {
      const cloned = { ...it };
      consolidatedItems.push(cloned);
      if (it.product_id) {
        seenProductIds.set(it.product_id, cloned);
      }
    }
  }

  let calculatedSubtotal = 0;
  const processedItems = [];
  const priceOverrides = [];

  const getProduct = db.prepare('SELECT id, item_name, details, sale_rate, hsn_sac, main_unit FROM products WHERE id = ?');

  for (const it of consolidatedItems) {
    const rawQty = parseFloat(it.quantity);
    const qty = (!isNaN(rawQty) && isFinite(rawQty) && rawQty > 0) ? Math.round(rawQty * 100) / 100 : 1;
    let catalogRate = null;
    let originalProduct = null;

    if (it.product_id) {
      originalProduct = getProduct.get(it.product_id);
      if (originalProduct) {
        catalogRate = originalProduct.sale_rate;
      }
    }

    let finalSaleRate = parseFloat(it.sale_rate);
    if (isNaN(finalSaleRate) || finalSaleRate < 0) {
      finalSaleRate = catalogRate != null ? catalogRate : 0;
    }

    let isOverridden = 0;
    if (catalogRate != null && Math.abs(catalogRate - finalSaleRate) > 0.001) {
      isOverridden = 1;
      priceOverrides.push({
        item: it.item_name || originalProduct?.item_name,
        catalogRate,
        overriddenRate: finalSaleRate
      });
    }

    const lineTotal = Math.round(qty * finalSaleRate * 100) / 100;
    calculatedSubtotal += lineTotal;

    processedItems.push({
      product_id: it.product_id || null,
      item_name: it.item_name || originalProduct?.item_name || 'Item',
      details: it.details || originalProduct?.details || '',
      hsn_sac: it.hsn_sac || originalProduct?.hsn_sac || '',
      unit: it.unit || originalProduct?.main_unit || 'Nos',
      quantity: qty,
      sale_rate: finalSaleRate,
      line_total: lineTotal,
      is_price_overridden: isOverridden,
      original_sale_rate: catalogRate
    });
  }

  const subtotal = Math.round(calculatedSubtotal * 100) / 100;
  const discPercent = Math.min(100, Math.max(0, parseFloat(discount_percent) || 0));
  const discountAmount = Math.round((subtotal * discPercent / 100) * 100) / 100;
  const discountedNet = Math.max(0, subtotal - discountAmount);

  const gstRateVal = parseFloat(gst_rate) || 0;
  let gstAmount = 0;
  let taxableValue = discountedNet;
  let grandTotal = 0;
  const deliveryVal = Math.max(0, parseFloat(delivery_charges) || 0);

  if (is_tax_inclusive) {
    if (gstRateVal > 0) {
      taxableValue = Math.round((discountedNet / (1 + (gstRateVal / 100))) * 100) / 100;
      gstAmount = Math.round((discountedNet - taxableValue) * 100) / 100;
    } else {
      taxableValue = discountedNet;
      gstAmount = 0;
    }
    grandTotal = Math.round((discountedNet + deliveryVal) * 100) / 100;
  } else {
    taxableValue = discountedNet;
    gstAmount = Math.round((discountedNet * gstRateVal / 100) * 100) / 100;
    grandTotal = Math.round((discountedNet + gstAmount + deliveryVal) * 100) / 100;
  }

  const validUntilStr = validity_date || quote.validity_date;
  const targetFormat = (paper_format || quote.paper_format || 'A4').toUpperCase() === 'A5' ? 'A5' : 'A4';

  const transaction = db.transaction(() => {
    db.prepare(`
      UPDATE quotations SET
        customer_id = ?,
        customer_name = ?,
        customer_phone = ?,
        customer_email = ?,
        customer_address = ?,
        validity_date = ?,
        status = ?,
        subtotal = ?,
        discount_percent = ?,
        discount_amount = ?,
        gst_rate = ?,
        gst_amount = ?,
        delivery_charges = ?,
        grand_total = ?,
        paper_format = ?,
        notes = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      finalCustomerId,
      customer_name.trim(),
      customer_phone.trim(),
      customer_email.trim(),
      customer_address.trim(),
      validUntilStr,
      status,
      subtotal,
      discPercent,
      discountAmount,
      gstRateVal,
      gstAmount,
      deliveryVal,
      grandTotal,
      targetFormat,
      notes.trim(),
      quote.id
    );

    // Delete existing line items and re-insert fresh items
    db.prepare('DELETE FROM quotation_items WHERE quotation_id = ?').run(quote.id);

    const insertItem = db.prepare(`
      INSERT INTO quotation_items (
        quotation_id, product_id, item_name, details, hsn_sac, unit, quantity, sale_rate, line_total, is_price_overridden, original_sale_rate
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const item of processedItems) {
      insertItem.run(
        quote.id,
        item.product_id,
        item.item_name,
        item.details || '',
        item.hsn_sac,
        item.unit,
        item.quantity,
        item.sale_rate,
        item.line_total,
        item.is_price_overridden,
        item.original_sale_rate
      );
    }

    logAudit(
      userId,
      userEmail,
      userRole,
      'UPDATE_QUOTATION',
      'QUOTATION',
      quote.id,
      `Updated quote ${quote.quotation_number} for ${customer_name} (Total: ₹${grandTotal.toFixed(2)})`
    );
  });

  transaction();

  res.json({
    success: true,
    id: quote.id,
    quotation_number: quote.quotation_number,
    grand_total: grandTotal,
    message: `Quotation ${quote.quotation_number} updated successfully`
  });
});

// DELETE /api/quotations/:id - Delete quotation
router.delete('/:id', (req, res) => {
  const quote = db.prepare('SELECT id, quotation_number, customer_name FROM quotations WHERE id = ?').get(req.params.id);
  if (!quote) {
    return res.status(404).json({ error: 'Quotation not found' });
  }

  const transaction = db.transaction(() => {
    db.prepare('DELETE FROM quotation_items WHERE quotation_id = ?').run(quote.id);
    db.prepare('DELETE FROM quotations WHERE id = ?').run(quote.id);

    logAudit(
      req.user?.id || 1,
      req.user?.email || 'admin@udhayam.com',
      req.user?.role || 'admin',
      'DELETE_QUOTATION',
      'QUOTATION',
      quote.id,
      `Deleted quotation ${quote.quotation_number} (Customer: ${quote.customer_name})`
    );
  });

  transaction();

  res.json({
    success: true,
    id: quote.id,
    quotation_number: quote.quotation_number,
    message: `Quotation ${quote.quotation_number} deleted successfully`
  });
});

// POST /api/quotations/:id/duplicate - Duplicate quotation
router.post('/:id/duplicate', (req, res) => {
  const source = db.prepare('SELECT * FROM quotations WHERE id = ?').get(req.params.id);
  if (!source) {
    return res.status(404).json({ error: 'Source quotation not found' });
  }

  const sourceItems = db.prepare('SELECT * FROM quotation_items WHERE quotation_id = ?').all(source.id);
  const newQuoteNumber = getNextQuotationNumber();
  const todayStr = new Date().toISOString().split('T')[0];
  const validUntilStr = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  let newQuoteId = null;

  const transaction = db.transaction(() => {
    const result = db.prepare(`
      INSERT INTO quotations (
        quotation_number, customer_id, customer_name, customer_phone, customer_email, customer_address,
        created_by, quotation_date, validity_date, status, subtotal, discount_percent, discount_amount,
        gst_rate, gst_amount, delivery_charges, grand_total, paper_format, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Created', ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      newQuoteNumber,
      source.customer_id,
      source.customer_name,
      source.customer_phone,
      source.customer_email,
      source.customer_address,
      req.user?.name || 'Administrator',
      todayStr,
      validUntilStr,
      source.subtotal,
      source.discount_percent,
      source.discount_amount,
      source.gst_rate,
      source.gst_amount,
      source.delivery_charges,
      source.grand_total,
      source.paper_format,
      source.notes
    );

    newQuoteId = result.lastInsertRowid;

    const insertItem = db.prepare(`
      INSERT INTO quotation_items (
        quotation_id, product_id, item_name, hsn_sac, unit, quantity, sale_rate, line_total, is_price_overridden, original_sale_rate
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const it of sourceItems) {
      insertItem.run(
        newQuoteId,
        it.product_id,
        it.item_name,
        it.hsn_sac,
        it.unit,
        it.quantity,
        it.sale_rate,
        it.line_total,
        it.is_price_overridden,
        it.original_sale_rate
      );
    }

    logAudit(
      req.user?.id || 1,
      req.user?.email || 'admin@udhayam.com',
      req.user?.role || 'admin',
      'DUPLICATE_QUOTATION',
      'QUOTATION',
      newQuoteId,
      `Duplicated ${source.quotation_number} into new quotation ${newQuoteNumber}`
    );
  });

  transaction();

  res.json({
    success: true,
    id: newQuoteId,
    quotation_number: newQuoteNumber,
    message: `Quotation duplicated as ${newQuoteNumber}`
  });
});

// GET /api/quotations/:id/pdf - Stream PDFKit PDF
router.get('/:id/pdf', (req, res) => {
  const quote = db.prepare('SELECT * FROM quotations WHERE id = ? OR quotation_number = ?').get(req.params.id, req.params.id);
  if (!quote) {
    return res.status(404).json({ error: 'Quotation not found' });
  }

  const items = db.prepare('SELECT * FROM quotation_items WHERE quotation_id = ? ORDER BY id ASC').all(quote.id);
  const quotationData = { ...quote, items };

  // Allow format override from query param if provided (e.g., ?format=a5)
  if (req.query.format) {
    quotationData.paper_format = req.query.format.toUpperCase() === 'A5' ? 'A5' : 'A4';
  }

  const settingsRows = db.prepare('SELECT key, value FROM settings').all();
  const settings = {};
  settingsRows.forEach(r => settings[r.key] = r.value);

  const filename = `${quote.quotation_number}-${quotationData.paper_format}.pdf`;
  const disposition = req.query.download === 'true' ? 'attachment' : 'inline';

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `${disposition}; filename="${filename}"`);

  generateQuotationPdf(quotationData, settings, res);
});

// POST /api/quotations/:id/audit-share - Record WhatsApp or Email sharing
router.post('/:id/audit-share', (req, res) => {
  const { channel, recipient } = req.body; // channel: 'whatsapp' | 'email'
  const quote = db.prepare('SELECT id, quotation_number, status FROM quotations WHERE id = ?').get(req.params.id);
  if (!quote) {
    return res.status(404).json({ error: 'Quotation not found' });
  }

  // Update status to 'Shared' if it was 'Created' or 'Draft'
  if (quote.status === 'Created' || quote.status === 'Draft') {
    db.prepare("UPDATE quotations SET status = 'Shared', updated_at = datetime('now') WHERE id = ?").run(quote.id);
  }

  logAudit(
    req.user?.id || 1,
    req.user?.email || 'admin@udhayam.com',
    req.user?.role || 'admin',
    `SHARE_${(channel || 'WHATSAPP').toUpperCase()}`,
    'QUOTATION',
    quote.id,
    `Shared quotation ${quote.quotation_number} via ${channel} to ${recipient}`
  );

  res.json({ success: true, status: 'Shared' });
});

module.exports = router;
