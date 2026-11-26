const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const app = require('../backend/src/app');
const { db } = require('../backend/src/db/database');
const { calculateQuotationFinancials } = require('../backend/src/utils/quotationEngine');
const { generateQuotationPdf, generateUpiQrDataUrl } = require('../backend/src/services/quotationHtmlPdfService');
const { extractTextFromPdf } = require('../backend/src/services/optechPdfParser');

const baseQuote4 = {
  id: 9112,
  quotation_number: 'UDQ-2026-000112',
  quotation_date: '2026-11-26',
  validity_date: '2026-12-11',
  customer_name: 'MILKY MIST DIARY FOOD PVT LTD',
  customer_phone: '+91 98765 43210',
  customer_gstin: '33AAJCM3448G1ZI',
  customer_address: 'PATTAKARAN PALAYAM, PERUNDURAI',
  payment_terms: 'CASH',
  is_tax_inclusive: 1,
  gst_rate: 18,
  items: [
    { item_name: 'ASIAN ROYALE LUXURY EMULSION 20L', details: 'White Base', hsn_sac: '32091010', quantity: 2, unit: 'Nos', sale_rate: 7500, tax_percent: 18, line_total: 15000 },
    { item_name: 'BROWN POWDER (GORILLA-400GM) B.S (25PKT-1BOX)', details: '400gm Pack', hsn_sac: '32082090', quantity: 1, unit: 'Pocket', sale_rate: 75, tax_percent: 18, line_total: 75 },
    { item_name: 'BIRLA WHITE WALL PUTTY 40KG BAG', details: 'Fine Finish', hsn_sac: '32149090', quantity: 2, unit: 'Bags', sale_rate: 1250, tax_percent: 18, line_total: 2500 },
    { item_name: 'APEX ULTIMA WEATHERPROOF 20L', details: 'Exterior', hsn_sac: '32091010', quantity: 1, unit: 'Nos', sale_rate: 8700, tax_percent: 18, line_total: 8700 }
  ]
};

test('Sample UDQ-2026-000112 GST inclusive and exclusive financials satisfy exact invariants', () => {
  const inc = calculateQuotationFinancials({
    items: baseQuote4.items,
    is_tax_inclusive: true,
    default_gst_rate: 18
  });

  assert.equal(inc.grandTotal, 26275);
  assert.equal(inc.taxableValue, 22266.95);
  assert.equal(inc.totalTaxAmount, 4008.05);
  assert.equal(Math.round((inc.taxableValue + inc.totalCgst + inc.totalSgst + inc.roundedOff) * 100) / 100, inc.grandTotal);

  const exc = calculateQuotationFinancials({
    items: [{ quantity: 1, sale_rate: 1000, tax_percent: 18 }],
    is_tax_inclusive: false,
    default_gst_rate: 18
  });
  assert.equal(exc.taxableValue, 1000);
  assert.equal(exc.totalCgst, 90);
  assert.equal(exc.totalSgst, 90);
  assert.equal(exc.grandTotal, 1180);
});

test('UPI QR code generates valid PNG data URL for exact NPCI payload', async () => {
  const dataUrl = await generateUpiQrDataUrl({
    upiId: 'paytmqr6vc6b5@ptys',
    payeeName: 'Udhayam Agencies',
    grandTotal: 26275,
    quoteNo: 'UDQ-2026-000112'
  });
  assert.ok(dataUrl.startsWith('data:image/png;base64,'));
});

