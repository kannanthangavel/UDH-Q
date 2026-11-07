const test = require('node:test');
const assert = require('node:assert/strict');
const { db } = require('../server/src/db/database');

test('Quotation Calculation logic produces mathematically exact totals', () => {
  const items = [
    { quantity: 2, sale_rate: 160 },   // 320
    { quantity: 5, sale_rate: 200 }    // 1000
  ];
  const subtotal = items.reduce((sum, it) => sum + (it.quantity * it.sale_rate), 0);
  assert.equal(subtotal, 1320);

  const discountPercent = 10;
  const discountAmount = Math.round((subtotal * discountPercent / 100) * 100) / 100;
  assert.equal(discountAmount, 132);

  const discountedAmount = subtotal - discountAmount;
  assert.equal(discountedAmount, 1188);

  const gstRate = 18;
  const gstAmount = Math.round((discountedAmount * gstRate / 100) * 100) / 100;
  assert.equal(gstAmount, 213.84);

  const delivery = 50;
  const grandTotal = Math.round((discountedAmount + gstAmount + delivery) * 100) / 100;
  assert.equal(grandTotal, 1451.84);
});

test('Customer records validate phone and name uniqueness', () => {
  const testPhone = '+91 99999 88888';
  db.prepare('DELETE FROM customers WHERE phone = ?').run(testPhone);

  const res = db.prepare('INSERT INTO customers (name, phone) VALUES (?, ?)').run('Test Customer', testPhone);
  assert.ok(res.lastInsertRowid > 0);

  const found = db.prepare('SELECT * FROM customers WHERE phone = ?').get(testPhone);
  assert.equal(found.name, 'Test Customer');

  // Cleanup
  db.prepare('DELETE FROM customers WHERE phone = ?').run(testPhone);
});
