const express = require('express');
const router = express.Router();
const { parseCustomerMessage } = require('../services/messageParser');
const { matchAllItems } = require('../services/matchingEngine');

/**
 * POST /api/parse-message and /api/parse-message/parse-message
 * Parses customer WhatsApp message and matches products against the active price list
 */
function handleParseMessage(req, res) {
  try {
    const { message, priceListId } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Please paste a customer WhatsApp message.' });
    }

    const parseResult = parseCustomerMessage(message);

    if (parseResult.isBillLookup) {
      return res.json({
        success: true,
        isBillLookup: true,
        warning: parseResult.billLookup.warning,
        billLookup: parseResult.billLookup,
        customerDetails: parseResult.customerDetails,
        documentType: parseResult.documentType,
        paperSize: parseResult.paperSize,
        items: []
      });
    }

    // Match extracted items against active price list
    const matchedItems = matchAllItems(parseResult.items, priceListId);

    // Compute matching summary
    let exactCount = 0;
    let reviewCount = 0;
    let noMatchCount = 0;

    matchedItems.forEach(item => {
      if (item.matchStatus === 'Exact Match') {
        exactCount++;
      } else if (item.matchStatus === 'No Match') {
        noMatchCount++;
      } else {
        reviewCount++;
      }
    });

    res.json({
      success: true,
      isBillLookup: false,
      customerDetails: parseResult.customerDetails,
      documentType: parseResult.documentType,
      docTypeConfidence: parseResult.docTypeConfidence,
      docTypeReason: parseResult.docTypeReason,
      paperSize: parseResult.paperSize,
      items: matchedItems,
      stats: {
        totalItems: matchedItems.length,
        exactMatches: exactCount,
        reviewsRequired: reviewCount,
        noMatches: noMatchCount
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to process customer message.' });
  }
}

router.post('/', handleParseMessage);
router.post('/parse-message', handleParseMessage);

module.exports = router;
