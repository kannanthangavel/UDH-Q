import { describe, it, expect } from 'vitest';
import path from 'path';
import xlsx from 'xlsx';
import fs from 'fs';
import {
  parsePrice,
  normalizeText,
  suggestColumnMapping,
  getWorksheetPreview,
  parseSheetProducts
} from '../server/src/services/excelParser.js';

describe('Excel Parser & Validation Suite', () => {
  it('parses numeric prices correctly from various Indian currency formats', () => {
    expect(parsePrice(290)).toEqual({ valid: true, value: 290, raw: 290 });
    expect(parsePrice('290.00')).toEqual({ valid: true, value: 290, raw: '290.00' });
    expect(parsePrice('Rs. 290')).toEqual({ valid: true, value: 290, raw: 'Rs. 290' });
    expect(parsePrice('₹ 1,23,456.50').value).toBe(123456.50);
    expect(parsePrice('₹ 3,450.00').value).toBe(3450.00);

    // Invalid & negative prices
    expect(parsePrice(-100).valid).toBe(false);
    expect(parsePrice('invalid').valid).toBe(false);
    expect(parsePrice('').valid).toBe(false);
    expect(parsePrice(null).valid).toBe(false);
  });

  it('normalizes product text for robust token comparisons', () => {
    expect(normalizeText('  As EN Golden Brown 1lt  ')).toBe('as en golden brown 1lt');
    expect(normalizeText('OPC 53-Grade / Cement!*')).toBe('opc 53-grade / cement');
  });

  it('suggests standard column mappings for Udhayam Excel headers', () => {
    const headers = ['Product Name', 'Details', 'HSN Code', 'Unit', 'Sales Rate', 'Purchase rate'];
    const mapping = suggestColumnMapping(headers);

    expect(mapping.product_name).toBe('Product Name');
    expect(mapping.specification).toBe('Details');
    expect(mapping.hsn_code).toBe('HSN Code');
    expect(mapping.unit).toBe('Unit');
    expect(mapping.sales_rate).toBe('Sales Rate');
    expect(mapping.purchase_rate).toBe('Purchase rate');
  });

  it('parses worksheet data and produces accurate validation metrics', () => {
    // Create temporary Excel file
    const tmpFile = path.join(process.cwd(), 'tests', 'test_pricelist.xlsx');
    const testData = [
      {
        'Product Name': 'As EN golden Brown 1lt',
        'Details': '1 Litre Enamel Paint',
        'HSN Code': '92030111',
        'Unit': '1Nos',
        'Sales Rate': 290.00,
        'Purchase rate': 240.00
      },
      {
        'Product Name': 'OPC Cement',
        'Details': '53 Grade',
        'HSN Code': '25232910',
        'Unit': 'bags',
        'Sales Rate': 385.00,
        'Purchase rate': 340.00
      },
      {
        'Product Name': 'Item Without Price',
        'Details': 'Missing rate',
        'HSN Code': '12345678',
        'Unit': 'nos',
        'Sales Rate': '',
        'Purchase rate': ''
      }
    ];

    const ws = xlsx.utils.json_to_sheet(testData);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Sheet1');
    xlsx.writeFile(wb, tmpFile);

    const mapping = {
      product_name: 'Product Name',
      specification: 'Details',
      hsn_code: 'HSN Code',
      unit: 'Unit',
      sales_rate: 'Sales Rate',
      purchase_rate: 'Purchase rate'
    };

    const result = parseSheetProducts(tmpFile, 'Sheet1', 0, mapping);

    expect(result.validProductsCount).toBe(3);
    expect(result.missingPricesCount).toBe(1);
    expect(result.products[0].product_name).toBe('As EN golden Brown 1lt');
    expect(result.products[0].sales_rate).toBe(290);
    expect(result.products[2].price_status).toBe('missing_price');

    // Clean up
    if (fs.existsSync(tmpFile)) {
      fs.unlinkSync(tmpFile);
    }
  });
});
