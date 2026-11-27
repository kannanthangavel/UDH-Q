const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const PDFDocument = require('pdfkit');
const { parseOptechText, processOptechPdf } = require('../backend/src/services/optechPdfParser');

describe('Optech PDF Ingestion & Auto-Converter', () => {

  const realOptechPdfText = `
 (ORIGINAL)
GSTIN: 33AADFU6496M1ZJ PAINT:9715622499
 ELECTRICAL:9715722499
 UDHAYAM AGENCIES
 41/10,M.R. Complex,
 Old Bus Stand Road,
 perundurai
 udhayamagency2013@gmail.com
 Quotation
To. MILKY MIST DIARY FOOD PVT LTD 
PATTAKARAN PALAYAM, 
PERUNDURAI 
GSTIN : 33AAJCM3448G1ZI
Payment Terms : Cash
No : 1182
Date : 18/11/2026
S.No Description HSN/
 SAC
 Qty Rate Amount \`
Tax
%
 1 AS EN 20LT SMK GREY 32089021 2 Nos 4902.96 18 9805.93
(GLSY-ENAMEL)-ASIAN 
 2 AS EN 4LT GO YELLOW 32089021 4 Nos 1134.54 18 4538.14
(GLSY-ENAMEL)-ASIAN 
 3 AS EN 4LT OX BLUE 32089021 2 Nos 1018.85 18 2037.71
(GLSY-ENAMEL)-ASIAN 
 4 FL 36NO FLAP DISC (BULLET) 68052090 15 Nos 28.81 18 432.15
 5 BR 4" ASIAN BRUSH 96034010 5 Nos 148.31 18 741.55
 6 BR 3" ASIAN BRUSH 96034010 5 Nos 63.56 18 317.80
 7 BR 2" ASIAN BRUSH 96034010 5 Nos 33.90 18 169.50
 8 AS 4LT ALUMI PAINT (HIGH HEAT 32089090 2 Nos 1830.51 18 3661.02
500 C) 0189 
 9 AGM 20LT-ANTI CORROSIVE 32089021 1 Nos 6254.24 18 6254.24
BLACK-AGARAM 
Total 41.000 27958.04
Taxable Value CGST% AMT SGST% AMT NET% AMT
 27958.04 9.00 2516.22 9.00 2516.22 18.00 5032.44
 Total Tax Amount : 5032.44
 Rounded Off : -0.48
E. & O.E. Net Amount : 32990.00
Rupees Thirty Two Thousand Nine Hundred And Ninety Only
BANK DETAILS: INDIAN BANK, A/C NO: 6659-3301-52, IFSC:IDIB000P155, PERUNDURAI BRANCH
 For UDHAYAM AGENCIES
 Authorised Signatory
  `;

  test('correctly parses real Optech PDF with Milky Mist customer, exact items, and 32990 net amount', () => {
    const result = parseOptechText(realOptechPdfText);

    assert.equal(result.customer.name, 'MILKY MIST DIARY FOOD PVT LTD');
    assert.equal(result.customer.gstin, '33AAJCM3448G1ZI');
    assert.equal(result.customer.address, 'PATTAKARAN PALAYAM, PERUNDURAI');
    assert.equal(result.referenceNo, '1182');
    assert.equal(result.quotationDate, '18/11/2026');
    assert.equal(result.paymentTerms, 'Cash');

    // Must be exactly 9 items (no tax lines falsely parsed)
    assert.equal(result.items.length, 9);

    // Verify first item
    assert.equal(result.items[0].item_name, 'AS EN 20LT SMK GREY (GLSY-ENAMEL)-ASIAN');
    assert.equal(result.items[0].hsn_sac, '32089021');
    assert.equal(result.items[0].quantity, 2);
    assert.equal(result.items[0].unit, 'Nos');
    assert.equal(result.items[0].sale_rate, 4902.96);
    assert.equal(result.items[0].tax_percent, 18);
    assert.equal(result.items[0].line_total, 9805.93);

    // Verify item 4 (Flap Disc 15 Nos)
    assert.equal(result.items[3].item_name, 'FL 36NO FLAP DISC (BULLET)');
    assert.equal(result.items[3].quantity, 15);
    assert.equal(result.items[3].sale_rate, 28.81);
    assert.equal(result.items[3].line_total, 432.15);

    // Verify item 8 (High Heat Aluminum Paint multi-line)
    assert.equal(result.items[7].item_name, 'AS 4LT ALUMI PAINT (HIGH HEAT 500 C) 0189');
    assert.equal(result.items[7].quantity, 2);
    assert.equal(result.items[7].sale_rate, 1830.51);

    // Verify totals
    assert.equal(result.totals.totalQty, 41);
    assert.equal(result.totals.taxableValue, 27958.04);
    assert.equal(result.totals.cgstAmount, 2516.22);
    assert.equal(result.totals.sgstAmount, 2516.22);
    assert.equal(result.totals.totalTaxAmount, 5032.44);
    assert.equal(result.totals.roundedOff, -0.48);
    assert.equal(result.totals.grandTotal, 32990.00);
  });

  test('successfully extracts text from real PDF binary buffer and produces exact matched quote', async () => {
    const doc = new PDFDocument();
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    const bufferPromise = new Promise(resolve => doc.on('end', () => resolve(Buffer.concat(chunks))));

    doc.text('UDHAYAM AGENCIES');
    doc.text('Quotation');
    doc.text('To. MILKY MIST DIARY FOOD PVT LTD');
    doc.text('PATTAKARAN PALAYAM, PERUNDURAI');
    doc.text('GSTIN : 33AAJCM3448G1ZI');
    doc.text('Payment Terms : Cash');
    doc.text('No : 1182');
    doc.text('Date : 18/11/2026');
    doc.text('S.No Description HSN/SAC Qty Rate Tax% Amount');
    doc.text('1 AS EN 20LT SMK GREY 32089021 2 Nos 4902.96 18 9805.93');
    doc.text('(GLSY-ENAMEL)-ASIAN');
    doc.text('2 AS EN 4LT GO YELLOW 32089021 4 Nos 1134.54 18 4538.14');
    doc.text('(GLSY-ENAMEL)-ASIAN');
    doc.text('Total 6.000 14344.07');
    doc.text('Net Amount : 16926.00');
    doc.end();

    const buffer = await bufferPromise;
    const result = await processOptechPdf(buffer);

    assert.equal(result.customer.name, 'MILKY MIST DIARY FOOD PVT LTD');
    assert.equal(result.customer.gstin, '33AAJCM3448G1ZI');
    assert.equal(result.referenceNo, '1182');
    assert.equal(result.items.length, 2);
    assert.equal(result.items[0].quantity, 2);
    assert.equal(result.items[0].sale_rate, 4902.96);
    assert.equal(result.items[1].quantity, 4);
  });

  test('extracts Credit and inline Payment Terms variants from Optech PDFs', () => {
    const sample = `
UDHAYAM AGENCIES
To. SRI MURUGAN PAINTS
PERUNDURAI
Terms : Credit (15 Days)
No : 2045
Date : 26/11/2026
S.No Description HSN/SAC Qty Rate Tax% Amount
1 AS EN 20LT WHITE 32089021 1 Nos 4000.00 18 4000.00
Total 1.000 4000.00
Net Amount : 4720.00
    `;
    const parsed = parseOptechText(sample);
    assert.equal(parsed.paymentTerms, 'Credit (15 Days)');
  });

});
