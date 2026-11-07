const express = require('express');
const router = express.Router();
const { db } = require('../db/database');

// GET /api/dashboard - Dashboard summary metrics
router.get('/', (req, res) => {
  // Quotation metrics
  const totalQuotes = db.prepare('SELECT COUNT(*) as count, COALESCE(SUM(grand_total), 0) as total_val FROM quotations').get();
  const pendingQuotes = db.prepare("SELECT COUNT(*) as count, COALESCE(SUM(grand_total), 0) as total_val FROM quotations WHERE status IN ('Created', 'Draft', 'Shared')").get();
  const acceptedQuotes = db.prepare("SELECT COUNT(*) as count, COALESCE(SUM(grand_total), 0) as total_val FROM quotations WHERE status = 'Accepted'").get();

  // Product counts
  const totalProducts = db.prepare('SELECT COUNT(*) as count FROM products WHERE is_active = 1').get().count;
  const paintProducts = db.prepare("SELECT COUNT(*) as count FROM products WHERE is_active = 1 AND section = 'PAINTS'").get().count;
  const accessProducts = db.prepare("SELECT COUNT(*) as count FROM products WHERE is_active = 1 AND section = 'ACCESS'").get().count;

  // Recent quotations (last 8)
  const recentQuotations = db.prepare(`
    SELECT id, quotation_number, customer_name, customer_phone, quotation_date, grand_total, status, paper_format, created_by
    FROM quotations
    ORDER BY id DESC
    LIMIT 8
  `).all();

  // Customer count
  const customerCount = db.prepare('SELECT COUNT(*) as count FROM customers').get().count;

  // Latest Rate Sheet Import
  const latestImport = db.prepare('SELECT filename, imported_by, import_timestamp, rows_imported FROM import_history ORDER BY id DESC LIMIT 1').get();

  res.json({
    metrics: {
      totalQuotations: totalQuotes.count,
      totalQuotationValue: totalQuotes.total_val,
      pendingQuotations: pendingQuotes.count,
      pendingValue: pendingQuotes.total_val,
      acceptedQuotations: acceptedQuotes.count,
      acceptedValue: acceptedQuotes.total_val,
      totalProducts,
      paintProducts,
      accessProducts,
      customerCount
    },
    latestImport,
    recentQuotations
  });
});

module.exports = router;
