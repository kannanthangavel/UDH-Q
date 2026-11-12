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
  { pattern: /\bwire\b/i, alias: 'finolex flame retardant wire' },
  // Paint & hardware trade expansions
  { pattern: /\b(green|black|red|blue|white|yellow|grey|brown)\s+paint\b/i, alias: 'enamel en glossy-enamel' },
  { pattern: /\benamel\s+thinner\b/i, alias: 'thinner mel thinner normal' },
  { pattern: /\bbrush\b/i, alias: 'br udaya mahendra jaya touchwood' }
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
 * Extracts dimensions/specs like '2"', '1 1/2"', '12mm', '10mm', '500ml', '1lt', '20l', '40kg' from text
 */
function extractSpecs(text) {
  if (!text) return [];
  const clean = String(text).toLowerCase();
  const specs = [];

  // 1. Mixed or simple fraction inch: "1 1/2\"", "2 1/2\"", "1/2\"", "11/2\""
  const mixedMatches = clean.matchAll(/(?:(\d+)\s+)?(\d+)\/(\d+)\s*(?:\"|''|inch|in\b)/g);
  for (const m of mixedMatches) {
    const whole = m[1] ? parseFloat(m[1]) : 0;
    const num = parseFloat(m[2]);
    const den = parseFloat(m[3]);
    if (den !== 0) {
      let val = whole + (num / den);
      if (!m[1] && num === 11 && den === 2) {
        val = 1.5; // "11/2\"" in hardware catalog is 1 1/2 inch
      }
      specs.push(`${val}inch`);
    }
  }

  // 2. Whole or decimal inch: "2\"", "2 inch", "2 in" (not preceded by / or digit)
  const wholeMatches = clean.matchAll(/(?<![\/\d])(\d+(?:\.\d+)?)\s*(?:\"|''|inch|in\b)/g);
  for (const m of wholeMatches) {
    specs.push(`${m[1]}inch`);
  }

  // 3. Match mm, cm, ft, mtr
  const dimMatches = clean.match(/\b\d+(\.\d+)?\s*(mm|cm|ft|feet|meter|mtr)\b/g);
  if (dimMatches) {
    dimMatches.forEach(m => specs.push(m.replace(/\s+/g, '')));
  }

  // 4. Match volume: 500ml, 5ooml, 1lt, 1ltr, 1/2lt, 20lt, 4lt
  const volMatches = clean.match(/\b\d+(\.\d+)?\s*(ml|lt|ltr|liter|litre|l)\b|\b5[o0]{2}\s*ml\b|\b1\/2\s*(?:lt|ltr|litre|l)\b/g);
  if (volMatches) {
    volMatches.forEach(m => {
      let v = m.replace(/\s+/g, '').replace(/o/g, '0');
      if (v.includes('1/2') || v === '500ml') {
        specs.push('500ml');
      } else if (v.includes('1/4') || v === '250ml') {
        specs.push('250ml');
      } else if (v === '1lt' || v === '1ltr' || v === '1l') {
        specs.push('1lt');
      } else {
        specs.push(v);
      }
    });
  }

  // 5. Match weights: kg, gm
  const wtMatches = clean.match(/\b\d+(\.\d+)?\s*(kg|kgs|gm|g|ton)\b/g);
  if (wtMatches) {
    wtMatches.forEach(m => specs.push(m.replace(/\s+/g, '')));
  }

  return [...new Set(specs)];
}

/**
 * Matches extracted items against products in the active price lists
 */
function matchItem(extractedItem, activePriceListId) {
  let products;
  if (activePriceListId) {
    products = db.prepare(`
      SELECT id, price_list_id, item_code, product_name, normalized_name, specification,
             brand, category, unit, sales_rate, purchase_rate, is_tax_inclusive,
             gst_rate, hsn_code, price_status
      FROM products
      WHERE price_list_id = ?
    `).all(activePriceListId);
  } else {
    // Search across ALL active price lists (supports multi-sheet catalogs like PAINTS + ACCESS)
    products = db.prepare(`
      SELECT id, price_list_id, item_code, product_name, normalized_name, specification,
             brand, category, unit, sales_rate, purchase_rate, is_tax_inclusive,
             gst_rate, hsn_code, price_status
      FROM products
      WHERE price_list_id IN (SELECT id FROM price_lists WHERE is_active = 1)
    `).all();

    // Fallback if no active price list is flagged
    if (products.length === 0) {
      products = db.prepare(`
        SELECT id, price_list_id, item_code, product_name, normalized_name, specification,
               brand, category, unit, sales_rate, purchase_rate, is_tax_inclusive,
               gst_rate, hsn_code, price_status
        FROM products
        LIMIT 5000
      `).all();
    }
  }

  if (products.length === 0) {
    return {
      ...extractedItem,
      matchedProduct: null,
      matchStatus: 'No Match',
      confidence: 0,
      explanation: 'No active price list found in the database. Please import a price list first.',
      candidates: []
    };
  }

  const queryText = `${extractedItem.productName || ''} ${extractedItem.specification || ''}`.trim();
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
  const exactName = products.find(p => {
    const isNameMatch = (p.normalized_name === queryName || normalizeText(p.product_name) === queryName);
    if (!isNameMatch) return false;
    // If the customer specified dimensions/specs (e.g. 2", 500ml), don't match a generic product without specs
    if (querySpecs.length > 0) {
      const pSpecs = extractSpecs(`${p.specification || ''} ${p.product_name || ''}`);
      if (!querySpecs.every(qs => pSpecs.includes(qs))) return false;
    }
    return p.sales_rate && p.sales_rate > 0;
  });
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

  // Category anchor constraints
  const mustHaveThinner = /\bthinner\b/i.test(queryText);
  const mustHaveBrush = /\bbrush\b/i.test(queryText);
  const mustHavePaintColor = queryText.match(/\b(green|black|red|blue|white|yellow|grey|brown)\b/i);

  const scoredCandidates = [];

  for (const product of products) {
    const prodName = product.product_name;
    const prodNorm = product.normalized_name;
    const productTokens = prodNorm.split(' ').filter(t => t.length > 1);
    const productSpecs = extractSpecs(`${product.specification || ''} ${prodName}`);

    // Constraint 1: Thinner queries must be thinners
    if (mustHaveThinner && !/thinner/i.test(prodName)) {
      continue;
    }

    // Constraint 2: Brush queries must be brushes
    if (mustHaveBrush && !/brush|roller/i.test(prodName) && !/^zz\s*br\s*/i.test(prodName) && !/^br\s*\d/i.test(prodName)) {
      continue;
    }

    // Constraint 3: Paint color matching (e.g. green must have green, black must have black)
    if (mustHavePaintColor) {
      const requiredColor = mustHavePaintColor[1].toLowerCase();
      const colorRegex = new RegExp(`\\b${requiredColor}\\b`, 'i');
      if (!colorRegex.test(prodName) && !colorRegex.test(product.specification || '')) {
        continue;
      }
    }

    // Check specification conflict (e.g. query has 12mm but product has 10mm, or 2" vs 1")
    let specConflict = false;
    let specMatch = false;

    if (querySpecs.length > 0 && productSpecs.length > 0) {
      const commonSpecs = querySpecs.filter(qs => productSpecs.includes(qs));
      if (commonSpecs.length > 0) {
        specMatch = true;
      } else {
        specConflict = true;
      }
    }

    if (specConflict) {
      // Never match conflicting specifications
      continue;
    }

    let tokenScore = calculateTokenScore(expandedTokens, productTokens);
    if (specMatch) {
      tokenScore += 0.45; // Significant boost for matching exact specification
    }

    // Rate availability bonus
    if (product.sales_rate && product.sales_rate > 0) {
      tokenScore += 0.05;
    } else {
      tokenScore -= 0.20; // Penalize products with rate 0
    }

    // Prefer standard liquid paint tins (Asian Paints, Berger, Addition) over spray paint unless spray requested
    if (!/spray/i.test(queryText) && /spray/i.test(prodName)) {
      tokenScore -= 0.15;
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
    return formatMatchResult(extractedItem, topMatch.product, 'Exact Match', topMatch.score, 'Strong match on name and specifications.', scoredCandidates.slice(1, 5).map(c => c.product));
  } else if (topMatch.score >= 50) {
    return formatMatchResult(extractedItem, topMatch.product, 'Strong Match — Review', topMatch.score, 'Fuzzy match. Operator review recommended.', scoredCandidates.slice(1, 5).map(c => c.product));
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
    itemCode: product ? product.item_code : (extractedItem.itemCode || null),
    hsnCode: product ? product.hsn_code : '',
    salesRate: product ? (product.sales_rate || 0) : 0,
    gstRate: product ? (product.gst_rate || 18) : 18,
    isTaxInclusive: product ? (product.is_tax_inclusive !== 0) : true,
    unit: extractedItem.unit || (product ? product.unit : 'Nos'),
    matchStatus: status,
    confidence,
    explanation: warnMsg ? `${explanation} (${warnMsg})` : explanation,
    candidates: (alternateCandidates || []).slice(0, 5)
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
