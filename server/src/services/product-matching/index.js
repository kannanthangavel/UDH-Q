/**
 * UDHAYAM AGENCIES
 * ADVANCED PRODUCT KEYWORD MATCHING & TRAINING SYSTEM
 * 
 * Main Architecture Orchestrator
 * Pipeline:
 * CUSTOMER INPUT
 *   ↓
 * NORMALIZATION (noise words, Tamil/Tanglish, whitespace, numbers)
 *   ↓
 * KEYWORD / ENTITY EXTRACTION
 *   ↓
 * SYNONYM + ALIAS MATCHING
 *   ↓
 * BRAND DETECTION
 *   ↓
 * PRODUCT TYPE DETECTION
 *   ↓
 * SIZE / PACK DETECTION
 *   ↓
 * UNIT DETECTION
 *   ↓
 * ATTRIBUTE EXTRACTION (PACK SIZE vs REQUESTED QUANTITY SEPARATION)
 *   ↓
 * CANDIDATE RETRIEVAL
 *   ↓
 * MULTI-SIGNAL RANKING
 *   ↓
 * CONFIDENCE SCORING & EXPLAINABILITY
 *   ↓
 * FINAL PRODUCT / MULTIPLE SISTER PACK OPTIONS
 */

const { normalizeQuery, cleanNorm } = require('./normalizer');
const { extractAttributes } = require('./attributeParser');
const { getSynonyms } = require('./synonymEngine');
const { retrieveCandidates } = require('./candidateRetriever');
const { scoreCandidate } = require('./rankingEngine');
const { evaluateConfidence } = require('./confidenceEngine');
const { recordSearchFeedback, recordAlias } = require('./aliasEngine');
const { getIndexedProducts, getSisterSizes } = require('../productSearchService');

/**
 * Matches a single product requirement string to the catalogue
 */
function matchProduct(queryText, options = {}) {
  if (!queryText || typeof queryText !== 'string' || !queryText.trim()) {
    return {
      query: '',
      matchedProduct: null,
      confidence: { score: 0, tier: 'None', explanation: 'Empty input query' },
      attributes: null,
      candidates: []
    };
  }

  const catalog = getIndexedProducts();

  // 1. Normalization
  const normalizedQuery = normalizeQuery(queryText);
  const cleanQuery = cleanNorm(normalizedQuery);

  // 2. Entity & Attribute Extraction (Separating Pack Size from Quantity!)
  const attributes = extractAttributes(normalizedQuery);

  // 3. Synonym & Abbreviation Expansion
  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
  const synonyms = new Set();
  for (const t of tokens) {
    getSynonyms(t).forEach(s => synonyms.add(s));
  }

  // 4. Candidate Discovery (Broad Retrieval across 5,300+ items)
  const queryContext = {
    originalQuery: queryText,
    normalizedQuery,
    cleanQuery,
    attributes,
    synonyms: Array.from(synonyms)
  };

  const retrieved = retrieveCandidates(catalog, queryContext);

  // Fallback to broader search if candidate retriever returned too few
  let candidatesToScore = retrieved;
  if (candidatesToScore.length < 5) {
    const broadTokens = attributes.searchCoreQuery.toLowerCase().split(/\s+/).filter(t => t.length >= 2);
    const broadSet = new Set(candidatesToScore.map(c => c.id));
    for (const p of catalog) {
      if (broadSet.has(p.id)) continue;
      if (broadTokens.some(t => p.normName.includes(t) || p.normDetails.includes(t))) {
        candidatesToScore.push(p);
        broadSet.add(p.id);
        if (candidatesToScore.length >= 35) break;
      }
    }
  }

  // 5. Multi-Signal Ranking
  const scoredCandidates = candidatesToScore
    .map(prod => scoreCandidate(prod, queryContext))
    .sort((a, b) => b.score - a.score || a.product.s_no - b.product.s_no);

  // 6. Confidence Engine & Explainability
  const confidence = evaluateConfidence(scoredCandidates);

  // 7. Format Top Candidates and attach Sister Pack Sizes
  const topCandidates = scoredCandidates.slice(0, 16).map(c => {
    const sisterSizes = getSisterSizes(c.product);
    return {
      id: c.product.id,
      s_no: c.product.s_no,
      item_name: c.product.item_name,
      details: c.product.details || c.product.structuredDetails?.summary || '',
      structuredDetails: c.product.structuredDetails,
      sale_rate: c.product.sale_rate || 0,
      main_unit: c.product.main_unit || 'Nos',
      hsn_sac: c.product.hsn_sac || '',
      section: c.product.section || 'PAINTS',
      score: c.score,
      packSize: c.product.specs?.[0] || '',
      availableSizes: sisterSizes,
      matchReasons: c.matchReasons,
      penalties: c.penalties
    };
  });

  const primaryProduct = topCandidates.length > 0 ? topCandidates[0] : null;

  return {
    query: queryText,
    normalizedQuery,
    matchedProduct: primaryProduct,
    quantity: attributes.quantity,
    unit: primaryProduct?.main_unit || attributes.requestedUnit || 'Nos',
    confidence: {
      score: confidence.confidenceScore,
      tier: confidence.confidenceTier,
      isAmbiguous: confidence.isAmbiguous,
      explanation: confidence.explanation,
      matchReasons: confidence.matchReasons
    },
    attributes,
    candidates: topCandidates
  };
}

module.exports = {
  matchProduct,
  recordSearchFeedback,
  trainAlias: recordAlias,
  normalizeQuery,
  extractAttributes
};
