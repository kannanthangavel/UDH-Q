function sanitizeForFilename(str, fallback = 'DOCUMENT') {
  if (!str) return fallback;
  const clean = str
    .trim()
    .replace(/[^A-Za-z0-9\-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return clean || fallback;
}

function getQuotationPdfFilename(customerName, quotationNumber) {
  const cust = sanitizeForFilename(customerName, 'Customer');
  const qNo = sanitizeForFilename(quotationNumber, 'Quote');
  return `${cust}_${qNo}.pdf`;
}

function getReceiptPdfFilename(customerName, receiptNumber) {
  const cust = sanitizeForFilename(customerName, 'Customer');
  const rNo = sanitizeForFilename(receiptNumber, 'Receipt');
  return `${cust}_Receipt_${rNo}.pdf`;
}

module.exports = {
  sanitizeForFilename,
  getQuotationPdfFilename,
  getReceiptPdfFilename
};
