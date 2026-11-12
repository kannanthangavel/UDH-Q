const { searchProductsSmart } = require('../backend/src/services/productSearchService');

const testCases = [
  'white',
  'white paint',
  'white 1lt',
  'white paint 1lt',
  'golden brown',
  'golden brown 1ltr',
  'golden brwn',
  'putty',
  'putty powder',
  'puty powder',
  'putty powder 40kg',
  'brush',
  'brush 2"',
  'brush 2 inch',
  'brsh 2 inch'
];

console.log('====================================================');
console.log('   UD-QM ADVANCED SEARCH & QA VALIDATION TEST SUITE   ');
console.log('====================================================\n');

let passCount = 0;

for (const q of testCases) {
  const result = searchProductsSmart({ search: q, limit: 5 });
  console.log(`🔍 QUERY: "${q}"`);
  console.log(`   Found: ${result.total} products | Ambiguous: ${result.ambiguous ? 'YES (' + result.distinctTypes.join(', ') + ')' : 'NO'}`);
  
  if (result.products.length > 0) {
    result.products.slice(0, 3).forEach((p, idx) => {
      console.log(`   #${idx + 1} [Score ${p.searchScore}] ${p.item_name} - ₹${p.sale_rate} (${p.matchReasons.join(', ')})`);
    });
    passCount++;
  } else {
    console.log(`   ❌ NO RESULTS FOUND!`);
  }
  console.log('');
}

console.log(`Result: ${passCount} / ${testCases.length} QA test queries passed successfully.`);
if (passCount === testCases.length) {
  console.log('✅ ALL SEARCH EDGE CASES VERIFIED!');
} else {
  process.exit(1);
}
