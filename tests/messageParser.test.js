import { describe, it, expect } from 'vitest';
import {
  parseCustomerMessage,
  checkForBillLookup,
  detectDocumentType,
  detectPaperSize
} from '../server/src/services/messageParser.js';

describe('WhatsApp Message Parser & NLP Suite', () => {
  it('correctly parses multiple product requirements from customer WhatsApp message', () => {
    const message = '20 bags OPC cement, 10 numbers of 12mm steel rods, 5 paint buckets. Please prepare a quotation.';
    const result = parseCustomerMessage(message);

    expect(result.success).toBe(true);
    expect(result.isBillLookup).toBe(false);
    expect(result.items.length).toBe(3);

    // Item 1: 20 bags OPC cement
    expect(result.items[0].quantity).toBe(20);
    expect(result.items[0].unit).toBe('bags');
    expect(result.items[0].productName.toLowerCase()).toContain('opc cement');

    // Item 2: 10 numbers of 12mm steel rods
    expect(result.items[1].quantity).toBe(10);
    expect(result.items[1].unit).toBe('nos');
    expect(result.items[1].specification).toContain('12mm');

    // Item 3: 5 paint buckets
    expect(result.items[2].quantity).toBe(5);
    expect(result.items[2].unit).toBe('buckets');
    expect(result.items[2].productName.toLowerCase()).toContain('paint');
  });

  it('detects existing bill lookup request and warns operator instead of quoting items', () => {
    const billMsg = 'UD12345 bill send pannunga.';
    const result = parseCustomerMessage(billMsg);

    expect(result.isBillLookup).toBe(true);
    expect(result.billLookup.warning).toContain('UD12345');
    expect(result.items.length).toBe(0);
  });

  it('detects explicit GST Quotation vs Estimation requests', () => {
    expect(detectDocumentType('Need quotation with GST').detected).toBe('gst_quotation');
    expect(detectDocumentType('Please give estimation without tax').detected).toBe('estimation');
    expect(detectDocumentType('send price list').detected).toBe(null);
  });

  it('detects explicit paper size requests or defaults to A5', () => {
    expect(detectPaperSize('Please format in A4 size').detected).toBe('A4');
    expect(detectPaperSize('A5 bill is fine').detected).toBe('A5');
    expect(detectPaperSize('Standard quotation').detected).toBe('A5'); // Default is A5
  });

  it('flags items where quantity is missing without fabricating numbers', () => {
    const msg = 'paint buckets and cement bags';
    const result = parseCustomerMessage(msg);

    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items[0].isQuantityMissing).toBe(true);
    expect(result.items[0].quantity).toBe(null);
  });
});
