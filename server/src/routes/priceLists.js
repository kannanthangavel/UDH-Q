const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { db, uploadsDir } = require('../db/database');
const { inspectWorkbook, getWorksheetPreview, parseSheetProducts } = require('../services/excelParser');

// Configure multer for excel file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const basename = path.basename(file.originalname, ext).replace(/[^\w\-]/g, '_');
    cb(null, `${basename}_${Date.now()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB max
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.xlsx' || ext === '.xls') {
      cb(null, true);
    } else {
      cb(new Error('Invalid file format. Only .xlsx and .xls Excel files are supported.'));
    }
  }
});

/**
 * POST /api/pricelists/upload
 * Handles Excel file upload, inspects sheets, and returns preliminary preview
 */
router.post('/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No Excel file uploaded.' });
    }

    const filePath = req.file.path;
    const inspection = inspectWorkbook(filePath);
    const defaultSheet = inspection.defaultSheet;
    const preview = getWorksheetPreview(filePath, defaultSheet);

    res.json({
      success: true,
      file: {
        filename: req.file.originalname,
        storedFilename: req.file.filename,
        path: filePath,
        size: req.file.size
      },
      sheets: inspection.sheets,
      selectedSheet: defaultSheet,
      preview
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to parse Excel workbook.' });
  }
});

/**
 * POST /api/pricelists/preview
 * Fetches preview for a specific sheet and header row
 */
router.post('/preview', (req, res) => {
  try {
    const { filePath, sheetName, headerRowIndex } = req.body;
    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(400).json({ error: 'Valid file path is required.' });
    }

    const preview = getWorksheetPreview(filePath, sheetName);
    if (headerRowIndex !== undefined) {
      preview.detectedHeaderRowIndex = Number(headerRowIndex);
    }
    res.json({ success: true, preview });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to preview worksheet.' });
  }
});

/**
 * POST /api/pricelists/confirm-import
 * Commits the imported price list to SQLite as a new version and activates it
 */
router.post('/confirm-import', (req, res) => {
  try {
    const {
      filePath,
      originalFilename,
      sheetName,
      headerRowIndex,
      columnMapping,
      isDemo,
      replaceExisting = true,
      deduplicate = true
    } = req.body;

    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(400).json({ error: 'Uploaded file not found. Please re-upload.' });
    }

    if (!columnMapping || !columnMapping.product_name) {
      return res.status(400).json({ error: 'Product Name column mapping is mandatory.' });
    }

    const parseResult = parseSheetProducts(
      filePath,
      sheetName,
      Number(headerRowIndex || 0),
      columnMapping
    );

    if (parseResult.products.length === 0) {
      return res.status(400).json({ error: 'No valid products could be extracted with the selected column mapping.' });
    }

    // Intra-file deduplication (prevents duplicate entries from repeated rows in daily Excel)
    let productsToInsert = parseResult.products;
    let intraFileDuplicatesCount = 0;

    if (deduplicate) {
      const seenMap = new Map();
      const deduped = [];
      for (const p of parseResult.products) {
        const codeKey = p.item_code && !p.item_code.startsWith('ITEM-') ? p.item_code.toLowerCase().trim() : null;
        const nameKey = `${p.normalized_name}__${(p.unit || '').toLowerCase().trim()}`;
        const dedupeKey = codeKey ? `code:${codeKey}` : `name:${nameKey}`;

        if (seenMap.has(dedupeKey)) {
          intraFileDuplicatesCount++;
          const existingIdx = seenMap.get(dedupeKey);
          // Prefer row with valid non-zero sales_rate
          if ((p.sales_rate > 0) && (!deduped[existingIdx].sales_rate || deduped[existingIdx].sales_rate <= 0)) {
            deduped[existingIdx] = p;
          }
        } else {
          seenMap.set(dedupeKey, deduped.length);
          deduped.push(p);
        }
      }
      productsToInsert = deduped;
    }

    const now = new Date().toISOString();

    const insertTx = db.transaction(() => {
      if (replaceExisting) {
        // Full catalog replacement for daily updates (prevents duplicate entries)
        db.prepare('DELETE FROM products').run();
        db.prepare('UPDATE quotations SET price_list_id = NULL').run();
        db.prepare('DELETE FROM price_lists').run();
      } else {
        // Deactivate all previous price lists
        db.prepare('UPDATE price_lists SET is_active = 0').run();
      }

      // Determine version number
      const maxVer = db.prepare('SELECT MAX(version) as maxVer FROM price_lists').get().maxVer || 0;
      const newVersion = replaceExisting ? 1 : (maxVer + 1);

      // Insert new price list record
      const stmtPriceList = db.prepare(`
        INSERT INTO price_lists (
          filename, sheet_name, version, is_demo, is_active, imported_at,
          total_rows, valid_products_count, warnings_count, column_mapping_json, metadata_json
        ) VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?)
      `);

      const metadata = JSON.stringify({
        duplicateCodesCount: parseResult.duplicateCodesCount,
        intraFileDuplicatesCount,
        missingPricesCount: parseResult.missingPricesCount,
        missingUnitsCount: parseResult.missingUnitsCount,
        replaceExisting: Boolean(replaceExisting)
      });

      const plResult = stmtPriceList.run(
        originalFilename || path.basename(filePath),
        sheetName,
        newVersion,
        isDemo ? 1 : 0,
        now,
        parseResult.totalRowsExamined,
        productsToInsert.length,
        parseResult.rowsWithWarningsCount,
        JSON.stringify(columnMapping),
        metadata
      );

      const priceListId = plResult.lastInsertRowid;

      // Bulk insert deduplicated products
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

      for (const p of productsToInsert) {
        insertProduct.run(priceListId, {
          ...p,
          source_data_json: JSON.stringify(p.source_data)
        }, now);
      }

      // Log to audit log
      db.prepare(`
        INSERT INTO audit_logs (event_type, operator, outcome, details, metadata_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        'PRICE_LIST_IMPORTED',
        'Operator',
        'success',
        `Imported ${productsToInsert.length} products from ${originalFilename} (v${newVersion}) ${replaceExisting ? '[Replaced Previous Catalog]' : ''} ${intraFileDuplicatesCount > 0 ? `(${intraFileDuplicatesCount} duplicate entries removed)` : ''}`,
        JSON.stringify({
          price_list_id: priceListId,
          version: newVersion,
          valid: productsToInsert.length,
          removedDuplicates: intraFileDuplicatesCount,
          replaceExisting: Boolean(replaceExisting)
        }),
        now
      );

      return { priceListId, version: newVersion, count: productsToInsert.length, duplicatesRemoved: intraFileDuplicatesCount };
    });

    const txResult = insertTx();

    res.json({
      success: true,
      message: `Price list version ${txResult.version} successfully activated with ${txResult.count} products.${txResult.duplicatesRemoved > 0 ? ` (${txResult.duplicatesRemoved} duplicate entries automatically removed).` : ''}`,
      priceListId: txResult.priceListId,
      version: txResult.version,
      summary: {
        totalRows: parseResult.totalRowsExamined,
        validProducts: txResult.count,
        rowsWithWarnings: parseResult.rowsWithWarningsCount,
        missingPrices: parseResult.missingPricesCount,
        duplicateCodes: parseResult.duplicateCodesCount,
        duplicatesRemoved: txResult.duplicatesRemoved,
        replacedExisting: Boolean(replaceExisting)
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to import and save price list.' });
  }
});

