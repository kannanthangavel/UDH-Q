const express = require('express');
const router = express.Router();
const { db } = require('../db/database');
const { sanitizeProducts, sanitizeProduct } = require('../middleware/auth');
const { searchProductsSmart, invalidateProductCache } = require('../services/productSearchService');

// GET /api/products/counts
router.get('/counts', (req, res) => {
  const total = db.prepare('SELECT COUNT(*) as count FROM products WHERE is_active = 1').get().count;
  const paints = db.prepare("SELECT COUNT(*) as count FROM products WHERE is_active = 1 AND section = 'PAINTS'").get().count;
  const access = db.prepare("SELECT COUNT(*) as count FROM products WHERE is_active = 1 AND section = 'ACCESS'").get().count;

  res.json({ total, paints, access });
});

// GET /api/products
router.get('/', (req, res) => {
  const { search, section, page = 1, limit = 50, all = 'false' } = req.query;
  const isAdmin = req.user?.role === 'admin';
  const isAll = all === 'true' || limit === 'all' || limit === '0';

  // If a search query is provided, use the Advanced Multi-Attribute & Typo-Tolerant Search
  if (search && search.trim()) {
    const parsedLimit = isAll ? null : (parseInt(limit, 10) || 50);
    const parsedPage = isAll ? 1 : (parseInt(page, 10) || 1);

    const searchRes = searchProductsSmart({
      search: search.trim(),
      section,
      limit: parsedLimit,
      page: parsedPage,
      isAdmin
    });

    const sanitized = sanitizeProducts(searchRes.products, isAdmin);
    const limitVal = isAll ? (searchRes.total || 1) : (parsedLimit || 50);
    return res.json({
      products: sanitized,
      total: searchRes.total,
      page: parsedPage,
      limit: limitVal,
      totalPages: isAll ? 1 : Math.ceil(searchRes.total / limitVal),
      ambiguous: searchRes.ambiguous,
      distinctTypes: searchRes.distinctTypes,
      suggestions: searchRes.suggestions,
      parsedQuery: searchRes.parsedQuery,
      isAdmin
    });
  }

  // Standard browsing without search
  let sql = 'SELECT * FROM products WHERE is_active = 1';
  const params = [];

  if (section && (section === 'PAINTS' || section === 'ACCESS')) {
    sql += ' AND section = ?';
    params.push(section);
  }

  // Count total matching
  const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total');
  const countRow = db.prepare(countSql).get(...params);
  const total = countRow ? countRow.total : 0;

  sql += ' ORDER BY s_no ASC, id ASC';

  if (!isAll) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 50);
    const offset = (pageNum - 1) * limitNum;
    sql += ' LIMIT ? OFFSET ?';
    params.push(limitNum, offset);
  }

  const products = db.prepare(sql).all(...params);
  const sanitized = sanitizeProducts(products, isAdmin);

  const limitVal = isAll ? (total || 1) : (parseInt(limit, 10) || 50);
  res.json({
    products: sanitized,
    total,
    page: isAll ? 1 : (parseInt(page, 10) || 1),
    limit: limitVal,
    totalPages: isAll ? 1 : Math.ceil(total / limitVal),
    isAdmin
  });
});

// GET /api/products/:id
router.get('/:id', (req, res) => {
  const isAdmin = req.user?.role === 'admin';
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }

  res.json({ product: sanitizeProduct(product, isAdmin) });
});

// POST /api/products - Manual Item Creation in Price List section
router.post('/', (req, res) => {
  const {
    item_name,
    details = '',
    sale_rate,
    section = 'PAINTS',
    main_unit = 'Nos',
    hsn_sac = '',
    dpl = 0,
    purc_rate = 0,
    cost = 0
  } = req.body;

  if (!item_name || !item_name.trim()) {
    return res.status(400).json({ error: 'Item Name is required' });
  }
  if (sale_rate === undefined || isNaN(parseFloat(sale_rate))) {
    return res.status(400).json({ error: 'Valid Sale Rate is required' });
  }

  const normalizedSection = section === 'ACCESS' ? 'ACCESS' : 'PAINTS';

  // Get next S.No in that section
  const maxSnoRow = db.prepare('SELECT MAX(s_no) as max_sno FROM products WHERE section = ?').get(normalizedSection);
  const nextSno = (maxSnoRow?.max_sno || 0) + 1;

  const result = db.prepare(`
    INSERT INTO products (
      s_no, item_name, details, sale_rate, dpl, purc_rate, hsn_sac, main_unit, cost, section, source_filename, is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Manual Entry', 1)
  `).run(
    nextSno,
    item_name.trim().toUpperCase(),
    details.trim(),
    parseFloat(sale_rate),
    parseFloat(dpl) || 0,
    parseFloat(purc_rate) || 0,
    String(hsn_sac || '').trim(),
    String(main_unit || 'Nos').trim(),
    parseFloat(cost) || 0,
    normalizedSection
  );

  invalidateProductCache();

  const newProduct = db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);

  res.json({
    success: true,
    product: newProduct,
    message: `Product ${item_name} created successfully in ${normalizedSection} section`
  });
});

// PUT /api/products/:id - Update product
router.put('/:id', (req, res) => {
  const {
    item_name,
    details,
    sale_rate,
    section,
    main_unit,
    hsn_sac,
    dpl,
    purc_rate,
    cost
  } = req.body;

  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Product not found' });
  }

  db.prepare(`
    UPDATE products SET
      item_name = COALESCE(?, item_name),
      details = COALESCE(?, details),
      sale_rate = COALESCE(?, sale_rate),
      section = COALESCE(?, section),
      main_unit = COALESCE(?, main_unit),
      hsn_sac = COALESCE(?, hsn_sac),
      dpl = COALESCE(?, dpl),
      purc_rate = COALESCE(?, purc_rate),
      cost = COALESCE(?, cost)
    WHERE id = ?
  `).run(
    item_name !== undefined ? item_name.trim().toUpperCase() : null,
    details !== undefined ? details.trim() : null,
    sale_rate !== undefined ? parseFloat(sale_rate) : null,
    section !== undefined ? section : null,
    main_unit !== undefined ? main_unit.trim() : null,
    hsn_sac !== undefined ? String(hsn_sac).trim() : null,
    dpl !== undefined ? parseFloat(dpl) : null,
    purc_rate !== undefined ? parseFloat(purc_rate) : null,
    cost !== undefined ? parseFloat(cost) : null,
    req.params.id
  );

  invalidateProductCache();
  const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  res.json({ success: true, product: updated });
});

// DELETE /api/products/:id - Delete product
router.delete('/:id', (req, res) => {
  db.prepare('UPDATE products SET is_active = 0 WHERE id = ?').run(req.params.id);
  invalidateProductCache();
  res.json({ success: true, message: 'Product removed' });
});

module.exports = router;
