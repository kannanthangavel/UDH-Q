const { db } = require('../db/database');
const { normalizeText } = require('./excelParser');

// Common aliases for hardware and construction products
const PRODUCT_ALIASES = [
  { pattern: /\bopc(\s*cement)?\b/i, alias: 'opc 53 grade cement' },
  { pattern: /\bppc(\s*cement)?\b/i, alias: 'ppc portland pozzolana cement' },
  { pattern: /\bsteel\s*(rods?|bars?|kambi)\b/i, alias: 'tmt steel rods fe550d' },
  { pattern: /\bpaint\s*buckets?\b/i, alias: 'asian paints apex emulsion bucket' },
  { pattern: /\bputty\b/i, alias: 'birla white wall care putty' },
  { pattern: /\bwaterproof(ing)?\b/i, alias: 'dr fixit pidiproof' },
  { pattern: /\bpvc\s*pipes?\b/i, alias: 'finolex pvc pipe' },
  { pattern: /\bwire\b/i, alias: 'finolex flame retardant wire' }
];

/**
 * Calculates similarity between two strings based on token overlap
 */
function calculateTokenScore(queryTokens, targetTokens) {
  if (queryTokens.length === 0 || targetTokens.length === 0) return 0;
  let matches = 0;
  for (const q of queryTokens) {
    if (targetTokens.some(t => t === q || (t.length > 3 && (t.startsWith(q) || q.startsWith(t))))) {
      matches++;
    }
  }
  return matches / Math.max(queryTokens.length, 1);
}

/**
 * Extracts dimensions/specs like '12mm', '10mm', '1lt', '20l', '40kg' from text
 */
function extractSpecs(text) {
  if (!text) return [];
  const matches = String(text).toLowerCase().match(/\b\d+(\.\d+)?\s*(mm|cm|inch|in|ft|meter|mtr|lt|ltr|litre|liter|l|ml|kg|kgs|gm|g|ton|tonne)\b/g);
  return matches ? matches.map(s => s.replace(/\s+/g, '')) : [];
}

/**
 * Matches extracted items against products in the active price list
 */
