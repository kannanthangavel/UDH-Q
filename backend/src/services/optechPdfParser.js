/**
 * UD-QM Optech PDF Parser Service
 * Parses quotation and estimate PDFs exported from Optech Billing Software
 * (widely used by Asian Paints & Berger retail dealers across Tamil Nadu).
 * 
 * Extracts:
 * - Customer Details (Name, Phone, Address, GSTIN)
 * - Quotation Date, Payment Terms & Estimate Number
 * - Line items (Item description, multi-line notes, HSN/SAC, quantity, unit, rate, tax%, amount)
 * - Exact tax breakdown (Taxable Value, CGST, SGST, Total Tax, Round Off, Grand Total, Amount in Words)
 * - Matches extracted items against catalogue while preserving authentic Optech rates and quantities
 */

const pdfParse = require('pdf-parse');
const { matchProduct } = require('./product-matching');
const { getSisterSizes } = require('./productSearchService');

/**
 * Extract plain text from PDF buffer across pdf-parse v1 and v2
 */
async function extractTextFromPdf(buffer) {
  if (!buffer || buffer.length === 0) {
    throw new Error('PDF file buffer is empty');
  }

  try {
    if (pdfParse.PDFParse) {
      const parser = new pdfParse.PDFParse({ data: new Uint8Array(buffer) });
      await parser.load();
      const res = await parser.getText();
      return typeof res === 'string' ? res : (res?.text || '');
    } else if (typeof pdfParse === 'function') {
      const data = await pdfParse(buffer);
      return data.text || '';
    }
  } catch (err) {
    throw new Error(`Failed to parse PDF document: ${err.message}`);
  }

  throw new Error('PDF parsing library is unavailable');
}

/**
 * Parse Optech Quotation Text into Structured UD-QM Format
 */
