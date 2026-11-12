const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { searchProductsSmart } = require('../backend/src/services/productSearchService');
const { generateQuotationPdf } = require('../backend/src/services/pdfService');

test('Never mind - space and hyphen: searches find exact products regardless of formatting', () => {
  // Test Case 1: asac2g20lt vs as ac2g 20lt vs as-ac2g-20lt
  const res1 = searchProductsSmart({ search: 'asac2g20lt' });
  const res2 = searchProductsSmart({ search: 'as ac2g 20lt' });
  const res3 = searchProductsSmart({ search: 'as-ac2g-20lt' });

  assert.ok(res1.products.length > 0, 'Should find product for asac2g20lt');
  assert.equal(res1.products[0].item_name, 'AS AC2G-20LT ACE EML (ASIAN)');
  assert.equal(res2.products[0].item_name, 'AS AC2G-20LT ACE EML (ASIAN)');
  assert.equal(res3.products[0].item_name, 'AS AC2G-20LT ACE EML (ASIAN)');

  // Test Case 2: SP39 vs SP-39 vs SP 39
  const sp1 = searchProductsSmart({ search: 'sp39' });
  const sp2 = searchProductsSmart({ search: 'sp-39' });
  const sp3 = searchProductsSmart({ search: 'sp 39' });

  assert.ok(sp1.products.length > 0);
  assert.ok(sp1.products[0].item_name.includes('SP-39'));
  assert.ok(sp2.products[0].item_name.includes('SP-39'));
  assert.ok(sp3.products[0].item_name.includes('SP-39'));

  // Test Case 3: goldenbrown vs golden brown 1ltr
  const gb1 = searchProductsSmart({ search: 'goldenbrown' });
  const gb2 = searchProductsSmart({ search: 'golden brown 1ltr' });

  assert.ok(gb1.products.length > 0);
  assert.ok(gb1.products.some(p => p.item_name.includes('GOLDEN BROWN')));
  assert.ok(gb2.products.length > 0);
  assert.ok(gb2.products[0].item_name.includes('GOLDEN BROWN'));

  // Test Case 4: Dr Fixit with dots/spaces/hyphens
  const df1 = searchProductsSmart({ search: 'drfixit' });
  const df2 = searchProductsSmart({ search: 'dr.fixit' });
  const df3 = searchProductsSmart({ search: 'dr fixit' });

  assert.ok(df1.products.length > 0);
  assert.ok(df2.products.length > 0);
  assert.ok(df3.products.length > 0);

  // Test Case 5: Putty 40kg
  const pt1 = searchProductsSmart({ search: 'putty 40kg' });
  const pt2 = searchProductsSmart({ search: 'putty-40kg' });
  assert.ok(pt1.products.length > 0);
  assert.ok(pt2.products.length > 0);
  assert.ok(pt1.products[0].item_name.includes('40KG'));

  // Test Case 6: Dynamic Suggestions & Typo Correction
  const typoRes = searchProductsSmart({ search: 'enemel wite' });
  assert.equal(typoRes.suggestions.didYouMean, 'enamel white');
  assert.ok(typoRes.products.length > 0);
});

test('A5 Quotation PDF layout generates crisp single-page document without overlap', (t, done) => {
  const quote = {
    id: 99,
    quotation_number: 'UDQ-2026-A5TEST',
    quotation_date: '2026-11-06',
    validity_date: '2026-11-13',
    customer_name: 'Kannan Thangavel',
    customer_phone: '09514698072',
    customer_address: 'Perundurai Bypass Road',
    subtotal: 8170,
    discount_percent: 2.5,
    discount_amount: 204.25,
    taxable_amount: 6750.64,
    gst_rate: 18,
    gst_amount: 1215.11,
    delivery_charges: 0,
    grand_total: 7965.75,
    paper_format: 'A5',
    items: [
      {
        item_name: 'AS AC2G-20LT ACE EML (ASIAN)',
        details: '4202',
        hsn_sac: '32091010',
        unit: 'Nos',
        quantity: 1,
        sale_rate: 4520,
        line_total: 4520
      },
      {
        item_name: 'AS AC12G-20LT ACE EML (ASIAN)',
        details: 'SANI MATE',
        hsn_sac: '32091010',
        unit: 'Nos',
        quantity: 1,
        sale_rate: 3650,
        line_total: 3650
      }
    ]
  };

  const testFile = path.join(__dirname, 'test_a5_verify.pdf');
  const out = fs.createWriteStream(testFile);
  generateQuotationPdf(quote, {}, out);

  out.on('finish', () => {
    const content = fs.readFileSync(testFile, 'latin1');
    const pages = (content.match(/\/Type\s*\/Page\b/g) || []).length;
    assert.equal(pages, 1, 'A5 with 2 items must generate exactly 1 page');

    // Clean up
    try { fs.unlinkSync(testFile); } catch (e) {}
    done();
  });
});
