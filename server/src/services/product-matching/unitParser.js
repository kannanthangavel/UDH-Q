/**
 * Unit Parser & Standardization Dictionary
 * 
 * Standardizes units, volumes, weights, and dimensions across paint & hardware trade.
 */

// Canonical Unit Definitions
const CANONICAL_UNITS = {
  VOLUME: ['L', 'ML'],
  WEIGHT: ['KG', 'GM'],
  DIMENSION: ['INCH', 'MM'],
  COUNT: ['PCS', 'BAG', 'BOX', 'CAN', 'TIN', 'ROLL', 'SET', 'BUNDLE']
};

// Map variants to canonical unit names
const UNIT_MAPPING = {
  // Volume
  'l': 'L',
  'lt': 'L',
  'ltr': 'L',
  'litre': 'L',
  'litres': 'L',
  'liter': 'L',
  'liters': 'L',
  'ml': 'ML',
  'milli': 'ML',
  'millilitre': 'ML',
  'milliliter': 'ML',

  // Weight
  'kg': 'KG',
  'kgs': 'KG',
  'kilo': 'KG',
  'kilos': 'KG',
  'kilogram': 'KG',
  'kilograms': 'KG',
  'gm': 'GM',
  'gms': 'GM',
  'g': 'GM',
  'gram': 'GM',
  'grams': 'GM',

  // Dimensions
  '"': 'INCH',
  'in': 'INCH',
  'inch': 'INCH',
  'inches': 'INCH',
  'mm': 'MM',

  // Packaging & Counting Units
  'pcs': 'PCS',
  'pc': 'PCS',
  'piece': 'PCS',
  'pieces': 'PCS',
  'nos': 'PCS',
  'no': 'PCS',
  'number': 'PCS',
  'numbers': 'PCS',
  'bag': 'BAG',
  'bags': 'BAG',
  'mootai': 'BAG',
  'box': 'BOX',
  'boxes': 'BOX',
  'can': 'CAN',
  'cans': 'CAN',
  'tin': 'TIN',
  'tins': 'TIN',
  'bucket': 'CAN',
  'buckets': 'CAN',
  'dabba': 'CAN',
  'dabbas': 'CAN',
  'roll': 'ROLL',
  'rolls': 'ROLL',
  'set': 'SET',
  'sets': 'SET',
  'bundle': 'BUNDLE',
  'bundles': 'BUNDLE',
  'kattu': 'BUNDLE'
};

/**
 * Normalizes a unit string to its canonical representation
 */
function standardizeUnit(raw) {
  if (!raw) return 'PCS';
  const clean = String(raw).trim().toLowerCase().replace(/[^a-z0-9\"]/g, '');
  return UNIT_MAPPING[clean] || 'PCS';
}

/**
 * Extracts and standardizes all pack sizes / specifications from a text string
 * Examples:
 * - "golden brown 1ltr" -> [{ raw: "1ltr", size: 1, unit: "L", formatted: "1L", canonical: "1LT" }]
 * - "putty 40kg" -> [{ raw: "40kg", size: 40, unit: "KG", formatted: "40KG", canonical: "40KG" }]
 * - "brush 2\"" -> [{ raw: "2\"", size: 2, unit: "INCH", formatted: '2"', canonical: '2"' }]
 */
function extractPackSizes(text) {
  if (!text) return [];
  const specs = [];
  const upper = text.toUpperCase();

  // 1. Volumes: e.g. 500ML, 1LT, 1LTR, 1 L, 4L, 10L, 20L
  const volRegex = /\b(\d+(?:\.\d+)?)\s*(LT|LTR|LITRE|LITER|L|ML)\b/g;
  let vm;
  while ((vm = volRegex.exec(upper)) !== null) {
    const size = parseFloat(vm[1]);
    const rawUnit = vm[2].toLowerCase();
    const unit = rawUnit === 'ml' ? 'ML' : 'L';
    const canonical = unit === 'ML' ? `${size}ML` : `${size}LT`;
    specs.push({
      raw: vm[0].trim(),
      size,
      unit,
      formatted: `${size}${unit}`,
      canonical
    });
  }

  // 2. Weights: e.g. 40KG, 25KG, 20KG, 5KG, 1KG, 500GM
  const wtRegex = /\b(\d+(?:\.\d+)?)\s*(KG|KGS|KILO|KILOS|GM|G|GRAM)\b/g;
  let wm;
  while ((wm = wtRegex.exec(upper)) !== null) {
    const size = parseFloat(wm[1]);
    const rawUnit = wm[2].toLowerCase();
    const unit = (rawUnit === 'gm' || rawUnit === 'g' || rawUnit === 'gram') ? 'GM' : 'KG';
    const canonical = `${size}${unit}`;
    specs.push({
      raw: wm[0].trim(),
      size,
      unit,
      formatted: `${size}${unit}`,
      canonical
    });
  }

  // 3. Fraction Inches: e.g. 1 1/2", 2 1/2", 1/2", 3/4"
  const fracRegex = /(?:^|[\s\-\(])((?:\d+\s+)?\d+\/\d+)\s*(?:\"|INCHES?\b|IN\b)/g;
  let fm;
  while ((fm = fracRegex.exec(upper)) !== null) {
    const rawFrac = fm[1].replace(/\s+/g, ' ');
    const canonical = `${rawFrac}"`;
    specs.push({
      raw: fm[0].trim(),
      size: parseFraction(rawFrac),
      unit: 'INCH',
      formatted: canonical,
      canonical
    });
  }

  // 4. Whole Inches (not preceded by slash or digit): e.g. 2", 3", 4", 5", 6", 2in, 2 inch
  const wholeInchRegex = /(?<![\/\d])\b([1-9]\d*)\s*(?:\"|INCHES?\b|IN\b)/g;
  let im;
  while ((im = wholeInchRegex.exec(upper)) !== null) {
    const size = parseInt(im[1], 10);
    const canonical = `${size}"`;
    if (!specs.some(s => s.canonical.endsWith(canonical) && s.canonical.includes('/'))) {
      specs.push({
        raw: im[0].trim(),
        size,
        unit: 'INCH',
        formatted: canonical,
        canonical
      });
    }
  }

  return specs;
}

function parseFraction(fracStr) {
  if (!fracStr) return 0;
  const parts = fracStr.trim().split(/\s+/);
  if (parts.length === 2) {
    const whole = parseFloat(parts[0]) || 0;
    const [num, den] = parts[1].split('/').map(Number);
    return whole + (num / (den || 1));
  }
  const [num, den] = parts[0].split('/').map(Number);
  return (num || 0) / (den || 1);
}

module.exports = {
  CANONICAL_UNITS,
  UNIT_MAPPING,
  standardizeUnit,
  extractPackSizes
};