function parseOptechText(rawText) {
  if (!rawText || !rawText.trim()) {
    return {
      customer: { name: '', phone: '', address: '', gstin: '' },
      estimateNumber: '',
      quotationNumber: '',
      referenceNo: '',
      paymentTerms: 'Cash',
      quotationDate: new Date().toISOString().split('T')[0],
      items: [],
      totals: {
        totalQty: 0,
        taxableValue: 0,
        cgstPercent: 9,
        cgstAmount: 0,
        sgstPercent: 9,
        sgstAmount: 0,
        totalTaxAmount: 0,
        roundedOff: 0,
        grandTotal: 0,
        amountInWords: ''
      }
    };
  }

  const lines = rawText
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);

  let customerName = '';
  const customerAddressParts = [];
  let customerGstin = '';
  let customerPhone = '';
  let paymentTerms = 'Cash';
  let estimateNumber = '';
  let quotationDate = '';

  let inToBlock = false;
  let inTableBlock = false;
  const rawItems = [];
  let currentItem = null;

  let totalQty = 0;
  let taxableValue = 0;
  let cgstAmount = 0;
  let sgstAmount = 0;
  let totalTaxAmount = 0;
  let roundedOff = 0;
  let netAmount = 0;
  let amountInWords = '';

  // Standard Optech Item regex:
  // Starts with S.No (1-999), then description, HSN (4-8 digits), Qty (int/dec), Unit (Nos/etc), Rate (float), Tax% (int/float), Amount (float)
  const itemRegex = /^\s*(\d{1,3})\s+(.+?)\s+(\d{4,8})\s+(\d+(?:\.\d+)?)\s*([A-Za-z]+)?\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s*$/;

  // Alternate regex for formats where HSN is omitted or on next line
  const altItemRegex = /^\s*(\d{1,3})\s+(.+?)\s+(\d+(?:\.\d+)?)\s*([A-Za-z]+)?\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s*$/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect Customer "To." or "To:" block (e.g. "To. MILKY MIST DIARY FOOD PVT LTD")
    const toMatch = line.match(/^To[.:\s]+(.+)$/i);
    if (toMatch) {
      customerName = toMatch[1].trim();
      inToBlock = true;
      continue;
    }

    // Also detect "M/s." or "M/s" or "Customer:"
    if (!customerName && !inTableBlock) {
      const msMatch = line.match(/^(?:M\/s\.?|Customer\s*:|Client\s*:|Party\s*:)\s*([A-Za-z0-9\s.&'-]+)/i);
      if (msMatch && msMatch[1]) {
        const candidate = msMatch[1].replace(/\b(?:GSTIN|PAN|Ph|Mobile|Date).*$/i, '').trim();
        if (candidate.length > 2 && !/^(udhayam|cash|estimate|quotation|agencies|invoice)/i.test(candidate)) {
          customerName = candidate;
          inToBlock = true;
          continue;
        }
      }
    }

    if (inToBlock) {
      // Customer GSTIN
      const gstinMatch = line.match(/^GSTIN\s*[:\s]*([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1})/i);
      if (gstinMatch) {
        customerGstin = gstinMatch[1];
        continue;
      }

      // Customer Phone if explicitly in customer block
      const custPhoneMatch = line.match(/(?:Ph(?:one)?|Mob(?:ile)?|Cell)[\s.:]*([6-9]\d{9})\b/i);
      if (custPhoneMatch) {
        // Ensure not shop phone
        const p = custPhoneMatch[1];
        if (p !== '9715622499' && p !== '9715722499') {
          customerPhone = p;
        }
        continue;
      }

      // Check if To block ended by finding metadata or table start
      if (line.match(/^(?:Payment\s+Terms|No\s*:|Date\s*:|S\.?No|Total|Taxable)/i)) {
        inToBlock = false;
        // fall through to metadata extraction
      } else {
        // Address line (ignore shop keywords)
        if (!line.match(/(?:UDHAYAM|PAINT:|ELECTRICAL:|GSTIN:\s*33AADFU6496M1ZJ)/i)) {
          const cleanedAddr = line.replace(/,\s*,/g, ',').trim();
          if (cleanedAddr) customerAddressParts.push(cleanedAddr);
        }
        continue;
      }
    }

    // Payment Terms (e.g. "Payment Terms : Cash")
    const payMatch = line.match(/^Payment\s+Terms\s*[:\s]*(.+)$/i);
    if (payMatch) {
      paymentTerms = payMatch[1].trim();
      continue;
    }

    // Quote / Estimate No (e.g. "No : 1182")
    const noMatch = line.match(/^(?:No|Estimate\s+No|Quote\s+No)\s*[:\s]*([A-Za-z0-9\-_/]+)/i);
    if (noMatch) {
      estimateNumber = noMatch[1].trim();
      continue;
    }

    // Quotation Date (e.g. "Date : 18/11/2026")
    const dateMatch = line.match(/^Date\s*[:\s]*(\d{1,2}[-/.](?:\d{1,2}|[A-Za-z]{3})[-/.]\d{2,4})/i);
    if (dateMatch) {
      quotationDate = dateMatch[1];
      continue;
    }

    // Detect Table Header (e.g. "S.No Description HSN/SAC Qty Rate Tax% Amount")
    if (line.match(/^S\.?No\b/i) || line.match(/Description.*HSN/i)) {
      inTableBlock = true;
      continue;
    }

    // Detect End of Table & Bottom Summaries
    const totalRowMatch = line.match(/^Total\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)/i);
    if (totalRowMatch) {
      if (currentItem) {
        rawItems.push(currentItem);
        currentItem = null;
      }
      inTableBlock = false;
      totalQty = parseFloat(totalRowMatch[1]);
      taxableValue = parseFloat(totalRowMatch[2]);
      continue;
    }

    if (line.match(/^Taxable\s+Value/i)) {
      if (currentItem) {
        rawItems.push(currentItem);
        currentItem = null;
      }
      inTableBlock = false;
      continue;
    }

    // CGST / SGST breakdown line (e.g. "27958.04 9.00 2516.22 9.00 2516.22 18.00 5032.44")
    const taxValuesMatch = line.match(/(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)/);
    if (taxValuesMatch && !inTableBlock) {
      if (!taxableValue) taxableValue = parseFloat(taxValuesMatch[1]);
      cgstAmount = parseFloat(taxValuesMatch[3]);
      sgstAmount = parseFloat(taxValuesMatch[5]);
      totalTaxAmount = parseFloat(taxValuesMatch[7]);
      continue;
    }

    // Total Tax Amount (e.g. "Total Tax Amount : 5032.44")
    const taxMatch = line.match(/Total\s+Tax\s+Amount\s*[:\s]*(\d+(?:\.\d+)?)/i);
    if (taxMatch) {
      totalTaxAmount = parseFloat(taxMatch[1]);
      continue;
    }

    // Rounded Off (e.g. "Rounded Off : -0.48")
    const roundMatch = line.match(/Rounded\s+Off\s*[:\s]*([+-]?\s*\d+(?:\.\d+)?)/i);
    if (roundMatch) {
      roundedOff = parseFloat(roundMatch[1].replace(/\s+/g, ''));
      continue;
    }

    // Net Amount / Grand Total (e.g. "Net Amount : 32990.00")
    const netMatch = line.match(/(?:Net\s+Amount|Grand\s+Total)\s*[:\s]*(\d+(?:\.\d+)?)/i);
    if (netMatch) {
      netAmount = parseFloat(netMatch[1]);
      continue;
    }

    // Amount in Words (e.g. "Rupees Thirty Two Thousand Nine Hundred And Ninety Only")
    const wordsMatch = line.match(/^Rupees\s+(.+)$/i);
    if (wordsMatch) {
      amountInWords = 'Rupees ' + wordsMatch[1].trim();
      continue;
    }

    // Parse Table Items
    if (inTableBlock) {
      const m = line.match(itemRegex);
      if (m) {
        if (currentItem) rawItems.push(currentItem);
        const qty = parseFloat(m[4]);
        const rate = parseFloat(m[6]);
        const valA = parseFloat(m[7]);
        const valB = parseFloat(m[8]);

        // In Optech: columns in text stream can be Rate Amount Tax% or Rate Tax% Amount
        let amount = valA;
        let taxPercent = valB;
        if (valA <= 28 && (valB > 28 || Math.abs((qty * rate) - valB) < Math.abs((qty * rate) - valA))) {
          taxPercent = valA;
          amount = valB;
        } else {
          amount = valA;
          taxPercent = valB;
        }

        currentItem = {
          sNo: parseInt(m[1], 10),
          desc: m[2].trim(),
          hsn: m[3],
          qty: qty,
          unit: m[5] || 'Nos',
          rate: rate,
          taxPercent: taxPercent,
          amount: amount
        };
        continue;
      }

      // Check alternate line match without HSN
      const altM = line.match(altItemRegex);
      if (altM && !line.match(/^(?:Total|Taxable|GSTIN|Payment|Date|BANK)/i)) {
        if (currentItem) rawItems.push(currentItem);
        const qty = parseFloat(altM[3]);
        const rate = parseFloat(altM[5]);
        const valA = parseFloat(altM[6]);
        const valB = parseFloat(altM[7]);

        let amount = valA;
        let taxPercent = valB;
        if (valA <= 28 && (valB > 28 || Math.abs((qty * rate) - valB) < Math.abs((qty * rate) - valA))) {
          taxPercent = valA;
          amount = valB;
        } else {
          amount = valA;
          taxPercent = valB;
        }

        currentItem = {
          sNo: parseInt(altM[1], 10),
          desc: altM[2].trim(),
          hsn: '3209',
          qty: qty,
          unit: altM[4] || 'Nos',
          rate: rate,
          taxPercent: taxPercent,
          amount: amount
        };
        continue;
      }

      // Check continuation line of multi-line description (e.g. "(GLSY-ENAMEL)-ASIAN", "500 C) 0189", "BLACK-AGARAM")
      if (currentItem) {
        if (!line.match(/^(?:Total|Taxable|GSTIN|Payment|Date|BANK|S\.?No|Rupees)/i)) {
          currentItem.desc += ' ' + line.trim();
        }
      }
    }
  }

  if (currentItem) {
    rawItems.push(currentItem);
  }

  // Format cleaned customer address
  const customerAddress = customerAddressParts
    .join(', ')
    .replace(/\s*,\s*,+/g, ',')
    .replace(/^,\s*/, '')
    .trim();

  // Match each raw item against catalogue while preserving authentic Optech rate and quantity
  const matchedLineItems = rawItems.map((raw, idx) => {
    const matchResult = matchProduct(raw.desc);
    const matched = matchResult.matchedProduct;
    const confidence = matchResult.confidence || { score: 0, tier: 'None' };

    // Get sister pack sizes for instant 1-click swapping if user wants
    let sisterSizes = [];
    if (matched && matched.id) {
      try {
        sisterSizes = getSisterSizes(matched.id) || [];
      } catch (e) {}
    }

    // STRICT USER REQUIREMENT: Preserve exact Optech item name, quantity, rate, tax and amount!
    const effectiveRate = raw.rate > 0 ? raw.rate : (matched?.sale_rate || 0);
    const lineTotal = raw.amount > 0 ? raw.amount : Math.round(raw.qty * effectiveRate * 100) / 100;

    return {
      id: Date.now() + idx + Math.random(),
      originalDescription: raw.desc,
      product_id: matched?.id || null,
      item_name: raw.desc, // Keep full original Optech description
      matchedCatalogName: matched?.item_name || '',
      details: '',
      hsn_sac: raw.hsn || matched?.hsn_sac || '3209',
      unit: raw.unit || matched?.main_unit || 'Nos',
      quantity: raw.qty,
      sale_rate: effectiveRate,
      tax_percent: raw.taxPercent || 18,
      line_total: lineTotal,
      confidenceScore: Math.round((confidence.score || 0) * 100),
      confidenceTier: confidence.tier || (matched ? 'High' : 'None'),
      isMatched: Boolean(matched),
      availableSizes: sisterSizes
    };
  });

  // Calculate fallbacks if not explicitly found in footer
  if (!taxableValue && matchedLineItems.length > 0) {
    taxableValue = matchedLineItems.reduce((acc, it) => acc + (it.line_total || 0), 0);
  }
  if (!totalTaxAmount && taxableValue > 0) {
    totalTaxAmount = Math.round(taxableValue * 0.18 * 100) / 100;
    cgstAmount = Math.round(totalTaxAmount / 2 * 100) / 100;
    sgstAmount = Math.round(totalTaxAmount / 2 * 100) / 100;
  }
  if (!netAmount) {
    netAmount = Math.round((taxableValue + totalTaxAmount + roundedOff) * 100) / 100;
  }
  if (!totalQty) {
    totalQty = matchedLineItems.reduce((acc, it) => acc + it.quantity, 0);
  }

  // Quotation number formatting
  const formattedQuoteNo = estimateNumber
    ? `UDQ-2026-${String(estimateNumber).padStart(6, '0')}`
    : '';

  return {
    customer: {
      name: customerName || 'Valued Customer',
      address: customerAddress,
      gstin: customerGstin,
      phone: customerPhone
    },
    quotationNumber: formattedQuoteNo,
    referenceNo: estimateNumber,
    paymentTerms: paymentTerms,
    quotationDate: quotationDate || new Date().toISOString().split('T')[0],
    items: matchedLineItems,
    totals: {
      totalQty: totalQty,
      taxableValue: Math.round(taxableValue * 100) / 100,
      cgstPercent: 9.0,
      cgstAmount: cgstAmount || Math.round(taxableValue * 0.09 * 100) / 100,
      sgstPercent: 9.0,
      sgstAmount: sgstAmount || Math.round(taxableValue * 0.09 * 100) / 100,
      totalTaxAmount: Math.round(totalTaxAmount * 100) / 100,
      roundedOff: roundedOff,
      grandTotal: Math.round(netAmount * 100) / 100,
      amountInWords: amountInWords
    }
  };
}

/**
 * Main Entry Point: Ingest Optech PDF Buffer and return matched UD-QM Quotation
 */
async function processOptechPdf(buffer) {
  const extractedText = await extractTextFromPdf(buffer);
  const parsedData = parseOptechText(extractedText);
  return {
    ...parsedData,
    rawExtractedText: extractedText.slice(0, 1500)
  };
}

module.exports = {
  extractTextFromPdf,
  parseOptechText,
  processOptechPdf
};
