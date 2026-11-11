const { db } = require('../db/database');

// Standard Unit & Size Mapping
const SPEC_SYNONYMS = {
  // Volume mappings
  '1LT': ['1LT', '1LTR', '1 LT', '1 LTR', '1 L', '1L', '1000ML'],
  '500ML': ['500ML', '500 ML', '1/2LT', '0.5LT', '0.5L', '1/2 LTR'],
  '200ML': ['200ML', '200 ML'],
  '100ML': ['100ML', '100 ML'],
  '50ML': ['50ML', '50 ML'],
  '4LT': ['4LT', '4LTR', '4 LT', '4 LTR', '4 L', '4L'],
  '10LT': ['10LT', '10LTR', '10 LT', '10 LTR', '10 L', '10L'],
  '20LT': ['20LT', '20LTR', '20 LT', '20 LTR', '20 L', '20L'],
  
  // Weight mappings
  '40KG': ['40KG', '40 KG', '40 KILO', '40KGS', '40 KGS'],
  '25KG': ['25KG', '25 KG', '25 KILO'],
  '20KG': ['20KG', '20 KG', '20 KILO'],
  '10KG': ['10KG', '10 KG'],
  '5KG': ['5KG', '5 KG'],
  '2KG': ['2KG', '2 KG'],
  '1KG': ['1KG', '1 KG', '1000GM', '1 KILO'],
  '500GM': ['500GM', '500 GM', '500G'],

  // Inch / Brush sizes
  '2"': ['2"', '2 "', '2 INCH', '2INCH', '2 INCHES', '50MM'],
  '1"': ['1"', '1 "', '1 INCH', '1INCH', '25MM'],
  '1 1/2"': ['1 1/2"', '11/2"', '1.5"', '1.5 INCH', '1 1/2 INCH', '40MM'],
  '2 1/2"': ['2 1/2"', '21/2"', '2.5"', '2.5 INCH', '2 1/2 INCH', '63MM'],
  '3"': ['3"', '3 "', '3 INCH', '3INCH', '75MM'],
  '4"': ['4"', '4 "', '4 INCH', '4INCH', '100MM'],
  '5"': ['5"', '5 "', '5 INCH', '125MM'],
  '6"': ['6"', '6 "', '6 INCH', '150MM']
};

// Common Trade Synonyms & Abbreviations
const TRADE_DICTIONARY = {
  'paint': ['paint', 'enamel', 'emulsion', 'primer', 'distemper', 'spray paint'],
  'enamel': ['enamel', ' en ', 'en ', 'enemel', 'glsy', 'glossy', 'satin'],
  'emulsion': ['emulsion', 'emul', 'tractor', 'apex', 'ace', 'royale', 'walmasta', 'weathercoat', 'silk'],
  'primer': ['primer', 'primer ', 'pr ', 'prim', 'ps ', 'bp ', 'wood primer', 'metal primer'],
  'putty': ['putty', 'putti', 'puty', 'walcare', 'level plast', 'knife putty', 'paste putty', 'tex putty', 'stucco'],
  'brush': ['brush', 'br '],
  'roller': ['roller'],
  'thinner': ['thinner', 'thiner', 'tinner'],
  'cement': ['cement', 'white cement', 'brilla'],
  'touchwood': ['touchwood', 'touch wood', 'tw '],
  'varnish': ['varnish', 'copal'],

  // Colours
  'golden brown': ['golden brown', 'go.brown', 'g.brown', 'go brown', 'g brown', 'golden brwn', 'goldenbrown'],
  'white': ['white', 'wht', 'br white', 'off white', 'glsy white', 'sparc white'],
  'black': ['black', 'blk'],
  'brown': ['brown', 'brwn'],
  'red': ['red', 'p.o. red', 'signal red'],
  'blue': ['blue', 'phthalo blue', 'royal blue'],
  'green': ['green', 'bus green', 'leaf green'],
  'yellow': ['yellow', 'golden yellow', 'lemon yellow'],
  'grey': ['grey', 'gray', 'smoke grey', 'deep grey']
};

