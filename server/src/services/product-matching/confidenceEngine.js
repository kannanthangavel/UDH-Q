/**
 * Confidence Engine & Explainability Calculator
 * 
 * Determines matching confidence tiers:
 * - Very High (>= 90)
 * - High (80 - 89)
 * - Medium (60 - 79)
 * - Low (< 60)
 */

function evaluateConfidence(rankedCandidates) {
  if (!rankedCandidates || rankedCandidates.length === 0) {
    return {
      topCandidate: null,
      confidenceScore: 0,
      confidenceTier: 'None',
      isAmbiguous: false,
      explanation: 'No catalogue product matched the input criteria.'
    };
  }

  const top1 = rankedCandidates[0];
  const top2 = rankedCandidates.length > 1 ? rankedCandidates[1] : null;

  const rawScore = top1.score;
  let confidenceScore = Math.min(100, Math.round((rawScore / 300) * 100));

  // If score is boosted by exact pack size, brand, and type
  const reasons = top1.matchReasons || [];
  const hasBrand = reasons.some(r => r.startsWith('Brand'));
  const hasSize = reasons.some(r => r.startsWith('Pack Size'));
  const hasExact = reasons.some(r => r.startsWith('Exact Text'));

  if (hasExact && hasSize) {
    confidenceScore = Math.max(confidenceScore, 95);
  } else if (hasBrand && hasSize) {
    confidenceScore = Math.max(confidenceScore, 90);
  } else if (hasExact) {
    confidenceScore = Math.max(confidenceScore, 88);
  }

  // Margin calculation between top 1 and top 2
  let isAmbiguous = false;
  if (top2 && top1.score > 0) {
    const margin = (top1.score - top2.score) / top1.score;
    if (margin < 0.15 && top1.score < 200) {
      isAmbiguous = true;
      confidenceScore = Math.min(confidenceScore, 75);
    }
  }

  let confidenceTier = 'Low';
  if (confidenceScore >= 90) {
    confidenceTier = 'Very High';
  } else if (confidenceScore >= 80) {
    confidenceTier = 'High';
  } else if (confidenceScore >= 60) {
    confidenceTier = 'Medium';
  }

  // Generate clear human-readable explanation
  let explanation = '';
  if (reasons.length > 0) {
    explanation = `Matched based on: ${reasons.slice(0, 3).join(', ')}`;
  } else {
    explanation = 'Partial catalog keyword match';
  }

  return {
    topCandidate: top1.product,
    topScore: top1.score,
    confidenceScore,
    confidenceTier,
    isAmbiguous,
    explanation,
    matchReasons: top1.matchReasons,
    penalties: top1.penalties
  };
}

module.exports = {
  evaluateConfidence
};
