/**
 * Candidate Retriever
 * 
 * Performs high-performance discovery across 5,300+ catalogue products
 * to retrieve the most promising candidates for deep multi-signal ranking.
 */

const { cleanNorm } = require('./normalizer');
const { lookupAlias } = require('./aliasEngine');

/**
 * Retrieves candidates from catalog based on extracted query signals
 */
function retrieveCandidates(catalog, queryContext) {
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

  const coreTokens = searchCoreQuery.toLowerCase().split(/\s+/).filter(t => t.length >= 2);
  const aliasHits = lookupAlias(cleanQuery);
  const aliasProductIds = new Set(aliasHits.map(h => h.productId));

  const candidates = [];

  for (const product of catalog) {
    // 1. Direct Alias match (Learned / Trained)
    if (aliasProductIds.has(product.id)) {
      candidates.push({ product, preScore: 1000, candidateReason: 'Learned Alias Match' });
      continue;
    }

    // 2. Direct normalized string containment (Space & Hyphen Agnostic!)
    const isDirectMatch = cleanQuery && (product.normName.includes(cleanQuery) || product.normDetails.includes(cleanQuery));

    // 3. Brand alignment
    const brandMatches = brand && (
      (product.structuredDetails?.brand || '').toLowerCase().includes(brand.toLowerCase()) ||
      product.rawName.toLowerCase().includes(brand.toLowerCase())
    );

    // 4. Product type alignment
    const typeMatches = productType && (
      product.types.includes(productType) ||
      product.rawName.toLowerCase().includes(productType)
    );

    // 5. Variant / Color alignment
    const variantMatches = variant && (
      product.colours.includes(variant.toLowerCase()) ||
      product.rawName.toLowerCase().includes(variant.toLowerCase())
    );

    // 6. Pack size alignment
    const sizeMatches = packSize && (
      product.specs.includes(packSize.canonical) ||
      product.rawName.toUpperCase().includes(packSize.canonical)
    );

    // 7. Token overlaps
    const tokenOverlapCount = coreTokens.filter(t => product.normName.includes(t) || product.normDetails.includes(t)).length;

    let preScore = 0;
    if (isDirectMatch) preScore += 300;
    if (variantMatches) preScore += 140;
    if (brandMatches) preScore += 90;
    if (sizeMatches) preScore += 90;
    if (typeMatches) preScore += 60;
    preScore += (tokenOverlapCount * 30);

    // Filter rule: candidate must match at least 2 key signals or have strong token overlap
    if (isDirectMatch || (variantMatches && sizeMatches) || (brandMatches && variantMatches) || preScore >= 140) {
      candidates.push({
        product,
        preScore,
        candidateReason: `Multi-signal match (${preScore} pts)`
      });
    }
  }

  // Sort by preScore descending so the most relevant candidates are always prioritized!
  candidates.sort((a, b) => b.preScore - a.preScore);

  // Deduplicate products
  const seenIds = new Set();
  const uniqueCandidates = [];
  for (const c of candidates) {
    if (!seenIds.has(c.product.id)) {
      seenIds.add(c.product.id);
      uniqueCandidates.push(c.product);
    }
  }

  return uniqueCandidates.slice(0, 60);
}

module.exports = {
  retrieveCandidates
};