/**
 * GET /api/pricelists
 * Lists all price list versions
 */
router.get('/', (req, res) => {
  try {
    const list = db.prepare(`
      SELECT id, filename, sheet_name, version, is_demo, is_active,
             imported_at, total_rows, valid_products_count, warnings_count, column_mapping_json
      FROM price_lists
      ORDER BY version DESC
    `).all();

    res.json({ success: true, priceLists: list });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/pricelists/active
 * Gets the current active price list metadata
 */
router.get('/active', (req, res) => {
  try {
    const active = db.prepare(`
      SELECT id, filename, sheet_name, version, is_demo, is_active,
             imported_at, total_rows, valid_products_count, warnings_count, column_mapping_json
      FROM price_lists
      WHERE is_active = 1
      LIMIT 1
    `).get();

    res.json({ success: true, activePriceList: active || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/pricelists/:id/activate
 * Switches active price list to a selected version
 */
router.post('/:id/activate', (req, res) => {
  try {
    const id = req.params.id;
    const exists = db.prepare('SELECT id, version, filename FROM price_lists WHERE id = ?').get(id);
    if (!exists) {
      return res.status(404).json({ error: 'Price list version not found.' });
    }

    const now = new Date().toISOString();
    const switchTx = db.transaction(() => {
      db.prepare('UPDATE price_lists SET is_active = 0').run();
      db.prepare('UPDATE price_lists SET is_active = 1 WHERE id = ?').run(id);

      db.prepare(`
        INSERT INTO audit_logs (event_type, operator, outcome, details, metadata_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        'PRICE_LIST_ACTIVATED',
        'Operator',
        'success',
        `Switched active price list to version ${exists.version} (${exists.filename})`,
        JSON.stringify({ price_list_id: id, version: exists.version }),
        now
      );
    });

    switchTx();
    res.json({ success: true, message: `Activated price list version ${exists.version}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/pricelists/clear-all
 * DELETE /api/pricelists/clear-all
 * Full section clear / wipe: removes all price lists and all catalog products
 */
const handleClearAllPriceLists = (req, res) => {
  try {
    const tx = db.transaction(() => {
      const delProd = db.prepare('DELETE FROM products').run();
      db.prepare('UPDATE quotations SET price_list_id = NULL').run();
      const delPl = db.prepare('DELETE FROM price_lists').run();

      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO audit_logs (event_type, operator, outcome, details, metadata_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        'ALL_PRICE_LISTS_CLEARED',
        'Operator',
        'success',
        `Full section clear: cleared all ${delPl.changes} price lists and ${delProd.changes} catalog products.`,
        JSON.stringify({ priceListsDeleted: delPl.changes, productsDeleted: delProd.changes }),
        now
      );

      return { priceListsDeleted: delPl.changes, productsDeleted: delProd.changes };
    });

    const summary = tx();

    res.json({
      success: true,
      message: `Successfully cleared all ${summary.priceListsDeleted} price lists and ${summary.productsDeleted} products. You can now import a fresh daily Excel file without duplicates.`,
      summary
    });
  } catch (err) {
    console.error('Failed to clear price lists:', err);
    res.status(500).json({ error: err.message || 'Failed to clear all price lists.' });
  }
};

router.post('/clear-all', handleClearAllPriceLists);
router.delete('/clear-all', handleClearAllPriceLists);
router.delete('/', handleClearAllPriceLists);

/**
 * DELETE /api/pricelists/:id
 * Deletes a specific price list version and all its products
 */
router.delete('/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    const priceList = db.prepare('SELECT id, version, filename, is_active FROM price_lists WHERE id = ?').get(id);
    if (!priceList) {
      return res.status(404).json({ error: 'Price list version not found.' });
    }

    const tx = db.transaction(() => {
      // 1. Delete all products belonging to this price list
      const delProd = db.prepare('DELETE FROM products WHERE price_list_id = ?').run(id);

      // 2. Clear price_list_id reference in quotations
      db.prepare('UPDATE quotations SET price_list_id = NULL WHERE price_list_id = ?').run(id);

      // 3. Delete the price list record
      db.prepare('DELETE FROM price_lists WHERE id = ?').run(id);

      // 4. If this was the active price list, activate the latest remaining version
      let newActiveVersion = null;
      if (priceList.is_active) {
        const latest = db.prepare('SELECT id, version FROM price_lists ORDER BY version DESC LIMIT 1').get();
        if (latest) {
          db.prepare('UPDATE price_lists SET is_active = 1 WHERE id = ?').run(latest.id);
          newActiveVersion = latest.version;
        }
      }

      // 5. Audit log
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO audit_logs (event_type, operator, outcome, details, metadata_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        'PRICE_LIST_DELETED',
        'Operator',
        'success',
        `Deleted price list version ${priceList.version} (${priceList.filename}) and ${delProd.changes} products.`,
        JSON.stringify({ priceListId: id, version: priceList.version, productsRemoved: delProd.changes, newActiveVersion }),
        now
      );

      return { productsRemoved: delProd.changes, newActiveVersion };
    });

    const result = tx();

    res.json({
      success: true,
      message: `Price list version ${priceList.version} (${priceList.filename}) and ${result.productsRemoved} products deleted successfully.${result.newActiveVersion ? ` Version ${result.newActiveVersion} is now the active price list.` : ''}`,
      newActiveVersion: result.newActiveVersion
    });
  } catch (err) {
    console.error('Failed to delete price list version:', err);
    res.status(500).json({ error: err.message || 'Failed to delete price list.' });
  }
});

/**
 * GET /api/products
 * Searchable, filterable product table for the active price list
 */
router.get('/products', (req, res) => {
  try {
    const { search, category, status, priceListId, page = 1, limit = 50 } = req.query;

    let targetPlId = priceListId;
    if (!targetPlId) {
      const active = db.prepare('SELECT id FROM price_lists WHERE is_active = 1 LIMIT 1').get();
      if (!active) {
        return res.json({ success: true, products: [], total: 0, categories: [] });
      }
      targetPlId = active.id;
    }

    let whereClause = 'WHERE price_list_id = ?';
    const params = [targetPlId];

    if (search && search.trim()) {
      whereClause += ' AND (product_name LIKE ? OR item_code LIKE ? OR specification LIKE ? OR brand LIKE ?)';
      const s = `%${search.trim()}%`;
      params.push(s, s, s, s);
    }

    if (category && category !== 'all') {
      whereClause += ' AND category = ?';
      params.push(category);
    }

    if (status && status !== 'all') {
      whereClause += ' AND price_status = ?';
      params.push(status);
    }

    const totalCount = db.prepare(`SELECT COUNT(*) as count FROM products ${whereClause}`).get(...params).count;

    const offset = (Number(page) - 1) * Number(limit);
    const products = db.prepare(`
      SELECT id, item_code, product_name, specification, brand, category,
             unit, sales_rate, purchase_rate, is_tax_inclusive, gst_rate, hsn_code,
             price_status, created_at
      FROM products
      ${whereClause}
      ORDER BY id ASC
      LIMIT ? OFFSET ?
    `).all(...params, Number(limit), offset);

    // Get list of distinct categories for filters
    const categories = db.prepare(`
      SELECT DISTINCT category FROM products
      WHERE price_list_id = ? AND category IS NOT NULL AND category != ''
      ORDER BY category ASC
    `).all(targetPlId).map(r => r.category);

    res.json({
      success: true,
      products,
      total: totalCount,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(totalCount / Number(limit)),
      categories
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/products/:id/override-price
 * Explicit manual price override with audit entry
 */
router.post('/products/:id/override-price', (req, res) => {
  try {
    const id = req.params.id;
    const { newPrice, reason } = req.body;

    if (!newPrice || isNaN(newPrice) || Number(newPrice) <= 0) {
      return res.status(400).json({ error: 'Valid positive price required for override.' });
    }
    if (!reason || reason.trim().length < 4) {
      return res.status(400).json({ error: 'A specific reason is required for a manual price override.' });
    }

    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    const now = new Date().toISOString();
    const oldPrice = product.sales_rate;

    const tx = db.transaction(() => {
      db.prepare(`
        UPDATE products
        SET sales_rate = ?, price_status = 'verified'
        WHERE id = ?
      `).run(Number(newPrice), id);

      db.prepare(`
        INSERT INTO audit_logs (event_type, operator, outcome, details, metadata_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        'PRICE_OVERRIDE',
        'Operator',
        'success',
        `Overrode price for product "${product.product_name}" from ${oldPrice} to ${newPrice}. Reason: ${reason}`,
        JSON.stringify({
          productId: id,
          productName: product.product_name,
          oldPrice,
          newPrice,
          reason
        }),
        now
      );
    });

    tx();

    res.json({
      success: true,
      message: `Price successfully updated for ${product.product_name}.`,
      newPrice: Number(newPrice)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
