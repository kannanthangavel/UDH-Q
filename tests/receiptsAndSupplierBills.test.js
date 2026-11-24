const test = require('node:test');
const assert = require('node:assert');
const { db, getNextReceiptNumber } = require('../backend/src/db/database');
const { generateReceiptPdf, numberToIndianWords } = require('../backend/src/services/receiptPdfService');
const { formatSupplierAlertMessage, checkAndGetDueBills } = require('../backend/src/services/supplierAlertService');

test('Customer Receipt - getNextReceiptNumber issues atomic UDR-YYYY-XXXXXX sequence', () => {
  const year = new Date().getFullYear();
  const num1 = getNextReceiptNumber();
  const num2 = getNextReceiptNumber();
  assert.ok(num1.startsWith(`UDR-${year}-`));
  assert.ok(num2.startsWith(`UDR-${year}-`));
  const seq1 = parseInt(num1.split('-')[2], 10);
  const seq2 = parseInt(num2.split('-')[2], 10);
  assert.strictEqual(seq2, seq1 + 1);
});

test('Customer Receipt - numberToIndianWords converts Indian currency accurately', () => {
  assert.strictEqual(numberToIndianWords(15000), 'Rupees Fifteen Thousand Only');
  assert.strictEqual(numberToIndianWords(23456), 'Rupees Twenty Three Thousand Four Hundred and Fifty Six Only');
  assert.strictEqual(numberToIndianWords(0), 'Rupees Zero Only');
});

test('Customer Receipt - generateReceiptPdf outputs valid PDF Buffer in A4 and A5', async () => {
  const sampleReceipt = {
    receipt_number: 'UDR-2026-000001',
    customer_name: 'Vinoth kumar',
    customer_phone: '9715622499',
    customer_address: 'Perundurai',
    bill_no: 'UD23056',
    payment_date: '2026-11-24',
    payment_mode: 'UPI',
    amount_paid: 15000,
    balance_amount: 2000,
    notes: 'Thank you for your prompt payment!',
    paper_format: 'A4'
  };

  const a4Buffer = await generateReceiptPdf(sampleReceipt, {
    company_name: 'UDHAYAM AGENCIES',
    company_division: 'Paint Division'
  });
  assert.ok(Buffer.isBuffer(a4Buffer));
  assert.ok(a4Buffer.length > 1000);
  assert.strictEqual(a4Buffer.slice(0, 4).toString(), '%PDF');

  // Test A5
  sampleReceipt.paper_format = 'A5';
  const a5Buffer = await generateReceiptPdf(sampleReceipt, {
    company_name: 'UDHAYAM AGENCIES'
  });
  assert.ok(Buffer.isBuffer(a5Buffer));
  assert.ok(a5Buffer.length > 1000);
  assert.strictEqual(a5Buffer.slice(0, 4).toString(), '%PDF');
});

test('Supplier Alert - formats alert message with target numbers and due details', () => {
  const sampleBill = {
    supplier_name: 'Asian Paints',
    bill_number: '1525-22522-2255',
    bill_date: '2026-11-20',
    due_date: '2026-12-10',
    bill_amount: 23456,
    paid_amount: 0
  };

  const msg = formatSupplierAlertMessage(sampleBill);
  assert.ok(msg.includes('Asian Paints'));
  assert.ok(msg.includes('1525-22522-2255'));
  assert.ok(msg.includes('23,456.00'));
  assert.ok(msg.includes('+91 97156 22499'));
  assert.ok(msg.includes('+91 88700 22499'));
});
