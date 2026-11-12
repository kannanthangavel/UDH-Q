/**
 * Product Attribute & Intent Extraction Engine
 * 
 * Extracts:
 * - Brand
 * - Product Type (Category)
 * - Variant / Color
 * - Pack Size & Pack Unit (e.g. 40 KG, 1 L, 20 L, 2 INCH)
 * - Requested Quantity & Requested Packaging Unit (e.g. 3 Bags, 2 Cans, 5 Nos)
 * 
 * CRITICAL RULE: Pack size and requested quantity MUST NEVER be confused.
 * "Putty 40kg - 3 bags" -> packSize = "40KG", quantity = 3, requestedUnit = "BAG"
 */

const { extractPackSizes, standardizeUnit } = require('./unitParser');
const { detectBrand } = require('./brandParser');

// Variant & Shade Definitions
const COLOR_VARIANTS = [
  { name: 'golden brown', aliases: ['golden brown', 'goldenbrown', 'go brown', 'go.brown', 'g brown', 'g.brown', 'golden brwn', 'golden brwon'] },
  { name: 'br brown', aliases: ['br brown', 'br.brown', 'br-brown'] },
  { name: 'white', aliases: ['white', 'wht', 'wite', 'br white', 'off white', 'glsy white', 'sparc white', 'pure white'] },
  { name: 'black', aliases: ['black', 'blk', 'block'] },
  { name: 'brown', aliases: ['brown', 'brwn'] },
  { name: 'signal red', aliases: ['signal red', 'p.o. red', 'po red', 'po.red'] },
  { name: 'red', aliases: ['red'] },
  { name: 'royal blue', aliases: ['royal blue', 'phthalo blue'] },
  { name: 'blue', aliases: ['blue'] },
  { name: 'bus green', aliases: ['bus green', 'leaf green'] },
  { name: 'green', aliases: ['green'] },
  { name: 'golden yellow', aliases: ['golden yellow', 'lemon yellow'] },
  { name: 'yellow', aliases: ['yellow'] },
  { name: 'smoke grey', aliases: ['smoke grey', 'deep grey'] },
  { name: 'grey', aliases: ['grey', 'gray'] },
  { name: 'orange', aliases: ['orange'] },
  { name: 'ivory', aliases: ['ivory'] }
];

// Product Category / Type Definitions
const PRODUCT_TYPES = [
  { type: 'emulsion', aliases: ['emulsion', 'emul', 'eml', 'apex', 'ace', 'tractor', 'royale', 'apcolite', 'dampproof', 'walmasta', 'weathercoat', 'silk'] },
  { type: 'enamel', aliases: ['enamel', 'enemel', 'enamal', 'glsy', 'glossy', 'satin', 'en '] },
  { type: 'primer', aliases: ['primer', 'primar', 'primr', 'red oxide', 'redoxide', 'yellow primer', 'metal primer', 'wood primer', 'pr ', 'ps ', 'bp '] },
  { type: 'putty', aliases: ['putty', 'putti', 'puty', 'puddy', 'wall putty', 'wallcare', 'wall care', 'patty', 'knife putty', 'shield max'] },
  { type: 'brush', aliases: ['brush', 'brsh', 'painting brush', 'paint brush', 'colour brush', 'tiger brush', 'mayil brush', 'br '] },
  { type: 'roller', aliases: ['roller', 'paint roller', 'cotton roller', 'foam roller', 'roller brush', 'ro '] },
  { type: 'thinner', aliases: ['thinner', 'thiner', 'tinner', 'nc thinner'] },
  { type: 'touchwood', aliases: ['touchwood', 'touch wood', 'wood polish', 'tw '] },
  { type: 'varnish', aliases: ['varnish', 'copal'] },
  { type: 'cement', aliases: ['cement', 'white cement', 'brilla'] },
  { type: 'distemper', aliases: ['distemper', 'dist'] },
  { type: 'spray', aliases: ['spray', 'spray paint', 'aerocare'] },
  { type: 'paint', aliases: ['paint', 'paints'] }
];

/**
 * Extracts structured attributes from a normalized search query or order line
 */
