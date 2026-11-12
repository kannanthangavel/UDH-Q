const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { parseWorkbook, commitImport } = require('../services/excelService');
const { invalidateProductCache } = require('../services/productSearchService');
const { requireAdmin } = require('../middleware/auth');
const { db, logAudit } = require('../db/database');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.xlsx' || ext === '.xls' || ext === '.csv') {
      cb(null, true);
    } else {
      cb(new Error('Only .xlsx, .xls, and .csv files are supported.'));
    }
  }
});

// Cache for parsed preview data (keyed by temporary preview ID or filename)
const previewCache = new Map();

// POST /api/imports/preview
router.post('/preview', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Please select an Excel or CSV rate sheet file to upload.' });
  }

  try {
    const parsed = parseWorkbook(req.file.buffer, req.file.originalname);
    const previewId = 'prev_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
    previewCache.set(previewId, { ...parsed, buffer: req.file.buffer });

    // Clean old preview cache entries
    if (previewCache.size > 20) {
      const firstKey = previewCache.keys().next().value;
      previewCache.delete(firstKey);
    }

    res.json({
      previewId,
      filename: parsed.filename,
      fileHash: parsed.fileHash,
      sheetsFound: parsed.sheetsFound,
      sections: {
        PAINTS: parsed.sections.PAINTS ? {
          sheetName: parsed.sections.PAINTS.sheetName,
          itemCount: parsed.sections.PAINTS.itemCount,
          preview: parsed.sections.PAINTS.preview,
          headers: parsed.sections.PAINTS.headers
        } : null,
        ACCESS: parsed.sections.ACCESS ? {
          sheetName: parsed.sections.ACCESS.sheetName,
          itemCount: parsed.sections.ACCESS.itemCount,
          preview: parsed.sections.ACCESS.preview,
          headers: parsed.sections.ACCESS.headers
        } : null
      },
      totalRows: parsed.totalRows,
      validRows: parsed.validRows,
      errors: parsed.errors,
      warnings: parsed.warnings,
      isDuplicate: parsed.isDuplicate,
      previousImport: parsed.previousImport
    });
  } catch (err) {
    console.error('Preview error:', err);
    res.status(400).json({ error: 'Failed to parse workbook: ' + err.message });
  }
});

// POST /api/imports/commit (Admin only)
router.post('/commit', requireAdmin, (req, res) => {
  const { previewId } = req.body;
  if (!previewId || !previewCache.has(previewId)) {
    return res.status(400).json({ error: 'Preview session expired or not found. Please upload the file again.' });
  }

  const parsedData = previewCache.get(previewId);

  try {
    const result = commitImport(parsedData, req.user);
    invalidateProductCache();
    previewCache.delete(previewId);
    res.json(result);
  } catch (err) {
    console.error('Commit error:', err);
    res.status(500).json({ error: 'Failed to import rate sheet: ' + err.message });
  }
});

// GET /api/imports/history
router.get('/history', (req, res) => {
  const history = db.prepare('SELECT * FROM import_history ORDER BY id DESC LIMIT 50').all();
  res.json({ history });
});

// POST /api/imports/seed-official (Admin only: Quick re-seed from official rates file)
router.post('/seed-official', requireAdmin, (req, res) => {
  const rateFilePath = path.join(__dirname, '../../storage/uploads/rates/4. RATES [04.11.2026].xlsx');
  if (!fs.existsSync(rateFilePath)) {
    return res.status(404).json({ error: 'Official rate sheet file not found on server.' });
  }

  try {
    const buffer = fs.readFileSync(rateFilePath);
    const parsed = parseWorkbook(buffer, '4. RATES [04.11.2026].xlsx');
    const result = commitImport(parsed, req.user);
    invalidateProductCache();
    res.json({ success: true, message: 'Official rate sheet imported successfully!', ...result });
  } catch (err) {
    res.status(500).json({ error: 'Failed to seed official rates: ' + err.message });
  }
});

module.exports = router;
