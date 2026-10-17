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

/**
 * Splits text into individual item requirement statements
 */
function splitIntoItemLines(rawText) {
  // Remove conversational greetings and closing lines
  let text = rawText
    .replace(/(?:hi|hello|sir|vanakkam|dear sir|please|pls|send quotation|need quotation|prepare quotation|urgent|tq|thanks|thank you)[\.\,\s]*/gi, ' ')
    .replace(/\b(ud[\d\-]+|inv[\d\-]+)\b.*?(bill|invoice)/gi, ' ');

  // Split by newlines, commas, or semicolons, or " and "
  const rawParts = text
    .split(/\r?\n|;|,|\band\b/i)
    .map(p => p.trim())
    .filter(p => p.length > 2);

  return rawParts;
}

/**
 * Parses a single item line to extract quantity, unit, specification, and product name
 */
function parseItemLine(rawPhrase) {
  let phrase = rawPhrase.trim();
  if (!phrase) return null;

  let quantity = null;
  let unit = null;
  let specification = '';
  let isQuantityMissing = false;
  let isUnitMissing = false;

  // 1. Extract specifications first (e.g. 12mm, 1lt, 20L, 50kg, fe550d)
  const matchedSpecs = [];
  SPEC_PATTERNS.forEach(pattern => {
    const matches = phrase.match(pattern);
    if (matches) {
      matches.forEach(m => matchedSpecs.push(m.trim()));
    }
  });

  if (matchedSpecs.length > 0) {
    specification = matchedSpecs.join(', ');
  }

  // 2. Extract Quantity and Unit pattern: e.g. "20 bags", "10 numbers of", "5 buckets", "1Nos"
  // Look for leading or trailing numbers
  const qtyUnitRegex = /(\d+(?:\.\d+)?)\s*(bags?|nos?|numbers?|pieces?|pcs?|buckets?|bkts?|kgs?|kilos?|liters?|litres?|ltrs?|lt|l|boxes?|pkts?|bundles?|meters?|mtrs?|feet|ft)?\b/i;
  
  const match = phrase.match(qtyUnitRegex);
  if (match) {
    const parsedQty = parseFloat(match[1]);
    if (!isNaN(parsedQty) && parsedQty > 0) {
      quantity = parsedQty;
      const rawUnit = (match[2] || '').toLowerCase();
      if (rawUnit && UNIT_MAP[rawUnit]) {
        unit = UNIT_MAP[rawUnit];
      }
    }
  }

  // If unit not found directly after quantity, search phrase for known units
  if (!unit) {
    for (const [rawU, stdU] of Object.entries(UNIT_MAP)) {
      const uRegex = new RegExp(`\\b${rawU}\\b`, 'i');
      if (uRegex.test(phrase)) {
        unit = stdU;
        break;
      }
    }
  }

  if (quantity === null) {
    isQuantityMissing = true;
  }

  if (!unit) {
    isUnitMissing = true;
  }

  // 3. Clean product name by removing the parsed quantity, unit, and filler words
  let productName = phrase;
  if (quantity !== null) {
    // Remove quantity from product name
    productName = productName.replace(new RegExp(`\\b${quantity}\\b`, 'i'), ' ');
  }
  if (unit) {
    // Remove unit words from product name
    productName = productName.replace(new RegExp(`\\b(${unit}|bags?|nos?|numbers?|pieces?|pcs?|buckets?|bkts?|kgs?|kilos?|litres?|ltr|pkt|box|bundle)\\b`, 'gi'), ' ');
  }

  // Remove common connecting words
  productName = productName
    .replace(/\b(of|numbers of|pieces of|bags of|buckets of|packets of|boxes of|need|req|required|wanted|please|send)\b/gi, ' ')
    .replace(/[^\w\s\.\-\/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // If the product name became empty (e.g. phrase was just "20 bags"), fall back to raw phrase
  if (!productName || productName.length < 2) {
    productName = phrase;
  }

  return {
    rawPhrase,
    productName,
    specification,
    quantity,
    unit,
    isQuantityMissing,
    isUnitMissing
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
