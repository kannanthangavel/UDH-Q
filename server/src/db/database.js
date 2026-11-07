const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { hashPassword } = require('../utils/security');

const isVercel = process.env.VERCEL === '1' || process.env.VERCEL === true || Boolean(process.env.VERCEL);
const dbDir = isVercel ? '/tmp/storage' : path.join(__dirname, '../../storage');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const bundledDb = path.join(__dirname, '../../storage/ud_qm.sqlite');
const dbPath = isVercel ? path.join(dbDir, 'ud_qm.sqlite') : bundledDb;

if (isVercel && !fs.existsSync(dbPath) && fs.existsSync(bundledDb)) {
  try {
    fs.copyFileSync(bundledDb, dbPath);
  } catch (err) {
    console.warn('[DB] Failed copying bundled sqlite to /tmp:', err);
  }
}

const db = new Database(dbPath);

// Enable WAL mode and foreign keys for high performance and integrity
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initDb() {
  db.exec(`
    -- Users Table
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'staff')),
      avatar_url TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- User Sessions Table
    CREATE TABLE IF NOT EXISTS user_sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Settings Table
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Customers Table
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT,
      address TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Products Table
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      s_no INTEGER,
      item_name TEXT NOT NULL,
      details TEXT DEFAULT '',
      sale_rate REAL NOT NULL,
      dpl REAL DEFAULT 0,
      purc_rate REAL DEFAULT 0,
      hsn_sac TEXT DEFAULT '',
      main_unit TEXT DEFAULT 'Nos',
      cost REAL DEFAULT 0,
      section TEXT NOT NULL CHECK (section IN ('PAINTS', 'ACCESS')),
      source_filename TEXT,
      import_timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      is_active INTEGER DEFAULT 1
    );

    -- Quotations Table
    CREATE TABLE IF NOT EXISTS quotations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quotation_number TEXT UNIQUE NOT NULL,
      customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      customer_email TEXT,
      customer_address TEXT,
      created_by TEXT NOT NULL DEFAULT 'Admin',
      quotation_date TEXT NOT NULL,
      validity_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Created' CHECK (status IN ('Draft', 'Created', 'Shared', 'Accepted', 'Rejected', 'Expired')),
      subtotal REAL NOT NULL DEFAULT 0,
      discount_percent REAL NOT NULL DEFAULT 0,
      discount_amount REAL NOT NULL DEFAULT 0,
      gst_rate REAL NOT NULL DEFAULT 18,
      gst_amount REAL NOT NULL DEFAULT 0,
      delivery_charges REAL NOT NULL DEFAULT 0,
      grand_total REAL NOT NULL DEFAULT 0,
      paper_format TEXT NOT NULL DEFAULT 'A4' CHECK (paper_format IN ('A4', 'A5')),
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Quotation Items Table
    CREATE TABLE IF NOT EXISTS quotation_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quotation_id INTEGER NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
      product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
      item_name TEXT NOT NULL,
      details TEXT DEFAULT '',
      hsn_sac TEXT DEFAULT '',
      unit TEXT DEFAULT 'Nos',
      quantity REAL NOT NULL DEFAULT 1,
      sale_rate REAL NOT NULL,
      line_total REAL NOT NULL,
      is_price_overridden INTEGER DEFAULT 0,
      original_sale_rate REAL
    );

    -- Import History Table
    CREATE TABLE IF NOT EXISTS import_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      file_hash TEXT,
      imported_by TEXT NOT NULL DEFAULT 'Admin',
      import_timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      rows_processed INTEGER NOT NULL DEFAULT 0,
      rows_imported INTEGER NOT NULL DEFAULT 0,
      rows_skipped INTEGER NOT NULL DEFAULT 0,
      section_summary TEXT
    );

    -- Audit Logs Table
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      user_email TEXT,
      user_role TEXT,
      action TEXT NOT NULL,
      entity TEXT NOT NULL,
      entity_id TEXT,
      details TEXT,
      timestamp TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Quotation Sequence Table for Atomic Numbering
    CREATE TABLE IF NOT EXISTS quotation_sequences (
      year INTEGER PRIMARY KEY,
      current_sequence INTEGER NOT NULL DEFAULT 0
    );

    -- Performance Indices
    CREATE INDEX IF NOT EXISTS idx_products_search ON products(item_name, hsn_sac);
    CREATE INDEX IF NOT EXISTS idx_products_section ON products(section);
    CREATE INDEX IF NOT EXISTS idx_quotations_customer ON quotations(customer_id);
    CREATE INDEX IF NOT EXISTS idx_quotations_status ON quotations(status);
    CREATE INDEX IF NOT EXISTS idx_quotations_created ON quotations(created_at);
    CREATE INDEX IF NOT EXISTS idx_quotation_items_quote ON quotation_items(quotation_id);
    CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp);
  `);

  try {
    db.exec("ALTER TABLE quotation_items ADD COLUMN details TEXT DEFAULT ''");
  } catch (e) {}

  seedInitialData();
}

