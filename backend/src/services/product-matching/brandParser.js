/**
 * Brand Parser & Brand Detection Engine
 * 
 * Accurately detects brands, brand codes, and trade prefixes from user queries
 * across Udhayam Agencies' official catalog.
 */

const BRAND_DEFINITIONS = [
  {
    brand: 'Asian Paints',
    aliases: ['asian paints', 'asian paint', 'asian', 'apcolite', 'apex', 'royale', 'tractor', 'ace', 'smartcare', 'dampproof'],
    prefixes: ['as ', 'as-', 'ap '],
    categoryBoost: 'PAINTS'
  },
  {
    brand: 'Birla',
    aliases: ['birla white', 'birla', 'wall care', 'wallcare'],
    prefixes: ['birla '],
    categoryBoost: 'PAINTS'
  },
  {
    brand: 'Dr. Fixit',
    aliases: ['dr fixit', 'dr. fixit', 'dr.fixit', 'fixit', 'pidilite', 'fastflex', 'urp', 'primecoat'],
    prefixes: ['dr fixit', 'dr.fixit'],
    categoryBoost: 'PAINTS'
  },
  {
    brand: 'Berger',
    aliases: ['berger', 'bison', 'walmasta', 'weathercoat', 'luxol', 'silk'],
    prefixes: ['br ', 'bp ', 'berger '],
    categoryBoost: 'PAINTS'
  },
  {
    brand: 'JK Cement',
    aliases: ['jk cement', 'jk', 'shield max', 'shieldmax'],
    prefixes: ['jk '],
    categoryBoost: 'PAINTS'
  },
  {
    brand: 'MRF',
    aliases: ['mrf', 'mrf paints', 'woodstyn'],
    prefixes: ['mrf '],
    categoryBoost: 'PAINTS'
  },
  {
    brand: 'Nerolac',
    aliases: ['nerolac', 'kansai nerolac', 'beauty', 'suraksha'],
    prefixes: ['nerolac '],
    categoryBoost: 'PAINTS'
  },
  {
    brand: 'Dulux',
    aliases: ['dulux', 'velvet touch', 'weathershield'],
    prefixes: ['du ', 'dulux '],
    categoryBoost: 'PAINTS'
  },
  {
    brand: 'Sheenlac',
    aliases: ['sheenlac', 'wood polish', 'sanding sealer'],
    prefixes: ['sheenlac '],
    categoryBoost: 'PAINTS'
  },
  {
    brand: 'Addition',
    aliases: ['addition', 'addition brush'],
    prefixes: ['ad ', 'ad-'],
    categoryBoost: 'ACCESS'
  },
  {
    brand: 'Abro',
    aliases: ['abro', 'masking tape', 'abro tape'],
    prefixes: ['abro '],
    categoryBoost: 'ACCESS'
  },
  {
    brand: '3M',
    aliases: ['3m', '3m tape', 'scotch'],
    prefixes: ['3m '],
    categoryBoost: 'ACCESS'
  },
  {
    brand: 'Udhayam',
    aliases: ['udhayam', 'udaya', 'udhayam manjal'],
    prefixes: ['udhayam ', 'udaya '],
    categoryBoost: 'PAINTS'
  },
  {
    brand: 'Sagar',
    aliases: ['sagar', 'sagar brush'],
    prefixes: ['sagar '],
    categoryBoost: 'ACCESS'
  },
  {
    brand: 'Elite',
    aliases: ['elite', 'elite roller'],
    prefixes: ['elite '],
    categoryBoost: 'ACCESS'
  },
  {
    brand: 'Mangalam',
    aliases: ['mangalam', 'mangalam brush'],
    prefixes: ['mangalam '],
    categoryBoost: 'ACCESS'
  },
  {
    brand: 'Neoseal',
    aliases: ['neoseal', 'solvent cement'],
    prefixes: ['neoseal '],
    categoryBoost: 'ACCESS'
  },
  {
    brand: 'Brilla',
    aliases: ['brilla', 'brilla cement'],
    prefixes: ['brilla '],
    categoryBoost: 'PAINTS'
  },
  {
    brand: 'Joyna',
    aliases: ['joyna'],
    prefixes: ['joyna '],
    categoryBoost: 'ACCESS'
  },
  {
    brand: 'Padmashri',
    aliases: ['padmashri'],
    prefixes: ['padmashri '],
    categoryBoost: 'ACCESS'
  }
];

/**
 * Detects brand mentioned in query text
 * Returns { brand: string, confidence: number, matchedAlias: string }
 */
function detectBrand(text) {
  if (!text) return null;
  const lower = text.toLowerCase();

  for (const def of BRAND_DEFINITIONS) {
    // 1. Check exact aliases
    for (const alias of def.aliases) {
      const reg = new RegExp(`\\b${alias.replace(/\./g, '\\.')}\\b`, 'i');
      if (reg.test(lower)) {
        return {
          brand: def.brand,
          confidence: 0.95,
          matchedAlias: alias,
          categoryBoost: def.categoryBoost
        };
      }
    }

    // 2. Check prefixes if at the beginning of query
    for (const prefix of def.prefixes) {
      if (lower.startsWith(prefix.trim()) || lower.includes(` ${prefix.trim()} `)) {
        return {
          brand: def.brand,
          confidence: 0.85,
          matchedAlias: prefix.trim(),
          categoryBoost: def.categoryBoost
        };
      }
    }
  }

  return null;
}

/**
 * Detects brand from official product item name in catalogue
 */
function detectBrandFromProductName(itemName) {
  if (!itemName) return '';
  const upper = itemName.toUpperCase();

  // Explicit parentheses brand tags e.g. "ITEM NAME (ASIAN)"
  const parenMatch = upper.match(/\(([A-Z0-9\.\s\-]+)\)$/);
  if (parenMatch && parenMatch[1]) {
    const rawTag = parenMatch[1].trim();
    if (rawTag === 'ASIAN') return 'Asian Paints';
    if (rawTag === 'SHIELD MAX') return 'JK Cement';
    if (rawTag.length <= 15) return rawTag;
  }

  if (upper.startsWith('AS ') || upper.startsWith('AS-') || upper.includes('ASIAN')) return 'Asian Paints';
  if (upper.startsWith('BR ') || upper.startsWith('BP ') || upper.includes('BERGER')) return 'Berger';
  if (upper.includes('DR.FIX IT') || upper.includes('DR.FIXIT') || upper.includes('DR FIXIT') || upper.includes('FIXIT')) return 'Dr. Fixit';
  if (upper.includes('BIRLA')) return 'Birla';
  if (upper.startsWith('JK ') || upper.includes('JK CEMENT')) return 'JK Cement';
  if (upper.startsWith('AD ') || upper.includes('ADDITION')) return 'Addition';
  if (upper.includes('ABRO')) return 'Abro';
  if (upper.includes('3M')) return '3M';
  if (upper.includes('UDHAYAM') || upper.includes('UDAYA')) return 'Udhayam';
  if (upper.includes('SHEENLAC')) return 'Sheenlac';
  if (upper.includes('NEROLAC')) return 'Nerolac';
  if (upper.includes('MRF')) return 'MRF';
  if (upper.includes('BRILLA')) return 'Brilla';
  if (upper.includes('NEOSEAL')) return 'Neoseal';
  if (upper.includes('JOYNA')) return 'Joyna';
  if (upper.includes('PADMASHRI')) return 'Padmashri';

  return '';
}

module.exports = {
  BRAND_DEFINITIONS,
  detectBrand,
  detectBrandFromProductName
};