// Common Typo Replacements
const TYPO_MAP = {
  'brwn': 'brown',
  'puty': 'putty',
  'putti': 'putty',
  'brsh': 'brush',
  'wite': 'white',
  'whte': 'white',
  'enamal': 'enamel',
  'enaml': 'enamel',
  'enemel': 'enamel',
  'emulson': 'emulsion',
  'emultion': 'emulsion',
  'thiner': 'thinner',
  'tinner': 'thinner',
  'primr': 'primer',
  'primar': 'primer',
  'fixit': 'dr fixit',
  'touch wood': 'touchwood',
  'putty powder': 'putty',
  'wall putty': 'putty'
};

function cleanNorm(str) {
  if (!str) return '';
  return String(str).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function levenshteinDistance(s1, s2) {
  const a = s1.toLowerCase();
  const b = s2.toLowerCase();
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const d = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) d[i][0] = i;
  for (let j = 0; j <= n; j++) d[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,       // deletion
        d[i][j - 1] + 1,       // insertion
        d[i - 1][j - 1] + cost // substitution
      );
    }
  }
  return d[m][n];
}

// In-Memory Cached & Normalized Index of all 8,000+ products
let cachedProducts = null;
let lastCacheTimestamp = 0;

function invalidateProductCache() {
  cachedProducts = null;
  lastCacheTimestamp = 0;
}

function extractStructuredDetails(rawName, rawDetails, specs, colours, types, section) {
  const upper = rawName.toUpperCase();
  
  // 1. Brand Detection
  let brand = '';
  if (upper.includes('(ASIAN)') || upper.startsWith('AS ') || upper.startsWith('ASIAN') || upper.includes(' ASIAN')) {
    brand = 'Asian Paints';
  } else if (upper.includes('ABRO')) {
    brand = 'Abro';
  } else if (upper.includes('DR.FIX IT') || upper.includes('DR.FIXIT') || upper.includes('DR FIXIT') || upper.includes('FIXIT')) {
    brand = 'Dr. Fixit';
  } else if (upper.includes('JK ') || upper.includes('(SHIELD MAX)') || upper.includes('JK 40KG')) {
    brand = 'JK Cement';
  } else if (upper.includes('NEOSEAL')) {
    brand = 'Neoseal';
  } else if (upper.includes('3M')) {
    brand = '3M';
  } else if (upper.includes('ADDITION') || upper.startsWith('AD ')) {
    brand = 'Addition';
  } else if (upper.includes('BRILLA')) {
    brand = 'Brilla';
  } else if (upper.includes('ESDEE')) {
    brand = 'Esdee';
  } else if (upper.includes('SHEENLAC')) {
    brand = 'Sheenlac';
  } else if (upper.includes('NEROLAC')) {
    brand = 'Nerolac';
  } else if (upper.includes('BERGER')) {
    brand = 'Berger';
  } else if (upper.includes('JOYNA')) {
    brand = 'Joyna';
  } else if (upper.includes('PADMASHRI')) {
    brand = 'Padmashri';
  } else if (upper.includes('UDAYA')) {
    brand = 'Udaya';
  } else {
    const parenMatch = upper.match(/\(([A-Z0-9\.\s\-]+)\)$/);
    if (parenMatch && parenMatch[1] && parenMatch[1].length <= 15) {
      brand = parenMatch[1].trim();
    }
  }

  // 2. Category
  let category = '';
  if (types.includes('emulsion') || upper.includes('EML') || upper.includes('EMULSION') || upper.includes('TRACTOR') || upper.includes('APEX') || upper.includes('ACE ') || upper.includes('ROYALE')) {
    category = 'Emulsion';
  } else if (types.includes('enamel') || upper.includes('ENAMEL') || upper.includes(' EN ')) {
    category = 'Enamel';
  } else if (types.includes('primer') || upper.includes('PRIMER') || upper.includes('PR ') || upper.includes('PS ')) {
    category = 'Primer';
  } else if (types.includes('putty') || upper.includes('PUTTY') || upper.includes('PATTI')) {
    category = 'Wall Putty';
  } else if (types.includes('spray') || upper.includes('SPRAY')) {
    category = 'Spray Paint';
  } else if (types.includes('brush') || upper.includes('BRUSH') || upper.startsWith('BR ')) {
    category = 'Paint Brush';
  } else if (types.includes('roller') || upper.includes('ROLLER')) {
    category = 'Paint Roller';
  } else if (types.includes('thinner') || upper.includes('THINNER')) {
    category = 'Thinner';
  } else if (upper.includes('LATEX') || upper.includes('SEAL') || upper.includes('WATERPROOF')) {
    category = 'Waterproofing';
  } else if (types.includes('varnish') || types.includes('touchwood') || upper.includes('POLISH')) {
    category = 'Wood Finish / Polish';
  } else {
    category = section === 'PAINTS' ? 'Paints & Coatings' : 'Hardware & Accessory';
  }

  // 3. Finish
  let finish = '';
  if (upper.includes('GLSY') || upper.includes('GLOSS') || upper.includes('GLOSSY')) {
    finish = 'Glossy';
  } else if (upper.includes('MATT') || upper.includes('MAT ') || upper.includes('-MATT')) {
    finish = 'Matt';
  } else if (upper.includes('SHYNE') || upper.includes('SHINE') || upper.includes('SATIN')) {
    finish = 'Shyne / Satin';
  }

  // 4. Code / Model (e.g. SP-39, AC2G, 302, 502)
  let code = '';
  const codeMatch = upper.match(/\b(SP-\d+[A-Z]?|AC\d+[A-Z]?|\d{3,4}\b)/);
  if (codeMatch) {
    code = codeMatch[1];
  }

  // Pack size
  const packSize = specs.length > 0 ? specs[0] : '';
  const colour = colours.length > 0 ? colours[0].replace(/\b\w/g, c => c.toUpperCase()) : '';

  // Concise structured summary
  const summaryParts = [];
  if (brand) summaryParts.push(brand);
  if (packSize) summaryParts.push(packSize);
  if (category) summaryParts.push(category);
  if (colour) summaryParts.push(colour);
  if (finish) summaryParts.push(finish);
  if (code) summaryParts.push(`Code: ${code}`);

  return {
    brand,
    category,
    packSize,
    colour,
    finish,
    code,
    summary: summaryParts.join(' • ')
  };
}

