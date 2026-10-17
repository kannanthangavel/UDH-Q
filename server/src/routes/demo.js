const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx');
const { db, storageDir } = require('../db/database');

/**
 * GET /api/demo/sample-excel
 * Downloads a ready-to-test sample Excel workbook in the Udhayam format
 */
router.get('/sample-excel', (req, res) => {
  try {
    const sampleFilePath = path.join(storageDir, 'SAMPLE_UDHAYAM_PRICE_LIST.xlsx');

    const sampleData = [
      {
        'Product Name': 'As EN golden Brown 1lt',
        'Details': '1 Litre Enamel Paint Golden Brown',
        'HSN Code': '92030111',
        'Unit': '1Nos',
        'Sales Rate': 290.00,
        'Purchase rate': 240.00
      },
      {
        'Product Name': 'OPC 53 Grade Cement',
        'Details': '53 Grade Ordinary Portland Cement',
        'HSN Code': '25232910',
        'Unit': 'bags',
        'Sales Rate': 385.00,
        'Purchase rate': 345.00
      },
      {
        'Product Name': '12mm TMT Steel Rods',
        'Details': '12mm Fe 550D High Strength Steel Bar',
        'HSN Code': '72142090',
        'Unit': 'nos',
        'Sales Rate': 640.00,
        'Purchase rate': 580.00
      },
      {
        'Product Name': '10mm TMT Steel Rods',
        'Details': '10mm Fe 550D High Strength Steel Bar',
        'HSN Code': '72142090',
        'Unit': 'nos',
        'Sales Rate': 450.00,
        'Purchase rate': 410.00
      },
      {
        'Product Name': 'Asian Paints Apex White 20L',
        'Details': '20 Litre Weatherproof Exterior Emulsion',
        'HSN Code': '32091000',
        'Unit': 'buckets',
        'Sales Rate': 3450.00,
        'Purchase rate': 3050.00
      },
      {
        'Product Name': 'Asian Paints Tractor Emulsion 5L',
        'Details': '5 Litre Interior Acrylic Emulsion',
        'HSN Code': '32091000',
        'Unit': 'buckets',
        'Sales Rate': 820.00,
        'Purchase rate': 720.00
      },
      {
        'Product Name': 'Dr. Fixit Pidiproof LW+ 1L',
        'Details': '1 Litre Integral Liquid Waterproofing Compound',
        'HSN Code': '38244090',
        'Unit': 'nos',
        'Sales Rate': 160.00,
        'Purchase rate': 135.00
      },
      {
        'Product Name': 'Birla White Wall Care Putty 40kg',
        'Details': '40 kg White Cement Putty Bag',
        'HSN Code': '32141000',
        'Unit': 'bags',
        'Sales Rate': 880.00,
        'Purchase rate': 795.00
      },
      {
        'Product Name': 'Finolex PVC Pipe 4 inch 6kg',
        'Details': '4 Inch Rigid PVC Conduit 6kg/cm2',
        'HSN Code': '39172300',
        'Unit': 'pieces',
        'Sales Rate': 420.00,
        'Purchase rate': 370.00
      },
      {
        'Product Name': 'Finolex 2.5 sq mm Wire 90m',
        'Details': '90 Meter Flame Retardant Copper Wire',
        'HSN Code': '85444990',
        'Unit': 'box',
        'Sales Rate': 2150.00,
        'Purchase rate': 1920.00
      }
    ];

    const worksheet = xlsx.utils.json_to_sheet(sampleData);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'PriceList');

    xlsx.writeFile(workbook, sampleFilePath);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="SAMPLE_UDHAYAM_PRICE_LIST.xlsx"');
    const stream = fs.createReadStream(sampleFilePath);
    stream.pipe(res);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/demo/reset
 * Resets the demo price list and clears test quotations if requested
 */
router.post('/reset', (req, res) => {
  try {
    const { clearQuotations } = req.body;
    const now = new Date().toISOString();

    const tx = db.transaction(() => {
      // Find or activate demo price list
      const demoPl = db.prepare('SELECT id FROM price_lists WHERE is_demo = 1 LIMIT 1').get();
      if (demoPl) {
        db.prepare('UPDATE price_lists SET is_active = 0').run();
        db.prepare('UPDATE price_lists SET is_active = 1 WHERE id = ?').run(demoPl.id);
      }

      if (clearQuotations) {
        db.prepare('DELETE FROM quotation_items').run();
        db.prepare('DELETE FROM quotations').run();
      }

      db.prepare(`
        INSERT INTO audit_logs (event_type, operator, outcome, details, metadata_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        'DEMO_DATA_RESET',
        'Operator',
        'success',
        `Demo mode reset performed.${clearQuotations ? ' Test quotations were cleared.' : ''}`,
        JSON.stringify({ clearQuotations: Boolean(clearQuotations) }),
        now
      );
    });

    tx();

    res.json({ success: true, message: 'Demo mode successfully reset.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
