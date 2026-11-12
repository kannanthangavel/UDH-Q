/**
 * Fuzzy Matcher & Typo Tolerance Engine
 * 
 * Supports Damerau-Levenshtein distance with adjacent transposition
 * and normalized similarity scoring.
 */

/**
 * Computes Damerau-Levenshtein distance between two strings
 * Handles:
 * - Insertions
 * - Deletions
 * - Substitutions
 * - Transpositions (e.g. "brwon" -> "brown")
 */
function damerauLevenshtein(s1, s2) {
  if (!s1 || !s2) return (s1 || s2 || '').length;
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

      // Transposition
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + cost);
      }
    }
  }

  return d[m][n];
}

/**
 * Returns a normalized similarity score between 0.0 and 1.0
 */
function fuzzySimilarity(s1, s2) {
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1.0;
  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1.0;
  const dist = damerauLevenshtein(s1, s2);
  return Math.max(0, 1 - (dist / maxLen));
}

/**
 * Checks if a word is close to any target in a dictionary
 */
function findClosestWord(word, candidates, maxDistance = 1) {
  if (!word || !candidates || candidates.length === 0) return null;
  let best = null;
  let minDistance = Infinity;

  for (const c of candidates) {
    const d = damerauLevenshtein(word, c);
    if (d <= maxDistance && d < minDistance) {
      minDistance = d;
      best = c;
    }
  }

  return best;
}

module.exports = {
  damerauLevenshtein,
  fuzzySimilarity,
  findClosestWord
};
