/**
 * Deterministic NLP WhatsApp Message Parser for Udhayam Quotation Maker
 * Extracts products, quantities, units, specifications, document type, and paper size preferences.
 */

// Common units dictionary with standardizations
const UNIT_MAP = {
  'bag': 'bags',
  'bags': 'bags',
  'nos': 'nos',
  'no': 'nos',
  'number': 'nos',
  'numbers': 'nos',
  'piece': 'pieces',
  'pieces': 'pieces',
  'pcs': 'pieces',
  'pc': 'pieces',
  'bucket': 'buckets',
  'buckets': 'buckets',
  'bkt': 'buckets',
  'kg': 'kg',
  'kgs': 'kg',
  'kilo': 'kg',
  'kilos': 'kg',
  'gram': 'g',
  'grams': 'g',
  'gm': 'g',
  'gms': 'g',
  'liter': 'litres',
  'liters': 'litres',
  'litre': 'litres',
  'litres': 'litres',
  'ltr': 'litres',
  'lt': 'litres',
  'l': 'litres',
  'box': 'box',
  'boxes': 'box',
  'pkt': 'pkt',
  'packet': 'pkt',
  'packets': 'pkt',
  'bundle': 'bundle',
  'bundles': 'bundle',
  'meter': 'meters',
  'meters': 'meters',
  'mtr': 'meters',
  'ft': 'feet',
  'feet': 'feet',
  'tonne': 'tonnes',
  'tonnes': 'tonnes',
  'ton': 'tonnes',
  'tons': 'tonnes'
};

// Known dimension/volume/grade specification patterns (preserve these carefully)
const SPEC_PATTERNS = [
  /\b\d+(\.\d+)?\s*(mm|cm|inch|in|ft|meter|mtr)\b/gi,
  /\b\d+(\.\d+)?\s*(lt|ltr|litre|litres|liter|l|ml)\b/gi,
  /\b\d+(\.\d+)?\s*(kg|kgs|gm|g|ton)\b/gi,
  /\b(fe\s*550d|fe\s*500d|fe\s*550|fe\s*500|opc\s*53|opc\s*43|ppc|grade\s*\d+)\b/gi
];

/**
 * Checks if the message looks like a bill lookup request rather than a new quotation
 */
function checkForBillLookup(text) {
  const billPatterns = [
    /\b(ud[\d\-]+|inv[\d\-]+|bill[\d\-]+)\b.*?(bill|invoice|send|pannunga|anupunga|kudunga)/i,
    /(bill|invoice|kudunga|pannunga|anupunga).*?\b(ud[\d\-]+|inv[\d\-]+|bill[\d\-]+)\b/i,
    /^(ud|inv)[\d\-]+\s*(bill|invoice)?/i
  ];

  for (const pattern of billPatterns) {
    const match = text.match(pattern);
    if (match) {
      return {
        isBillLookup: true,
        detectedRef: match[0],
        warning: `The message appears to request an existing invoice/bill ("${match[0]}"). It has not been processed as new quotation items.`
      };
    }
  }
  return { isBillLookup: false };
}

/**
 * Detects document type (GST Quotation vs Estimation) from text
 */
function detectDocumentType(text) {
  const lower = text.toLowerCase();
  if (lower.includes('gst') || lower.includes('tax bill') || lower.includes('with tax') || lower.includes('with gst')) {
    return { detected: 'gst_quotation', confidence: 'high', reason: 'Customer explicitly requested GST/Tax' };
  }
  if (lower.includes('estimate') || lower.includes('estimation') || lower.includes('without tax') || lower.includes('without gst') || lower.includes('rough')) {
    return { detected: 'estimation', confidence: 'high', reason: 'Customer explicitly requested Estimation' };
  }
  return { detected: null, confidence: 'none', reason: 'Ambiguous or not specified' };
}

/**
 * Detects paper size preference (A5 vs A4) from text
 */
function detectPaperSize(text) {
  const lower = text.toLowerCase();
  if (/\ba4\b/i.test(lower)) {
    return { detected: 'A4', reason: 'Explicitly requested A4' };
  }
  if (/\ba5\b/i.test(lower)) {
    return { detected: 'A5', reason: 'Explicitly requested A5' };
  }
  return { detected: 'A5', reason: 'Default paper size is A5' };
}

