const { processWhatsAppMessage } = require('../backend/src/services/smartParser');

const sampleMsg = `Customer: Ramesh +91 98427 11223
golden brown 1ltr 5ps
putty powder 40kg
brush 2" 1ps`;

const res = processWhatsAppMessage(sampleMsg);
console.log('Customer Details:', res.customerName, res.customerPhone);
console.log('Total items parsed:', res.totalItems);

res.items.forEach((it, i) => {
  console.log(`\nItem ${i + 1}: "${it.originalLine}"`);
  console.log(`  -> Matched: ${it.matchedProduct?.item_name || 'NO MATCH'}`);
  console.log(`  -> Rate: ₹${it.matchedProduct?.sale_rate || 0}`);
  console.log(`  -> Qty: ${it.quantity} ${it.unit}`);
  console.log(`  -> Candidates: ${it.candidates.map(c => c.item_name).slice(0, 3).join(' | ')}`);
});
