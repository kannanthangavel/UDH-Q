import { describe, it, expect } from 'vitest';
import { db } from '../server/src/db/database.js';
import { matchItem } from '../server/src/services/matchingEngine.js';

describe('Product Matching Engine Suite', () => {
  it('matches exact item codes with 100% confidence', () => {
    const item = {
      productName: 'As EN golden Brown 1lt',
      itemCode: 'UD-PNT-01',
      quantity: 1,
      unit: '1Nos'
    };

    const result = matchItem(item);
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

    const match12 = matchItem(item12mm);
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

    const match10 = matchItem(item10mm);
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

    const result = matchItem(item);
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

    const result = matchItem(vagueItem);
    // There are 20L and 5L paint buckets in demo database, so it should flag multiple matches or suggest candidates
    expect(result.candidates.length).toBeGreaterThan(0);
  });
});