test('Quotation HTML PDF renders 1-item long name, 4-item sample, and 26-item multi-page PDFs with zero duplication', async () => {
  // 1-item with long wrapping name and omitted optional fields
  const buf1 = await generateQuotationPdf({
    ...baseQuote4,
    quotation_number: 'UDQ-2026-T1ITEM',
    customer_address: '',
    customer_gstin: '',
    items: [
      {
        item_name: 'BROWN POWDER (GORILLA-400GM) B.S (25PKT-1BOX) EXTRA LONG PRODUCT DESCRIPTION FOR WRAPPING CHECK',
        details: 'Specification Line',
        hsn_sac: '32082090',
        quantity: 1,
        unit: 'Pocket',
        sale_rate: 75,
        tax_percent: 18,
        line_total: 75
      }
    ]
  }, {});
  assert.ok(buf1.length < 500 * 1024, '1-item PDF must be under 500 KB');
  const txt1 = await extractTextFromPdf(buf1);
  assert.equal((txt1.match(/UDQ-2026-T1ITEM/g) || []).length, 1);
  assert.equal((txt1.match(/Date:/g) || []).length, 1);
  assert.equal((txt1.match(/Valid Till:/g) || []).length, 1);
  assert.equal((txt1.match(/\+91 98765 43210/g) || []).length, 1);
  assert.ok(!txt1.includes('QUOTATION META'), 'Must not contain duplicate Quotation Meta block');
  assert.ok(!txt1.includes('…'), 'Must wrap long names instead of truncating');
  assert.ok(txt1.includes('₹'), 'Must embed font with Rupee symbol');

  // 4-item sample UDQ-2026-000112
  const buf4 = await generateQuotationPdf(baseQuote4, {});
  assert.ok(buf4.length < 500 * 1024, '4-item PDF must be under 500 KB');
  const txt4 = await extractTextFromPdf(buf4);
  assert.equal((txt4.match(/UDQ-2026-000112/g) || []).length, 1);
  assert.equal((txt4.match(/Date:/g) || []).length, 1);
  assert.equal((txt4.match(/Valid Till:/g) || []).length, 1);
  assert.equal((txt4.match(/\+91 98765 43210/g) || []).length, 1);
  assert.ok(txt4.includes('₹22,266.95'));
  assert.ok(txt4.includes('₹26,275.00'));

  // 26-item multi-page with mixed GST rates (5%, 12%, 18%, 28%)
  const items26 = Array.from({ length: 26 }, (_, i) => ({
    item_name: `ASIAN PAINTS ITEM #${i + 1}`,
    details: `Spec ${i + 1}`,
    hsn_sac: '32091010',
    quantity: (i % 5) + 1,
    unit: i % 2 === 0 ? 'Nos' : 'Pocket',
    sale_rate: 250 + i * 10,
    tax_percent: [5, 12, 18, 28][i % 4],
    line_total: ((i % 5) + 1) * (250 + i * 10)
  }));
  const buf26 = await generateQuotationPdf({
    ...baseQuote4,
    quotation_number: 'UDQ-2026-T26ITEM',
    items: items26
  }, {});
  const pages26 = (buf26.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length;
  assert.ok(pages26 >= 2, '26-item quotation must span multiple pages');
  assert.ok(buf26.length < 500 * 1024, '26-item PDF must be under 500 KB');
  const txt26 = await extractTextFromPdf(buf26);
  assert.equal((txt26.match(/UDQ-2026-T26ITEM/g) || []).length, 1, 'Quote No must appear once even on multi-page PDF');
  assert.equal((txt26.match(/Date:/g) || []).length, 1, 'Date must appear once even on multi-page PDF');
  assert.equal((txt26.match(/Valid Till:/g) || []).length, 1, 'Valid Till must appear once even on multi-page PDF');
  assert.equal((txt26.match(/\+91 98765 43210/g) || []).length, 1, 'Customer phone must appear once even on multi-page PDF');
  assert.equal((txt26.match(/ITEM DESCRIPTION & SPECIFICATIONS/g) || []).length, pages26, 'Table header must repeat on every page');
});

test('GET /api/quotations/:id/pdf?download=true streams valid Puppeteer PDF over HTTP', async () => {
  const quoteRow = db.prepare('SELECT id, quotation_number FROM quotations ORDER BY id DESC LIMIT 1').get();
  assert.ok(quoteRow, 'At least one quotation must exist in DB');

  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/quotations/${quoteRow.id}/pdf?download=true`);
    assert.equal(res.status, 200);
    assert.ok((res.headers.get('content-type') || '').includes('application/pdf'));
    assert.ok((res.headers.get('content-disposition') || '').includes('attachment'));
    const buf = Buffer.from(await res.arrayBuffer());
    assert.equal(buf.subarray(0, 5).toString('ascii'), '%PDF-');
    const txt = await extractTextFromPdf(buf);
    assert.equal((txt.match(new RegExp(quoteRow.quotation_number, 'g')) || []).length, 1);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
