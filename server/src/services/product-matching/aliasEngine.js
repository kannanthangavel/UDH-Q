/**
 * Alias Engine & Dynamic Learning System
 * 
 * Manages learned product aliases from user corrections and system training.
 */

const { db } = require('../../db/database');
const { cleanNorm } = require('./normalizer');

let aliasCache = null;
let lastCacheTime = 0;

function refreshAliasCache() {
  try {
    const rows = db.prepare('SELECT product_id, alias, normalized_alias, confidence_boost FROM product_aliases').all();
    const map = new Map();
    for (const r of rows) {
      if (!map.has(r.normalized_alias)) {
        map.set(r.normalized_alias, []);
      }
      map.get(r.normalized_alias).push({
        productId: r.product_id,
        alias: r.alias,
        boost: r.confidence_boost || 100
      });
    }
    aliasCache = map;
    lastCacheTime = Date.now();
  } catch (err) {
    aliasCache = new Map();
  }
}

/**
 * Returns matching product IDs for an alias or phrase
 */
function lookupAlias(text) {
  if (!text) return [];
  const now = Date.now();
  if (!aliasCache || now - lastCacheTime > 30000) {
    refreshAliasCache();
  }

  const norm = cleanNorm(text);
  return aliasCache.get(norm) || [];
}

/**
 * Learns a new alias for a product
 */
function recordAlias(productId, aliasText, boost = 100) {
  if (!productId || !aliasText) return;
  const norm = cleanNorm(aliasText);
  if (!norm) return;

  try {
    const existing = db.prepare('SELECT id FROM product_aliases WHERE product_id = ? AND normalized_alias = ?').get(productId, norm);
    if (!existing) {
      db.prepare('INSERT INTO product_aliases (product_id, alias, normalized_alias, confidence_boost) VALUES (?, ?, ?, ?)').run(
        productId,
        aliasText.trim(),
        norm,
        boost
      );
      refreshAliasCache();
    }
  } catch (err) {
    console.warn('[AliasEngine] Failed to save alias:', err.message);
  }
}

/**
 * Records user feedback when a candidate is chosen or corrected
 */
function recordSearchFeedback(rawQuery, selectedProductId, userAction = 'selected') {
  if (!rawQuery || !selectedProductId) return;
  const norm = cleanNorm(rawQuery);

  try {
    db.prepare('INSERT INTO search_feedback (raw_query, normalized_query, selected_product_id, user_action) VALUES (?, ?, ?, ?)').run(
      rawQuery.trim(),
      norm,
      selectedProductId,
      userAction
    );

    // If explicitly selected or corrected, automatically learn this alias
    if (userAction === 'corrected' || userAction === 'selected') {
      recordAlias(selectedProductId, rawQuery, userAction === 'corrected' ? 120 : 100);
    }
  } catch (err) {
    console.warn('[AliasEngine] Failed to record search feedback:', err.message);
  }
}

module.exports = {
  lookupAlias,
  recordAlias,
  recordSearchFeedback,
  refreshAliasCache
};
