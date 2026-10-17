import { describe, it, expect } from 'vitest';
import {
  calculateLineItem,
  calculateQuotationTotals,
  formatINR,
  numberToWordsINR
} from '../server/src/services/calculationService.js';

describe('Quotation Calculations & INR Arithmetic Suite', () => {
  it('correctly calculates single line item in tax-inclusive format', () => {
    // Example from user prompt: 1 As EN golden Brown 1lt 1Nos 290 18% 290
    const item = {
      quantity: 1,
      unit_price: 290.00,
      gst_rate: 18.0,
      discount_percent: 0
    };

    const calc = calculateLineItem(item, true);
    expect(calc.line_total).toBe(290.00);
    expect(calc.taxable_amount).toBe(245.76);
    expect(calc.gst_amount).toBe(44.24);
    expect(Math.round((calc.taxable_amount + calc.gst_amount) * 100) / 100).toBe(290.00);
  });

  it('correctly applies percentage discounts before calculating taxes', () => {
    const item = {
      quantity: 10,
      unit_price: 100.00, // Gross = 1000
      discount_percent: 10, // 10% discount = 100
      gst_rate: 18.0
    };

    const calc = calculateLineItem(item, true);
    expect(calc.discount_amount).toBe(100.00);
    expect(calc.line_total).toBe(900.00);
    expect(calc.taxable_amount).toBe(762.71);
    expect(calc.gst_amount).toBe(137.29);
  });

  it('computes full quotation totals, charges, and CGST/SGST tax breakdown', () => {
    const items = [
      { quantity: 1, unit_price: 290.00, gst_rate: 18.0, discount_percent: 0 },
      { quantity: 2, unit_price: 385.00, gst_rate: 28.0, discount_percent: 0 }
    ];

    const result = calculateQuotationTotals(items, {
      isTaxInclusive: true,
      deliveryCharges: 50.00,
      otherCharges: 0,
      isInterState: false
    });

    const expectedLinesTotal = 290.00 + (2 * 385.00); // 290 + 770 = 1060
    expect(result.subtotal).toBe(1060.00);
    expect(result.grand_total).toBe(1060.00 + 50.00); // 1110.00

    // Check tax breakdown exists for 18% and 28%
    expect(result.taxBreakdown['18']).toBeDefined();
    expect(result.taxBreakdown['28']).toBeDefined();
    expect(result.taxBreakdown['18'].cgst).toBe(round2(result.taxBreakdown['18'].totalGst / 2));
    expect(result.taxBreakdown['18'].sgst).toBe(round2(result.taxBreakdown['18'].totalGst / 2));
  });

  function round2(num) {
    return Math.round((Number(num) + Number.EPSILON) * 100) / 100;
  }

  it('formats currency according to Indian comma rules', () => {
    expect(formatINR(0)).toBe('₹ 0.00');
    expect(formatINR(290)).toBe('₹ 290.00');
    expect(formatINR(1234)).toBe('₹ 1,234.00');
    expect(formatINR(123456.75)).toBe('₹ 1,23,456.75');
    expect(formatINR(10000000)).toBe('₹ 1,00,00,000.00');
  });

  it('converts numbers to Indian words representation reliably', () => {
    expect(numberToWordsINR(290)).toBe('Rupees Two Hundred and Ninety Only');
    expect(numberToWordsINR(123456)).toBe('Rupees One Lakh Twenty Three Thousand Four Hundred and Fifty Six Only');
    expect(numberToWordsINR(385.50)).toBe('Rupees Three Hundred and Eighty Five and Fifty Paise Only');
  });
});
