/**
 * Decimal-safe currency and quotation calculation service for Indian Rupee (INR)
 */

function round2(num) {
  return Math.round((Number(num) + Number.EPSILON) * 100) / 100;
}

/**
 * Calculates line item values safely
 */
function calculateLineItem(item, isTaxInclusive = true) {
  const quantity = Math.max(0, Number(item.quantity || 0));
  const unitPrice = Math.max(0, Number(item.unit_price || 0));
  const discountPercent = Math.min(100, Math.max(0, Number(item.discount_percent || 0)));
  const gstRate = Math.max(0, Number(item.gst_rate !== undefined ? item.gst_rate : 18));

  let taxableAmount = 0;
  let gstAmount = 0;
  let lineTotal = 0;
  let discountAmount = 0;

  if (isTaxInclusive) {
    // Unit price already includes GST
    const rawTotal = quantity * unitPrice;
    discountAmount = round2(rawTotal * (discountPercent / 100));
    const discountedTotal = rawTotal - discountAmount;

    // Base taxable value before tax
    taxableAmount = round2(discountedTotal / (1 + (gstRate / 100)));
    gstAmount = round2(discountedTotal - taxableAmount);
    lineTotal = round2(discountedTotal);
  } else {
    // Unit price is exclusive of GST
    const rawTotal = quantity * unitPrice;
    discountAmount = round2(rawTotal * (discountPercent / 100));
    taxableAmount = round2(rawTotal - discountAmount);
    gstAmount = round2(taxableAmount * (gstRate / 100));
    lineTotal = round2(taxableAmount + gstAmount);
  }

  return {
    ...item,
    quantity,
    unit_price: round2(unitPrice),
    discount_percent: discountPercent,
    discount_amount: discountAmount,
    taxable_amount: taxableAmount,
    gst_rate: gstRate,
    gst_amount: gstAmount,
    line_total: lineTotal
  };
}

/**
 * Calculates whole quotation totals and tax breakdown
 */
function calculateQuotationTotals(items, options = {}) {
  const isTaxInclusive = options.isTaxInclusive !== undefined ? options.isTaxInclusive : true;
  const deliveryCharges = round2(Math.max(0, Number(options.deliveryCharges || 0)));
  const otherCharges = round2(Math.max(0, Number(options.otherCharges || 0)));
  const isInterState = Boolean(options.isInterState || false);

  const calculatedItems = (items || []).map(item => calculateLineItem(item, isTaxInclusive));

  let subtotal = 0;
  let discountTotal = 0;
  let taxableTotal = 0;
  let taxTotal = 0;
  let linesGrandTotal = 0;

  // Breakdown grouped by GST rate: e.g. { '18': { taxable: 100, gst: 18 } }
  const taxBreakdown = {};

  calculatedItems.forEach(item => {
    subtotal += item.quantity * item.unit_price;
    discountTotal += item.discount_amount;
    taxableTotal += item.taxable_amount;
    taxTotal += item.gst_amount;
    linesGrandTotal += item.line_total;

    const rateKey = String(item.gst_rate);
    if (!taxBreakdown[rateKey]) {
      taxBreakdown[rateKey] = {
        rate: item.gst_rate,
        taxable: 0,
        cgst: 0,
        sgst: 0,
        igst: 0,
        totalGst: 0
      };
    }
    taxBreakdown[rateKey].taxable = round2(taxBreakdown[rateKey].taxable + item.taxable_amount);
    taxBreakdown[rateKey].totalGst = round2(taxBreakdown[rateKey].totalGst + item.gst_amount);

    if (isInterState) {
      taxBreakdown[rateKey].igst = taxBreakdown[rateKey].totalGst;
    } else {
      taxBreakdown[rateKey].cgst = round2(taxBreakdown[rateKey].totalGst / 2);
      taxBreakdown[rateKey].sgst = round2(taxBreakdown[rateKey].totalGst - taxBreakdown[rateKey].cgst);
    }
  });

  const grandTotal = round2(linesGrandTotal + deliveryCharges + otherCharges);

  return {
    items: calculatedItems,
    subtotal: round2(subtotal),
    discount_total: round2(discountTotal),
    taxable_amount: round2(taxableTotal),
    tax_total: round2(taxTotal),
    delivery_charges: deliveryCharges,
    other_charges: otherCharges,
    grand_total: grandTotal,
    taxBreakdown,
    amount_in_words: numberToWordsINR(grandTotal)
  };
}

/**
 * Formats a number with Indian currency comma grouping (e.g., 1,23,456.00)
 */
function formatINR(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return '₹ 0.00';
  const num = Number(amount);
  const isNegative = num < 0;
  const absNum = Math.abs(num);
  const parts = absNum.toFixed(2).split('.');
  let integerPart = parts[0];
  const decimalPart = parts[1];

  // Indian grouping: last 3 digits, then groups of 2
  if (integerPart.length > 3) {
    const lastThree = integerPart.substring(integerPart.length - 3);
    const otherNumbers = integerPart.substring(0, integerPart.length - 3);
    integerPart = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + lastThree;
  }

  return `${isNegative ? '-' : ''}₹ ${integerPart}.${decimalPart}`;
}

/**
 * Converts a number to words according to the Indian numbering system
 */
function numberToWordsINR(amount) {
  if (!amount || isNaN(amount) || amount <= 0) {
    return 'Rupees Zero Only';
  }

  const ones = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen'
  ];

  const tens = [
    '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'
  ];

  function convertTwoDigits(num) {
    if (num < 20) return ones[num];
    const unit = num % 10;
    return tens[Math.floor(num / 10)] + (unit > 0 ? ' ' + ones[unit] : '');
  }

  function convertThreeDigits(num) {
    let result = '';
    const hundred = Math.floor(num / 100);
    const remainder = num % 100;

    if (hundred > 0) {
      result += ones[hundred] + ' Hundred';
      if (remainder > 0) result += ' and ';
    }
    if (remainder > 0) {
      result += convertTwoDigits(remainder);
    }
    return result;
  }

  const rounded = round2(amount);
  const rupees = Math.floor(rounded);
  const paise = Math.round((rounded - rupees) * 100);

  let rupeesStr = '';

  const crore = Math.floor(rupees / 10000000);
  const remainderCrore = rupees % 10000000;

  const lakh = Math.floor(remainderCrore / 100000);
  const remainderLakh = remainderCrore % 100000;

  const thousand = Math.floor(remainderLakh / 1000);
  const remainderThousand = remainderLakh % 1000;

  if (crore > 0) {
    rupeesStr += convertThreeDigits(crore) + ' Crore ';
  }
  if (lakh > 0) {
    rupeesStr += convertThreeDigits(lakh) + ' Lakh ';
  }
  if (thousand > 0) {
    rupeesStr += convertThreeDigits(thousand) + ' Thousand ';
  }
  if (remainderThousand > 0) {
    rupeesStr += convertThreeDigits(remainderThousand);
  }

  rupeesStr = rupeesStr.trim();
  if (!rupeesStr) {
    rupeesStr = 'Zero';
  }

  let finalWords = `Rupees ${rupeesStr}`;

  if (paise > 0) {
    finalWords += ` and ${convertTwoDigits(paise)} Paise`;
  }

  finalWords += ' Only';
  return finalWords.replace(/\s+/g, ' ');
}

module.exports = {
  round2,
  calculateLineItem,
  calculateQuotationTotals,
  formatINR,
  numberToWordsINR
};
