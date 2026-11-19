/**
 * UD-QM Optech PDF Parser Service
 * Parses quotation and estimate PDFs exported from Optech Billing Software
 * (widely used by Asian Paints & Berger retail dealers across Tamil Nadu).
 * 
 * Extracts:
 * - Customer Details (Name, Phone, Address)
 * - Quotation Date & Estimate Number
 * - Line items (Item description, pack size, quantity, rate, amount)
 * - Matches extracted items against the 5,331 UD-QM catalogue using the 11-stage AI matching engine
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
 * Standardize pack size units
 */
function normalizePackUnit(unit) {
  if (!unit) return 'Nos';
  const u = unit.trim().toUpperCase();
  if (['LT', 'LTR', 'LTRS', 'LITRE', 'LITRES', 'L'].includes(u)) return 'L';
  if (['ML', 'MILLILITRE'].includes(u)) return 'ML';
  if (['KG', 'KGS', 'KILO', 'KILOS'].includes(u)) return 'KG';
  if (['GM', 'GMS', 'GRAM', 'GRAMS'].includes(u)) return 'GM';
  if (['NOS', 'NO', 'PCS', 'PC', 'NUMBERS'].includes(u)) return 'Nos';
  if (['BOX', 'BOXES'].includes(u)) return 'Box';
  if (['BAG', 'BAGS'].includes(u)) return 'Bags';
  if (['ROLL', 'ROLLS'].includes(u)) return 'Roll';
  if (['SET', 'SETS'].includes(u)) return 'Set';
  return unit;
}

/**
 * Parse Optech Quotation Text into Structured UD-QM Format
 */
