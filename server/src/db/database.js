const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const storageDir = path.join(__dirname, '..', '..', 'storage');
const uploadsDir = path.join(storageDir, 'uploads');
const pdfsDir = path.join(storageDir, 'pdfs');
const logosDir = path.join(uploadsDir, 'logos');
const snapshotsDir = path.join(uploadsDir, 'snapshots');

// Ensure storage directories exist
[storageDir, uploadsDir, pdfsDir, logosDir, snapshotsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const dbPath = path.join(storageDir, 'database.sqlite');
const db = new Database(dbPath);

// Enable foreign keys and WAL mode for better concurrency and durability
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS price_lists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      sheet_name TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      is_demo INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 0,
      imported_at TEXT NOT NULL,
      total_rows INTEGER DEFAULT 0,
      valid_products_count INTEGER DEFAULT 0,
      warnings_count INTEGER DEFAULT 0,
      column_mapping_json TEXT,
      metadata_json TEXT
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      price_list_id INTEGER NOT NULL REFERENCES price_lists(id) ON DELETE CASCADE,
      item_code TEXT,
      product_name TEXT NOT NULL,
      normalized_name TEXT NOT NULL,
      specification TEXT,
      brand TEXT,
      category TEXT,
      unit TEXT,
      sales_rate REAL,
      purchase_rate REAL,
      is_tax_inclusive INTEGER DEFAULT 1,
      gst_rate REAL DEFAULT 18,
      hsn_code TEXT,
      price_status TEXT DEFAULT 'verified',
      source_data_json TEXT,
      created_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_products_pricelist ON products(price_list_id);
    CREATE INDEX IF NOT EXISTS idx_products_name ON products(normalized_name);
    CREATE INDEX IF NOT EXISTS idx_products_code ON products(item_code);

    CREATE TABLE IF NOT EXISTS quotations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quotation_number TEXT UNIQUE NOT NULL,
      revision INTEGER DEFAULT 1,
      status TEXT DEFAULT 'draft',
      document_type TEXT DEFAULT 'gst_quotation',
      paper_size TEXT DEFAULT 'A5',
      customer_name TEXT,
      customer_phone TEXT,
      customer_company TEXT,
      customer_address TEXT,
      customer_gstin TEXT,
      reference_no TEXT,
      delivery_location TEXT,
      notes TEXT,
      validity_days INTEGER DEFAULT 7,
      payment_terms TEXT DEFAULT 'Immediate / Against Delivery',
      delivery_terms TEXT DEFAULT 'Ex-Shop / Standard Delivery',
      price_list_id INTEGER REFERENCES price_lists(id),
      subtotal REAL DEFAULT 0,
      discount_total REAL DEFAULT 0,
      taxable_amount REAL DEFAULT 0,
      tax_total REAL DEFAULT 0,
      delivery_charges REAL DEFAULT 0,
      other_charges REAL DEFAULT 0,
      grand_total REAL DEFAULT 0,
      amount_in_words TEXT,
      raw_whatsapp_message TEXT,
      pdf_filename TEXT,
      pdf_generated_at TEXT,
      is_stale_pdf INTEGER DEFAULT 0,
      whatsapp_status TEXT DEFAULT 'not_started',
      created_at TEXT,
      updated_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_quotations_number ON quotations(quotation_number);
    CREATE INDEX IF NOT EXISTS idx_quotations_status ON quotations(status);

    CREATE TABLE IF NOT EXISTS quotation_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quotation_id INTEGER NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
      row_order INTEGER DEFAULT 0,
      product_id INTEGER,
      item_code TEXT,
      product_name TEXT NOT NULL,
      specification TEXT,
      hsn_code TEXT,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      unit_price REAL NOT NULL,
      is_override_price INTEGER DEFAULT 0,
      override_reason TEXT,
      discount_percent REAL DEFAULT 0,
      discount_amount REAL DEFAULT 0,
      taxable_amount REAL DEFAULT 0,
      gst_rate REAL DEFAULT 18,
      gst_amount REAL DEFAULT 0,
      line_total REAL NOT NULL,
      match_status TEXT DEFAULT 'Exact Match',
      raw_query TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_items_quotation ON quotation_items(quotation_id);

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      quotation_id INTEGER,
      operator TEXT DEFAULT 'Operator',
      outcome TEXT DEFAULT 'success',
      details TEXT,
      metadata_json TEXT,
      created_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_logs(created_at);

    CREATE TABLE IF NOT EXISTS whatsapp_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider_message_id TEXT UNIQUE,
      sender_phone TEXT NOT NULL,
      sender_name TEXT,
      business_phone_id TEXT,
      message_type TEXT DEFAULT 'text',
      raw_content TEXT,
      media_id TEXT,
      media_mime_type TEXT,
      media_filename TEXT,
      intent TEXT DEFAULT 'new_quotation',
      conversation_id TEXT,
      quotation_id INTEGER REFERENCES quotations(id) ON DELETE SET NULL,
      processing_status TEXT DEFAULT 'received',
      unresolved_items_count INTEGER DEFAULT 0,
      extracted_json TEXT,
      error_message TEXT,
      received_at TEXT NOT NULL,
      processed_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_wa_provider_id ON whatsapp_messages(provider_message_id);
    CREATE INDEX IF NOT EXISTS idx_wa_sender ON whatsapp_messages(sender_phone);
    CREATE INDEX IF NOT EXISTS idx_wa_status ON whatsapp_messages(processing_status);

    CREATE TABLE IF NOT EXISTS processing_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_type TEXT NOT NULL,
      reference_id TEXT,
      status TEXT DEFAULT 'pending',
      payload_json TEXT,
      result_json TEXT,
      attempts INTEGER DEFAULT 0,
      max_attempts INTEGER DEFAULT 3,
      last_error TEXT,
      next_run_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_jobs_status ON processing_jobs(status);
    CREATE INDEX IF NOT EXISTS idx_jobs_type ON processing_jobs(job_type);

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      reference_type TEXT,
      reference_id INTEGER,
      is_read INTEGER DEFAULT 0,
      metadata_json TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_notif_read ON notifications(is_read);
    CREATE INDEX IF NOT EXISTS idx_notif_time ON notifications(created_at);
  `);

  // Safe schema migrations for quotations
  const migrationCols = [
    'ALTER TABLE quotations ADD COLUMN customer_email TEXT',
    "ALTER TABLE quotations ADD COLUMN logo_source TEXT DEFAULT 'default'",
    'ALTER TABLE quotations ADD COLUMN custom_logo_path TEXT',
    'ALTER TABLE quotations ADD COLUMN logo_snapshot_path TEXT',
    'ALTER TABLE quotations ADD COLUMN whatsapp_message_id INTEGER REFERENCES whatsapp_messages(id)',
    "ALTER TABLE quotations ADD COLUMN approval_status TEXT DEFAULT 'pending'",
    'ALTER TABLE quotations ADD COLUMN approved_by TEXT',
    'ALTER TABLE quotations ADD COLUMN approved_at TEXT',
    'ALTER TABLE quotations ADD COLUMN rejection_reason TEXT',
    'ALTER TABLE quotations ADD COLUMN outbound_wamid TEXT',
    "ALTER TABLE quotations ADD COLUMN delivery_status TEXT DEFAULT 'none'",
    'ALTER TABLE quotations ADD COLUMN delivery_error TEXT',
    'ALTER TABLE notifications ADD COLUMN quotation_id INTEGER'
  ];

  for (const sql of migrationCols) {
    try {
      db.prepare(sql).run();
    } catch (_) {}
  }

  seedDefaultSettings();
  seedDemoDataIfEmpty();
}

function seedDefaultSettings() {
  const getSetting = db.prepare('SELECT value FROM settings WHERE key = ?');
  const insertSetting = db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)');
  
  const now = new Date().toISOString();
  const defaults = {
    company_name: 'Udhayam Agencies',
    company_tagline: 'Building Materials & Hardware Supplies',
    company_address: '41/10, KMR Complex, Old Bus Stand Road,\nPerundurai - 638052',
    company_phone: '+91 97156 22499',
    company_phone_secondary: '+91 88700 22499',
    company_email: 'udhayamagencies2013@gmail.com',
    company_gstin: '33AADFU6496M1ZJ',
    bank_name: 'Indian Bank',
    bank_branch: 'Perundurai',
    bank_account_name: 'Udhayam Agencies',
    bank_account_no: '6659330152',
    bank_ifsc: 'IDIB000P034 (Perundurai Branch)',
    gpay_number: '+91 97156 22499 (MS Udhayam Agencies)',
    quote_prefix: 'UD',
    quote_sequence: '1',
    default_paper_size: 'A5',
    default_doc_type: 'gst_quotation',
    default_validity_days: '7',
    default_payment_terms: 'Immediate / Payment Against Delivery',
    default_delivery_terms: 'Ex-Shop / Standard Local Delivery',
    default_notes: '1. Quotation valid for 7 days from the date of issue.\n2. Goods once dispatched/sold cannot be returned.\n3. Delivery subject to physical stock availability.\n4. Subject to Perundurai jurisdiction only.',
    company_logo: '',
    whatsapp_integration_mode: 'demo',
    meta_waba_id: '',
    meta_phone_number_id: '',
    meta_business_phone: '+91 97156 22499',
    meta_access_token: '',
    meta_app_secret: '',
    meta_webhook_verify_token: 'udhayam_secure_webhook_token_2026',
    meta_api_version: 'v21.0',
    public_webhook_url: '',
    last_webhook_received_at: '',
    last_processed_message_at: '',
    last_integration_error: '',
    sound_notifications_enabled: 'true',
    smtp_host: '',
    smtp_port: '587',
    smtp_user: '',
    smtp_pass: '',
    smtp_secure: 'false',
    smtp_from: ''
  };

  const insertTx = db.transaction(() => {
    for (const [key, val] of Object.entries(defaults)) {
      const existing = getSetting.get(key);
      if (!existing) {
        insertSetting.run(key, val, now);
      }
    }
  });
  insertTx();
}

function seedDemoDataIfEmpty() {
  const count = db.prepare('SELECT COUNT(*) as count FROM price_lists').get().count;
  if (count > 0) return;

  const now = new Date().toISOString();
  const insertPriceList = db.prepare(`
    INSERT INTO price_lists (
      filename, sheet_name, version, is_demo, is_active, imported_at,
      total_rows, valid_products_count, warnings_count, column_mapping_json, metadata_json
    ) VALUES (?, ?, 1, 1, 1, ?, 10, 10, 0, ?, ?)
  `);

  const mapping = JSON.stringify({
    product_name: 'Product Name',
    specification: 'Details',
    hsn_code: 'HSN Code',
    sales_rate: 'Sales Rate',
    purchase_rate: 'Purchase rate',
    unit: 'Unit'
  });

  const metadata = JSON.stringify({
    source: 'Demonstration price list with fictional pricing'
  });

  const result = insertPriceList.run('UDHAYAM_DEMO_PRICELIST.xlsx', 'Sheet1', now, mapping, metadata);
  const priceListId = result.lastInsertRowid;

  const demoProducts = [
    {
      item_code: 'UD-PNT-01',
      product_name: 'As EN golden Brown 1lt',
      normalized_name: 'as en golden brown 1lt',
      specification: '1 Litre Golden Brown Enamel Paint',
      brand: 'Asian Paints',
      category: 'Paints & Enamel',
      unit: '1Nos',
      sales_rate: 290.00,
      purchase_rate: 245.00,
      is_tax_inclusive: 1,
      gst_rate: 18.0,
      hsn_code: '92030111',
      price_status: 'verified'
    },
    {
      item_code: 'UD-CMT-01',
      product_name: 'OPC 53 Grade Cement',
      normalized_name: 'opc 53 grade cement opc cement',
      specification: '53 Grade Ordinary Portland Cement',
      brand: 'UltraTech',
      category: 'Cement',
      unit: 'bags',
      sales_rate: 385.00,
      purchase_rate: 340.00,
      is_tax_inclusive: 1,
      gst_rate: 28.0,
      hsn_code: '25232910',
      price_status: 'verified'
    },
    {
      item_code: 'UD-STL-12',
      product_name: '12mm TMT Steel Rods Fe550D',
      normalized_name: '12mm tmt steel rods fe550d 12mm steel rods rod',
      specification: '12mm Thermo-Mechanically Treated Bars',
      brand: 'Tata Tiscon',
      category: 'Steel & TMT',
      unit: 'nos',
      sales_rate: 640.00,
      purchase_rate: 575.00,
      is_tax_inclusive: 1,
      gst_rate: 18.0,
      hsn_code: '72142090',
      price_status: 'verified'
    },
    {
      item_code: 'UD-STL-10',
      product_name: '10mm TMT Steel Rods Fe550D',
      normalized_name: '10mm tmt steel rods fe550d 10mm steel rods rod',
      specification: '10mm Thermo-Mechanically Treated Bars',
      brand: 'Tata Tiscon',
      category: 'Steel & TMT',
      unit: 'nos',
      sales_rate: 450.00,
      purchase_rate: 405.00,
      is_tax_inclusive: 1,
      gst_rate: 18.0,
      hsn_code: '72142090',
      price_status: 'verified'
    },
    {
      item_code: 'UD-PNT-20L',
      product_name: 'Asian Paints Apex Exterior White 20L Bucket',
      normalized_name: 'asian paints apex exterior white 20l bucket paint buckets',
      specification: '20 Litre Bucket Weatherproof Emulsion',
      brand: 'Asian Paints',
      category: 'Paints & Enamel',
      unit: 'buckets',
      sales_rate: 3450.00,
      purchase_rate: 3000.00,
      is_tax_inclusive: 1,
      gst_rate: 18.0,
      hsn_code: '32091000',
      price_status: 'verified'
    },
    {
      item_code: 'UD-PNT-05L',
      product_name: 'Asian Paints Tractor Emulsion 5L Bucket',
      normalized_name: 'asian paints tractor emulsion 5l bucket 5 paint buckets',
      specification: '5 Litre Interior Acrylic Emulsion',
      brand: 'Asian Paints',
      category: 'Paints & Enamel',
      unit: 'buckets',
      sales_rate: 820.00,
      purchase_rate: 710.00,
      is_tax_inclusive: 1,
      gst_rate: 18.0,
      hsn_code: '32091000',
      price_status: 'verified'
    },
    {
      item_code: 'UD-CHM-01',
      product_name: 'Dr. Fixit Pidiproof LW+ 1L',
      normalized_name: 'dr fixit pidiproof lw 1l waterproof chemical',
      specification: '1 Litre Integral Liquid Waterproofing',
      brand: 'Dr. Fixit',
      category: 'Construction Chemicals',
      unit: 'nos',
      sales_rate: 160.00,
      purchase_rate: 130.00,
      is_tax_inclusive: 1,
      gst_rate: 18.0,
      hsn_code: '38244090',
      price_status: 'verified'
    },
    {
      item_code: 'UD-PTY-40K',
      product_name: 'Birla White Wall Care Putty 40kg',
      normalized_name: 'birla white wall care putty 40kg bag',
      specification: '40 kg White Portland Cement-based Putty',
      brand: 'Birla White',
      category: 'Putty & Plaster',
      unit: 'bags',
      sales_rate: 880.00,
      purchase_rate: 790.00,
      is_tax_inclusive: 1,
      gst_rate: 18.0,
      hsn_code: '32141000',
      price_status: 'verified'
    },
    {
      item_code: 'UD-PVC-04',
      product_name: 'Finolex PVC Pipe 4 inch 6kg',
      normalized_name: 'finolex pvc pipe 4 inch 6kg pipe',
      specification: '4 inch 6 kg/cm2 Rigid PVC Conduit Pipe',
      brand: 'Finolex',
      category: 'Plumbing & Pipes',
      unit: 'pieces',
      sales_rate: 420.00,
      purchase_rate: 360.00,
      is_tax_inclusive: 1,
      gst_rate: 18.0,
      hsn_code: '39172300',
      price_status: 'verified'
    },
    {
      item_code: 'UD-WIR-25',
      product_name: 'Finolex 2.5 sq mm Flame Retardant Wire 90m',
      normalized_name: 'finolex 2.5 sq mm flame retardant wire 90m wire',
      specification: '90m Single Core Flexible Copper Cable',
      brand: 'Finolex',
      category: 'Electricals',
      unit: 'box',
      sales_rate: 2150.00,
      purchase_rate: 1890.00,
      is_tax_inclusive: 1,
      gst_rate: 18.0,
      hsn_code: '85444990',
      price_status: 'verified'
    }
  ];

  const insertProduct = db.prepare(`
    INSERT INTO products (
      price_list_id, item_code, product_name, normalized_name, specification,
      brand, category, unit, sales_rate, purchase_rate, is_tax_inclusive,
      gst_rate, hsn_code, price_status, source_data_json, created_at
    ) VALUES (
      ?, @item_code, @product_name, @normalized_name, @specification,
      @brand, @category, @unit, @sales_rate, @purchase_rate, @is_tax_inclusive,
      @gst_rate, @hsn_code, @price_status, @source_data_json, ?
    )
  `);

  const insertMany = db.transaction((products) => {
    for (const p of products) {
      insertProduct.run(priceListId, {
        ...p,
        source_data_json: JSON.stringify(p)
      }, now);
    }
  });

  insertMany(demoProducts);

  // Add initial audit log
  db.prepare(`
    INSERT INTO audit_logs (event_type, operator, outcome, details, metadata_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    'SYSTEM_INIT',
    'System',
    'success',
    'Application initialized with default settings and demo price list.',
    JSON.stringify({ demo_price_list_id: priceListId, product_count: demoProducts.length }),
    now
  );
}

// Initialize tables and seed
initSchema();

module.exports = {
  db,
  storageDir,
  uploadsDir,
  pdfsDir,
  logosDir,
  snapshotsDir,
  initSchema
};
