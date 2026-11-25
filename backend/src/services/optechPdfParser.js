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
  const parsedTaxRows = [];
  let amountInWords = '';

  // Standard & Flexible Optech Item regex patterns (handles comma-separated numbers like 1,830.51):
  // 1. With HSN (2-8 digits), Qty, Unit, Rate, ValA, ValB (ValA/ValB = Tax% / Amount)
  const itemRegexWithHsn = /^(\d{1,3})[\s.)-]+\s*(.+?)\s+(\d{2,8})\s+(\d+(?:\.\d+)?)\s*([A-Za-z]+)?\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)$/;

  // 2. With HSN, Qty, Unit, Rate, Amount (2 trailing numbers, e.g. Cash/estimate bills without tax col)
  const itemRegexHsnNoTax = /^(\d{1,3})[\s.)-]+\s*(.+?)\s+(\d{2,8})\s+(\d+(?:\.\d+)?)\s*([A-Za-z]+)?\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)$/;

  // 3. Without HSN, Qty, Unit, Rate, ValA, ValB (3 trailing numbers)
  const itemRegexNoHsn3 = /^(\d{1,3})[\s.)-]+\s*(.+?)\s+(\d+(?:\.\d+)?)\s*([A-Za-z]+)?\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)$/;

  // 4. Without HSN, Qty, Unit, Rate, Amount (2 trailing numbers)
  const itemRegexNoHsn2 = /^(\d{1,3})[\s.)-]+\s*(.+?)\s+(\d+(?:\.\d+)?)\s*([A-Za-z]+)?\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)$/;

  // 5. With Discount: HSN, Qty, Unit, Rate, Disc%, Tax%, Amount (4 trailing numbers)
  const itemRegexWithDisc = /^(\d{1,3})[\s.)-]+\s*(.+?)\s+(\d{2,8})\s+(\d+(?:\.\d+)?)\s*([A-Za-z]+)?\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)$/;

  for (let i = 0; i < lines.length; i++) {
    // Sanitize commas between digits so "1,830.51" parses cleanly as 1830.51 without altering address text
    let line = lines[i].replace(/(\d),(\d)/g, '$1$2').trim();

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
      const slabTaxable = parseFloat(taxValuesMatch[1]);
      const slabCgstPct = parseFloat(taxValuesMatch[2]);
      const slabCgstAmt = parseFloat(taxValuesMatch[3]);
      const slabSgstPct = parseFloat(taxValuesMatch[4]);
      const slabSgstAmt = parseFloat(taxValuesMatch[5]);
      const slabNetPct = parseFloat(taxValuesMatch[6]);
      const slabTotalTax = parseFloat(taxValuesMatch[7]);

      parsedTaxRows.push({
        taxableValue: slabTaxable,
        cgstPercent: slabCgstPct,
        cgstAmount: slabCgstAmt,
        sgstPercent: slabSgstPct,
        sgstAmount: slabSgstAmt,
        netPercent: slabNetPct,
        totalTaxAmount: slabTotalTax
      });

      if (!taxableValue) taxableValue = slabTaxable;
      cgstAmount = slabCgstAmt;
      sgstAmount = slabSgstAmt;
      totalTaxAmount = slabTotalTax;
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

    // Auto-resume table block if we see an indexed row even after a page subtotal
    const looksLikeItemRow = line.match(/^(\d{1,3})[\s.)-]+\s*[A-Za-z]/);
    if (!inTableBlock && looksLikeItemRow && !line.match(/^(?:Phone|Date|GSTIN|No|Payment|Total|Taxable|BANK)/i)) {
      inTableBlock = true;
    }

    // Parse Table Items
    if (inTableBlock) {
      // 1. Check with HSN (3 trailing numbers: Rate, ValA, ValB)
      let m = line.match(itemRegexWithHsn);
      if (m) {
        if (currentItem) rawItems.push(currentItem);
        const qty = parseFloat(m[4]);
        const rate = parseFloat(m[6]);
        const valA = parseFloat(m[7]);
        const valB = parseFloat(m[8]);

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

      // 2. Check with HSN and Discount (4 trailing numbers: Rate, Disc, Tax%, Amount)
      const mDisc = line.match(itemRegexWithDisc);
      if (mDisc) {
        if (currentItem) rawItems.push(currentItem);
        const qty = parseFloat(mDisc[4]);
        const rate = parseFloat(mDisc[6]);
        const taxVal = parseFloat(mDisc[8]);
        const amtVal = parseFloat(mDisc[9]);

        currentItem = {
          sNo: parseInt(mDisc[1], 10),
          desc: mDisc[2].trim(),
          hsn: mDisc[3],
          qty: qty,
          unit: mDisc[5] || 'Nos',
          rate: rate,
          taxPercent: taxVal || 18,
          amount: amtVal > 0 ? amtVal : Math.round(qty * rate * 100) / 100
        };
        continue;
      }

      // 3. Check with HSN (2 trailing numbers: Rate, Amount - e.g. Cash/estimate bills)
      const mHsn2 = line.match(itemRegexHsnNoTax);
      if (mHsn2 && !line.match(/^(?:Total|Taxable|GSTIN|Payment|Date|BANK)/i)) {
        if (currentItem) rawItems.push(currentItem);
        const qty = parseFloat(mHsn2[4]);
        const rate = parseFloat(mHsn2[6]);
        const amount = parseFloat(mHsn2[7]);

        currentItem = {
          sNo: parseInt(mHsn2[1], 10),
          desc: mHsn2[2].trim(),
          hsn: mHsn2[3],
          qty: qty,
          unit: mHsn2[5] || 'Nos',
          rate: rate,
          taxPercent: 18,
          amount: amount
        };
        continue;
      }

      // 4. Check without HSN (3 trailing numbers: Qty, Unit, Rate, ValA, ValB)
      const mNoHsn3 = line.match(itemRegexNoHsn3);
      if (mNoHsn3 && !line.match(/^(?:Total|Taxable|GSTIN|Payment|Date|BANK)/i)) {
        if (currentItem) rawItems.push(currentItem);
        const qty = parseFloat(mNoHsn3[3]);
        const rate = parseFloat(mNoHsn3[5]);
        const valA = parseFloat(mNoHsn3[6]);
        const valB = parseFloat(mNoHsn3[7]);

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
          sNo: parseInt(mNoHsn3[1], 10),
          desc: mNoHsn3[2].trim(),
          hsn: '3209',
          qty: qty,
          unit: mNoHsn3[4] || 'Nos',
          rate: rate,
          taxPercent: taxPercent,
          amount: amount
        };
        continue;
      }

      // 5. Check without HSN (2 trailing numbers: Qty, Unit, Rate, Amount)
      const mNoHsn2 = line.match(itemRegexNoHsn2);
      if (mNoHsn2 && !line.match(/^(?:Total|Taxable|GSTIN|Payment|Date|BANK)/i)) {
        if (currentItem) rawItems.push(currentItem);
        const qty = parseFloat(mNoHsn2[3]);
        const rate = parseFloat(mNoHsn2[5]);
        const amount = parseFloat(mNoHsn2[6]);

        currentItem = {
          sNo: parseInt(mNoHsn2[1], 10),
          desc: mNoHsn2[2].trim(),
          hsn: '3209',
          qty: qty,
          unit: mNoHsn2[4] || 'Nos',
          rate: rate,
          taxPercent: 18,
          amount: amount
        };
        continue;
      }

      // 6. Check split row across 2 lines (Line 1: S.No + Desc, Line 2: numerical columns)
      const splitCandidateMatch = line.match(/^(\d{1,3})[\s.)-]+\s*[A-Za-z]/);
      if (i + 1 < lines.length && splitCandidateMatch) {
        const candSNo = parseInt(splitCandidateMatch[1], 10);
        const nextExpected = (currentItem ? currentItem.sNo : rawItems.length) + 1;
        const nextCleanLine = lines[i + 1].replace(/(\d),(\d)/g, '$1$2').trim();
        const nextLineIsItsOwnItem = nextCleanLine.match(itemRegexWithHsn) || nextCleanLine.match(itemRegexHsnNoTax);

        // Only consider a 2-line split if candSNo is in sequential order AND next line is not already a standalone item
        if (candSNo <= nextExpected + 2 && candSNo <= 150 && !nextLineIsItsOwnItem) {
          const combined = line + ' ' + nextCleanLine;
          const combM = combined.match(itemRegexWithHsn) || combined.match(itemRegexHsnNoTax) || combined.match(itemRegexNoHsn3) || combined.match(itemRegexNoHsn2);
          if (combM) {
            if (currentItem) rawItems.push(currentItem);
            i++; // Consume next line
            const sNo = parseInt(combM[1], 10);
            const desc = combM[2].trim();
            let hsn = '3209';
            let qty = 1;
            let unit = 'Nos';
            let rate = 0;
            let amount = 0;
            let taxPercent = 18;

            if (combM.length === 9) {
              hsn = combM[3];
              qty = parseFloat(combM[4]);
              unit = combM[5] || 'Nos';
              rate = parseFloat(combM[6]);
              const valA = parseFloat(combM[7]);
              const valB = parseFloat(combM[8]);
              if (valA <= 28) { taxPercent = valA; amount = valB; } else { amount = valA; taxPercent = valB; }
            } else if (combM.length === 8) {
              hsn = combM[3];
              qty = parseFloat(combM[4]);
              unit = combM[5] || 'Nos';
              rate = parseFloat(combM[6]);
              amount = parseFloat(combM[7]);
            }

            currentItem = { sNo, desc, hsn, qty, unit, rate, taxPercent, amount };
            continue;
          }
        }
      }

      // 7. Check continuation line of multi-line description (e.g. "(GLSY-ENAMEL)-ASIAN", "500 C) 0189", "BLACK-AGARAM")
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

    let itemTax = raw.taxPercent;
    if (itemTax == null || isNaN(itemTax)) {
      if (parsedTaxRows.length === 1) {
        itemTax = parsedTaxRows[0].netPercent;
      } else if (raw.hsn && raw.hsn.startsWith('25')) {
        itemTax = 5;
      } else if (raw.hsn && raw.hsn.startsWith('9603')) {
        itemTax = 12;
      } else {
        itemTax = 18;
      }
    }

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
      tax_percent: itemTax,
      line_total: lineTotal,
      confidenceScore: Math.round((confidence.score || 0) * 100),
      confidenceTier: confidence.tier || (matched ? 'High' : 'None'),
      isMatched: Boolean(matched),
      availableSizes: sisterSizes
    };
  });

  // Calculate distinct GST tax slabs across items (5%, 12%, 18%, 28%)
  const slabsMap = {};
  for (const it of matchedLineItems) {
    const rate = parseFloat(it.tax_percent) || 18;
    if (!slabsMap[rate]) {
      slabsMap[rate] = {
        rate: rate,
        cgstPercent: rate / 2,
        sgstPercent: rate / 2,
        taxableValue: 0,
        cgstAmount: 0,
        sgstAmount: 0,
        totalTaxAmount: 0
      };
    }
    slabsMap[rate].taxableValue += (it.line_total || 0);
  }

  const taxSlabs = Object.values(slabsMap).sort((a, b) => a.rate - b.rate).map(s => {
    s.taxableValue = Math.round(s.taxableValue * 100) / 100;
    s.cgstAmount = Math.round(s.taxableValue * (s.cgstPercent / 100) * 100) / 100;
    s.sgstAmount = Math.round(s.taxableValue * (s.sgstPercent / 100) * 100) / 100;
    s.totalTaxAmount = Math.round((s.cgstAmount + s.sgstAmount) * 100) / 100;
    return s;
  });

  // Calculate fallbacks if not explicitly found in footer
  if (!taxableValue && matchedLineItems.length > 0) {
    taxableValue = matchedLineItems.reduce((acc, it) => acc + (it.line_total || 0), 0);
  }
  if (!totalTaxAmount) {
    if (parsedTaxRows.length > 0) {
      totalTaxAmount = parsedTaxRows.reduce((acc, r) => acc + r.totalTaxAmount, 0);
      cgstAmount = parsedTaxRows.reduce((acc, r) => acc + r.cgstAmount, 0);
      sgstAmount = parsedTaxRows.reduce((acc, r) => acc + r.sgstAmount, 0);
    } else {
      totalTaxAmount = taxSlabs.reduce((acc, s) => acc + s.totalTaxAmount, 0);
      cgstAmount = taxSlabs.reduce((acc, s) => acc + s.cgstAmount, 0);
      sgstAmount = taxSlabs.reduce((acc, s) => acc + s.sgstAmount, 0);
    }
  }
  if (!netAmount) {
    netAmount = Math.round((taxableValue + totalTaxAmount + roundedOff) * 100) / 100;
  }
  if (!totalQty) {
    totalQty = matchedLineItems.reduce((acc, it) => acc + it.quantity, 0);
  }

  // Quotation number formatting - strictly use exact estimate/quote number from Optech PDF
  const optechQuoteNo = estimateNumber || '';
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
    quotationNumber: optechQuoteNo || formattedQuoteNo,
    estimateNumber: estimateNumber,
    referenceNo: estimateNumber,
    paymentTerms: paymentTerms,
    quotationDate: quotationDate || new Date().toISOString().split('T')[0],
    items: matchedLineItems,
    totals: {
      totalQty: totalQty,
      taxableValue: Math.round(taxableValue * 100) / 100,
      cgstPercent: taxSlabs.length === 1 ? taxSlabs[0].cgstPercent : 9.0,
      cgstAmount: cgstAmount || Math.round(taxableValue * 0.09 * 100) / 100,
      sgstPercent: taxSlabs.length === 1 ? taxSlabs[0].sgstPercent : 9.0,
      sgstAmount: sgstAmount || Math.round(taxableValue * 0.09 * 100) / 100,
      totalTaxAmount: Math.round(totalTaxAmount * 100) / 100,
      roundedOff: roundedOff,
      grandTotal: Math.round(netAmount * 100) / 100,
      amountInWords: amountInWords,
      taxSlabs: taxSlabs
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
