/**
 * Evaluation Runner for Udhayam Agencies Product Keyword Matching System
 */

const { matchProduct } = require('./index');
const { TEST_CASES } = require('./trainingDataset');
const { getIndexedProducts } = require('../productSearchService');

function runEvaluation() {
  console.log('================================================================');
  console.log('   UDHAYAM AGENCIES - ADVANCED PRODUCT MATCHING EVALUATION');
  console.log('================================================================\n');

  // Pre-load catalogue
  const catalog = getIndexedProducts();
  console.log(`Indexed Products in Catalogue: ${catalog.length}\n`);

  let totalCases = TEST_CASES.length;
  let top1Passed = 0;
  let packSizePassed = 0;
  let quantityPassed = 0;
  let hardNegativesPassed = 0;
  let hardNegativesTotal = 0;

  const failureDetails = [];

  TEST_CASES.forEach((tc, idx) => {
    const result = matchProduct(tc.input);
    const matched = result.matchedProduct;
    let casePassed = true;

    // Check Pack Size
    if (tc.expectedPackSize) {
      const matchSize = result.attributes?.packSize?.canonical;
      if (matchSize === tc.expectedPackSize || (matched && matched.packSize === tc.expectedPackSize)) {
        packSizePassed++;
      } else {
        casePassed = false;
        failureDetails.push(`[Case ${idx + 1}] "${tc.input}": Expected Pack Size ${tc.expectedPackSize}, got ${matchSize || matched?.packSize}`);
      }
    }

    // Check Quantity
    if (tc.expectedQty !== undefined) {
      if (result.quantity === tc.expectedQty) {
        quantityPassed++;
      } else {
        casePassed = false;
        failureDetails.push(`[Case ${idx + 1}] "${tc.input}": Expected Quantity ${tc.expectedQty}, got ${result.quantity}`);
      }
    }

    // Check Hard Negatives
    if (tc.mustNotMatchPackSizes) {
      hardNegativesTotal++;
      const topSize = matched?.packSize;
      if (!tc.mustNotMatchPackSizes.includes(topSize)) {
        hardNegativesPassed++;
      } else {
        casePassed = false;
        failureDetails.push(`[Case ${idx + 1}] "${tc.input}": Violated Hard Negative! Matched excluded size ${topSize}`);
      }
    }

    // Check Brand if expected
    if (tc.expectedBrand) {
      const brandMatch = result.attributes?.brand === tc.expectedBrand ||
        (matched?.structuredDetails?.brand || '').toLowerCase() === tc.expectedBrand.toLowerCase();
      if (!brandMatch) {
        casePassed = false;
        failureDetails.push(`[Case ${idx + 1}] "${tc.input}": Expected Brand ${tc.expectedBrand}, got ${result.attributes?.brand || matched?.structuredDetails?.brand}`);
      }
    }

    // Top-1 overall success
    if (matched && casePassed) {
      top1Passed++;
    }
  });

  const top1Acc = ((top1Passed / totalCases) * 100).toFixed(1);
  const packSizeAcc = ((packSizePassed / totalCases) * 100).toFixed(1);
  const quantityAcc = ((quantityPassed / totalCases) * 100).toFixed(1);
  const negAcc = hardNegativesTotal > 0 ? ((hardNegativesPassed / hardNegativesTotal) * 100).toFixed(1) : 100;

  console.log('----------------------------------------------------------------');
  console.log(' EVALUATION METRICS REPORT:');
  console.log('----------------------------------------------------------------');
  console.log(`Total Test Scenarios        : ${totalCases}`);
  console.log(`Top-1 Match Accuracy        : ${top1Acc}% (${top1Passed}/${totalCases})`);
  console.log(`Pack Size Extraction Rate   : ${packSizeAcc}% (${packSizePassed}/${totalCases})`);
  console.log(`Quantity/Pack Differentiation: ${quantityAcc}% (${quantityPassed}/${totalCases})`);
  console.log(`Hard Negatives Passed       : ${negAcc}% (${hardNegativesPassed}/${hardNegativesTotal})`);
  console.log('----------------------------------------------------------------\n');

  if (failureDetails.length > 0) {
    console.log('Investigating Discrepancies:');
    failureDetails.forEach(f => console.log('  ⚠️ ' + f));
    console.log('\n');
  } else {
    console.log('🎉 100% BENCHMARK SUITE PASSED! ALL 40+ SCENARIOS VERIFIED.\n');
  }

  return {
    top1Passed,
    totalCases,
    top1Acc,
    packSizeAcc,
    quantityAcc,
    failures: failureDetails
  };
}

if (require.main === module) {
  runEvaluation();
}

module.exports = {
  runEvaluation
};
