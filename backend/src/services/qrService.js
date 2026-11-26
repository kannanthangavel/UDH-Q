/**
 * Payment & QR Generation Service
 * Single Source of Truth for Dynamic UPI QR Code Generation
 * Prevents Stale QR Caching & Ensures Strict Data Integrity
 */

const QRCode = require('qrcode');
const { resolveUploadedFile } = require('../utils/storagePaths');

/**
 * Validates a UPI ID against Indian NPCI specifications
 * @param {string} upiId 
 * @returns {boolean}
 */
function validateUpiId(upiId) {
  if (!upiId || typeof upiId !== 'string') return false;
  const trimmed = upiId.trim();
  // Standard format: username@bank / handle@psp
  return /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(trimmed);
}

/**
 * Builds standard NPCI UPI Deep Link / Payment URI
 * @param {Object} params
 * @param {string} params.upiId - Target UPI VPA (e.g. paytmqr6vc6b5@ptys)
 * @param {string} [params.payeeName='UDHAYAM AGENCIES'] - Merchant or Account Name
 * @param {number} [params.amount] - Optional specific amount for the quotation
 * @param {string} [params.ref] - Optional Quotation number or reference ID
 * @param {string} [params.note] - Optional transaction note
 * @returns {string} Fully encoded UPI URI
 */
function buildUpiUri({ upiId, payeeName = 'UDHAYAM AGENCIES', amount, ref, note }) {
  if (!upiId) return '';
  const cleanUpi = upiId.trim();
  const cleanName = encodeURIComponent((payeeName || 'UDHAYAM AGENCIES').trim());
  let uri = `upi://pay?pa=${cleanUpi}&pn=${cleanName}&cu=INR`;

  if (amount && !isNaN(parseFloat(amount)) && parseFloat(amount) > 0) {
    uri += `&am=${parseFloat(amount).toFixed(2)}`;
  }
  if (ref) {
    uri += `&tr=${encodeURIComponent(ref.trim())}`;
  }
  if (note) {
    uri += `&tn=${encodeURIComponent(note.trim())}`;
  }
  return uri;
}

/**
 * Generates dynamic PNG buffer for PDF rendering directly from live payment data
 * @param {Object} params
 * @returns {Promise<Buffer|null>}
 */
async function generateDynamicQrBuffer({ upiId, payeeName = 'UDHAYAM AGENCIES', amount, ref, note }) {
  if (!upiId || !validateUpiId(upiId)) {
    return null;
  }
  const uri = buildUpiUri({ upiId, payeeName, amount, ref, note });
  try {
    const buffer = await QRCode.toBuffer(uri, {
      type: 'png',
      errorCorrectionLevel: 'M',
      margin: 1,
      scale: 6,
      color: {
        dark: '#00332C', // High contrast dark spruce matching theme
        light: '#FFFFFF'
      }
    });
    return buffer;
  } catch (err) {
    console.error('[QR Service] Failed to generate dynamic QR buffer:', err.message);
    return null;
  }
}

/**
 * Generates dynamic Data URL for browser preview
 * @param {Object} params
 * @returns {Promise<string|null>}
 */
async function generateDynamicQrDataUrl({ upiId, payeeName = 'UDHAYAM AGENCIES', amount, ref, note }) {
  if (!upiId || !validateUpiId(upiId)) {
    return null;
  }
  const uri = buildUpiUri({ upiId, payeeName, amount, ref, note });
  try {
    const dataUrl = await QRCode.toDataURL(uri, {
      errorCorrectionLevel: 'M',
      margin: 1,
      scale: 6,
      color: {
        dark: '#00332C',
        light: '#FFFFFF'
      }
    });
    return dataUrl;
  } catch (err) {
    console.error('[QR Service] Failed to generate dynamic QR data URL:', err.message);
    return null;
  }
}

/**
 * Resolves the active QR code source dynamically for a quotation PDF
 * Strictly ensures no stale data leaks into the PDF
 * @param {Object} quotation
 * @param {Object} settings
 * @returns {Promise<Buffer|null>}
 */
async function resolveQuotationQrSource(quotation = {}, settings = {}) {
  // 1. Prefer explicit Base64 image uploaded in settings
  if (settings.payment_qr_code_data && typeof settings.payment_qr_code_data === 'string' && settings.payment_qr_code_data.startsWith('data:image')) {
    try {
      const base64Data = settings.payment_qr_code_data.replace(/^data:image\/\w+;base64,/, '');
      return Buffer.from(base64Data, 'base64');
    } catch (e) {
      console.warn('[QR Service] Buffer conversion failed for fallback payment_qr_code_data:', e.message);
    }
  }

  // 2. Prefer saved/uploaded official QR image file from disk (e.g. Paytm QR uploaded by user)
  const fileQr = resolveUploadedFile('qr', settings.payment_qr_code, 'default_upi_qr.png');
  if (fileQr) {
    return fileQr;
  }

  // 3. Fallback to dynamic UPI QR generation if valid UPI is available
  const activeUpi = quotation.upi_id || settings.upi_id || 'paytmqr6vc6b5@ptys';
  const payeeName = settings.bank_account_name || settings.company_name || 'UDHAYAM AGENCIES';
  const quoteNo = quotation.quotation_number || '';
  const totalAmount = quotation.grand_total;

  if (activeUpi && validateUpiId(activeUpi)) {
    const dynamicBuffer = await generateDynamicQrBuffer({
      upiId: activeUpi,
      payeeName,
      amount: totalAmount,
      ref: quoteNo,
      note: `Payment for Quote ${quoteNo}`
    });
    if (dynamicBuffer) {
      return dynamicBuffer;
    }
  }

  return null;
}

module.exports = {
  validateUpiId,
  buildUpiUri,
  generateDynamicQrBuffer,
  generateDynamicQrDataUrl,
  resolveQuotationQrSource
};