function extractProductSpecs(rawName) {
  const specs = [];
  const upper = (rawName || '').toUpperCase();

  // 1. Volumes: 1LT, 20LT, 4LT, 10LT, 500ML, 100ML
  const volRegex = /(?:^|[\s\-\(\/])(\d+(?:\.\d+)?)\s*(LT|LTR|L|ML)(?:[\s\-\)\/]|$)/g;
  let vm;
  while ((vm = volRegex.exec(upper)) !== null) {
    const num = vm[1];
    const unit = vm[2].startsWith('M') ? 'ML' : 'LT';
    specs.push(`${num}${unit}`);
  }

  // 2. Weights: 40KG, 25KG, 20KG, 1KG, 500GM
  const wtRegex = /(?:^|[\s\-\(\/])(\d+(?:\.\d+)?)\s*(KG|KGS|GM|G)(?:[\s\-\)\/]|$)/g;
  let wm;
  while ((wm = wtRegex.exec(upper)) !== null) {
    const num = wm[1];
    const unit = wm[2].startsWith('G') ? 'GM' : 'KG';
    specs.push(`${num}${unit}`);
  }

  // 3. Inches: 2", 1 1/2", 4", 6"
  const inchRegex = /(?:^|[\s\-\(\/])(\d+(?:\s*1\/2)?)\s*(?:\"|INCH)/g;
  let im;
  while ((im = inchRegex.exec(upper)) !== null) {
    specs.push(`${im[1].replace(/\s+/g, '')}"`);
  }

  return [...new Set(specs)];
}

function getIndexedProducts() {
  const now = Date.now();
  if (cachedProducts && (now - lastCacheTimestamp < 60000)) {
    return cachedProducts;
  }

  try {
    const rows = db.prepare('SELECT id, s_no, item_name, details, sale_rate, dpl, purc_rate, hsn_sac, main_unit, cost, section, is_active FROM products WHERE is_active = 1 ORDER BY s_no ASC, id ASC').all();

    cachedProducts = rows.map(p => {
      const rawName = p.item_name || '';
      const rawDetails = p.details || '';
      const words = rawName.toLowerCase().split(/[\s\-\.\/\"\'\(\)\[\]\_\+\,]+/).filter(Boolean);

      // Extract pack specs accurately using regex patterns
      const specs = extractProductSpecs(rawName);

      // Extract colors
      const colours = [];
      const colourNames = ['golden brown', 'white', 'black', 'brown', 'red', 'blue', 'green', 'yellow', 'grey', 'gray', 'orange', 'ivory'];
      for (const c of colourNames) {
        if (rawName.toLowerCase().includes(c) || cleanNorm(rawName).includes(cleanNorm(c))) {
          colours.push(c);
        }
      }

      // Extract category / type
      const types = [];
      const typeNames = ['enamel', 'emulsion', 'primer', 'putty', 'brush', 'roller', 'thinner', 'cement', 'paint', 'touchwood', 'varnish', 'spray'];
      for (const t of typeNames) {
        if (rawName.toLowerCase().includes(t) || cleanNorm(rawName).includes(cleanNorm(t))) {
          types.push(t);
        }
      }

      // Extract structured intelligent details
      const structuredDetails = extractStructuredDetails(rawName, rawDetails, specs, colours, types, p.section);
      const effectiveDetails = rawDetails || structuredDetails.summary;

      const normName = cleanNorm(rawName);
      const normDetails = cleanNorm(effectiveDetails);

      return {
        ...p,
        details: effectiveDetails,
        structuredDetails,
        rawName,
        rawDetails,
        normName,
        normDetails,
        words,
        specs: [...new Set(specs)],
        colours: [...new Set(colours)],
        types: [...new Set(types)]
      };
    });

    lastCacheTimestamp = now;
    return cachedProducts;
  } catch (err) {
    console.error('Failed to load products for index:', err);
    return [];
  }
}

/**
 * Normalizes input query and extracts specs, colors, types, and keywords
 */
function parseSearchQuery(query) {
  if (!query || typeof query !== 'string') {
    return {
      rawQuery: '',
      normalized: '',
      cleanNormQuery: '',
      tokens: [],
      normTokens: [],
      extractedSpecs: [],
      extractedColours: [],
      extractedTypes: [],
      didYouMean: null
    };
  }

  const raw = query.trim();
  let normalized = raw.toLowerCase();
  let didYouMean = null;

  // Check typos
  for (const [typo, replacement] of Object.entries(TYPO_MAP)) {
    const regex = new RegExp(`\\b${typo}\\b`, 'gi');
    if (regex.test(normalized)) {
      didYouMean = normalized.replace(regex, replacement);
      normalized = didYouMean;
    }
  }

  const cleanNormQuery = cleanNorm(normalized);
  const extractedSpecs = [];
  const extractedColours = [];
  const extractedTypes = [];

  // 1. Extract Volumes: 1ltr, 1 ltr, 1lt, 1 l, 500ml, 4lt, 20lt, 20-lt
  const volRegex = /\b(\d+(?:\.\d+)?)\s*(lt|ltr|liter|litre|l|ml)\b/gi;
  let match;
  while ((match = volRegex.exec(normalized)) !== null) {
    const num = match[1];
    const unit = match[2].toLowerCase();
    if (unit === 'ml') {
      extractedSpecs.push(`${num}ML`);
    } else {
      extractedSpecs.push(`${num}LT`);
    }
  }

  // 2. Extract Weights: 40kg, 40 kg, 40-kg, 20kg, 5kg, 1kg, 500gm
  const wtRegex = /\b(\d+(?:\.\d+)?)\s*(kg|kgs|kilo|kilos|gm|g)\b/gi;
  while ((match = wtRegex.exec(normalized)) !== null) {
    const num = match[1];
    const unit = match[2].toLowerCase();
    if (unit.startsWith('g')) {
      extractedSpecs.push(`${num}GM`);
    } else {
      extractedSpecs.push(`${num}KG`);
    }
  }

  // 3. Extract Brush / Dimensions: 2", 2 inch, 2inch, 1 1/2", 1/2 inch
  const fracInchRegex = /(\d+\s+)?\d+\/\d+\s*(?:\"|inch|in\b)/gi;
  const fracMatches = normalized.match(fracInchRegex);
  if (fracMatches) {
    fracMatches.forEach(m => extractedSpecs.push(m.replace(/\s+/g, '').replace(/inch|in/gi, '"')));
  } else {
    const wholeInchRegex = /(?<![\/\d])(\d+)\s*(?:\"|inch|in\b)/gi;
    let imatch;
    while ((imatch = wholeInchRegex.exec(normalized)) !== null) {
      extractedSpecs.push(`${imatch[1]}"`);
    }
  }

  // 4. Extract Colours
  const colourNames = ['golden brown', 'white', 'black', 'brown', 'red', 'blue', 'green', 'yellow', 'grey', 'gray', 'orange', 'ivory'];
  for (const c of colourNames) {
    if (normalized.includes(c) || cleanNormQuery.includes(cleanNorm(c))) {
      extractedColours.push(c);
    }
  }

  // 5. Extract Product Types
  const productTypeNames = ['enamel', 'emulsion', 'primer', 'putty', 'brush', 'roller', 'thinner', 'cement', 'paint', 'touchwood', 'varnish', 'spray'];
  for (const t of productTypeNames) {
    if (normalized.includes(t) || cleanNormQuery.includes(cleanNorm(t))) {
      extractedTypes.push(t);
    }
  }

  // Tokens separated by spaces, hyphens, slashes, dots
  const tokens = normalized.split(/[\s\-\.\/\"\'\(\)\[\]\_\+\,]+/).filter(Boolean);
  const normTokens = tokens.map(cleanNorm).filter(t => t.length > 0 && !['of', 'need', 'req', 'pcs', 'nos', 'for', 'a'].includes(t));

  return {
    rawQuery: raw,
    normalized,
    cleanNormQuery,
    tokens,
    normTokens,
    extractedSpecs: [...new Set(extractedSpecs)],
    extractedColours: [...new Set(extractedColours)],
    extractedTypes: [...new Set(extractedTypes)],
    didYouMean
  };
}

/**
 * Intelligent Multi-Attribute Product Search Across 8,000+ Products
 * Space and Hyphen Agnostic Matching: whether user types 'AS-AC2G-20LT', 'AS AC2G 20LT',
 * 'asac2g20lt', 'SP39', 'SP-39', 'SP 39', 'goldenbrown', or 'putty 40kg',
 * it effortlessly finds and ranks the exact product at the top.
 */
function searchProductsSmart({ search = '', section, limit = null, page = 1, isAdmin = false }) {
  const parsed = parseSearchQuery(search);
  const { cleanNormQuery, normTokens, extractedSpecs, extractedColours, extractedTypes, normalized, didYouMean } = parsed;

  const catalog = getIndexedProducts();

  // If query is blank, return standard listing
  if (!cleanNormQuery) {
    const filtered = section && section !== 'ALL'
      ? catalog.filter(p => p.section === section)
      : catalog;

    let paged = filtered;
    if (limit && limit !== 'all' && Number(limit) > 0) {
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = parseInt(limit, 10);
      const start = (pageNum - 1) * limitNum;
      paged = filtered.slice(start, start + limitNum);
    }

    return {
      products: paged,
      total: filtered.length,
      ambiguous: false,
      distinctTypes: [],
      suggestions: {
        availableSizes: [],
        availableTypes: [],
        availableSections: ['PAINTS', 'ACCESS'],
        didYouMean: null
      },
      parsedQuery: { specs: [], colours: [], types: [] }
    };
  }

  // Qualifying candidates:
  // Must match either direct cleanNorm substring, or all tokens, or significant token
  const significantTokens = normTokens.filter(t => t.length >= 3 || /\d/.test(t));
  const scored = [];

  for (const p of catalog) {
    // Section filter
    if (section && section !== 'ALL' && p.section !== section) continue;

    // Check direct cleanNorm match (SPACE AND HYPHEN AGNOSTIC!)
    const directMatch = p.normName.includes(cleanNormQuery) || p.normDetails.includes(cleanNormQuery);
    const allTokensMatch = normTokens.length > 1 && normTokens.every(t => p.normName.includes(t) || p.normDetails.includes(t));
    const sigTokenMatch = significantTokens.length > 0 && significantTokens.some(t => p.normName.includes(t) || p.normDetails.includes(t));

    // Loose match if query contains specs or trade words
    const specMatch = extractedSpecs.some(s => p.specs.includes(s));
    const typeMatch = extractedTypes.some(t => p.types.includes(t));

    // Skip if completely unrelated
    if (!directMatch && !allTokensMatch && !sigTokenMatch && !specMatch && !typeMatch) {
      continue;
    }

    let score = 0;
    const matchReasons = [];

    // 1. Direct Space-and-Hyphen Agnostic Substring Match
    if (directMatch) {
      score += 260;
      matchReasons.push('Exact Text (Hyphen & Space Agnostic)');
      if (p.normName.startsWith(cleanNormQuery)) {
        score += 60;
        matchReasons.push('Prefix Match');
      }
    }

    // 2. All tokens present in product
    if (allTokensMatch) {
      score += 160;
      matchReasons.push('All Keywords Matched');
    }

    // 3. Token-by-token scoring
    let matchedTokenCount = 0;
    for (const t of normTokens) {
      if (p.normName.includes(t) || p.normDetails.includes(t)) {
        matchedTokenCount++;
        score += t.length >= 3 ? 35 : 15;
      } else if (t.length >= 4) {
        // Fuzzy check for typos
        if (p.words.some(w => levenshteinDistance(w, t) <= 1)) {
          matchedTokenCount++;
          score += 20;
          matchReasons.push(`Fuzzy: ${t}`);
        }
      }
    }

    // 4. Exact pack size / unit match with boundary discrimination
    if (extractedSpecs.length > 0) {
      for (const qs of extractedSpecs) {
        if (p.specs.includes(qs)) {
          score += 90;
          matchReasons.push(`Pack Size: ${qs}`);
        } else {
          // Penalize conflicting size
          if (qs === '1LT' && (p.specs.includes('20LT') || p.specs.includes('10LT') || p.specs.includes('4LT'))) {
            score -= 45;
          } else if (qs === '20LT' && (p.specs.includes('1LT') || p.specs.includes('4LT'))) {
            score -= 45;
          } else if (qs === '2"' && (p.rawName.includes('1/2"') || p.rawName.includes('2 1/2"'))) {
            score -= 35;
          } else if (qs === '40KG' && (p.specs.includes('1KG') || p.specs.includes('5KG') || p.specs.includes('20KG'))) {
            score -= 45;
          }
        }
      }
    }

    // 5. Colour matching
    if (extractedColours.length > 0) {
      for (const col of extractedColours) {
        if (p.colours.includes(col) || p.normName.includes(cleanNorm(col))) {
          score += 70;
          matchReasons.push(`Colour: ${col}`);
        }
      }
    }

    // 6. Product Type matching
    if (extractedTypes.length > 0) {
      for (const typ of extractedTypes) {
        if (p.types.includes(typ) || p.normName.includes(cleanNorm(typ))) {
          score += 60;
          matchReasons.push(`Category: ${typ}`);
        }
      }
    }

    // 7. Section boost
    if (extractedTypes.includes('brush') || extractedTypes.includes('roller')) {
      if (p.section === 'ACCESS') score += 35;
    } else if (extractedTypes.includes('enamel') || extractedTypes.includes('emulsion') || extractedTypes.includes('primer')) {
      if (p.section === 'PAINTS') score += 30;
    }

    if (score >= 35) {
      scored.push({
        ...p,
        searchScore: score,
        matchReasons: [...new Set(matchReasons)]
      });
    }
  }

  // Sort by searchScore descending, then s_no ascending
  scored.sort((a, b) => b.searchScore - a.searchScore || a.s_no - b.s_no);

  // Suggestions aggregation across top matches
  const availableSizes = new Set();
  const availableTypes = new Set();
  const availableSections = new Set();

  scored.slice(0, 40).forEach(p => {
    p.specs.forEach(s => availableSizes.add(s));
    p.types.forEach(t => availableTypes.add(t));
    availableSections.add(p.section);
  });

  // Ambiguity Detection
  const distinctTypes = new Set();
  scored.slice(0, 15).forEach(p => {
    p.types.forEach(t => distinctTypes.add(t));
  });
  const isAmbiguous = distinctTypes.size >= 2;

  // Pagination
  let returnProducts = scored;
  if (limit && limit !== 'all' && Number(limit) > 0) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = parseInt(limit, 10);
    const start = (pageNum - 1) * limitNum;
    returnProducts = scored.slice(start, start + limitNum);
  }

  return {
    products: returnProducts,
    total: scored.length,
    ambiguous: isAmbiguous,
    distinctTypes: Array.from(distinctTypes),
    suggestions: {
      availableSizes: Array.from(availableSizes),
      availableTypes: Array.from(availableTypes),
      availableSections: Array.from(availableSections),
      didYouMean
    },
    parsedQuery: {
      specs: extractedSpecs,
      colours: extractedColours,
      types: extractedTypes
    }
  };
}

module.exports = {
  searchProductsSmart,
  parseSearchQuery,
  levenshteinDistance,
  invalidateProductCache
};