function extractAttributes(inputText) {
  if (!inputText) {
    return {
      brand: null,
      productType: null,
      variant: null,
      packSize: null,
      allPackSizes: [],
      quantity: 1,
      requestedUnit: 'PCS',
      isQuantityExplicit: false,
      searchCoreQuery: ''
    };
  }

  let text = inputText.trim();

  // 1. Detect Brand
  const brandObj = detectBrand(text);
  const brand = brandObj ? brandObj.brand : null;

  // 2. Extract Pack Sizes (Volume, Weight, or Dimension)
  const packSizes = extractPackSizes(text);
  const primaryPackSize = packSizes.length > 0 ? packSizes[0] : null;

  // 3. Extract Variant / Color
  let variant = null;
  const lower = text.toLowerCase();
  for (const v of COLOR_VARIANTS) {
    for (const al of v.aliases) {
      const reg = new RegExp(`\\b${al.replace(/\./g, '\\.')}\\b`, 'i');
      if (reg.test(lower)) {
        variant = v.name;
        break;
      }
    }
    if (variant) break;
  }

  // 4. Extract Product Type
  let productType = null;
  for (const pt of PRODUCT_TYPES) {
    for (const al of pt.aliases) {
      const reg = new RegExp(`\\b${al.replace(/\./g, '\\.')}\\b`, 'i');
      if (reg.test(lower)) {
        productType = pt.type;
        break;
      }
    }
    if (productType) break;
  }

  // 5. EXTRACT QUANTITY & REQUESTED PACKAGING UNIT (Distinct from Pack Size!)
  let quantity = 1;
  let requestedUnit = 'PCS';
  let isQuantityExplicit = false;

  // Strip extracted pack size text temporarily to avoid confusing e.g. "40kg" with quantity "40"
  let countSearchText = text;
  if (primaryPackSize) {
    countSearchText = countSearchText.replace(primaryPackSize.raw, ' ');
  }

  // A. Count with explicit packaging unit: e.g. "3 bags", "2 cans", "5 pcs", "10 nos", "2 buckets"
  const unitCountRegex = /\b(\d+(?:\.\d+)?)\s*(bags?|mootai|cans?|tins?|buckets?|dabbas?|boxes?|pkts?|packets?|sets?|rolls?|bundles?|kattu|pcs|pc|pieces?|nos?|numbers?|btl|bottles?)\b/i;
  const unitCountMatch = countSearchText.match(unitCountRegex);

  // B. Multiplier notation: e.g. "* 3", "x 2", "x2", "@ 5"
  const multiplierRegex = /(?:[\*\-\x\@\:]\s*|\bx\s*)(\d+(?:\.\d+)?)\s*$/i;
  const multiplierMatch = countSearchText.match(multiplierRegex);

  // C. Leading count: e.g. "3 putty 40kg" or "2 apex 20lt"
  const leadingCountRegex = /^(\d+(?:\.\d+)?)\s+(?=[a-zA-Z])/;
  const leadingCountMatch = countSearchText.match(leadingCountRegex);

  // D. Trailing integer count: e.g. "golden brown 1ltr 5"
  const trailingCountRegex = /\s+(\d+(?:\.\d+)?)$/;
  const trailingCountMatch = countSearchText.match(trailingCountRegex);

  if (unitCountMatch) {
    quantity = Math.max(0.01, parseFloat(unitCountMatch[1]) || 1);
    requestedUnit = standardizeUnit(unitCountMatch[2]);
    isQuantityExplicit = true;
    text = text.replace(unitCountMatch[0], ' ');
  } else if (multiplierMatch) {
    quantity = Math.max(0.01, parseFloat(multiplierMatch[1]) || 1);
    isQuantityExplicit = true;
    text = text.replace(multiplierMatch[0], ' ');
  } else if (leadingCountMatch && (!primaryPackSize || leadingCountMatch[1] !== String(primaryPackSize.size))) {
    quantity = Math.max(0.01, parseFloat(leadingCountMatch[1]) || 1);
    isQuantityExplicit = true;
    text = text.replace(leadingCountMatch[0], ' ');
  } else if (trailingCountMatch && (!primaryPackSize || trailingCountMatch[1] !== String(primaryPackSize.size))) {
    quantity = Math.max(0.01, parseFloat(trailingCountMatch[1]) || 1);
    isQuantityExplicit = true;
    text = text.replace(trailingCountMatch[0], ' ');
  } else if (primaryPackSize) {
    // Default sensible container unit when quantity is implicit
    if (primaryPackSize.unit === 'KG') requestedUnit = 'BAG';
    else if (primaryPackSize.unit === 'L') requestedUnit = 'CAN';
    else requestedUnit = 'PCS';
  }

  // 6. Clean Search Core Tokens (removes punctuation, preserves essential keywords)
  const searchCoreQuery = text
    .replace(/[^\w\s\"\.\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    brand,
    productType,
    variant,
    packSize: primaryPackSize,
    allPackSizes: packSizes,
    quantity,
    requestedUnit,
    isQuantityExplicit,
    searchCoreQuery
  };
}

module.exports = {
  COLOR_VARIANTS,
  PRODUCT_TYPES,
  extractAttributes
};
