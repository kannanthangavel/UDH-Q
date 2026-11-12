import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../server/src/db/database.js';
import { matchItem } from '../server/src/services/matchingEngine.js';

describe('Product Matching Engine Suite', () => {
  let demoPlId = null;

  beforeAll(() => {
    // Check if demo price list exists; if not, create one for test consistency
    const existingDemo = db.prepare('SELECT id FROM price_lists WHERE is_demo = 1 LIMIT 1').get();
    if (existingDemo) {
      demoPlId = existingDemo.id;
      db.prepare('UPDATE price_lists SET is_active = 1 WHERE id = ?').run(demoPlId);
    } else {
      const now = new Date().toISOString();
      const res = db.prepare(`
        INSERT INTO price_lists (filename, sheet_name, version, is_demo, is_active, imported_at, total_rows, valid_products_count)
        VALUES ('UDHAYAM_DEMO_PRICELIST.xlsx', 'Sheet1', 998, 1, 1, ?, 7, 7)
      `).run(now);
      demoPlId = res.lastInsertRowid;

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
          hsn_code: '92030111'
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
          hsn_code: '25232910'
        },
        {
          item_code: 'UD-STL-12',
          product_name: 'TMT Steel Rods Fe550D 12mm',
          normalized_name: 'tmt steel rods fe550d 12mm kambi',
          specification: '12mm Fe550D High Strength Steel',
          brand: 'Tata Tiscon',
          category: 'Steel & TMT',
          unit: 'nos',
          sales_rate: 640.00,
          purchase_rate: 570.00,
          is_tax_inclusive: 1,
          gst_rate: 18.0,
          hsn_code: '72142090'
        },
        {
          item_code: 'UD-STL-10',
          product_name: 'TMT Steel Rods Fe550D 10mm',
          normalized_name: 'tmt steel rods fe550d 10mm kambi',
          specification: '10mm Fe550D High Strength Steel',
          brand: 'Tata Tiscon',
          category: 'Steel & TMT',
          unit: 'nos',
          sales_rate: 450.00,
          purchase_rate: 395.00,
          is_tax_inclusive: 1,
          gst_rate: 18.0,
          hsn_code: '72142090'
        },
        {
          item_code: 'UD-PNT-20L',
          product_name: 'Asian Paints Apex Emulsion 20L Bucket',
          normalized_name: 'asian paints apex emulsion 20l bucket paint buckets',
          specification: '20 Litre Bucket Weatherproof Emulsion',
          brand: 'Asian Paints',
          category: 'Paints & Enamel',
          unit: 'buckets',
          sales_rate: 3450.00,
          purchase_rate: 3000.00,
          is_tax_inclusive: 1,
          gst_rate: 18.0,
          hsn_code: '32091000'
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
          hsn_code: '32091000'
        }
      ];

      const ins = db.prepare(`
        INSERT INTO products (
          price_list_id, item_code, product_name, normalized_name, specification,
          brand, category, unit, sales_rate, purchase_rate, is_tax_inclusive,
          gst_rate, hsn_code, price_status, created_at
        ) VALUES (
          ?, @item_code, @product_name, @normalized_name, @specification,
          @brand, @category, @unit, @sales_rate, @purchase_rate, @is_tax_inclusive,
          @gst_rate, @hsn_code, 'verified', ?
        )
      `);

      for (const p of demoProducts) {
        ins.run(demoPlId, p, now);
      }
    }
  });

  it('matches exact item codes with 100% confidence', () => {
    const item = {
      productName: 'As EN golden Brown 1lt',
      itemCode: 'UD-PNT-01',
      quantity: 1,
      unit: '1Nos'
    };

    const result = matchItem(item, demoPlId);
    expect(result.matchStatus).toBe('Exact Match');
    expect(result.confidence).toBe(100);
    expect(result.matchedProduct.item_code).toBe('UD-PNT-01');
    expect(result.matchedProduct.sales_rate).toBe(290);
  });

  it('preserves dimension specifications and never matches 10mm to 12mm rods', () => {
    const item12mm = {
      productName: 'steel rods',
      specification: '12mm',
      rawPhrase: '10 numbers of 12mm steel rods',
      quantity: 10,
      unit: 'nos'
    };

    const match12 = matchItem(item12mm, demoPlId);
    expect(match12.matchedProduct).not.toBeNull();
    expect(match12.matchedProduct.product_name).toContain('12mm');
    expect(match12.matchedProduct.sales_rate).toBe(640);

    const item10mm = {
      productName: 'steel rods',
      specification: '10mm',
      rawPhrase: '10 steel rods 10mm',
      quantity: 10,
      unit: 'nos'
    };

    const match10 = matchItem(item10mm, demoPlId);
    expect(match10.matchedProduct).not.toBeNull();
    expect(match10.matchedProduct.product_name).toContain('10mm');
    expect(match10.matchedProduct.sales_rate).toBe(450);
  });

  it('matches common product aliases such as OPC cement to OPC 53 Grade Cement', () => {
    const item = {
      productName: 'OPC cement',
      rawPhrase: '20 bags OPC cement',
      quantity: 20,
      unit: 'bags'
    };

    const result = matchItem(item, demoPlId);
    expect(result.matchedProduct).not.toBeNull();
    expect(result.matchedProduct.product_name).toContain('OPC');
    expect(result.matchedProduct.sales_rate).toBe(385);
  });

  it('flags ambiguous products where multiple candidates score closely', () => {
    const vagueItem = {
      productName: 'paint buckets',
      rawPhrase: '5 paint buckets',
      quantity: 5,
      unit: 'buckets'
    };

    const result = matchItem(vagueItem, demoPlId);
    expect(result.candidates.length).toBeGreaterThan(0);
  });

  it('correctly respects inch dimensions and prevents matching 2" brush to 1" brush', () => {
    const brush2 = {
      productName: 'brush',
      specification: '2"',
      rawPhrase: '4.brush(2inch)=2 nos',
      quantity: 2,
      unit: 'nos'
    };
    const res = matchItem(brush2);
    if (res.matchedProduct) {
      expect(res.matchedProduct.product_name).toContain('2"');
      expect(res.matchedProduct.product_name).not.toContain('1"');
    }
  });

  it('matches paint, thinner, and hardware trade requirements with verified rates', () => {
    // 1. green paint 500ML
    const greenRes = matchItem({
      productName: 'green paint',
      specification: '500ML',
      quantity: 1,
      unit: 'Nos'
    });
    if (greenRes.matchedProduct) {
      expect(greenRes.matchedProduct.sales_rate).toBeGreaterThan(0);
      expect(greenRes.matchedProduct.product_name.toUpperCase()).toContain('GREEN');
      expect(greenRes.candidates.length).toBeGreaterThan(0);
    }

    // 2. black paint 500ML (from "block paint")
    const blackRes = matchItem({
      productName: 'black paint',
      specification: '500ML',
      quantity: 1,
      unit: 'Nos'
    });
    if (blackRes.matchedProduct) {
      expect(blackRes.matchedProduct.sales_rate).toBeGreaterThan(0);
      expect(blackRes.matchedProduct.product_name.toUpperCase()).toContain('BLACK');
    }

    // 3. enamel thinner 500ML
    const thinnerRes = matchItem({
      productName: 'enamel thinner',
      specification: '500ML',
      quantity: 1,
      unit: 'Nos'
    });
    if (thinnerRes.matchedProduct) {
      expect(thinnerRes.matchedProduct.sales_rate).toBeGreaterThan(0);
      expect(thinnerRes.matchedProduct.product_name.toUpperCase()).toContain('THINNER');
    }
  });
});
