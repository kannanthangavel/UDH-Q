const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { db, logosDir, snapshotsDir } = require('../db/database');

// Configure multer for logo uploads (PNG, JPG/JPEG, WebP, max 5MB)
const logoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, logosDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    const cleanExt = ['.png', '.jpg', '.jpeg', '.webp'].includes(ext) ? ext : '.png';
    cb(null, `company_logo_${Date.now()}${cleanExt}`);
  }
});

const uploadLogo = multer({
  storage: logoStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB limit
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (allowedMimes.includes(file.mimetype.toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('Invalid image format. Only PNG, JPG/JPEG, and WebP files are supported.'));
    }
  }
});

/**
 * GET /api/settings
 * Retrieves all company profile, bank, and quotation default settings
 */
router.get('/', (req, res) => {
  try {
    const rows = db.prepare('SELECT key, value, updated_at FROM settings').all();
    const settings = {};
    rows.forEach(r => {
      settings[r.key] = r.value;
    });

    // Provide logoUrl if company_logo is set
    if (settings.company_logo) {
      settings.logoUrl = `/api/settings/logo/${encodeURIComponent(settings.company_logo)}`;
    }

    res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/settings/company-logo
 * Uploads and sets official company logo
 */
router.post('/company-logo', (req, res) => {
  uploadLogo.single('logo')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Failed to upload logo.' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Please choose an image file to upload.' });
    }

    try {
      const filename = req.file.filename;
      const now = new Date().toISOString();

      // Upsert into settings table
      db.prepare(`
        INSERT INTO settings (key, value, updated_at)
        VALUES ('company_logo', ?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
      `).run(filename, now);

      db.prepare(`
        INSERT INTO audit_logs (event_type, operator, outcome, details, metadata_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        'COMPANY_LOGO_UPDATED',
        'Operator',
        'success',
        `Official company logo updated (${filename}, ${(req.file.size / 1024).toFixed(1)} KB).`,
        JSON.stringify({ filename, size: req.file.size, mimetype: req.file.mimetype }),
        now
      );

      res.json({
        success: true,
        message: 'Company logo uploaded and saved successfully.',
        filename,
        logoUrl: `/api/settings/logo/${encodeURIComponent(filename)}`
      });
    } catch (saveErr) {
      res.status(500).json({ error: saveErr.message || 'Failed to save company logo setting.' });
    }
  });
});

/**
 * DELETE /api/settings/company-logo
 * Removes official company logo
 */
router.delete('/company-logo', (req, res) => {
  try {
    const now = new Date().toISOString();
    const currentLogo = db.prepare("SELECT value FROM settings WHERE key = 'company_logo'").get();

    db.prepare("UPDATE settings SET value = '', updated_at = ? WHERE key = 'company_logo'").run(now);

    db.prepare(`
      INSERT INTO audit_logs (event_type, operator, outcome, details, metadata_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      'COMPANY_LOGO_REMOVED',
      'Operator',
      'success',
      'Official company logo removed.',
      JSON.stringify({ previousLogo: currentLogo?.value || '' }),
      now
    );

    res.json({ success: true, message: 'Company logo removed successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/settings/logo/:filename
 * Safely serves logo images from logosDir or snapshotsDir
 */
router.get('/logo/:filename', (req, res) => {
  try {
    const filename = path.basename(req.params.filename);
    const logoFile = path.join(logosDir, filename);
    const snapshotFile = path.join(snapshotsDir, filename);

    let targetPath = null;
    if (fs.existsSync(logoFile)) {
      targetPath = logoFile;
    } else if (fs.existsSync(snapshotFile)) {
      targetPath = snapshotFile;
    }

    if (!targetPath) {
      return res.status(404).send('Logo not found.');
    }

    const ext = path.extname(filename).toLowerCase();
    const mimeTypes = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp'
    };

    res.setHeader('Content-Type', mimeTypes[ext] || 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    fs.createReadStream(targetPath).pipe(res);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

/**
 * PUT /api/settings
 * Updates company profile, bank details, or quotation configuration
 */
router.put('/', (req, res) => {
  try {
    const newSettings = req.body;
    if (!newSettings || typeof newSettings !== 'object') {
      return res.status(400).json({ error: 'Settings object is required.' });
    }

    const now = new Date().toISOString();
    const upsert = db.prepare(`
      INSERT INTO settings (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `);

    const updateTx = db.transaction(() => {
      for (const [key, val] of Object.entries(newSettings)) {
        upsert.run(key, String(val !== undefined && val !== null ? val : ''), now);
      }

      db.prepare(`
        INSERT INTO audit_logs (event_type, operator, outcome, details, metadata_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        'SETTINGS_UPDATED',
        'Operator',
        'success',
        `Business and quotation settings updated (${Object.keys(newSettings).length} keys).`,
        JSON.stringify({ updatedKeys: Object.keys(newSettings) }),
        now
      );
    });

    updateTx();

    res.json({ success: true, message: 'Settings saved successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