function parseOptechText(rawText) {
  if (!rawText || !rawText.trim()) {
    return {
      customer: { name: '', phone: '', address: '' },
      estimateNumber: '',
      date: new Date().toISOString().split('T')[0],
      items: [],
      totals: { subtotal: 0, taxAmount: 0, grandTotal: 0 }
    };
  }

  const lines = rawText
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);

  // 1. Extract Customer Info
  let customerName = '';
  let customerPhone = '';
  let customerAddress = '';
  let estimateNumber = '';
  let quotationDate = '';

  for (let i = 0; i < Math.min(lines.length, 30); i++) {
    const line = lines[i];

    // Phone / Mobile detection (10 digits)
    if (!customerPhone) {
      const phoneMatch = line.match(/(?:Ph(?:one)?|Mob(?:ile)?|Cell)[\s.:]*([6-9]\d{9})\b/i) ||
                         line.match(/\b([6-9]\d{4}\s*[0-9]{5})\b/) ||
                         line.match(/\b([6-9]\d{9})\b/);
      if (phoneMatch) {
        customerPhone = phoneMatch[1].replace(/\s+/g, '');
      }
    }

    // Estimate / Quotation Number
    if (!estimateNumber) {
      const estMatch = line.match(/(?:Estimate|Quote|Quotation|Bill|Inv(?:oice)?)\s*(?:No|#)[\s.:]*([A-Z0-9\-_/]+)/i);
      if (estMatch && estMatch[1] && !/^(date|dated|to|for|of)$/i.test(estMatch[1])) {
        estimateNumber = estMatch[1].trim();
      }
    }

    // Date
    if (!quotationDate) {
      const dateMatch = line.match(/(?:Date|Dated)[\s.:]*(\d{1,2}[-/.](?:\d{1,2}|[A-Za-z]{3})[-/.]\d{2,4})/i) ||
                        line.match(/\b(\d{1,2}[-/.](?:\d{1,2}|[A-Za-z]{3})[-/.]\d{4})\b/);
      if (dateMatch) {
        quotationDate = dateMatch[1];
      }
    }

    // Customer Address
    if (!customerAddress) {
      const addrPrefix = line.match(/(?:Address|Place|City|Location)\s*[:\s]*([A-Za-z0-9\s,.-]+)/i);
      if (addrPrefix && addrPrefix[1]) {
        customerAddress = addrPrefix[1].trim();
      } else if (customerName && !line.match(/(?:phone|mobile|date|gstin|pan|estimate|quote|s\.?no|udhayam)/i) && line !== customerName) {
        if (/\b(?:road|street|nagar|colony|perundurai|erode|salem|coimbatore|tirupur|chennai|madurai|bhavani|nadu)\b/i.test(line)) {
          customerAddress = line.trim();
        }
      }
    }

    // Customer Name (M/s. ..., To: ..., Customer: ...)
    if (!customerName) {
      const nameMatch = line.match(/(?:M\/s\.?|To\s*:|Customer\s*:|Client\s*:|Party\s*:)\s*([A-Za-z0-9\s.&'-]+)/i);
      if (nameMatch && nameMatch[1]) {
        const candidate = nameMatch[1].replace(/\b(?:GSTIN|PAN|Ph|Mobile|Date).*$/i, '').trim();
        if (candidate.length > 2 && !/^(udhayam|cash|estimate|quotation|agencies|invoice)/i.test(candidate)) {
          customerName = candidate;
        }
      }
    }
  }

  // 2. Identify Table Lines
  // Filter out boilerplate headers and footers
  const ignorePatterns = [
    /^(?:s\.?no|sl\.?no|item|description|particulars|hsn|qty|rate|amount|disc|tax|total|net)\b/i,
    /^(?:terms|conditions|bank|ifsc|account|for\s+udhayam|authorised|signatory|e\.?\s*&\s*o\.?e)/i,
    /^(?:amount\s+in\s+words|rupees\s+|grand\s+total|round\s+off|sub\s*total)/i,
    /^(?:page\s+\d+|--\s*\d+\s*of\s*\d+\s*--)/i
  ];

  const parsedItems = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check if line is header/footer noise
    if (ignorePatterns.some(p => p.test(line))) {
      continue;
    }

    // Typical Optech Table row formats:
    // Format A: "1  APEX ULTIMA WHITE 20LT  20 LT  2.00  3250.00  6500.00"
    // Format B: "1  ROYALE SHYNE 1 LT  5  540.00  2700.00"
    // Format C: "APEX ULTIMA 20 LTR - 2 Nos @ 3200 = 6400"
    // Format D: "BIRLA WHITE PUTTY 40KG  10  950.00  9500.00"

    // Number columns usually sit at the end: Quantity, Rate, Amount
    // Regex for numbers at end of line: [qty] [rate] [total]
    const numericTailRegex = /(?:(\d+(?:\.\d+)?)\s*(?:nos|nos\.|ltr|lt|kg|box|bag|set|m|ft)?\s+)?(\d+(?:\.\d+)?)\s+(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)\s+(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)$/i;

    const match = line.match(numericTailRegex);

    if (match) {
      let qty = parseFloat(match[2]);
      let rate = parseFloat(match[3].replace(/,/g, ''));
      let amount = parseFloat(match[4].replace(/,/g, ''));

      // If rate & amount make sense
      if (qty > 0 && (rate > 0 || amount > 0)) {
        if (!rate && amount) rate = Math.round((amount / qty) * 100) / 100;
        if (!amount && rate) amount = Math.round(qty * rate * 100) / 100;

        // Extract item text before the numbers
        let itemPart = line.substring(0, line.length - match[0].length).trim();
        // Remove leading S.No (e.g. "1.", "1 ", "1)")
        itemPart = itemPart.replace(/^\d+[\s.)-]+/, '').trim();

        if (itemPart.length > 2) {
          // Extract pack size if present inside item text (e.g., "20 LT", "1LTR", "40 KG", "500 ML")
          const packMatch = itemPart.match(/\b(\d+(?:\.\d+)?\s*(?:LT|LTR|L|KG|ML|GM|NOS|INCH|MM))\b/i);
          const detectedPack = packMatch ? packMatch[1].toUpperCase() : '';

          parsedItems.push({
            rawText: line,
            itemName: itemPart,
            packSize: detectedPack,
            quantity: qty,
            rate: rate,
            amount: amount
          });
          continue;
        }
      }
    }

    // Alternate Format: Look for line with HSN and quantity/rate
    const hsnMatch = line.match(/(?:HSN|SAC)?\s*[:\s]*(\d{4,8})\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)/i);
    if (hsnMatch && i > 0) {
      const prevLine = lines[i - 1].replace(/^\d+[\s.)-]+/, '').trim();
      if (prevLine.length > 2 && !ignorePatterns.some(p => p.test(prevLine))) {
        const qty = parseFloat(hsnMatch[2]) || 1;
        const rate = parseFloat(hsnMatch[3]) || 0;
        parsedItems.push({
          rawText: `${prevLine} ${line}`,
          itemName: prevLine,
          packSize: '',
          quantity: qty,
          rate: rate,
          amount: Math.round(qty * rate * 100) / 100
        });
      }
    }
  }

  // 3. Match each item using UD-QM's 11-Stage Matching Engine
  const matchedLineItems = parsedItems.map((rawItem, idx) => {
    const matchResult = matchProduct(rawItem.itemName);
    const matched = matchResult.matchedProduct;
    const confidence = matchResult.confidence || { score: 0, tier: 'None' };

    // Determine unit
    const unit = matched?.main_unit || (rawItem.packSize.match(/LT|L|ML/i) ? 'Litre' : rawItem.packSize.match(/KG|GM/i) ? 'Kg' : 'Nos');

    // Sister pack sizes for instant 1-click swapping
    let sisterSizes = [];
    if (matched && matched.id) {
      try {
        sisterSizes = getSisterSizes(matched.id) || [];
      } catch (e) {}
    }

    // Determine final rate:
    // If matched product has catalogue sale_rate, user gets authentic rate.
    // Otherwise fallback to Optech rate from PDF.
    const catalogRate = matched?.sale_rate != null ? Number(matched.sale_rate) : rawItem.rate;
    const effectiveRate = catalogRate > 0 ? catalogRate : rawItem.rate;
    const lineTotal = Math.round(rawItem.quantity * effectiveRate * 100) / 100;

    return {
      id: Date.now() + idx + Math.random(),
      originalDescription: rawItem.itemName,
      rawText: rawItem.rawText,
      product_id: matched?.id || null,
      item_name: matched?.item_name || rawItem.itemName,
      details: rawItem.itemName !== (matched?.item_name || '') ? `Optech: ${rawItem.itemName}` : '',
      hsn_sac: matched?.hsn_sac || '3209',
      unit: unit,
      quantity: rawItem.quantity,
      sale_rate: effectiveRate,
      catalog_rate: catalogRate,
      optech_rate: rawItem.rate,
      line_total: lineTotal,
      confidenceScore: Math.round((confidence.score || 0) * 100),
      confidenceTier: confidence.tier || (matched ? 'High' : 'None'),
      isMatched: Boolean(matched),
      availableSizes: sisterSizes
    };
  });

  // Calculate totals
  const subtotal = matchedLineItems.reduce((acc, it) => acc + (it.line_total || 0), 0);
  const gstRate = 18; // Tamil Nadu standard paint GST included in UD-QM rates
  const taxAmount = Math.round((subtotal * (gstRate / (100 + gstRate))) * 100) / 100;

  return {
    customer: {
      name: customerName,
      phone: customerPhone,
      address: customerAddress
    },
    estimateNumber: estimateNumber,
    quotationDate: quotationDate || new Date().toISOString().split('T')[0],
    items: matchedLineItems,
    totals: {
      subtotal: Math.round(subtotal * 100) / 100,
      taxAmount: taxAmount,
      grandTotal: Math.round(subtotal * 100) / 100
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
    rawExtractedText: extractedText.slice(0, 1000) // snippet for debugging
  };
}

module.exports = {
  extractTextFromPdf,
  parseOptechText,
  processOptechPdf
};
