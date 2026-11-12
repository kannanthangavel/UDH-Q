const fs = require('fs');
const { generateQuotationPdf } = require('../backend/src/services/pdfService');

function testQuotes(count) {
  const items = [];
  for (let i = 1; i <= count; i++) {
    items.push({
      item_name: `Paint Item Description ${i}`,
      details: i % 2 === 0 ? 'Shade Golden Brown' : '',
      quantity: 2,
      sale_rate: 250,
      line_total: 500,
      unit: 'Nos',
      hsn_sac: '32082090'
    });
  }

  const dummyQuote = {
    quotation_number: `UDQ-2026-00000${count}`,
    quotation_date: '2026-11-05',
    validity_date: '2026-11-12',
    customer_name: 'Test Builder Corp',
    customer_phone: '+91 97156 22499',
    customer_address: 'Site 44, Perundurai Bypass Road',
    subtotal: count * 500,
    grand_total: count * 500,
    paper_format: 'A4',
    items
  };

  const file = `./tests/test_${count}_items.pdf`;
  const out = fs.createWriteStream(file);
  generateQuotationPdf(dummyQuote, {}, out);
  out.on('finish', () => {
    const content = fs.readFileSync(file, 'utf-8');
    const pages = content.match(/\/Type\s*\/Page\b/g)?.length;
    console.log(`Quotation with ${count} items -> Page Count: ${pages}`);
  });
}

testQuotes(1);
testQuotes(5);
testQuotes(10);
testQuotes(20);
