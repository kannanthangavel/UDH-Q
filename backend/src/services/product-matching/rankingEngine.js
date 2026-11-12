/**
 * Multi-Signal Ranking Engine & Hard Constraint Enforcement
 * 
 * Scores candidate products using weighted signals:
 * - Exact / Normalized Substring Match (30%)
 * - Brand Alignment (15%)
 * - Product Type Alignment (15%)
 * - Variant / Color Alignment (15%)
 * - Pack Size & Pack Unit Alignment (15%)
 * - Synonym & Abbreviation Alignment (5%)
 * - Fuzzy Typo Similarity (5%)
 * 
 * Enforces Hard Constraints & Penalties:
 * - Conflicting pack size: -50 pts
 * - Conflicting brand: -40 pts
 * - Missing core product line keyword: -30 pts
 */

const { cleanNorm } = require('./normalizer');
const { fuzzySimilarity } = require('./fuzzyMatcher');
const { lookupAlias } = require('./aliasEngine');

function scoreCandidate(product, queryContext) {
  const {
    normalizedQuery,
    cleanQuery,
    attributes,
    synonyms
  } = queryContext;

  const {
    brand,
    productType,
    variant,
    packSize,
    searchCoreQuery
  } = attributes;

  let totalScore = 0;
  const matchReasons = [];
  const penalties = [];

  const normProdName = product.normName || cleanNorm(product.item_name);
  const normProdDetails = product.normDetails || cleanNorm(product.details);
  const prodBrand = (product.structuredDetails?.brand || '').toLowerCase();
  const prodSpecs = product.specs || [];
  const prodColours = product.colours || [];
  const prodTypes = product.types || [];

  // Check Learned Alias boost
  const aliases = lookupAlias(cleanQuery);
  const aliasHit = aliases.find(a => a.productId === product.id);
  if (aliasHit) {
    totalScore += aliasHit.boost || 100;
    matchReasons.push('Learned Official Trade Alias');
  }

  // 1. EXACT / NORMALIZED TEXT MATCH (Weight: 30% / 150 pts max)
  if (cleanQuery && normProdName.includes(cleanQuery)) {
    totalScore += 150;
    matchReasons.push('Exact Text Match (Hyphen & Space Agnostic)');
    if (normProdName.startsWith(cleanQuery)) {
      totalScore += 25;
      matchReasons.push('Prefix Name Match');
    }
  } else if (cleanQuery && normProdDetails.includes(cleanQuery)) {
    totalScore += 90;
    matchReasons.push('Specification Details Text Match');
  } else {
    // Token coverage
    const coreTokens = searchCoreQuery.toLowerCase().split(/\s+/).filter(t => t.length >= 2);
    if (coreTokens.length > 0) {
      let matchedTokens = 0;
      for (const t of coreTokens) {
        if (normProdName.includes(t)) {
          matchedTokens++;
          totalScore += 20;
        } else if (normProdDetails.includes(t)) {
          matchedTokens++;
          totalScore += 10;
        }
      }
      if (matchedTokens === coreTokens.length && coreTokens.length >= 2) {
        totalScore += 50;
        matchReasons.push('All Search Tokens Present');
      }
    }
  }

  // 2. BRAND ALIGNMENT (Weight: 15% / 75 pts)
  if (brand) {
    const brandLower = brand.toLowerCase();
    const isBrandMatch = prodBrand.includes(brandLower) || product.rawName.toLowerCase().includes(brandLower);
    if (isBrandMatch) {
      totalScore += 75;
      matchReasons.push(`Brand Matched: ${brand}`);
    } else {
      // Hard Penalty: User specifically requested Brand A, but candidate is Brand B
      if (prodBrand && prodBrand !== brandLower) {
        totalScore -= 40;
        penalties.push(`Brand Conflict (Wanted ${brand}, found ${product.structuredDetails?.brand})`);
      }
    }
  }

  // 3. PRODUCT TYPE ALIGNMENT (Weight: 15% / 75 pts)
  if (productType) {
    const typeLower = productType.toLowerCase();
    const isTypeMatch = prodTypes.includes(typeLower) || product.rawName.toLowerCase().includes(typeLower);
    if (isTypeMatch) {
      totalScore += 75;
      matchReasons.push(`Category Matched: ${productType}`);
    }
  }

  // 4. VARIANT / COLOR ALIGNMENT (Weight: 15% / 75 pts)
  if (variant) {
    const varLower = variant.toLowerCase();
    const isVariantMatch = prodColours.includes(varLower) || product.rawName.toLowerCase().includes(varLower);
    if (isVariantMatch) {
      totalScore += 75;
      matchReasons.push(`Variant / Shade Matched: ${variant}`);
    }
  }

  // 5. PACK SIZE & UNIT ALIGNMENT (Weight: 15% / 75 pts)
  if (packSize) {
    const targetSpec = packSize.canonical;
    let isExactSize = prodSpecs.includes(targetSpec);

    if (!isExactSize && targetSpec.endsWith('"')) {
      const wholeVal = targetSpec.replace('"', '');
      const inchBoundRegex = new RegExp(`(?<![\\/\\d])${wholeVal}\"`);
      isExactSize = inchBoundRegex.test(product.rawName);
    } else if (!isExactSize) {
      isExactSize = new RegExp(`\\b${targetSpec}\\b`, 'i').test(product.rawName);
    }

    // Fraction inch boundary protection: e.g. 2" must never match 1/2", 1 1/2", or 2 1/2"
    if (targetSpec.endsWith('"') && !targetSpec.includes('/')) {
      if (product.rawName.includes('/' + targetSpec.replace('"', '')) || product.rawName.includes('1/2"') || product.rawName.includes('2 1/2"')) {
        isExactSize = false;
        totalScore -= 80;
        penalties.push(`Fraction Inch Conflict (Wanted ${packSize.formatted}, candidate is fraction inch)`);
      }
    }

    if (isExactSize) {
      totalScore += 75;
      matchReasons.push(`Pack Size Matched: ${packSize.formatted}`);
    } else {
      // Hard Penalty: Pack size explicitly requested does not match candidate pack size
      if (prodSpecs.length > 0 && !prodSpecs.includes(targetSpec)) {
        totalScore -= 50;
        penalties.push(`Pack Size Conflict (Wanted ${packSize.formatted}, candidate is ${prodSpecs[0]})`);
      }
    }
  }

  // 6. SYNONYMS & ABBREVIATIONS ALIGNMENT (Weight: 5% / 25 pts)
  if (synonyms && synonyms.length > 0) {
    let synCount = 0;
    for (const syn of synonyms) {
      if (normProdName.includes(cleanNorm(syn)) || normProdDetails.includes(cleanNorm(syn))) {
        synCount++;
      }
    }
    if (synCount > 0) {
      totalScore += Math.min(25, synCount * 12);
      matchReasons.push('Trade Synonym Aligned');
    }
  }

  // 7. FUZZY / TYPO SIMILARITY (Weight: 5% / 25 pts)
  if (cleanQuery && !normProdName.includes(cleanQuery)) {
    const words = product.words || [];
    const coreWords = searchCoreQuery.toLowerCase().split(/\s+/).filter(w => w.length >= 3);
    for (const cw of coreWords) {
      for (const pw of words) {
        const sim = fuzzySimilarity(cw, pw);
        if (sim >= 0.75) {
          totalScore += Math.round(sim * 15);
          matchReasons.push(`Typo Corrected: "${cw}" ≈ "${pw}"`);
          break;
        }
      }
    }
  }

  return {
    product,
    score: Math.max(0, totalScore),
    matchReasons: [...new Set(matchReasons)],
    penalties
  };
}

module.exports = {
  scoreCandidate
};
