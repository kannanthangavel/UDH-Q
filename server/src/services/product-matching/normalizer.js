/**
 * Normalization Engine for Udhayam Agencies Product Matching
 * 
 * Cleans, sanitizes, and normalizes user search queries and WhatsApp message lines:
 * - Lowercase & trim
 * - Consolidate whitespaces and punctuation
 * - Number normalization (e.g. "one litre" -> "1 L", "half litre" -> "500 ML")
 * - Strip Tanglish, Tamil, and conversational noise words
 */

// Tanglish & Conversational Noise Words in paint/hardware retail trade
const CONVERSATIONAL_NOISE_WORDS = new Set([
  // Tamil / Tanglish colloquial noise
  'venum', 'venumnga', 'thevai', 'thevaiya', 'thevaipadu', 'kudu', 'kudunga', 
  'thaa', 'thaanga', 'iruku', 'iruka', 'irukku', 'anupu', 'anupunga', 'anupanum',
  'annachi', 'ayya', 'thambi', 'bro', 'sir', 'madam', 'vanakkam', 'namaskaram',
  // Transactional / generic noise
  'quote', 'quotation', 'rate', 'rates', 'price', 'pricing', 'bill', 'slip', 'amount',
  'total', 'cost', 'give', 'send', 'sendme', 'please', 'pls', 'plz', 'urgent',
  'req', 'required', 'requirement', 'need', 'needs', 'want', 'order', 'item', 'items',
  'of', 'for', 'with', 'in', 'and', 'or', 'to', 'from', 'at'
]);

// Number words to digits
const NUMBER_WORDS_MAP = {
  'zero': 0,
  'one': 1,
  'two': 2,
  'three': 3,
  'four': 4,
  'five': 5,
  'six': 6,
  'seven': 7,
  'eight': 8,
  'nine': 9,
  'ten': 10,
  'half': 0.5,
  'quarter': 0.25
};

/**
 * Strips all non-alphanumeric characters, returns clean lowercase string
 */
function cleanNorm(str) {
  if (!str) return '';
  return String(str).toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Normalizes numbers and common number phrases
 */
function normalizeNumbers(str) {
  if (!str) return '';
  let out = str;

  // Replace common words like "one litre", "two bags", "half litre"
  for (const [word, val] of Object.entries(NUMBER_WORDS_MAP)) {
    const reg = new RegExp(`\\b${word}\\b`, 'gi');
    out = out.replace(reg, String(val));
  }

  // Handle compound fraction inches: "1 1/2 inch", "2 1/2 inch"
  out = out.replace(/\b(\d+)\s+1\/2\s*(?:inch|\"|in\b)/gi, '$1 1/2"');
  out = out.replace(/\b(\d+)\s+1\/4\s*(?:inch|\"|in\b)/gi, '$1 1/4"');
  out = out.replace(/\b(\d+)\s+3\/4\s*(?:inch|\"|in\b)/gi, '$1 3/4"');

  // Handle standalone fraction notation
  out = out.replace(/(?<!\d\s+)\b1\/2\s*(?:ltr|litre|liter|l)\b/gi, '500 ML');
  out = out.replace(/(?<!\d\s+)\b1\/2\s*(?:kg|kilo)\b/gi, '500 GM');
  out = out.replace(/(?<!\d\s+)\b1\/2\s*(?:inch|\"|in\b)/gi, '1/2"');

  return out;
}

/**
 * Strips conversational noise words
 */
function stripNoiseWords(str) {
  if (!str) return '';
  const words = str.split(/\s+/).filter(Boolean);
  const filtered = words.filter(w => {
    const cleanW = w.toLowerCase().replace(/[^a-z0-9]/g, '');
    return cleanW.length > 0 && !CONVERSATIONAL_NOISE_WORDS.has(cleanW);
  });
  return filtered.join(' ');
}

/**
 * Full normalization pipeline
 */
function normalizeQuery(input) {
  if (!input || typeof input !== 'string') return '';

  let normalized = input.trim();

  // 1. Lowercase
  normalized = normalized.toLowerCase();

  // 2. Normalize numbers & fractions
  normalized = normalizeNumbers(normalized);

  // 3. Normalize quotes and apostrophes
  normalized = normalized.replace(/[\u201C\u201D\u2018\u2019]/g, '"');

  // 4. Normalize spaces around dimension inches
  normalized = normalized.replace(/((?:\d+\s+)?\d+\/\d+|\d+)\s*\"/g, '$1"');
  normalized = normalized.replace(/((?:\d+\s+)?\d+\/\d+|\d+)\s+inch(?:es)?\b/gi, '$1"');

  // 5. Strip noise words
  normalized = stripNoiseWords(normalized);

  // 6. Clean consecutive spaces
  normalized = normalized.replace(/\s+/g, ' ').trim();

  return normalized;
}

module.exports = {
  cleanNorm,
  normalizeNumbers,
  stripNoiseWords,
  normalizeQuery,
  CONVERSATIONAL_NOISE_WORDS
};
