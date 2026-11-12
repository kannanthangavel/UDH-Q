/**
 * Synonym Engine for Hardware & Paint Retail
 * 
 * Provides category-aware expansions, domain synonym dictionaries,
 * and abbreviation mappings.
 */

const SYNONYM_DICTIONARY = {
  // Products / Categories
  'putty': ['putty', 'wall putty', 'wallcare', 'wall care', 'putti', 'puddy', 'patty', 'knife putty'],
  'brush': ['brush', 'paint brush', 'painting brush', 'colour brush', 'tiger brush', 'mayil brush', 'addition brush'],
  'roller': ['roller', 'paint roller', 'cotton roller', 'foam roller', 'roller brush'],
  'primer': ['primer', 'red oxide', 'redoxide', 'yellow primer', 'metal primer', 'wood primer', 'wall primer'],
  'thinner': ['thinner', 'thiner', 'tinner', 'nc thinner'],
  'cement': ['cement', 'white cement', 'brilla'],
  'touchwood': ['touchwood', 'touch wood', 'wood polish', 'copal varnish'],
  'varnish': ['varnish', 'copal'],

  // Colors / Shades
  'golden brown': ['golden brown', 'goldenbrown', 'go brown', 'go.brown', 'g brown', 'g.brown', 'golden brwn'],
  'white': ['white', 'wht', 'br white', 'off white', 'pure white', 'glsy white'],
  'black': ['black', 'blk', 'jet black'],
  'red': ['red', 'signal red', 'p.o. red', 'po red'],
  'blue': ['blue', 'royal blue', 'phthalo blue'],
  'green': ['green', 'bus green', 'leaf green'],
  'yellow': ['yellow', 'golden yellow', 'lemon yellow'],
  'grey': ['grey', 'gray', 'smoke grey'],

  // Model & Trade Expansions
  'apex': ['apex', 'apex ultima', 'asian apex'],
  'ace': ['ace', 'asian ace', 'ace exterior'],
  'tractor': ['tractor', 'tractor emulsion', 'tractor distemper'],
  'royale': ['royale', 'asian royale', 'royale luxury'],
  'dampproof': ['dampproof', 'smartcare dampproof', 'damp proof'],
  'bison': ['bison', 'berger bison', 'bison acrylic'],
  'walmasta': ['walmasta', 'berger walmasta'],
  'weathercoat': ['weathercoat', 'berger weathercoat'],
  'dr fixit': ['dr fixit', 'fixit', 'pidilite', 'fastflex', 'urp', 'primecoat']
};

// Common Abbreviations Map
const ABBREVIATION_MAP = {
  'ltr': 'litre',
  'lt': 'litre',
  'l': 'litre',
  'kg': 'kilogram',
  'gm': 'gram',
  'ml': 'millilitre',
  'pcs': 'pieces',
  'pc': 'piece',
  'nos': 'numbers',
  'br': 'brush',
  'ro': 'roller',
  'en': 'enamel',
  'eml': 'emulsion',
  'pr': 'primer',
  'ps': 'primer',
  'bp': 'berger',
  'as': 'asian',
  'tw': 'touchwood',
  'sp': 'spray paint'
};

/**
 * Expands a token or phrase with its domain synonyms
 */
function getSynonyms(term) {
  if (!term) return [];
  const lower = term.toLowerCase().trim();
  const synonyms = new Set([lower]);

  // Check abbreviation
  if (ABBREVIATION_MAP[lower]) {
    synonyms.add(ABBREVIATION_MAP[lower]);
  }

  // Check synonym dictionary
  for (const [canonical, list] of Object.entries(SYNONYM_DICTIONARY)) {
    if (canonical === lower || list.includes(lower)) {
      list.forEach(s => synonyms.add(s));
      synonyms.add(canonical);
    }
  }

  return Array.from(synonyms);
}

module.exports = {
  SYNONYM_DICTIONARY,
  ABBREVIATION_MAP,
  getSynonyms
};