function matchItem(extractedItem, activePriceListId) {
  // If no active price list is specified, find the currently active one
  let priceListId = activePriceListId;
  if (!priceListId) {
    const active = db.prepare('SELECT id FROM price_lists WHERE is_active = 1 LIMIT 1').get();
    if (!active) {
      return {
        ...extractedItem,
        matchedProduct: null,
        matchStatus: 'No Match',
        confidence: 0,
        explanation: 'No active price list found in the database. Please import a price list first.',
        candidates: []
      };
    }
    priceListId = active.id;
  }

  // Load all products for the active price list
  const products = db.prepare(`
    SELECT id, item_code, product_name, normalized_name, specification,
           brand, category, unit, sales_rate, purchase_rate, is_tax_inclusive,
           gst_rate, hsn_code, price_status
    FROM products
    WHERE price_list_id = ?
  `).all(priceListId);

  if (products.length === 0) {
    return {
      ...extractedItem,
      matchedProduct: null,
      matchStatus: 'No Match',
      confidence: 0,
      explanation: 'Active price list has no products.',
      candidates: []
    };
  }

  const queryName = normalizeText(extractedItem.productName || extractedItem.rawPhrase);
  const queryTokens = queryName.split(' ').filter(t => t.length > 1);
  const querySpecs = extractSpecs(`${extractedItem.specification || ''} ${extractedItem.productName || ''} ${extractedItem.rawPhrase || ''}`);

  // 1. Stage 1: Exact Item Code Match
  if (extractedItem.itemCode) {
    const exactCode = products.find(p => p.item_code && p.item_code.toLowerCase() === extractedItem.itemCode.toLowerCase());
    if (exactCode) {
      return formatMatchResult(extractedItem, exactCode, 'Exact Match', 100, 'Matched exact item code.', []);
    }
  }

  // Check if query starts with or equals an exact item code in price list
  const codeMatch = products.find(p => p.item_code && queryName.toLowerCase() === p.item_code.toLowerCase());
  if (codeMatch) {
    return formatMatchResult(extractedItem, codeMatch, 'Exact Match', 100, 'Matched exact item code.', []);
  }

  // 2. Stage 2: Exact Normalized Name Match
  const exactName = products.find(p => p.normalized_name === queryName || normalizeText(p.product_name) === queryName);
  if (exactName) {
    return formatMatchResult(extractedItem, exactName, 'Exact Match', 98, 'Matched exact product name.', []);
  }

  // 3. Stage 3 & 4: Alias expansion and Scored Matching
  let expandedQuery = queryName;
  for (const { pattern, alias } of PRODUCT_ALIASES) {
    if (pattern.test(extractedItem.rawPhrase) || pattern.test(queryName)) {
      expandedQuery += ' ' + alias;
    }
  }
  const expandedTokens = expandedQuery.split(' ').filter(t => t.length > 1);

  // Score all candidate products
  const scoredCandidates = [];

  for (const product of products) {
    const productTokens = product.normalized_name.split(' ').filter(t => t.length > 1);
    const productSpecs = extractSpecs(`${product.specification || ''} ${product.product_name || ''}`);

    // Check specification conflict (e.g. query has 12mm but product has 10mm)
    let specConflict = false;
    let specMatch = false;

    if (querySpecs.length > 0 && productSpecs.length > 0) {
      const commonSpecs = querySpecs.filter(qs => productSpecs.includes(qs));
      if (commonSpecs.length > 0) {
        specMatch = true;
      } else {
        // Conflicting dimension (e.g. 10mm vs 12mm)
        specConflict = true;
      }
    }

    if (specConflict) {
      // Never match conflicting specifications
      continue;
    }

    let tokenScore = calculateTokenScore(expandedTokens, productTokens);
    if (specMatch) {
      tokenScore += 0.35; // Significant boost for matching exact specification
    }

    // Category / brand bonus if query includes them
    if (product.brand && queryName.includes(product.brand.toLowerCase())) {
      tokenScore += 0.15;
    }
    if (product.category && queryName.includes(product.category.toLowerCase())) {
      tokenScore += 0.10;
    }

    if (tokenScore >= 0.35) {
      scoredCandidates.push({
        product,
        score: Math.min(Math.round(tokenScore * 100), 99)
      });
    }
  }

  // Sort descending by score
  scoredCandidates.sort((a, b) => b.score - a.score);

  if (scoredCandidates.length === 0) {
    return {
      ...extractedItem,
      matchedProduct: null,
      matchStatus: 'No Match',
      confidence: 0,
      explanation: 'No matching product found in the uploaded price list.',
      candidates: []
    };
  }

  const topMatch = scoredCandidates[0];
  const secondMatch = scoredCandidates[1];

  // Ambiguity check: if top two matches are within 10 points and both high score
  if (secondMatch && (topMatch.score - secondMatch.score <= 10) && topMatch.score < 90) {
    return {
      ...extractedItem,
      matchedProduct: topMatch.product,
      matchStatus: 'Multiple Possible Matches',
      confidence: topMatch.score,
      explanation: `Multiple similar products found ("${topMatch.product.product_name}" vs "${secondMatch.product.product_name}"). Manual selection required.`,
      candidates: scoredCandidates.slice(0, 5).map(c => ({
        id: c.product.id,
        item_code: c.product.item_code,
        product_name: c.product.product_name,
        specification: c.product.specification,
        sales_rate: c.product.sales_rate,
        unit: c.product.unit,
        score: c.score
      }))
    };
  }

  // High confidence single match
  if (topMatch.score >= 80) {
    return formatMatchResult(extractedItem, topMatch.product, 'Exact Match', topMatch.score, 'Strong match on name and specifications.', scoredCandidates.slice(1, 4).map(c => c.product));
  } else if (topMatch.score >= 50) {
    return formatMatchResult(extractedItem, topMatch.product, 'Strong Match — Review', topMatch.score, 'Fuzzy match. Operator review recommended.', scoredCandidates.slice(1, 4).map(c => c.product));
  } else {
    return {
      ...extractedItem,
      matchedProduct: topMatch.product,
      matchStatus: 'Multiple Possible Matches',
      confidence: topMatch.score,
      explanation: 'Low confidence match. Please verify or pick from the price list.',
      candidates: scoredCandidates.slice(0, 5).map(c => c.product)
    };
  }
}

function formatMatchResult(extractedItem, product, defaultStatus, confidence, explanation, alternateCandidates) {
  let status = defaultStatus;
  let warnMsg = '';

  // Check price and unit validity
  if (!product.sales_rate || product.sales_rate <= 0) {
    status = 'Missing Price';
    warnMsg = 'Product exists in price list but has no verified sales rate.';
  } else if (!product.unit && !extractedItem.unit) {
    status = 'Missing Unit';
    warnMsg = 'Neither customer message nor price list specified a unit.';
  }

  return {
    ...extractedItem,
    matchedProduct: product,
    matchStatus: status,
    confidence,
    explanation: warnMsg ? `${explanation} (${warnMsg})` : explanation,
    candidates: (alternateCandidates || []).slice(0, 4)
  };
}

/**
 * Matches an array of extracted items against the active price list
 */
function matchAllItems(extractedItems, priceListId) {
  return extractedItems.map(item => matchItem(item, priceListId));
}

module.exports = {
  PRODUCT_ALIASES,
  extractSpecs,
  calculateTokenScore,
  matchItem,
  matchAllItems
};
