const express = require('express');
const router = express.Router();
const { db, getNextReceiptNumber, logAudit } = require('../db/database');
const { requireAdmin } = require('../middleware/auth');
const { generateReceiptPdf } = require('../services/receiptPdfService');
const { getReceiptPdfFilename } = require('../utils/filenameHelper');

// GET /api/receipts - List receipts with pagination and search
router.get('/', (req, res) => {
  try {
    const { search = '', page = 1, limit = 20 } = req.query;
    const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
    const searchTerm = `%${search.trim()}%`;

    const countStmt = db.prepare(`
      SELECT COUNT(*) as total FROM customer_receipts
      WHERE customer_name LIKE ? OR receipt_number LIKE ? OR bill_no LIKE ? OR customer_phone LIKE ?
    `);
    const total = countStmt.get(searchTerm, searchTerm, searchTerm, searchTerm).total;

    const listStmt = db.prepare(`
      SELECT * FROM customer_receipts
      WHERE customer_name LIKE ? OR receipt_number LIKE ? OR bill_no LIKE ? OR customer_phone LIKE ?
      ORDER BY id DESC
      LIMIT ? OFFSET ?
    `);
    const receipts = listStmt.all(searchTerm, searchTerm, searchTerm, searchTerm, parseInt(limit, 10), offset);

    res.json({
      receipts,
      total,
      page: parseInt(page, 10),
      totalPages: Math.ceil(total / parseInt(limit, 10)) || 1
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/receipts/:id - Get a single receipt
router.get('/:id', (req, res) => {
  try {
    const receipt = db.prepare('SELECT * FROM customer_receipts WHERE id = ?').get(req.params.id);
    if (!receipt) {
      return res.status(404).json({ error: 'Receipt not found' });
    }
    res.json({ receipt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/receipts - Create a new receipt
router.post('/', (req, res) => {
  try {
    const {
      customer_name,
      customer_phone = '',
      customer_address = '',
      bill_no = '',
      payment_date = new Date().toISOString().split('T')[0],
      payment_mode = 'Cash',
      reference_no = '',
      amount_paid = 0,
      balance_amount = 0,
      notes = '',
      paper_format = 'A4'
    } = req.body;

    if (!customer_name || !customer_name.trim()) {
      return res.status(400).json({ error: 'Customer name is required' });
    }

    const parsedPaid = parseFloat(amount_paid) || 0;
    if (parsedPaid <= 0) {
      return res.status(400).json({ error: 'Amount paid must be greater than zero' });
    }

    const receipt_number = getNextReceiptNumber();

    const insertStmt = db.prepare(`
      INSERT INTO customer_receipts (
        receipt_number, customer_name, customer_phone, customer_address,
        bill_no, payment_date, payment_mode, reference_no,
        amount_paid, balance_amount, notes, paper_format,
        created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = insertStmt.run(
      receipt_number,
      customer_name.trim(),
      customer_phone.trim(),
      customer_address.trim(),
      bill_no.trim(),
      payment_date,
      payment_mode,
      reference_no.trim(),
      parsedPaid,
      parseFloat(balance_amount) || 0,
      notes.trim(),
      paper_format,
      req.user?.id || 1
    );

    logAudit(
      req.user?.id || 1,
      req.user?.email || 'kids@udhayam.com',
      req.user?.role || 'admin',
      'CREATE_RECEIPT',
      'RECEIPT',
      result.lastInsertRowid,
      `Created receipt ${receipt_number} for ${customer_name} (Rs. ${parsedPaid})`
    );

    const created = db.prepare('SELECT * FROM customer_receipts WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ success: true, receipt: created });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/receipts/:id/pdf - Stream PDF for receipt
router.get('/:id/pdf', async (req, res) => {
  try {
    const receipt = db.prepare('SELECT * FROM customer_receipts WHERE id = ?').get(req.params.id);
    if (!receipt) {
      return res.status(404).json({ error: 'Receipt not found' });
    }

    const settingsRows = db.prepare('SELECT key, value FROM settings').all();
    const settings = {};
    settingsRows.forEach(r => settings[r.key] = r.value);

    const format = req.query.format || receipt.paper_format || 'A4';
    receipt.paper_format = format;

    const filename = getReceiptPdfFilename(receipt.customer_name, receipt.receipt_number);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);

    await generateReceiptPdf(receipt, settings, res);
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
});

// DELETE /api/receipts/:id - Delete receipt (admin only)
router.delete('/:id', requireAdmin, (req, res) => {
  try {
    const receipt = db.prepare('SELECT * FROM customer_receipts WHERE id = ?').get(req.params.id);
    if (!receipt) {
      return res.status(404).json({ error: 'Receipt not found' });
    }

    db.prepare('DELETE FROM customer_receipts WHERE id = ?').run(req.params.id);

    logAudit(
      req.user?.id || 1,
      req.user?.email || 'kids@udhayam.com',
      req.user?.role || 'admin',
      'DELETE_RECEIPT',
      'RECEIPT',
      req.params.id,
      `Deleted receipt ${receipt.receipt_number}`
    );

    res.json({ success: true, message: 'Receipt deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
