const { db } = require('../db/database');
const { searchProductsSmart, extractProductSpecs, getSisterSizes, levenshteinDistance } = require('./productSearchService');
const { matchProduct } = require('./product-matching');

// Comprehensive Indian / Tamil hardware & paint unit standardizations
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
  'can': 'Nos',
  'cans': 'Nos',
  'tin': 'Nos',
  'tins': 'Nos',
  'dabba': 'Nos',
  'dabbas': 'Nos',
  'bucket': 'Nos',
  'buckets': 'Nos',
  'bottle': 'Nos',
  'bottles': 'Nos',
  'btl': 'Nos',
  'bag': 'Bags',
  'bags': 'Bags',
  'mootai': 'Bags',
  'box': 'Box',
  'boxes': 'Box',
  'pkt': 'Pocket',
  'pkts': 'Pocket',
  'packet': 'Pocket',
  'packets': 'Pocket',
  'set': 'Set',
  'sets': 'Set',
  'roll': 'Roll',
  'rolls': 'Roll',
  'bundle': 'Bundle',
  'bundles': 'Bundle',
  'kattu': 'Bundle',
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
  'kilos': 'Kg'
};

const TRADE_PHRASE_NORMALIZATION = [
  // Brand & Model expansions for exact catalog hit (prevent double-prefixing)
  { pattern: /\b(?:asian\s*paints?|ap)\s+(apex|ace|tractor|royale|apcolite|dampproof|smartcare)\b/gi, replacement: 'AS $1' },
  { pattern: /(?<!AS\s+)\b(apex|ace|tractor|royale|apcolite)\b/gi, replacement: 'AS $1' },
  { pattern: /\b(?:berger|bp)\s+(bison|walmasta|weathercoat|luxol)\b/gi, replacement: 'BR $1' },
  { pattern: /(?<!BR\s+)\b(bison|walmasta|weathercoat|luxol)\b/gi, replacement: 'BR $1' },
  { pattern: /\b(?:dr\s*fixit|dr\.fixit|pidilite)\s*(302|101|urp|lw\+?|fastflex|primecoat)\b/gi, replacement: 'DR FIXIT $1' },
  { pattern: /(?<!DR\s+)\b(fixit|pidilite)\b/gi, replacement: 'DR FIXIT' },
  { pattern: /\b(birla\s*white|birla)\s*(putty|wall\s*care)?\b/gi, replacement: 'BIRLA WHITE WALL CARE PUTTY' },
  { pattern: /\b(jk\s*cement|jk)\s*(putty|shield\s*max)?\b/gi, replacement: 'JK PUTTY SHIELD MAX' },
  { pattern: /\b(touch\s*wood|touchwood)\b/gi, replacement: 'TOUCH WOOD' },
  { pattern: /\b(putty\s*powder|wall\s*putty|patty\s*powder|patti)\b/gi, replacement: 'PUTTY' },
  { pattern: /\b(red\s*oxide|yellow\s*primer|metal\s*primer)(?!\s+primer)\b/gi, replacement: '$1 PRIMER' },
  { pattern: /\b(foam\s*roller|cotton\s*roller|roller\s*brush)\b/gi, replacement: 'ROLLER' },
  { pattern: /\b(tiger\s*brush|mayil\s*brush|paint\s*brush)\b/gi, replacement: 'BRUSH' },
  { pattern: /\bthiner\b|\btinner\b/gi, replacement: 'thinner' },
  { pattern: /\benamal\b|\benaml\b/gi, replacement: 'enamel' },
  { pattern: /\bwite\b|\bwhte\b/gi, replacement: 'white' },
  { pattern: /\bblock\b/gi, replacement: 'black' },
  { pattern: /\bbrwn\b/gi, replacement: 'brown' }
];

function cleanWhatsAppNoise(raw) {
  if (!raw) return '';
  return raw
    // Strip WhatsApp date-time header e.g. [10:30 am, 5/11/2026] Kannan: or 05/11/26, 10:45 AM - Kannan:
    .replace(/\[\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4},?\s*\d{1,2}:\d{2}(?::\d{2})?\s*(?:am|pm)?\]\s*[^:]*:\s*/gi, '')
    .replace(/\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4},?\s*\d{1,2}:\d{2}(?::\d{2})?\s*(?:am|pm)?\s*[\-\–]\s*[^:]*:\s*/gi, '')
    // Strip bullet markers e.g. * - • 1. 2)
    .replace(/^[\s\*\-\•\>]*(?:\d+[\.\)\-]\s*)?/, '')
    .trim();
}

