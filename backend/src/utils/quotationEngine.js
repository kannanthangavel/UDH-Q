/**
 * Canonical Quotation Calculation Engine
 * Single Source of Truth for Financials, Tax Slabs, Discounts, and Round-Off
 * Shared across API, PDF Generator, Optech Converter, and Frontend
 */

const { numberToIndianWords } = require('./numberToWords');

/**
 * Calculates complete quotation financial breakdown with mathematical accuracy
 * @param {Object} params
 * @param {Array} params.items - Array of line items
 * @param {number} [params.discount_percent=0]
 * @param {number} [params.discount_amount=0]
 * @param {'percent'|'amount'} [params.discount_mode='percent']
 * @param {boolean} [params.is_tax_inclusive=true] - true: sale_rate includes GST, false: GST is added on top
 * @param {number} [params.default_gst_rate=18]
 * @param {number} [params.delivery_charges=0]
 * @param {string} [params.company_state_code='33'] - 33 for Tamil Nadu
 * @param {string} [params.customer_gstin=''] - Customer GSTIN if available
 * @param {string} [params.customer_state_code=''] - If provided directly
 * @returns {Object} Calculated quotation model
 */
function calculateQuotationFinancials({
  items = [],
  discount_percent = 0,
  discount_amount = 0,
  discount_mode = 'percent',
  is_tax_inclusive = true,
  default_gst_rate = 18,
  delivery_charges = 0,
  company_state_code = '33',
  customer_gstin = '',
  customer_state_code = ''
}) {
  const isTaxInclusive = Boolean(is_tax_inclusive);
  const defaultRate = parseFloat(default_gst_rate) || 18;

  // Determine Inter-state vs Intra-state (IGST vs CGST+SGST)
  let custState = customer_state_code;
  if (!custState && customer_gstin && typeof customer_gstin === 'string') {
    const cleanGst = customer_gstin.trim();
    if (/^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}$/i.test(cleanGst)) {
      custState = cleanGst.substring(0, 2);
    }
  }
  const isInterstate = Boolean(custState && custState !== company_state_code);

  // 1. Line Item Calculations
  const calculatedItems = [];
  let grossSubtotal = 0;

  for (let i = 0; i < items.length; i++) {
    const rawItem = items[i];
    const qty = Math.max(0, parseFloat(rawItem.quantity) || 0);
    const rate = Math.max(0, parseFloat(rawItem.sale_rate) || 0);
    const rawLineTotal = Math.round(qty * rate * 100) / 100;
    const taxRate = rawItem.tax_percent != null && !isNaN(parseFloat(rawItem.tax_percent))
      ? parseFloat(rawItem.tax_percent)
      : defaultRate;

    calculatedItems.push({
      ...rawItem,
      quantity: qty,
      sale_rate: rate,
      tax_percent: taxRate,
      raw_line_total: rawLineTotal,
      line_total: rawLineTotal
    });

    grossSubtotal += rawLineTotal;
  }
  grossSubtotal = Math.round(grossSubtotal * 100) / 100;

  // 2. Discount Calculation
  let computedDiscount = 0;
  const numDiscPercent = Math.min(100, Math.max(0, parseFloat(discount_percent) || 0));
  const numDiscAmount = Math.max(0, parseFloat(discount_amount) || 0);

  if (discount_mode === 'amount') {
    computedDiscount = Math.min(grossSubtotal, numDiscAmount);
  } else {
    computedDiscount = Math.round((grossSubtotal * numDiscPercent / 100) * 100) / 100;
  }
  computedDiscount = Math.round(computedDiscount * 100) / 100;

  const netAfterDiscount = Math.max(0, Math.round((grossSubtotal - computedDiscount) * 100) / 100);
  const discountFactor = grossSubtotal > 0 ? (netAfterDiscount / grossSubtotal) : 1;

  // 3. Tax Slabs & Base Taxable Calculations
  const slabsMap = {};

  for (let i = 0; i < calculatedItems.length; i++) {
    const it = calculatedItems[i];
    const rate = it.tax_percent;
    const discountedLineVal = Math.round(it.raw_line_total * discountFactor * 100) / 100;

    let itemTaxable = 0;
    let itemTax = 0;

    if (isTaxInclusive) {
      itemTaxable = rate > 0 ? Math.round((discountedLineVal / (1 + rate / 100)) * 100) / 100 : discountedLineVal;
      itemTax = Math.round((discountedLineVal - itemTaxable) * 100) / 100;
    } else {
      itemTaxable = discountedLineVal;
      itemTax = Math.round((itemTaxable * (rate / 100)) * 100) / 100;
    }

    it.taxable_value = itemTaxable;
    it.tax_amount = itemTax;

    if (!slabsMap[rate]) {
      slabsMap[rate] = {
        rate: rate,
        isInterstate: isInterstate,
        cgstPercent: isInterstate ? 0 : rate / 2,
        sgstPercent: isInterstate ? 0 : rate / 2,
        igstPercent: isInterstate ? rate : 0,
        grossTotal: 0,
        taxableValue: 0,
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 0,
        totalTaxAmount: 0
      };
    }

    slabsMap[rate].grossTotal += discountedLineVal;
  }

  const taxSlabs = Object.values(slabsMap).sort((a, b) => a.rate - b.rate).map(s => {
    const slabGross = Math.round(s.grossTotal * 100) / 100;
    if (isTaxInclusive) {
      s.taxableValue = s.rate > 0 ? Math.round((slabGross / (1 + s.rate / 100)) * 100) / 100 : slabGross;
      s.totalTaxAmount = Math.round((slabGross - s.taxableValue) * 100) / 100;
    } else {
      s.taxableValue = slabGross;
      s.totalTaxAmount = Math.round((s.taxableValue * (s.rate / 100)) * 100) / 100;
    }
    if (s.isInterstate) {
      s.igstAmount = s.totalTaxAmount;
      s.cgstAmount = 0;
      s.sgstAmount = 0;
    } else {
      s.cgstAmount = Math.round((s.taxableValue * (s.cgstPercent / 100)) * 100) / 100;
      s.sgstAmount = Math.round((s.totalTaxAmount - s.cgstAmount) * 100) / 100;
    }
    delete s.grossTotal;
    return s;
  });

  const totalTaxable = Math.round(taxSlabs.reduce((acc, s) => acc + s.taxableValue, 0) * 100) / 100;
  const totalTax = Math.round(taxSlabs.reduce((acc, s) => acc + s.totalTaxAmount, 0) * 100) / 100;
  const totalCgst = Math.round(taxSlabs.reduce((acc, s) => acc + s.cgstAmount, 0) * 100) / 100;
  const totalSgst = Math.round(taxSlabs.reduce((acc, s) => acc + s.sgstAmount, 0) * 100) / 100;
  const totalIgst = Math.round(taxSlabs.reduce((acc, s) => acc + s.igstAmount, 0) * 100) / 100;

  // 4. Grand Total & Round-Off (invariant: taxable + totalTax + delivery + roundOff === grandTotal)
  const deliveryVal = Math.max(0, parseFloat(delivery_charges) || 0);
  const unroundedTotal = Math.round((totalTaxable + totalTax + deliveryVal) * 100) / 100;

  const roundedGrandTotal = Math.round(unroundedTotal);
  const roundedOff = Math.round((roundedGrandTotal - unroundedTotal) * 100) / 100;

  // 5. Amount in Indian Currency Words
  const amountInWords = numberToIndianWords ? numberToIndianWords(roundedGrandTotal) : '';

  return {
    items: calculatedItems,
    grossSubtotal,
    discountPercent: numDiscPercent,
    discountAmount: computedDiscount,
    netSubtotal: netAfterDiscount,
    subtotal: grossSubtotal,
    taxableValue: totalTaxable,
    isTaxInclusive,
    isInterstate,
    taxSlabs,
    totalCgst,
    totalSgst,
    totalIgst,
    totalTaxAmount: totalTax,
    deliveryCharges: deliveryVal,
    roundedOff,
    grandTotal: roundedGrandTotal,
    unroundedTotal,
    amountInWords,
    isValid: calculatedItems.length > 0 && roundedGrandTotal > 0
  };
}

