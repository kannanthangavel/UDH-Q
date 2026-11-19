const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const PDFDocument = require('pdfkit');
const { parseOptechText, processOptechPdf } = require('../backend/src/services/optechPdfParser');

describe('Optech PDF Ingestion & Auto-Converter', () => {

  test('correctly parses raw Optech text and extracts customer, items and totals', () => {
    const sampleText = `
OPTECH SOFTWARE SOLUTIONS
SALE ESTIMATE
M/s. SENTHIL PAINTS & HARDWARE
Phone: 9842144555
Erode Main Road, Perundurai
Date: 18/11/2026
Estimate No: EST-2026-904
----------------------------------------------------
S.No Description Pack Qty Rate Amount
1 APEX ULTIMA WHITE 20LT 2 3250.00 6500.00
2 ROYALE SHYNE BRILLIANT WHITE 1 LT 5 540.00 2700.00
3 BIRLA WHITE WALL CARE PUTTY 40 KG 10 950.00 9500.00
4 PAINT BRUSH 2 INCH 5 45.00 225.00
Grand Total: 18925.00
    `;

    const result = parseOptechText(sampleText);

    assert.equal(result.customer.name, 'SENTHIL PAINTS & HARDWARE');
    assert.equal(result.customer.phone, '9842144555');
    assert.equal(result.customer.address, 'Erode Main Road, Perundurai');
    assert.equal(result.estimateNumber, 'EST-2026-904');
    assert.equal(result.quotationDate, '18/11/2026');
    assert.equal(result.items.length, 4);

    const first = result.items[0];
    assert.equal(first.quantity, 2);
    assert.ok(first.line_total > 0);
    assert.ok(first.item_name.length > 0);

    assert.ok(result.totals.subtotal > 0);
    assert.ok(result.totals.grandTotal > 0);
  });

  test('successfully extracts text from real PDF buffer and produces matched quote', async () => {
    const doc = new PDFDocument();
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    const bufferPromise = new Promise(resolve => doc.on('end', () => resolve(Buffer.concat(chunks))));

    doc.text('OPTECH RETAIL BILLING SOFTWARE');
    doc.text('ESTIMATE / QUOTATION');
    doc.text('M/s. VINOTH KUMAR');
    doc.text('Phone: 9715622499');
    doc.text('Date: 19/11/2026');
    doc.text('Estimate No: EST-8833');
    doc.text('1 APEX ULTIMA WHITE 20LT 2 3250.00 6500.00');
    doc.text('2 ROYALE SHYNE 1 LT 5 540.00 2700.00');
    doc.end();

    const buffer = await bufferPromise;
    const result = await processOptechPdf(buffer);

    assert.equal(result.customer.name, 'VINOTH KUMAR');
    assert.equal(result.customer.phone, '9715622499');
    assert.equal(result.estimateNumber, 'EST-8833');
    assert.equal(result.items.length, 2);
    assert.equal(result.items[0].quantity, 2);
    assert.equal(result.items[1].quantity, 5);
  });

});
