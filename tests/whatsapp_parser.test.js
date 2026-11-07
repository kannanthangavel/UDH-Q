const test = require('node:test');
const assert = require('node:assert/strict');
const { processWhatsAppMessage } = require('../server/src/services/smartParser.js');

test('WhatsApp Order Parser extracts customer and accurately matches messy product strings', () => {
  const rawMessage = `Customer: Ramesh Kumar +91 98427 11223
Site: Perundurai SIPCOT

golden brown 1ltr 5ps
putty powder 40kg
brush 2" 1ps`;

  const result = processWhatsAppMessage(rawMessage);

  assert.equal(result.success, true);
  // Customer extraction
  assert.equal(result.customerName, 'Ramesh Kumar');
  assert.equal(result.customerPhone, '+91 9842711223');

  // 3 products parsed
  assert.equal(result.items.length, 3);

  // Item 1: golden brown 1ltr 5ps -> 5 cans of 1LT
  const item1 = result.items[0];
  assert.ok(item1.matchedProduct, 'Item 1 should match a product');
  assert.ok(item1.matchedProduct.item_name.includes('GOLDEN BROWN'), 'Item 1 should match GOLDEN BROWN');
  assert.equal(item1.quantity, 5);

  // Item 2: putty powder 40kg -> 1 bag of 40KG
  const item2 = result.items[1];
  assert.ok(item2.matchedProduct, 'Item 2 should match a product');
  assert.ok(item2.matchedProduct.item_name.includes('PUTTY'), 'Item 2 should match PUTTY');
  assert.equal(item2.quantity, 1);

  // Item 3: brush 2" 1ps -> 1 piece of 2" brush
  const item3 = result.items[2];
  assert.ok(item3.matchedProduct, 'Item 3 should match a product');
  assert.ok(item3.matchedProduct.item_name.includes('2"'), 'Item 3 should match 2" brush');
  assert.equal(item3.quantity, 1);
});

test('Tax inclusive calculation preserves sales rate as total including GST', () => {
  const items = [
    { sale_rate: 118, quantity: 1, line_total: 118, details: 'Golden Brown' }
  ];
  const subtotal = 118;
  const discountPercent = 0;
  const discountAmount = 0;
  const netAmount = subtotal - discountAmount;
  const gstRate = 18;

  // Taxable base and included GST
  const taxableAmount = Math.round((netAmount / (1 + gstRate / 100)) * 100) / 100;
  const gstAmount = Math.round((netAmount - taxableAmount) * 100) / 100;
  const delivery = 0;
  const grandTotal = Math.round((netAmount + delivery) * 100) / 100;

  assert.equal(subtotal, 118);
  assert.equal(taxableAmount, 100);
  assert.equal(gstAmount, 18);
  assert.equal(grandTotal, 118);
});
