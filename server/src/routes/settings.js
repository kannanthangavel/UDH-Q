const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { db, logAudit } = require('../db/database');
const { requireAdmin } = require('../middleware/auth');

// Multer storage for logo / company profile image upload
const logoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../storage/uploads/logos');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `company_logo_${Date.now()}${ext}`;
    cb(null, uniqueName);
  }
});

const uploadLogo = multer({
  storage: logoStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    const allowedExts = ['.png', '.jpg', '.jpeg', '.webp', '.svg'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only PNG, JPG, WEBP, and SVG image files are allowed.'));
    }
  }
});

// Multer storage for manual UPI payment QR code upload
const qrStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../storage/uploads/qr');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `payment_qr_${Date.now()}${ext}`;
    cb(null, uniqueName);
  }
});

const uploadQr = multer({
  storage: qrStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedExts = ['.png', '.jpg', '.jpeg', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only PNG, JPG, and WEBP image files are allowed for payment QR codes.'));
    }
  }
});

// GET /api/settings - Get all application settings
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = {};
  rows.forEach(r => settings[r.key] = r.value);
  res.json({ settings });
});

// POST /api/settings - Update application settings (Admin only)
router.post('/', requireAdmin, (req, res) => {
  const updates = req.body;
  if (!updates || typeof updates !== 'object') {
    return res.status(400).json({ error: 'Settings object required' });
  }

  const upsert = db.prepare(`
    INSERT INTO settings (key, value, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
  `);

  const transaction = db.transaction(() => {
    for (const [key, value] of Object.entries(updates)) {
      upsert.run(key, String(value ?? ''));
    }

    logAudit(
      req.user?.id || 1,
      req.user?.email || 'kids@udhayam.com',
      req.user?.role || 'admin',
      'UPDATE_SETTINGS',
      'SETTINGS',
      'general',
      `Updated settings: ${Object.keys(updates).join(', ')}`
    );
  });

  transaction();

  // Return full updated settings
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = {};
  rows.forEach(r => settings[r.key] = r.value);

  res.json({ success: true, settings, message: 'Settings updated successfully' });
});

// POST /api/settings/logo - Upload company logo / profile image
router.post('/logo', requireAdmin, uploadLogo.single('logo'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Please choose an image file to upload.' });
  }

  const filename = req.file.filename;

  db.prepare(`
    INSERT INTO settings (key, value, updated_at)
    VALUES ('company_logo', ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
  `).run(filename);

  logAudit(
    req.user?.id || 1,
    req.user?.email || 'kids@udhayam.com',
    req.user?.role || 'admin',
    'UPLOAD_LOGO',
    'SETTINGS',
    'logo',
    `Uploaded new company logo: ${filename}`
  );

  res.json({
    success: true,
    filename,
    url: `/uploads/logos/${filename}`,
    message: 'Company logo uploaded and updated successfully'
  });
});

// DELETE /api/settings/logo - Reset to official default logo
router.delete('/logo', requireAdmin, (req, res) => {
  db.prepare(`
    UPDATE settings SET value = 'udhayam_logo.png', updated_at = datetime('now')
    WHERE key = 'company_logo'
  `).run();

  logAudit(
    req.user?.id || 1,
    req.user?.email || 'kids@udhayam.com',
    req.user?.role || 'admin',
    'RESET_LOGO',
    'SETTINGS',
    'logo',
    'Reset company logo to default udhayam_logo.png'
  );

  res.json({
    success: true,
    filename: 'udhayam_logo.png',
    url: '/uploads/logos/udhayam_logo.png',
    message: 'Reset to default official Udhayam Agencies logo'
  });
});

// POST /api/settings/qr-code - Upload manual payment UPI QR code image
router.post('/qr-code', requireAdmin, uploadQr.single('qr_code'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Please choose a QR code image file to upload.' });
  }

  const filename = req.file.filename;

  db.prepare(`
    INSERT INTO settings (key, value, updated_at)
    VALUES ('payment_qr_code', ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
  `).run(filename);

  logAudit(
    req.user?.id || 1,
    req.user?.email || 'kids@udhayam.com',
    req.user?.role || 'admin',
    'UPLOAD_QR_CODE',
    'SETTINGS',
    'qr_code',
    `Uploaded manual payment UPI QR code: ${filename}`
  );

  res.json({
    success: true,
    filename,
    url: `/uploads/qr/${filename}`,
    message: 'Payment UPI QR code uploaded and attached successfully'
  });
});

// DELETE /api/settings/qr-code - Reset to default generated UPI QR code
router.delete('/qr-code', requireAdmin, (req, res) => {
  db.prepare(`
    INSERT INTO settings (key, value, updated_at)
    VALUES ('payment_qr_code', 'default_upi_qr.png', datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = 'default_upi_qr.png', updated_at = datetime('now')
  `).run();

  logAudit(
    req.user?.id || 1,
    req.user?.email || 'kids@udhayam.com',
    req.user?.role || 'admin',
    'RESET_QR_CODE',
    'SETTINGS',
    'qr_code',
    'Reset payment QR code to default'
  );

  res.json({
    success: true,
    filename: 'default_upi_qr.png',
    url: '/uploads/qr/default_upi_qr.png',
    message: 'Reset payment QR code to default UPI QR'
  });
});

module.exports = router;
