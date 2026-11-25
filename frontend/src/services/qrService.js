/**
 * Payment & QR Generation Service (Frontend / Client-Side)
 * Generates dynamic UPI QR codes locally for instant, zero-latency preview
 */

import QRCode from 'qrcode';

export function validateUpiId(upiId) {
  if (!upiId || typeof upiId !== 'string') return false;
  return /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(upiId.trim());
}

export function buildUpiUri({ upiId, payeeName = 'UDHAYAM AGENCIES', amount, ref, note }) {
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

export async function generateDynamicQrDataUrl({ upiId, payeeName = 'UDHAYAM AGENCIES', amount, ref, note }) {
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
    console.error('[Frontend QR Service] Failed to generate dynamic QR:', err);
    return null;
  }
}