/**
 * Extracts customer name or phone if mentioned in common WhatsApp formats
 */
function extractCustomerDetails(text) {
  let customerName = '';
  let customerPhone = '';

  // Phone number regex (10-12 digits with optional +91 or 0 prefix)
  const phoneMatch = text.match(/(?:\+91[\-\s]?)?[6789]\d{9}\b/);
  if (phoneMatch) {
    customerPhone = phoneMatch[0].replace(/[\-\s]/g, '');
  }

  // Name patterns like: Name: Ramesh, Customer: Babu, or M/S ABC Traders
  const nameMatch = text.match(/(?:customer|client|name|to|m\/s)[:\s]+([A-Za-z\s\.\&]{3,35})(?:\n|,|$)/i);
  if (nameMatch) {
    customerName = nameMatch[1].trim();
  }

  return { customerName, customerPhone };
}

const TYPO_MAP = [
  { pattern: /\bblock\s+paint\b/gi, replacement: 'black paint' },
  { pattern: /\bblock\b(?=\s+(?:enamel|spray|primer|distemper|color|colour|matte|mat|glossy|glsy))/gi, replacement: 'black' },
  { pattern: /\bblck\b/gi, replacement: 'black' },
  { pattern: /\bwite\b|\bwhte\b/gi, replacement: 'white' },
  { pattern: /\benamal\b|\benaml\b/gi, replacement: 'enamel' },
  { pattern: /\bthiner\b|\btinner\b/gi, replacement: 'thinner' },
  { pattern: /\bmetrial\b|\bmeterial\b|\bmateriel\b/gi, replacement: 'material' },
  { pattern: /\bbrsh\b/gi, replacement: 'brush' }
];

function correctTradeTypos(text) {
  let cleaned = text;
  for (const { pattern, replacement } of TYPO_MAP) {
    cleaned = cleaned.replace(pattern, replacement);
  }
  return cleaned;
}

function isConversationalNoise(line) {
  const trimmed = line.trim().toLowerCase();
  if (trimmed.length < 3) return true;

  if (/^(?:this\s+)?(?:material|metrial|meterial|item|items|goods)\s+(?:is\s+)?(?:needed|need|req|required|wanted|urgent)/i.test(trimmed)) {
    return true;
  }
  if (/^(?:kindly|please|pls)?\s*(?:send|give|provide|share)\s+(?:quotation|quote|rate|rates|price|prices|estimate|bill)/i.test(trimmed)) {
    return true;
  }
  if (/^(?:thanks|thank\s+you|tq|nandri|dhanyawad)\b/i.test(trimmed)) {
    return true;
  }
  if (/(?:rate|bill|invoice)\s+(?:kudunga|anupunga|podunga|sollunga)/i.test(trimmed)) {
    return true;
  }
  return false;
}

function stripListPrefix(line) {
  return line.replace(/^\s*(?:(?:\d+|[a-zA-Z])[\.\)\-\:\/]\s*|[\*\-\•\⁃\–]\s*)/, '').trim();
}

function parseFraction(str) {
  if (!str) return null;
  const s = str.trim();

  const mixed = s.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)/);
  if (mixed) {
    const whole = parseFloat(mixed[1]);
    const num = parseFloat(mixed[2]);
    const den = parseFloat(mixed[3]);
    if (den !== 0) return { val: whole + (num / den), raw: mixed[0] };
  }

  const frac = s.match(/^(\d+)\s*\/\s*(\d+)/);
  if (frac) {
    const num = parseFloat(frac[1]);
    const den = parseFloat(frac[2]);
    if (den !== 0) return { val: num / den, raw: frac[0] };
  }

  if (/^half\b/i.test(s)) return { val: 0.5, raw: 'half' };
  if (/^quarter\b/i.test(s)) return { val: 0.25, raw: 'quarter' };

  const num = s.match(/^(\d+(?:\.\d+)?)/);
  if (num) {
    return { val: parseFloat(num[1]), raw: num[0] };
  }

  return null;
}

/**
 * Splits text into individual item requirement statements
 */
