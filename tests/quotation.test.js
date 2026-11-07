const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

const { db, getNextQuotationNumber } = require('../server/src/db/database');
const { parseWorkbook } = require('../server/src/services/excelService');
const { numberToIndianWords, formatINR } = require('../server/src/utils/numberToWords');

test('Quotation Number Generator formats properly as UDQ-YYYY-000001', () => {
  const qNum = getNextQuotationNumber();
  const currentYear = new Date().getFullYear();
  assert.match(qNum, new RegExp(`^UDQ-${currentYear}-\\d{6}$`));
});

test('Number to Indian Words converts amounts correctly', () => {
  assert.equal(numberToIndianWords(0), 'Rupees Zero Only');
  assert.equal(numberToIndianWords(100), 'Rupees One Hundred Only');
  assert.equal(numberToIndianWords(1250), 'Rupees One Thousand Two Hundred Fifty Only');
  assert.equal(numberToIndianWords(123456), 'Rupees One Lakh Twenty Three Thousand Four Hundred Fifty Six Only');
  assert.equal(formatINR(123456.5), 'Rs. 1,23,456.50');
  assert.equal(formatINR(123456.5, '₹'), '₹1,23,456.50');
});

test('Excel Rate Sheet Parser parses PAINTS and ACCESS sheets correctly', () => {
  const rateFilePath = path.join(__dirname, '../server/storage/uploads/rates/4. RATES [04.11.2026].xlsx');
  assert.ok(fs.existsSync(rateFilePath), 'Official rate file must exist');

  const buffer = fs.readFileSync(rateFilePath);
  const result = parseWorkbook(buffer, '4. RATES [04.11.2026].xlsx');

  assert.equal(result.errors.length, 0, 'Should parse without errors');
  assert.ok(result.sections.PAINTS, 'Should have PAINTS section');
  assert.ok(result.sections.ACCESS, 'Should have ACCESS section');
  assert.ok(result.sections.PAINTS.itemCount > 3000, 'PAINTS should have > 3000 items');
  assert.ok(result.sections.ACCESS.itemCount > 1000, 'ACCESS should have > 1000 items');

  const firstPaint = result.sections.PAINTS.items[0];
  assert.ok(firstPaint.item_name, 'First item must have item_name');
  assert.ok(typeof firstPaint.sale_rate === 'number', 'First item sale_rate must be number');
  assert.equal(firstPaint.section, 'PAINTS');
});

test('Products table has seeded records with correct sections', () => {
  const paintsCount = db.prepare("SELECT COUNT(*) as c FROM products WHERE section = 'PAINTS'").get().c;
  const accessCount = db.prepare("SELECT COUNT(*) as c FROM products WHERE section = 'ACCESS'").get().c;

  assert.ok(paintsCount > 3000, 'Database must have seeded PAINTS');
  assert.ok(accessCount > 1000, 'Database must have seeded ACCESS');
});