function seedInitialData() {
  // 1. Seed Single User: Username 'Kids' / Password '22499'
  const existingKids = db.prepare('SELECT id FROM users WHERE name = ? OR email = ?').get('Kids', 'kids@udhayam.com');
  if (!existingKids) {
    db.prepare('DELETE FROM users').run(); // Clean old users
    const insertUser = db.prepare(`
      INSERT INTO users (name, email, password_hash, role)
      VALUES (?, ?, ?, ?)
    `);
    insertUser.run('Kids', 'kids@udhayam.com', hashPassword('22499'), 'admin');
  } else {
    // Ensure password is reset to 22499
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword('22499'), existingKids.id);
  }

  // 2. Seed Settings
  const defaultSettings = [
    ['company_name', 'UDHAYAM AGENCIES'],
    ['company_division', 'Paint Division Quotation Management'],
    ['company_tagline', 'Authorised Dealer in All Reputed Brands of Paints & Accessories'],
    ['company_address', '41/10, KMR Complex, Old Bus Stand Road, Perundurai, Erode - 638052'],
    ['company_phone', '+91 97156 22499'],
    ['company_phone_secondary', '+91 88700 22499'],
    ['company_email', 'udhayamagencies2013@gmail.com'],
    ['company_gstin', '33AADFU6496M1ZJ'],
    ['company_logo', 'udhayam_logo.png'],
    ['payment_qr_code', 'default_upi_qr.png'],
    ['bank_name', 'Indian Bank'],
    ['bank_branch', 'Perundurai'],
    ['bank_account_name', 'Udhayam Agencies'],
    ['bank_account_no', '6659330152'],
    ['bank_ifsc', 'IDIB000P034'],
    ['gpay_number', '+91 97156 22499 (MS Udhayam Agencies)'],
    ['default_paper_format', 'A4'],
    ['default_validity_days', '7'],
    ['default_gst_rate', '18'],
    ['default_delivery_terms', 'Ex-Shop / Standard Local Delivery'],
    ['default_payment_terms', 'Immediate / Payment Against Delivery'],
    ['default_terms', '1. Quotation is valid for 7 days from the date of issue.\n2. Goods once sold/dispatched will not be taken back.\n3. Delivery subject to physical stock availability.\n4. GST and Transport charges applicable as mentioned.']
  ];

  const getSetting = db.prepare('SELECT value FROM settings WHERE key = ?');
  const insertSetting = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');

  for (const [key, value] of defaultSettings) {
    const existing = getSetting.get(key);
    if (!existing) {
      insertSetting.run(key, value);
    }
  }

  // 3. Seed Customers
  const customerCount = db.prepare('SELECT COUNT(*) as count FROM customers').get().count;
  if (customerCount === 0) {
    const insertCustomer = db.prepare(`
      INSERT INTO customers (name, phone, email, address)
      VALUES (?, ?, ?, ?)
    `);
    insertCustomer.run('Karthik Builders', '+91 98427 11223', 'karthik.builders@gmail.com', 'Site 44, Perundurai SIPCOT Road, Erode');
    insertCustomer.run('Murali Decorators & Painters', '+91 94432 55667', 'murali.paints@yahoo.com', '12 Nehru Street, Perundurai');
    insertCustomer.run('Sri Ramakrishna Engineering Works', '+91 97880 33445', 'sre.works@gmail.com', 'Kavundapadi Road, Erode');
  }

  // 4. Seed Products if empty from official rates file
  const productCount = db.prepare('SELECT COUNT(*) as count FROM products').get().count;
  if (productCount === 0) {
    seedProductsFromOfficialFile();
  }
}