/**
 * Validates a quotation model for complete data integrity before saving or PDF generation
 * @param {Object} quote
 * @returns {{ isValid: boolean, errors: string[] }}
 */
function validateQuotationIntegrity(quote) {
  const errors = [];
  if (!quote.customer_name || !quote.customer_name.trim()) {
    errors.push('Customer Name is required.');
  }
  if (!quote.quotation_number || !quote.quotation_number.trim()) {
    errors.push('Quotation Number is required.');
  }
  if (!quote.quotation_date) {
    errors.push('Quotation Date is required.');
  }
  if (!Array.isArray(quote.items) || quote.items.length === 0) {
    errors.push('At least one line item is required.');
  } else {
    quote.items.forEach((it, idx) => {
      if (!it.item_name || !it.item_name.trim()) {
        errors.push(`Item #${idx + 1} is missing a description/name.`);
      }
      if (it.quantity == null || parseFloat(it.quantity) <= 0) {
        errors.push(`Item #${idx + 1} (${it.item_name || 'Item'}) has invalid quantity.`);
      }
      if (it.sale_rate == null || parseFloat(it.sale_rate) < 0) {
        errors.push(`Item #${idx + 1} (${it.item_name || 'Item'}) has invalid rate.`);
      }
    });
  }
  if (quote.grand_total == null || isNaN(parseFloat(quote.grand_total)) || parseFloat(quote.grand_total) < 0) {
    errors.push('Quotation grand total is invalid.');
  }
  return {
    isValid: errors.length === 0,
    errors
  };
}

module.exports = {
  calculateQuotationFinancials,
  validateQuotationIntegrity
};
