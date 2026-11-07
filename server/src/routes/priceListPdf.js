const express = require('express');
const router = express.Router();
const { db } = require('../db/database');
const { generatePriceListPdf } = require('../services/pdfService');

// GET /api/price-list/pdf
router.get('/pdf', (req, res) => {
  const { section = 'combined', format = 'a4', download = 'false' } = req.query;
  const paperFormat = format.toUpperCase() === 'A5' ? 'A5' : 'A4';
  const sec = section.toLowerCase();

  let sql = 'SELECT s_no, item_name, details, sale_rate, main_unit, hsn_sac FROM products WHERE is_active = 1';
  let sectionTitle = 'ALL PRODUCTS (PAINTS & ACCESSORIES)';

  if (sec === 'paints') {
    sql += " AND section = 'PAINTS'";
    sectionTitle = 'PAINTS SECTION';
  } else if (sec === 'access' || sec === 'accessories') {
    sql += " AND section = 'ACCESS'";
    sectionTitle = 'ACCESSORIES SECTION';
  }

  sql += ' ORDER BY section DESC, s_no ASC, id ASC';
  const products = db.prepare(sql).all();

  // Load current settings
  const settingsRows = db.prepare('SELECT key, value FROM settings').all();
  const settings = {};
  settingsRows.forEach(r => settings[r.key] = r.value);

  const filename = `UD-QM-PriceList-${sec.toUpperCase()}-${paperFormat}.pdf`;
  const disposition = download === 'true' ? 'attachment' : 'inline';

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `${disposition}; filename="${filename}"`);

  generatePriceListPdf(products, sectionTitle, paperFormat, settings, res);
});

module.exports = router;
