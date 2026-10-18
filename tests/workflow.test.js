import { describe, it, expect } from 'vitest';
import { db, initSchema } from '../server/src/db/database.js';

describe('Quotation Lifecycle & Workflow Integrity Suite', () => {
  it('creates draft quotation with valid calculations and sequential number', () => {
    const quoteNumber = `TEST-WORKFLOW-${Date.now()}`;
    const now = new Date().toISOString();

    const insertQuote = db.prepare(`
      INSERT INTO quotations (
        quotation_number, revision, status, document_type, paper_size,
        customer_name, customer_phone, subtotal, grand_total, amount_in_words,
        created_at, updated_at
      ) VALUES (?, 1, 'draft', 'gst_quotation', 'A5', 'Ramesh', '9876543210', 290, 290, 'Rupees Two Hundred Ninety Only', ?, ?)
    `);

    const result = insertQuote.run(quoteNumber, now, now);
    const qId = result.lastInsertRowid;

    expect(qId).toBeGreaterThan(0);

    // Insert line item
    db.prepare(`
      INSERT INTO quotation_items (
        quotation_id, row_order, product_name, quantity, unit, unit_price, line_total
      ) VALUES (?, 1, 'As EN golden Brown 1lt', 1, '1Nos', 290, 290)
    `).run(qId);

    // Verify row
    const quote = db.prepare('SELECT * FROM quotations WHERE id = ?').get(qId);
    expect(quote.status).toBe('draft');
    expect(quote.grand_total).toBe(290);

    const items = db.prepare('SELECT * FROM quotation_items WHERE quotation_id = ?').all(qId);
    expect(items.length).toBe(1);
    expect(items[0].product_name).toBe('As EN golden Brown 1lt');

    // Finalize quotation
    db.prepare("UPDATE quotations SET status = 'finalized' WHERE id = ?").run(qId);
    const finalized = db.prepare('SELECT status FROM quotations WHERE id = ?').get(qId);
    expect(finalized.status).toBe('finalized');

    // Clean up test rows
    db.prepare('DELETE FROM quotation_items WHERE quotation_id = ?').run(qId);
    db.prepare('DELETE FROM quotations WHERE id = ?').run(qId);
  });

  it('guarantees that replacing active price list never alters existing quotation items', () => {
    // 1. Create a historical quotation
    const quoteNumber = `TEST-HISTORICAL-${Date.now()}`;
    const now = new Date().toISOString();

    const result = db.prepare(`
      INSERT INTO quotations (
        quotation_number, status, grand_total, created_at, updated_at
      ) VALUES (?, 'finalized', 500, ?, ?)
    `).run(quoteNumber, now, now);

    const qId = result.lastInsertRowid;

    // Snapshot item with price 500
    db.prepare(`
      INSERT INTO quotation_items (
        quotation_id, row_order, product_name, quantity, unit, unit_price, line_total
      ) VALUES (?, 1, 'Cement Bag Old Rate', 1, 'bags', 500, 500)
    `).run(qId);

    // 2. Simulate inserting a new price list with a different rate for cement
    const plResult = db.prepare(`
      INSERT INTO price_lists (filename, sheet_name, version, is_active, imported_at)
      VALUES ('NEW_PRICE_LIST.xlsx', 'Sheet1', 99, 1, ?)
    `).run(now);

    const newPlId = plResult.lastInsertRowid;

    db.prepare(`
      INSERT INTO products (
        price_list_id, product_name, normalized_name, sales_rate, unit, created_at
      ) VALUES (?, 'Cement Bag Old Rate', 'cement bag old rate', 650, 'bags', ?)
    `).run(newPlId, now);

    // 3. Verify historical quotation items remain unchanged!
    const historicalItem = db.prepare('SELECT * FROM quotation_items WHERE quotation_id = ?').get(qId);
    expect(historicalItem.unit_price).toBe(500); // Must still be 500, NOT 650!

    // Clean up
    db.prepare('DELETE FROM quotation_items WHERE quotation_id = ?').run(qId);
    db.prepare('DELETE FROM quotations WHERE id = ?').run(qId);
    db.prepare('DELETE FROM products WHERE price_list_id = ?').run(newPlId);
    db.prepare('DELETE FROM price_lists WHERE id = ?').run(newPlId);
  });

  it('supports deleting an individual price list version and activating the next remaining version', () => {
    const now = new Date().toISOString();
    const vBase = 5000 + Math.floor(Math.random() * 1000);

    let plLow = null;
    let plHigh = null;

    try {
      // Create lower version
      plLow = db.prepare(`
        INSERT INTO price_lists (filename, sheet_name, version, is_active, imported_at)
        VALUES ('vLow.xlsx', 'Sheet1', ?, 0, ?)
      `).run(vBase, now).lastInsertRowid;

      // Create higher version (active)
      plHigh = db.prepare(`
        INSERT INTO price_lists (filename, sheet_name, version, is_active, imported_at)
        VALUES ('vHigh.xlsx', 'Sheet1', ?, 1, ?)
      `).run(vBase + 1, now).lastInsertRowid;

      // Create products for both
      db.prepare(`
        INSERT INTO products (price_list_id, product_name, normalized_name, sales_rate, unit, created_at)
        VALUES (?, 'Item Low', 'item low', 100, 'Nos', ?)
      `).run(plLow, now);

      db.prepare(`
        INSERT INTO products (price_list_id, product_name, normalized_name, sales_rate, unit, created_at)
        VALUES (?, 'Item High', 'item high', 110, 'Nos', ?)
      `).run(plHigh, now);

      // Simulate delete transaction for plHigh
      const delTx = db.transaction(() => {
        db.prepare('DELETE FROM products WHERE price_list_id = ?').run(plHigh);
        db.prepare('UPDATE quotations SET price_list_id = NULL WHERE price_list_id = ?').run(plHigh);
        db.prepare('DELETE FROM price_lists WHERE id = ?').run(plHigh);
        // Activate next latest
        const latest = db.prepare('SELECT id, version FROM price_lists ORDER BY version DESC LIMIT 1').get();
        if (latest) {
          db.prepare('UPDATE price_lists SET is_active = 1 WHERE id = ?').run(latest.id);
        }
      });

      delTx();

      // Verify plHigh products deleted
      const prodsHigh = db.prepare('SELECT * FROM products WHERE price_list_id = ?').all(plHigh);
      expect(prodsHigh.length).toBe(0);

      // Verify plLow is now active
      const activePl = db.prepare('SELECT * FROM price_lists WHERE id = ?').get(plLow);
      expect(activePl.is_active).toBe(1);
    } finally {
      if (plLow) {
        db.prepare('DELETE FROM products WHERE price_list_id = ?').run(plLow);
        db.prepare('DELETE FROM price_lists WHERE id = ?').run(plLow);
      }
      if (plHigh) {
        db.prepare('DELETE FROM products WHERE price_list_id = ?').run(plHigh);
        db.prepare('DELETE FROM price_lists WHERE id = ?').run(plHigh);
      }
      // Ensure seed version 1 is active if present
      db.prepare('UPDATE price_lists SET is_active = 1 WHERE version = 1').run();
    }
  });

  it('performs full section clear: deletes all price lists and products while preserving quotations', () => {
    const now = new Date().toISOString();
    const testQuoteNum = `TEST-CLEAR-${Date.now()}`;

    // Backup existing catalog so running test suite never destroys user catalog
    const savedPriceLists = db.prepare('SELECT * FROM price_lists').all();
    const savedProducts = db.prepare('SELECT * FROM products').all();

    try {
      // Create a quotation
      const quoteId = db.prepare(`
        INSERT INTO quotations (quotation_number, status, grand_total, created_at, updated_at)
        VALUES (?, 'draft', 999, ?, ?)
      `).run(testQuoteNum, now, now).lastInsertRowid;

      // Insert line item
      db.prepare(`
        INSERT INTO quotation_items (quotation_id, row_order, product_name, quantity, unit, unit_price, line_total)
        VALUES (?, 1, 'Preserved Item', 2, 'Nos', 500, 1000)
      `).run(quoteId);

      // Insert dummy price lists and products
      const plId = db.prepare(`
        INSERT INTO price_lists (filename, sheet_name, version, is_active, imported_at)
        VALUES ('temp.xlsx', 'Sheet1', 999, 1, ?)
      `).run(now).lastInsertRowid;

      db.prepare(`
        INSERT INTO products (price_list_id, product_name, normalized_name, sales_rate, unit, created_at)
        VALUES (?, 'Temp Prod', 'temp prod', 50, 'Nos', ?)
      `).run(plId, now);

      // Link quotation
      db.prepare('UPDATE quotations SET price_list_id = ? WHERE id = ?').run(plId, quoteId);

      // Full clear transaction simulation
      const clearTx = db.transaction(() => {
        db.prepare('DELETE FROM products').run();
        db.prepare('UPDATE quotations SET price_list_id = NULL').run();
        db.prepare('DELETE FROM price_lists').run();
      });

      clearTx();

      // Verify all products and price lists are 0
      const totalPl = db.prepare('SELECT count(*) as count FROM price_lists').get().count;
      const totalProd = db.prepare('SELECT count(*) as count FROM products').get().count;
      expect(totalPl).toBe(0);
      expect(totalProd).toBe(0);

      // Verify quotation still exists and has its items!
      const quote = db.prepare('SELECT * FROM quotations WHERE id = ?').get(quoteId);
      expect(quote).toBeDefined();
      expect(quote.price_list_id).toBeNull();

      const items = db.prepare('SELECT * FROM quotation_items WHERE quotation_id = ?').all(quoteId);
      expect(items.length).toBe(1);
      expect(items[0].product_name).toBe('Preserved Item');
      expect(items[0].line_total).toBe(1000);

      // Clean up test quote
      db.prepare('DELETE FROM quotation_items WHERE quotation_id = ?').run(quoteId);
      db.prepare('DELETE FROM quotations WHERE id = ?').run(quoteId);
    } finally {
      if (savedPriceLists.length > 0) {
        db.prepare('DELETE FROM products').run();
        db.prepare('DELETE FROM price_lists').run();

        const insertPl = db.prepare(`
          INSERT INTO price_lists (
            id, filename, sheet_name, version, is_demo, is_active, imported_at,
            total_rows, valid_products_count, warnings_count, column_mapping_json, metadata_json
          ) VALUES (
            @id, @filename, @sheet_name, @version, @is_demo, @is_active, @imported_at,
            @total_rows, @valid_products_count, @warnings_count, @column_mapping_json, @metadata_json
          )
        `);
        for (const pl of savedPriceLists) insertPl.run(pl);

        const insertProd = db.prepare(`
          INSERT INTO products (
            id, price_list_id, item_code, product_name, normalized_name, specification,
            brand, category, unit, sales_rate, purchase_rate, is_tax_inclusive,
            gst_rate, hsn_code, price_status, source_data_json, created_at
          ) VALUES (
            @id, @price_list_id, @item_code, @product_name, @normalized_name, @specification,
            @brand, @category, @unit, @sales_rate, @purchase_rate, @is_tax_inclusive,
            @gst_rate, @hsn_code, @price_status, @source_data_json, @created_at
          )
        `);
        for (const p of savedProducts) insertProd.run(p);
      } else {
        initSchema();
      }
    }
  });
});
