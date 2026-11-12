/**
 * Training Dataset & Test Benchmark Suite for Udhayam Agencies
 * 
 * Contains 40+ curated realistic queries covering:
 * - Brand + Product Type + Variant + Pack Size
 * - Conversational Tanglish & Noise
 * - Spelling Errors & Typos
 * - Pack Size vs Requested Quantity Separation
 * - Hard Negatives & Exclusion Tests
 */

const TEST_CASES = [
  // 1. Golden Brown Variations
  {
    input: 'golden brown 1ltr',
    expectedKeywords: ['golden brown', '1lt'],
    expectedType: 'paint',
    expectedPackSize: '1LT',
    expectedQty: 1
  },
  {
    input: 'golden brown 1 litre',
    expectedKeywords: ['golden brown', '1lt'],
    expectedPackSize: '1LT',
    expectedQty: 1
  },
  {
    input: 'goldenbrown 1l',
    expectedKeywords: ['golden brown', '1lt'],
    expectedPackSize: '1LT',
    expectedQty: 1
  },
  {
    input: 'asian golden brown 1ltr',
    expectedBrand: 'Asian Paints',
    expectedKeywords: ['golden brown', '1lt'],
    expectedPackSize: '1LT',
    expectedQty: 1
  },
  {
    input: 'golden brown one litre',
    expectedKeywords: ['golden brown', '1lt'],
    expectedPackSize: '1LT',
    expectedQty: 1
  },

  // 2. Putty Variations
  {
    input: 'putty 40kg',
    expectedType: 'putty',
    expectedPackSize: '40KG',
    expectedQty: 1
  },
  {
    input: 'putty 40 kg',
    expectedType: 'putty',
    expectedPackSize: '40KG',
    expectedQty: 1
  },
  {
    input: 'wall putty 40 kilo',
    expectedType: 'putty',
    expectedPackSize: '40KG',
    expectedQty: 1
  },
  {
    input: 'birla white putty 40kg',
    expectedBrand: 'Birla',
    expectedType: 'putty',
    expectedPackSize: '40KG',
    expectedQty: 1
  },

  // 3. Brush Variations
  {
    input: 'brush 2"',
    expectedType: 'brush',
    expectedPackSize: '2"',
    expectedQty: 1
  },
  {
    input: '2 inch brush',
    expectedType: 'brush',
    expectedPackSize: '2"',
    expectedQty: 1
  },
  {
    input: '2 inch painting brush',
    expectedType: 'brush',
    expectedPackSize: '2"',
    expectedQty: 1
  },
  {
    input: 'paint brush 2in',
    expectedType: 'brush',
    expectedPackSize: '2"',
    expectedQty: 1
  },
  {
    input: 'brush two inch',
    expectedType: 'brush',
    expectedPackSize: '2"',
    expectedQty: 1
  },

  // 4. Primer Variations
  {
    input: 'primer 20ltr',
    expectedType: 'primer',
    expectedPackSize: '20LT',
    expectedQty: 1
  },
  {
    input: 'primer 20 litre',
    expectedType: 'primer',
    expectedPackSize: '20LT',
    expectedQty: 1
  },
  {
    input: '20L primer',
    expectedType: 'primer',
    expectedPackSize: '20LT',
    expectedQty: 1
  },

  // 5. PACK SIZE vs REQUESTED QUANTITY SEPARATION
  {
    input: 'putty 40kg - 3 bags',
    expectedType: 'putty',
    expectedPackSize: '40KG',
    expectedQty: 3,
    expectedUnit: 'BAG'
  },
  {
    input: 'apex 20lt x 2',
    expectedKeywords: ['apex', '20lt'],
    expectedPackSize: '20LT',
    expectedQty: 2
  },
  {
    input: 'golden brown 1ltr 5',
    expectedKeywords: ['golden brown', '1lt'],
    expectedPackSize: '1LT',
    expectedQty: 5
  },
  {
    input: 'brush 2 inch 10 nos',
    expectedType: 'brush',
    expectedPackSize: '2"',
    expectedQty: 10,
    expectedUnit: 'PCS'
  },

  // 6. Conversational Tanglish & Noise Filtering
  {
    input: 'annachi birla white putty 40kg 2 bag venum',
    expectedBrand: 'Birla',
    expectedType: 'putty',
    expectedPackSize: '40KG',
    expectedQty: 2,
    expectedUnit: 'BAG'
  },
  {
    input: 'sir please send rate for brush 2 inch 5 nos',
    expectedType: 'brush',
    expectedPackSize: '2"',
    expectedQty: 5,
    expectedUnit: 'PCS'
  },
  {
    input: 'asian paints apex 20lt 2 can kudu',
    expectedBrand: 'Asian Paints',
    expectedPackSize: '20LT',
    expectedQty: 2,
    expectedUnit: 'CAN'
  },

  // 7. Spelling Errors & Typo Tolerance
  {
    input: 'golden brwon 1lt',
    expectedKeywords: ['golden brown', '1lt'],
    expectedPackSize: '1LT'
  },
  {
    input: 'puty 40kg',
    expectedType: 'putty',
    expectedPackSize: '40KG'
  },
  {
    input: 'primar 20l',
    expectedType: 'primer',
    expectedPackSize: '20LT'
  },
  {
    input: 'asianpain apex 20lt',
    expectedBrand: 'Asian Paints',
    expectedPackSize: '20LT'
  },

  // 8. Hard Negatives & Dimension Exclusions
  {
    input: 'brush 2"',
    mustNotMatchPackSizes: ['1 1/2"', '2 1/2"'],
    expectedPackSize: '2"'
  },
  {
    input: 'putty 40kg',
    mustNotMatchPackSizes: ['1KG', '5KG', '20KG'],
    expectedPackSize: '40KG'
  },

  // 9. Additional Advanced Product Scenarios
  {
    input: 'red oxide 4ltr',
    expectedType: 'primer',
    expectedPackSize: '4LT',
    expectedQty: 1
  },
  {
    input: 'touchwood 500ml',
    expectedType: 'touchwood',
    expectedPackSize: '500ML',
    expectedQty: 1
  },
  {
    input: 'brush 1 1/2"',
    expectedType: 'brush',
    expectedPackSize: '1 1/2"',
    expectedQty: 1
  },
  {
    input: 'brush 3 inch 2 nos',
    expectedType: 'brush',
    expectedPackSize: '3"',
    expectedQty: 2,
    expectedUnit: 'PCS'
  },
  {
    input: 'thinner 5lt 2 can',
    expectedType: 'thinner',
    expectedPackSize: '5LT',
    expectedQty: 2,
    expectedUnit: 'CAN'
  },
  {
    input: 'white cement 50kg 2 bag thaa',
    expectedType: 'cement',
    expectedPackSize: '50KG',
    expectedQty: 2,
    expectedUnit: 'BAG'
  },
  {
    input: 'dr fixit 302 20lt',
    expectedBrand: 'Dr. Fixit',
    expectedPackSize: '20LT',
    expectedQty: 1
  },
  {
    input: 'asian ace 20lt',
    expectedBrand: 'Asian Paints',
    expectedPackSize: '20LT',
    expectedQty: 1
  },
  {
    input: 'tractor emulsion 10lt',
    expectedBrand: 'Asian Paints',
    expectedPackSize: '10LT',
    expectedQty: 1
  },
  {
    input: 'apcolite 4lt 3 can',
    expectedBrand: 'Asian Paints',
    expectedPackSize: '4LT',
    expectedQty: 3,
    expectedUnit: 'CAN'
  }
];

module.exports = {
  TEST_CASES
};
