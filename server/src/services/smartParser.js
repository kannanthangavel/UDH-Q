const { db } = require('../db/database');

// Common unit standardizations
const UNIT_MAP = {
  'ps': 'Nos',
  'pcs': 'Nos',
  'pc': 'Nos',
  'piece': 'Nos',
  'pieces': 'Nos',
  'no': 'Nos',
  'nos': 'Nos',
  'number': 'Nos',
  'numbers': 'Nos',
  'lt': 'Litre',
  'ltr': 'Litre',
  'liter': 'Litre',
  'liters': 'Litre',
  'litre': 'Litre',
  'litres': 'Litre',
  'l': 'Litre',
  'kg': 'Kg',
  'kgs': 'Kg',
  'kilo': 'Kg',
  'kilos': 'Kg',
  'bag': 'Bags',
  'bags': 'Bags',
  'can': 'Nos',
  'tin': 'Nos',
  'bucket': 'Nos',
  'box': 'Box',
  'boxes': 'Box',
  'pkt': 'Pocket',
  'packet': 'Pocket',
  'set': 'Set',
  'roll': 'Roll',
  'bundle': 'Bundle'
};

const TRADE_CORRECTIONS = [
  { pattern: /\bblock\b/gi, replacement: 'black' },
  { pattern: /\bwite\b|\bwhte\b/gi, replacement: 'white' },
  { pattern: /\benamal\b|\benaml\b/gi, replacement: 'enamel' },
  { pattern: /\bthiner\b|\btinner\b/gi, replacement: 'thinner' },
  { pattern: /\bbrsh\b/gi, replacement: 'brush' },
  { pattern: /\bputty\s*powder\b/gi, replacement: 'putty' },
  { pattern: /\bwall\s*putty\b/gi, replacement: 'putty' },
  { pattern: /\bfixit\b/gi, replacement: 'dr fixit' },
  { pattern: /\btouch\s*wood\b/gi, replacement: 'touchwood' }
];