function parseCustomerDetails(fullText) {
  let customerName = '';
  let customerPhone = '';

  // Extract phone (+91 optional, 10-digit mobile starting with 6, 7, 8, 9)
  const phoneMatch = fullText.match(/(?:\+91[\-\s]?)?[6789]\d{4}[\-\s]?\d{5}\b|(?:\+91[\-\s]?)?[6789]\d{9}\b/);
  if (phoneMatch) {
    const rawDigits = phoneMatch[0].replace(/\D/g, '');
    const clean10 = rawDigits.length > 10 ? rawDigits.slice(-10) : rawDigits;
    customerPhone = '+91 ' + clean10;
  }

  // Extract name: e.g. "Customer: Ramesh", "Client: Kumar", "To: Ramesh Builders"
  const nameMatch = fullText.match(/(?:customer|client|name|to|m\/s|mr|from)[:\s\-]+([A-Za-z\s\.\&]{2,35}?)(?:\+91|\d{10}|\n|,|$)/i);
  if (nameMatch && nameMatch[1]) {
    const cand = nameMatch[1].trim();
    if (!/^(hi|hello|quote|quotation|sir|order)/i.test(cand)) {
      customerName = cand;
    }
  }

  return { customerName, customerPhone };
}

function parseRequirementLine(line) {
  if (!line || !line.trim()) return null;
  let raw = cleanWhatsAppNoise(line);
  if (!raw) return null;

  // Skip standalone metadata lines (e.g. "Customer: Ramesh", "Site: Perundurai Bypass")
  if (/^(customer|client|name|phone|mobile|date|site|address|delivery|location|note|gst|gstin|email)[:\s\-]/i.test(raw)) {
    return null;
  }

  // Skip greetings, thank yous, or generic non-order sentences
  const lower = raw.toLowerCase();
  if (
    /^(hi|hello|sir|vanakkam|good\s*morning|good\s*afternoon|quote|quotation|rate\s*send|price\s*send|please\s*send|need\s*rates?|send\s*bill|bill\s*send|total\s*send|thanks|thank\s*you)/i.test(lower) &&
    raw.split(/\s+/).length < 5 &&
    !/\d/.test(raw)
  ) {
    return null;
  }

  let cleanedText = raw;
  for (const { pattern, replacement } of TRADE_PHRASE_NORMALIZATION) {
    cleanedText = cleanedText.replace(pattern, replacement);
  }

  // Extract Pack Size / Volume Specs (e.g. 20LT, 40KG, 2")
  const specs = extractProductSpecs(cleanedText);

  // Extract Quantity & Unit
  let quantity = 1;
  let unit = 'Nos';
  let isQuantityExplicit = false;

  // 1. Explicit count with unit (e.g., 5ps, 5 nos, 5 pcs, 2 can, 2 tin, 10 box, 5 bags)
  const countWithUnitRegex = /(\d+(?:\.\d+)?)\s*(ps|pcs|pc|pieces?|nos?|numbers?|cans?|tins?|buckets?|dabbas?|boxes?|pkts?|packets?|sets?|rolls?|bundles?|kattu|bags?|mootai|bottles?|btl)\b/i;
  const countMatch = cleanedText.match(countWithUnitRegex);

  // 2. Multiplier notation e.g. "apex 20lt x 2" or "putty 40kg * 5" or "brush 2" @ 3"
  const multiplierMatch = cleanedText.match(/[\s\*\-\x\@\:]\s*(\d+(?:\.\d+)?)\s*(?:nos|pcs|can|bag)?$/i);

  // 3. Leading count e.g. "2 apex 20lt" or "5 putty 40kg"
  const leadingCountMatch = cleanedText.match(/^(\d+(?:\.\d+)?)\s+(?=[a-zA-Z])/);

  // 4. Trailing integer count e.g. "golden brown 1ltr 5" or "apex 20lt 2"
  const trailingCountMatch = cleanedText.match(/\s+(\d+(?:\.\d+)?)$/);

  if (countMatch) {
    quantity = Math.max(0.01, parseFloat(countMatch[1]) || 1);
    const rawU = countMatch[2].toLowerCase();
    unit = UNIT_MAP[rawU] || 'Nos';
    isQuantityExplicit = true;
    cleanedText = cleanedText.replace(countMatch[0], ' ');
  } else if (multiplierMatch && !specs.some(s => s.replace(/\D/g, '') === multiplierMatch[1])) {
    quantity = Math.max(0.01, parseFloat(multiplierMatch[1]) || 1);
    isQuantityExplicit = true;
    cleanedText = cleanedText.replace(multiplierMatch[0], ' ');
  } else if (leadingCountMatch && !specs.some(s => s.replace(/\D/g, '') === leadingCountMatch[1])) {
    quantity = Math.max(0.01, parseFloat(leadingCountMatch[1]) || 1);
    isQuantityExplicit = true;
    cleanedText = cleanedText.replace(leadingCountMatch[0], ' ');
  } else if (trailingCountMatch && !specs.some(s => s.replace(/\D/g, '') === trailingCountMatch[1])) {
    quantity = Math.max(0.01, parseFloat(trailingCountMatch[1]) || 1);
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

  // Build clean search query for the multi-attribute matching engine
  let searchTokens = cleanedText
    .replace(/[^\w\s\"\.\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(t => t.length > 0 && !['of', 'need', 'req', 'required', 'pls', 'please', 'for', 'send', 'sendme', 'want'].includes(t.toLowerCase()));

  const cleanSearchQuery = searchTokens.join(' ').trim();

  return {
    originalLine: raw,
    cleanSearchQuery: cleanSearchQuery || raw,
    specs,
    quantity,
    unit,
    isQuantityExplicit
  };
}

/**
 * Intelligent Multi-Candidate Product Matcher
 * Executes search across all 5,300+ indexed catalog products using the Advanced Product Matching Engine
 */
function matchProductsForRequirement(parsedReq) {
  const { originalLine, cleanSearchQuery, isQuantityExplicit } = parsedReq;

  // Use the Advanced Multi-Stage Product Keyword Matching Engine
  const matchResult = matchProduct(cleanSearchQuery || originalLine);

  const matchedProduct = matchResult.matchedProduct;
  const candidates = matchResult.candidates || [];
  
  // Use explicitly parsed quantity from input line if user specified e.g. "3 bags" or "5 nos"
  const quantity = isQuantityExplicit ? parsedReq.quantity : (matchResult.quantity || parsedReq.quantity || 1);
  const unit = matchedProduct?.main_unit || parsedReq.unit || matchResult.unit || 'Nos';

  return {
    originalLine,
    matchedProduct,
    availableSizes: matchedProduct?.availableSizes || [],
    quantity,
    unit,
    confidence: matchResult.confidence?.tier || 'Medium',
    confidenceScore: matchResult.confidence?.score || 70,
    isAmbiguous: matchResult.confidence?.isAmbiguous || false,
    explanation: matchResult.confidence?.explanation || '',
    matchReasons: matchResult.confidence?.matchReasons || [],
    candidates
  };
}

function processWhatsAppMessage(messageText) {
  if (!messageText || typeof messageText !== 'string' || !messageText.trim()) {
    return {
      success: false,
      error: 'Please paste a customer WhatsApp message to parse.'
    };
  }

  const { customerName, customerPhone } = parseCustomerDetails(messageText);

  // Split lines, also handling comma or semicolon separated item lists
  const rawLines = messageText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const normalizedLines = [];

  for (const rawLine of rawLines) {
    // If line has multiple items separated by comma or semicolon e.g. "apex 20lt 2, putty 40kg 5, brush 2\" 3"
    if (rawLine.includes(',') && !/customer|client|address|site/i.test(rawLine) && rawLine.split(',').length >= 2) {
      const parts = rawLine.split(',').map(p => p.trim()).filter(Boolean);
      normalizedLines.push(...parts);
    } else if (rawLine.includes(';') && rawLine.split(';').length >= 2) {
      const parts = rawLine.split(';').map(p => p.trim()).filter(Boolean);
      normalizedLines.push(...parts);
    } else {
      normalizedLines.push(rawLine);
    }
  }

  const results = [];
  for (const line of normalizedLines) {
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