function seedProductsFromOfficialFile() {
  const rateFilePath = path.join(__dirname, '../../storage/uploads/rates/4. RATES [04.11.2026].xlsx');
  if (!fs.existsSync(rateFilePath)) {
    console.log('[DB] No seed rate sheet found at', rateFilePath);
    return;
  }

  try {
    const xlsx = require('xlsx');
    const wb = xlsx.readFile(rateFilePath);
    const insertProduct = db.prepare(`
      INSERT INTO products (s_no, item_name, details, sale_rate, dpl, purc_rate, hsn_sac, main_unit, cost, section, source_filename, import_timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);

    let totalImported = 0;
    const summary = {};

    const transaction = db.transaction(() => {
      for (const sheetName of wb.SheetNames) {
        let section = null;
        if (sheetName.toUpperCase().includes('PAINT')) section = 'PAINTS';
        else if (sheetName.toUpperCase().includes('ACCESS')) section = 'ACCESS';
        if (!section) continue;

        const rows = xlsx.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1 });
        let headerRowIdx = -1;
        for (let i = 0; i < Math.min(15, rows.length); i++) {
          const row = rows[i] || [];
          const str = row.map(c => String(c || '').trim().toLowerCase()).join(' | ');
          if (str.includes('item name') && (str.includes('sale rate') || str.includes('sales rate'))) {
            headerRowIdx = i;
            break;
          }
        }

        if (headerRowIdx === -1) continue;

        let sheetCount = 0;
        for (let r = headerRowIdx + 1; r < rows.length; r++) {
          const row = rows[r];
          if (!row || !row.length) continue;
          const itemName = String(row[1] || '').trim();
          if (!itemName) continue;

          const sNo = parseInt(row[0], 10) || (sheetCount + 1);
          const saleRate = parseFloat(row[2]) || 0;
          const dpl = parseFloat(row[3]) || 0;
          const purcRate = parseFloat(row[4]) || 0;
          const hsnSac = String(row[5] || '').trim();
          const mainUnit = String(row[6] || 'Nos').trim();
          const cost = parseFloat(row[7]) || 0;

          insertProduct.run(
            sNo,
            itemName,
            '', // details (only if present in source data)
            saleRate,
            dpl,
            purcRate,
            hsnSac,
            mainUnit,
            cost,
            section,
            '4. RATES [04.11.2026].xlsx'
          );
          sheetCount++;
        }
        summary[section] = sheetCount;
        totalImported += sheetCount;
      }

      // Record in import_history
      db.prepare(`
        INSERT INTO import_history (filename, file_hash, imported_by, rows_processed, rows_imported, rows_skipped, section_summary)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        '4. RATES [04.11.2026].xlsx',
        'initial_seed',
        'System Seed',
        totalImported,
        totalImported,
        0,
        JSON.stringify(summary)
      );

      // Record in audit_logs
      db.prepare(`
        INSERT INTO audit_logs (user_id, user_email, user_role, action, entity, entity_id, details)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        1,
        'admin@udhayam.com',
        'admin',
        'SEED_PRODUCTS',
        'IMPORT',
        '1',
        `Auto-seeded ${totalImported} products from official rate sheet`
      );
    });

    transaction();
    console.log(`[DB] Successfully seeded ${totalImported} products:`, summary);
  } catch (err) {
    console.error('[DB] Error auto-seeding products:', err);
  }
}

// Atomic quotation number generator: UDQ-YYYY-000001
function getNextQuotationNumber() {
  const currentYear = new Date().getFullYear();
  const getSeq = db.prepare('SELECT current_sequence FROM quotation_sequences WHERE year = ?');
  const updateSeq = db.prepare(`
    INSERT INTO quotation_sequences (year, current_sequence)
    VALUES (?, 1)
    ON CONFLICT(year) DO UPDATE SET current_sequence = current_sequence + 1
    RETURNING current_sequence
  `);

  const result = updateSeq.get(currentYear);
  const sequenceNum = String(result.current_sequence).padStart(6, '0');
  return `UDQ-${currentYear}-${sequenceNum}`;
}

// Log audit action helper
function logAudit(userId, userEmail, userRole, action, entity, entityId, details) {
  try {
    db.prepare(`
      INSERT INTO audit_logs (user_id, user_email, user_role, action, entity, entity_id, details)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(userId, userEmail, userRole, action, entity, String(entityId || ''), typeof details === 'object' ? JSON.stringify(details) : String(details || ''));
  } catch (err) {
    console.error('[AUDIT ERROR]', err);
  }
}

initDb();

module.exports = {
  db,
  getNextQuotationNumber,
  logAudit
};