function splitIntoItemLines(rawText) {
  // Remove conversational greetings and closing lines using strict word boundaries
  let text = rawText
    .replace(/\b(?:hi|hello|sir|vanakkam|dear\s+sir|please|pls|send\s+quotation|need\s+quotation|prepare\s+quotation|urgent|tq|thanks|thank\s+you)\b[\.\,\s]*/gi, ' ')
    .replace(/\b(ud[\d\-]+|inv[\d\-]+)\b.*?(bill|invoice)/gi, ' ');

  // Split by newlines, semicolons, commas (if not within fractions), or " and "
  const rawParts = text
    .split(/\r?\n|;|\band\b/i)
    .map(p => p.trim())
    .filter(p => p.length > 2 && !isConversationalNoise(p));

  // If newlines didn't produce multiple items, split by comma if comma doesn't look like decimal/fraction
  const result = [];
  for (const part of rawParts) {
    if (part.includes(',') && !/\d+,\d+/.test(part)) {
      part.split(',').map(sub => sub.trim()).filter(sub => sub.length > 2 && !isConversationalNoise(sub)).forEach(sub => result.push(sub));
    } else {
      result.push(part);
    }
  }

  return result;
}

/**
 * Parses a single item line to extract quantity, unit, specification, and product name
 */
function parseItemLine(rawPhrase) {
  let phrase = stripListPrefix(rawPhrase.trim());
  if (!phrase || isConversationalNoise(phrase)) return null;

  phrase = correctTradeTypos(phrase);

  let productName = phrase;
  let specification = '';
  let quantity = null;
  let unit = null;
  let isQuantityMissing = false;
  let isUnitMissing = false;

  // Check for Key-Value separator: "=" or ":" or "@"
  const kvMatch = phrase.match(/^(.*?)\s*(=|:)\s*(.*?)$/);

  if (kvMatch) {
    const leftPart = kvMatch[1].trim();
    const rightPart = kvMatch[3].trim();

    // 1. Extract specs from left part (e.g. "brush(2inch)" -> spec "2inch", name "brush")
    let cleanLeft = leftPart;
    const parenSpecMatch = cleanLeft.match(/\((.*?)\)/);
    if (parenSpecMatch) {
      specification = parenSpecMatch[1].trim();
      cleanLeft = cleanLeft.replace(/\(.*?\)/, ' ').trim();
    }

    if (!specification) {
      const specMatch = cleanLeft.match(/\b\d+(\.\d+)?\s*(mm|cm|inch|in|ft|meter|mtr|lt|ltr|litre|liter|l|ml|kg|gm|g)\b/i);
      if (specMatch) {
        specification = specMatch[0].trim().toUpperCase();
      }
    }

    productName = cleanLeft;

    // 2. Parse quantity, unit, and pack capacity from right part
    // Check if right part has explicit count e.g. "2 nos", "3 buckets", "5 bags"
    const countMatch = rightPart.match(/\b(\d+(?:\.\d+)?)\s*(bags?|nos?|numbers?|pieces?|pcs?|pc|buckets?|bkts?|bkt|boxes?|pkts?|packets?|bundles?|cans?|tins?|drums?)\b/i);
    // Check if right part has pack capacity e.g. "20lt", "500ml", "1/2 litre", "4lt"
    const packCapMatch = rightPart.match(/\b(\d+(?:\.\d+)?)\s*(lt|ltr|litres?|liters?|ml|kgs?|kilos?|gm|g)\b/i);
    const fracObj = parseFraction(rightPart);

    if (countMatch) {
      quantity = parseFloat(countMatch[1]);
      const rawU = countMatch[2].toLowerCase();
      unit = UNIT_MAP[rawU] || rawU;
      if (packCapMatch) {
        const packSpec = packCapMatch[0].trim().toUpperCase();
        specification = specification ? `${specification}, ${packSpec}` : packSpec;
      }
    } else if (fracObj && (fracObj.raw.includes('/') || fracObj.raw === 'half' || fracObj.raw === 'quarter')) {
      // Fraction volume like "1/2 litre"
      const afterFrac = rightPart.slice(fracObj.raw.length).trim();
      const uMatch = afterFrac.match(/^([a-zA-Z]+)/);
      const rawU = uMatch ? uMatch[1].toLowerCase() : '';
      const stdU = UNIT_MAP[rawU] || rawU;

      if (fracObj.val === 0.5 && (stdU === 'litres' || rawU.startsWith('l'))) {
        specification = specification ? `${specification}, 500ML` : '500ML';
        quantity = 1;
        unit = 'Nos';
      } else if (fracObj.val === 0.25 && (stdU === 'litres' || rawU.startsWith('l'))) {
        specification = specification ? `${specification}, 250ML` : '250ML';
        quantity = 1;
        unit = 'Nos';
      } else {
        quantity = fracObj.val;
        unit = stdU || 'Nos';
      }
    } else if (packCapMatch) {
      // Customer specified only a pack size on right side (e.g. "item = 20lt")
      // Pack capacity: 20lt = 1 piece / bucket
      const packSpec = packCapMatch[0].trim().toUpperCase();
      specification = specification ? `${specification}, ${packSpec}` : packSpec;
      quantity = 1;
      unit = 'Nos';
    } else if (fracObj) {
      quantity = fracObj.val;
      const afterFrac = rightPart.slice(fracObj.raw.length).trim();
      const uMatch = afterFrac.match(/^([a-zA-Z]+)/);
      if (uMatch) {
        const rawU = uMatch[1].toLowerCase();
        unit = UNIT_MAP[rawU] || rawU;
      }
    }
  } else {
    // Non-delimited format: e.g. "asian golden yellow 20lt", "20 bags OPC cement", "10 numbers of 12mm steel rods"
    // 1. Check for dimension / pack specifications
    const parenSpecMatch = phrase.match(/\((.*?)\)/);
    if (parenSpecMatch) {
      specification = parenSpecMatch[1].trim();
    }

    const dimMatch = phrase.match(/\b\d+(\.\d+)?\s*(mm|cm|inch|in|ft|meter|mtr)\b/i);
    if (dimMatch && !specification) {
      specification = dimMatch[0].trim();
    }

    // Check for volume/weight pack capacity (e.g. "20lt", "10lt", "4lt", "1lt", "500ml", "50kg")
    const packCapMatch = phrase.match(/\b(\d+(?:\.\d+)?)\s*(lt|ltr|litres?|liters?|ml|kgs?|kilos?|gm|g)\b/i);

    // Check for explicit item count & count unit (e.g. "20 bags", "10 numbers", "2 nos", "3 buckets", "4 pieces")
    const countMatch = phrase.match(/\b(\d+(?:\.\d+)?)\s*(bags?|nos?|numbers?|pieces?|pcs?|pc|buckets?|bkts?|bkt|boxes?|pkts?|packets?|bundles?|cans?|tins?|drums?)\b/i);

    // Check for multiplier e.g. "20lt x 2" or "2 x 20lt"
    const multMatch = phrase.match(/\b(?:x|\*)\s*(\d+(?:\.\d+)?)\b/i) || phrase.match(/\b(\d+(?:\.\d+)?)\s*(?:x|\*)\b/i);

    // Check for fraction volume (e.g. "1/2 litre", "half litre")
    const fracVolMatch = phrase.match(/(?:(\d+\s*\/\s*\d+|half|quarter))\s*(litres?|liters?|ltrs?|lt|l|kg|kgs)\b/i);

    if (fracVolMatch) {
      const fracObj = parseFraction(fracVolMatch[1]);
      const rawU = (fracVolMatch[2] || '').toLowerCase();
      const stdU = UNIT_MAP[rawU] || rawU;

      if (fracObj && fracObj.val === 0.5 && stdU === 'litres') {
        specification = specification ? `${specification}, 500ML` : '500ML';
        quantity = 1;
        unit = 'Nos';
      } else if (fracObj && fracObj.val === 0.25 && stdU === 'litres') {
        specification = specification ? `${specification}, 250ML` : '250ML';
        quantity = 1;
        unit = 'Nos';
      } else if (fracObj) {
        quantity = fracObj.val;
        unit = stdU;
      }
      productName = phrase.replace(fracVolMatch[0], ' ');
    } else if (countMatch) {
      // Explicit count is present (e.g. "10 numbers of 12mm rods" or "asian golden yellow 20lt 2 nos" or "20 bags cement")
      quantity = parseFloat(countMatch[1]);
      const rawU = countMatch[2].toLowerCase();
      unit = UNIT_MAP[rawU] || rawU;

      if (packCapMatch) {
        const packSpec = packCapMatch[0].trim().toUpperCase();
        specification = specification ? `${specification}, ${packSpec}` : packSpec;
      }
      productName = phrase.replace(countMatch[0], ' ');
    } else if (multMatch) {
      quantity = parseFloat(multMatch[1]);
      unit = 'Nos';
      if (packCapMatch) {
        const packSpec = packCapMatch[0].trim().toUpperCase();
        specification = specification ? `${specification}, ${packSpec}` : packSpec;
      }
      productName = phrase.replace(multMatch[0], ' ');
    } else if (packCapMatch) {
      // CRITICAL PACK SIZE RULE:
      // When a user specifies a pack capacity (e.g. "asian golden yellow 20lt", "primer 4lt", "putty 20kg")
      // without an explicit count, the quantity is 1 piece / bucket / can (20lt = 1ps not 20ps)!
      const packSpec = packCapMatch[0].trim().toUpperCase();
      specification = specification ? `${specification}, ${packSpec}` : packSpec;
      quantity = 1;
      unit = 'Nos';
      // Keep pack spec in product name for catalog matching query, but remove it from noisy prefix
    } else {
      // Generic quantity extraction
      const qtyUnitRegex = /(\d+(?:\.\d+)?)\s*(bags?|nos?|numbers?|pieces?|pcs?|buckets?|bkts?|boxes?|pkts?|bundles?|meters?|mtrs?|feet|ft)?\b/i;
      const match = phrase.match(qtyUnitRegex);
      if (match) {
        quantity = parseFloat(match[1]);
        const rawUnit = (match[2] || '').toLowerCase();
        if (rawUnit && UNIT_MAP[rawUnit]) {
          unit = UNIT_MAP[rawUnit];
        }
        productName = phrase.replace(match[0], ' ');
      }
    }

    if (!unit) {
      for (const [rawU, stdU] of Object.entries(UNIT_MAP)) {
        const uRegex = new RegExp(`\\b${rawU}\\b`, 'i');
        if (uRegex.test(phrase)) {
          unit = stdU;
          break;
        }
      }
    }
  }

  if (quantity === null) {
    isQuantityMissing = true;
  }

  if (!unit) {
    unit = 'Nos';
  }

  // Clean product name
  productName = productName
    .replace(/\b(of|numbers of|pieces of|bags of|buckets of|need|req|required|wanted|please|pls|send)\b/gi, ' ')
    .replace(/[^\w\s\.\-\/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  let normalizedSpec = specification;
  if (normalizedSpec) {
    normalizedSpec = normalizedSpec.replace(/(\d+)\s*(?:inch|in)\b/gi, '$1"');
  }

  if (!productName || productName.length < 2) {
    productName = phrase;
  }

  return {
    rawPhrase,
    productName,
    specification: normalizedSpec,
    quantity,
    unit: unit || 'Nos',
    isQuantityMissing,
    isUnitMissing: false
  };
}

/**
 * Main message processing pipeline
 */
function parseCustomerMessage(messageText) {
  if (!messageText || typeof messageText !== 'string') {
    return {
      success: false,
      error: 'Message text is empty or invalid.',
      items: [],
      customerDetails: {},
      documentType: null,
      paperSize: 'A5',
      billLookup: { isBillLookup: false }
    };
  }

  // Check for bill/invoice lookup
  const billLookup = checkForBillLookup(messageText);
  const documentType = detectDocumentType(messageText);
  const paperSize = detectPaperSize(messageText);
  const customerDetails = extractCustomerDetails(messageText);

  // If it's a bill lookup, we don't treat it as product quotation requests
  if (billLookup.isBillLookup) {
    return {
      success: true,
      isBillLookup: true,
      billLookup,
      customerDetails,
      documentType: documentType.detected,
      paperSize: paperSize.detected,
      items: []
    };
  }

  const lines = splitIntoItemLines(messageText);
  const extractedItems = [];

  for (const line of lines) {
    const parsed = parseItemLine(line);
    if (parsed) {
      extractedItems.push(parsed);
    }
  }

  return {
    success: true,
    isBillLookup: false,
    billLookup: { isBillLookup: false },
    customerDetails,
    documentType: documentType.detected,
    docTypeConfidence: documentType.confidence,
    docTypeReason: documentType.reason,
    paperSize: paperSize.detected,
    items: extractedItems,
    originalMessage: messageText
  };
}

module.exports = {
  UNIT_MAP,
  SPEC_PATTERNS,
  checkForBillLookup,
  detectDocumentType,
  detectPaperSize,
  extractCustomerDetails,
  parseItemLine,
  parseCustomerMessage
};
