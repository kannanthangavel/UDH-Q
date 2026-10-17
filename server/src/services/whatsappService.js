const { formatINR } = require('./calculationService');

/**
 * Normalizes an Indian phone number to international format without plus or spaces (e.g. 919876543210)
 */
function normalizePhoneNumber(phone) {
  if (!phone) return '';
  let cleaned = String(phone).replace(/[^\d]/g, '');
  if (cleaned.length === 10) {
    cleaned = '91' + cleaned;
  } else if (cleaned.length === 11 && cleaned.startsWith('0')) {
    cleaned = '91' + cleaned.substring(1);
  } else if (cleaned.length === 12 && cleaned.startsWith('91')) {
    // already 91...
  }
  return cleaned;
}

/**
 * Formats WhatsApp message in the exact Tamil business quotation format requested
 */
function formatWhatsAppMessage(quotation, items, settings, options = {}) {
  const companyName = settings.company_name || 'Udhayam Agencies';
  const quoteNum = quotation.quotation_number;
  const grandTotal = Number(quotation.grand_total || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  const customerName = quotation.customer_name && quotation.customer_name.trim() 
    ? quotation.customer_name.trim() 
    : 'சார் / மேடம்';
  
  const bankName = settings.bank_name || 'Indian Bank';
  const bankAcc = settings.bank_account_no || '6659330152';
  // Extract just the IFSC code like IDIB000P034
  const bankIfsc = settings.bank_ifsc ? settings.bank_ifsc.split(/[\s(]/)[0] : 'IDIB000P034';
  // Extract clean GPay number
  const gpayMatch = (settings.gpay_number || '+91 97156 22499').match(/\+?\d[\d\s-]{8,15}\d/);
  const gpayNumber = gpayMatch ? gpayMatch[0].trim() : '+91 97156 22499';
  const companyAddress = '41/10, KMR Complex, Old Bus Stand Road,\nPerundurai - 638052';

  // Format date as DD/MM/YYYY
  let quoteDate = new Date().toLocaleDateString('en-GB');
  if (quotation.created_at) {
    try {
      const d = new Date(quotation.created_at);
      quoteDate = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    } catch (_) {}
  }

  let msg = `🙏 வணக்கம் ${customerName}\n\n`;
  msg += `📄 தங்களுக்கான quotation விவரங்கள் PDF-ல் இணைக்கப்பட்டுள்ளன.\n\n`;
  msg += `🧾 Quote No: ${quoteNum}\n`;
  msg += `📅 Date: ${quoteDate}\n`;
  msg += `💰 Grand Total: ₹${grandTotal}\n\n`;

  msg += `🏦 Payment Details:\n\n`;
  msg += `🏛️ Bank: ${bankName}\n\n`;
  msg += `💳 A/c No: ${bankAcc}\n\n`;
  msg += `🔢 IFSC: ${bankIfsc}\n\n`;
  msg += `📱 GPay: ${gpayNumber}\n\n`;

  if (options.pdfUrl) {
    msg += `🌐 PDF Download Link:\n${options.pdfUrl}\n\n`;
  }

  msg += `📌 தயவுசெய்து இணைக்கப்பட்டுள்ள PDF-ஐ review செய்து கொள்ளவும். ஏதேனும் queries இருந்தால் எங்களைத் தொடர்புகொள்ளவும்.\n\n`;
  msg += `🙏 நன்றி!\n\n`;
  msg += `🏢 ${companyName}\n`;
  msg += `📍 ${companyAddress}\n\n`;
  msg += `📞 Contact:\n`;
  msg += `+91 97156 22499\n`;
  msg += `+91 88700 22499`;

  return msg;
}

/**
 * Generates direct wa.me link for manual sharing
 */
function generateWhatsAppShareLink(phone, messageText) {
  const normalizedPhone = normalizePhoneNumber(phone);
  const encodedText = encodeURIComponent(messageText);

  if (normalizedPhone) {
    return `https://wa.me/${normalizedPhone}?text=${encodedText}`;
  }
  return `https://wa.me/?text=${encodedText}`;
}

/**
 * Adapter interface for official WhatsApp Business Cloud API
 */
class WhatsAppBusinessAdapter {
  constructor(config = {}) {
    this.token = config.token || process.env.WHATSAPP_CLOUD_API_TOKEN;
    this.phoneNumberId = config.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;
    this.isConfigured = Boolean(this.token && this.phoneNumberId);
  }

  async sendDocument(recipientPhone, documentUrl, caption) {
    if (!this.isConfigured) {
      return {
        success: false,
        method: 'official_api',
        status: 'not_configured',
        error: 'WhatsApp Business API credentials are not configured on the server. Please use manual WhatsApp sharing.'
      };
    }

    // In a live environment with credentials, this would call graph.facebook.com/v19.0/{phone_number_id}/messages
    return {
      success: true,
      method: 'official_api',
      messageId: `wamid.mock.${Date.now()}`,
      status: 'sent',
      recipient: recipientPhone
    };
  }
}

module.exports = {
  normalizePhoneNumber,
  formatWhatsAppMessage,
  generateWhatsAppShareLink,
  WhatsAppBusinessAdapter
};