function extractSpecs(text) {
  const specs = [];
  const clean = text.toLowerCase();

  // Volume: 1lt, 1ltr, 4lt, 20lt, 500ml, 200ml
  const volMatches = clean.match(/\b\d+(\.\d+)?\s*(lt|ltr|liter|litre|l|ml)\b/gi);
  if (volMatches) {
    volMatches.forEach(m => {
      let v = m.replace(/\s+/g, '').toUpperCase();
      v = v.replace('LTR', 'LT').replace('LITER', 'LT').replace('LITRE', 'LT');
      specs.push(v);
    });
  }

  // Weight: 40kg, 25kg, 20kg, 5kg, 1kg
  const wtMatches = clean.match(/\b\d+(\.\d+)?\s*(kg|kgs|kilo|gm)\b/gi);
  if (wtMatches) {
    wtMatches.forEach(m => {
      let w = m.replace(/\s+/g, '').toUpperCase();
      w = w.replace('KGS', 'KG').replace('KILO', 'KG');
      specs.push(w);
    });
  }

  // Dimensions / Brush sizes: 2", 1", 1 1/2", 3", 4", 2 inch
  // Match fraction first e.g. 1 1/2"
  const fracMatches = clean.match(/(?:\d+\s+)?\d+\/\d+\s*(?:\"|inch|in\b)/gi);
  if (fracMatches) {
    fracMatches.forEach(m => specs.push(m.replace(/\s+/g, '').replace(/inch|in/gi, '"')));
  } else {
    // Pure integer inch e.g. 2", 3", 4" (ensure not preceded by / or digit)
    const wholeMatches = clean.match(/(?<![\/\d])(\d+)\s*(?:\"|inch|in\b)/gi);
    if (wholeMatches) {
      wholeMatches.forEach(m => specs.push(m.replace(/\s+/g, '').replace(/inch|in/gi, '"')));
    }
  }

  return [...new Set(specs)];
}

function parseCustomerDetails(fullText) {
  let customerName = '';
  let customerPhone = '';

  const phoneMatch = fullText.match(/(?:\+91[\-\s]?)?[6789]\d{4}[\-\s]?\d{5}\b|(?:\+91[\-\s]?)?[6789]\d{9}\b/);
  if (phoneMatch) {
    const rawDigits = phoneMatch[0].replace(/\D/g, '');
    const clean10 = rawDigits.length > 10 ? rawDigits.slice(-10) : rawDigits;
    customerPhone = '+91 ' + clean10;
  }

  // Name match: e.g. Customer: Ramesh or Customer Name: Ramesh
  const nameMatch = fullText.match(/(?:customer|client|name|to|m\/s)[:\s\-]+([A-Za-z\s\.\&]{2,35}?)(?:\+91|\d{10}|\n|,|$)/i);
  if (nameMatch) {
    customerName = nameMatch[1].trim();
  }

  return { customerName, customerPhone };
}

function parseRequirementLine(line) {
  if (!line || !line.trim()) return null;
  let raw = line.trim();

  // Ignore chat timestamps e.g. [10:30 am, 5/11/2026]
  raw = raw.replace(/\[\d{1,2}:\d{2}\s*(?:am|pm)?,\s*[^\]]+\]/gi, '').trim();

  // If this line is just metadata like "Customer: Ramesh" or "Site: Perundurai", skip it as a product line
  if (/^(customer|client|name|phone|mobile|date|site|address|delivery|location|note|gst|gstin|email)[:\s\-]/i.test(raw)) {
    return null;
  }

  // Ignore greetings or non-product lines
  const lower = raw.toLowerCase();
  if (
    /^(hi|hello|sir|vanakkam|good\s*morning|good\s*afternoon|quote|quotation|rate\s*send|price\s*send|please\s*send|need\s*rates?|send\s*bill)/i.test(lower) &&
    raw.split(' ').length < 5 &&
    !/\d/.test(raw)
  ) {
    return null;
  }

  let cleanedText = raw;
  for (const { pattern, replacement } of TRADE_CORRECTIONS) {
    cleanedText = cleanedText.replace(pattern, replacement);
  }

  const specs = extractSpecs(cleanedText);

  // Extract Quantity and Unit
  let quantity = 1;
  let unit = 'Nos';
  let isQuantityExplicit = false;

  // 1. Explicit count with unit (e.g., 5ps, 5 nos, 5 pcs, 2 tin, 3 can, 10 box)
  const countWithUnitRegex = /(\d+(?:\.\d+)?)\s*(ps|pcs|pc|pieces?|nos?|numbers?|can|tin|buckets?|boxes?|pkts?|packets?|sets?|rolls?|bundles?)\b/i;
  const countMatch = cleanedText.match(countWithUnitRegex);

  // 2. Count at start or end of line (e.g., "5 golden brown" or "golden brown 5")
  const leadingCountMatch = cleanedText.match(/^(\d+(?:\.\d+)?)\s+(?=[a-zA-Z])/);
  const trailingCountMatch = cleanedText.match(/\s+(\d+(?:\.\d+)?)$/);

  if (countMatch) {
    quantity = parseFloat(countMatch[1]);
    const rawU = countMatch[2].toLowerCase();
    unit = UNIT_MAP[rawU] || 'Nos';
    isQuantityExplicit = true;
    cleanedText = cleanedText.replace(countMatch[0], ' ');
  } else if (leadingCountMatch) {
    quantity = parseFloat(leadingCountMatch[1]);
    isQuantityExplicit = true;
    cleanedText = cleanedText.replace(leadingCountMatch[0], ' ');
  } else if (trailingCountMatch) {
    quantity = parseFloat(trailingCountMatch[1]);
    isQuantityExplicit = true;
    cleanedText = cleanedText.replace(trailingCountMatch[0], ' ');
  } else if (specs.length > 0) {
    quantity = 1;
    if (specs.some(s => s.includes('KG'))) {
      unit = 'Bags';
    } else if (specs.some(s => s.includes('LT'))) {
      unit = 'Litre';
    }
  }

  // Clean keywords for searching
  let searchTokens = cleanedText
    .replace(/[^\w\s\"\.\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(t => t.length > 0 && !['of', 'need', 'req', 'required', 'pls', 'please', 'for', 'send'].includes(t.toLowerCase()));

  return {
    originalLine: raw,
    cleanedText: cleanedText.trim(),
    searchTokens,
    specs,
    quantity,
    unit,
    isQuantityExplicit
  };
}

/**
 * Intelligent Multi-Stage Product Matcher
 * Finds exact or closest matching products from SQLite database
 */
function matchProductsForRequirement(parsedReq) {
  const { originalLine, searchTokens, specs, quantity, unit } = parsedReq;

  const searchWords = searchTokens.filter(w => w.length > 1);
  if (searchWords.length === 0 && specs.length === 0) {
    return {
      originalLine,
      matchedProduct: null,
      quantity,
      unit,
      confidence: 'None',
      candidates: []
    };
  }

  // Construct flexible search query
  let sql = 'SELECT id, s_no, item_name, details, sale_rate, main_unit, hsn_sac, section FROM products WHERE is_active = 1';
  const params = [];

  const keywordConditions = [];
  for (const word of searchWords.slice(0, 4)) {
    keywordConditions.push('item_name LIKE ?');
    params.push(`%${word}%`);
  }

  for (const spec of specs) {
    keywordConditions.push('item_name LIKE ?');
    params.push(`%${spec}%`);
  }

  if (keywordConditions.length > 0) {
    sql += ' AND (' + keywordConditions.join(' OR ') + ')';
  }

  sql += ' LIMIT 150';

  const potentialProducts = db.prepare(sql).all(...params);

  if (potentialProducts.length === 0) {
    return {
      originalLine,
      matchedProduct: null,
      quantity,
      unit,
      confidence: 'None',
      explanation: 'No product found matching terms in database.',
      candidates: []
    };
  }

  // Score each candidate
  const scored = [];
  const lowerLine = originalLine.toLowerCase();

  for (const prod of potentialProducts) {
    const prodName = prod.item_name.toLowerCase();
    let score = 0;

    // A. Keyword overlap
    for (const word of searchWords) {
      const w = word.toLowerCase();
      if (prodName.includes(w)) {
        score += 25;
      }
    }

    // B. Specification match (e.g. 1LT, 40KG, 2")
    for (const spec of specs) {
      const s = spec.toLowerCase();
      if (s === '2"') {
        // Strict 2 inch check: ensure not 1/2", 1 1/2", 11/2", 2 1/2"
        const isFraction = /\d+\/\d+/.test(prodName);
        if (prodName.includes('2"') && !isFraction) {
          score += 70;
        } else if (isFraction) {
          score -= 50;
        }
      } else if (prodName.includes(s)) {
        score += 40;
      }
    }

    // C. Non-spray preference unless spray paint asked
    if (!lowerLine.includes('spray') && prodName.includes('spray')) {
      score -= 25;
    }

    // D. Unit match bonus
    if (prod.main_unit && unit && prod.main_unit.toLowerCase() === unit.toLowerCase()) {
      score += 10;
    }

    // E. Rate > 0 bonus
    if (prod.sale_rate > 0) {
      score += 5;
    }

    // F. Direct brand matching bonus
    if (/brush/i.test(lowerLine) && /^br\s+/i.test(prod.item_name)) {
      score += 30; // Trade standard: brush items start with "BR "
    }
    if (/roller/i.test(lowerLine) && (/roller/i.test(prodName) || /^ro\s+/i.test(prod.item_name))) {
      score += 30;
    }

    scored.push({
      product: prod,
      score
    });
  }

  // Sort descending by score
  scored.sort((a, b) => b.score - a.score);

  const top = scored[0];
  const candidates = scored.slice(0, 6).map(s => ({
    id: s.product.id,
    s_no: s.product.s_no,
    item_name: s.product.item_name,
    sale_rate: s.product.sale_rate,
    main_unit: s.product.main_unit,
    hsn_sac: s.product.hsn_sac,
    section: s.product.section,
    score: s.score
  }));

  let confidence = 'Medium';
  if (top.score >= 60) confidence = 'High';
  else if (top.score < 30) confidence = 'Low';

  return {
    originalLine,
    matchedProduct: top ? candidates[0] : null,
    quantity,
    unit: top?.product?.main_unit || unit,
    confidence,
    candidates
  };
}

function processWhatsAppMessage(messageText) {
  if (!messageText || typeof messageText !== 'string' || !messageText.trim()) {
    return {
      success: false,
      error: 'Message text is empty'
    };
  }

  const { customerName, customerPhone } = parseCustomerDetails(messageText);
  const lines = messageText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  const results = [];
  for (const line of lines) {
    const parsed = parseRequirementLine(line);
    if (parsed) {
      const matched = matchProductsForRequirement(parsed);
      results.push(matched);
    }
  }

  return {
    success: true,
    customerName,
    customerPhone,
    totalItems: results.length,
    items: results
  };
}

module.exports = {
  processWhatsAppMessage,
  parseRequirementLine,
  matchProductsForRequirement
};
