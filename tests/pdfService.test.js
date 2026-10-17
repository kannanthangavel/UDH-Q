import { describe, it, expect } from 'vitest';
import fs from 'fs';
import { generateQuotationPDF } from '../server/src/services/pdfService.js';

describe('PDF Generation Service Suite', () => {
  const dummySettings = {
    company_name: 'Udhayam Agencies',
    company_tagline: 'Building Materials & Hardware Supplies',
    company_address: 'Perundurai, Erode Dist, Tamil Nadu - 638052',
    company_gstin: '33AAAFU1234F1Z8',
    company_phone: '+91 97156 22499',
    bank_name: 'Indian Bank',
    bank_account_no: '6659330152',
    bank_ifsc: 'Perundurai',
    gpay_number: '+91 97156 22499 (MS Udhayam Agencies)'
  };

  const dummyItems = [
    {
      product_name: 'As EN golden Brown 1lt',
      specification: '1 Litre Enamel Paint',
      hsn_code: '92030111',
      quantity: 1,
      unit: '1Nos',
      unit_price: 290.00,
      gst_rate: 18.0,
      line_total: 290.00
    },
    {
      product_name: 'OPC 53 Grade Cement',
      specification: '53 Grade Bag',
      hsn_code: '25232910',
      quantity: 20,
      unit: 'bags',
      unit_price: 385.00,
      gst_rate: 28.0,
      line_total: 7700.00
    }
  ];

  it('generates a valid A5 quotation PDF without errors', async () => {
    const quotationA5 = {
      quotation_number: 'TEST-A5-001',
      paper_size: 'A5',
      document_type: 'gst_quotation',
      customer_name: 'Test Customer',
      customer_phone: '9876543210',
      subtotal: 7990.00,
      discount_total: 0,
      taxable_amount: 6250.00,
      tax_total: 1740.00,
      delivery_charges: 0,
      grand_total: 7990.00,
      amount_in_words: 'Rupees Seven Thousand Nine Hundred and Ninety Only'
    };

    const result = await generateQuotationPDF(quotationA5, dummyItems, dummySettings);

    expect(result.filePath).toBeDefined();
    expect(fs.existsSync(result.filePath)).toBe(true);
    expect(result.fileSize).toBeGreaterThan(1000);

    // Clean up test file
    fs.unlinkSync(result.filePath);
  });

  it('generates a valid A4 quotation PDF without errors', async () => {
    const quotationA4 = {
      quotation_number: 'TEST-A4-002',
      paper_size: 'A4',
      document_type: 'estimation',
      customer_name: 'Test Customer A4',
      subtotal: 7990.00,
      discount_total: 0,
      grand_total: 7990.00,
      amount_in_words: 'Rupees Seven Thousand Nine Hundred and Ninety Only'
    };

    const result = await generateQuotationPDF(quotationA4, dummyItems, dummySettings);

    expect(result.filePath).toBeDefined();
    expect(fs.existsSync(result.filePath)).toBe(true);
    expect(result.fileSize).toBeGreaterThan(1000);

    // Clean up test file
    fs.unlinkSync(result.filePath);
  });
});
