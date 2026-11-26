const express = require('express');
const router = express.Router();
const { db } = require('../db/database');
const { generateQuotationPdf } = require('../services/pdfService');
const { generateReceiptPdf } = require('../services/receiptPdfService');
const { getQuotationPdfFilename, getReceiptPdfFilename } = require('../utils/filenameHelper');

// GET /download/quote/:identifier - Quick direct link for quotation PDF
router.get('/quote/:identifier', async (req, res) => {
  try {
    const ident = req.params.identifier;
    let quote = null;

    if (/^\d+$/.test(ident)) {
      quote = db.prepare('SELECT * FROM quotations WHERE id = ? OR quotation_number = ?').get(parseInt(ident, 10), ident);
    }
    if (!quote) {
      quote = db.prepare('SELECT * FROM quotations WHERE quotation_number = ?').get(ident);
    }

    if (!quote) {
      return res.status(404).send('Quotation document not found');
    }

    const items = db.prepare('SELECT * FROM quotation_items WHERE quotation_id = ? ORDER BY id ASC').all(quote.id);
    const quotationData = { ...quote, items };

    if (req.query.format) {
      quotationData.paper_format = req.query.format.toUpperCase() === 'A5' ? 'A5' : 'A4';
    }

    const settingsRows = db.prepare('SELECT key, value FROM settings').all();
    const settings = {};
    settingsRows.forEach(r => settings[r.key] = r.value);

    const filename = getQuotationPdfFilename(quote.customer_name, quote.quotation_number);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);

    await generateQuotationPdf(quotationData, settings, res);
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).send(`Failed to generate quotation PDF: ${err.message}`);
    }
  }
});

// GET /download/receipt/:identifier - Quick direct link for receipt PDF
router.get('/receipt/:identifier', async (req, res) => {
  try {
    const ident = req.params.identifier;
    let receipt = null;

    if (/^\d+$/.test(ident)) {
      receipt = db.prepare('SELECT * FROM customer_receipts WHERE id = ? OR receipt_number = ?').get(parseInt(ident, 10), ident);
    }
    if (!receipt) {
      receipt = db.prepare('SELECT * FROM customer_receipts WHERE receipt_number = ?').get(ident);
    }

    if (!receipt) {
      return res.status(404).send('Payment receipt document not found');
    }

    const settingsRows = db.prepare('SELECT key, value FROM settings').all();
    const settings = {};
    settingsRows.forEach(r => settings[r.key] = r.value);

    if (req.query.format) {
      receipt.paper_format = req.query.format.toUpperCase() === 'A5' ? 'A5' : 'A4';
    }

    const filename = getReceiptPdfFilename(receipt.customer_name, receipt.receipt_number);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);

    await generateReceiptPdf(receipt, settings, res);
  } catch (err) {
    res.status(500).send(`Failed to generate receipt PDF: ${err.message}`);
  }
});

module.exports = router;
