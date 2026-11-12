const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const { formatINR } = require('./calculationService');
const { formatWhatsAppMessage } = require('./whatsappService');

/**
 * Prepares email subject and formatted text/HTML body
 */
function formatEmailContent(quotation, items, settings, options = {}) {
  const companyName = settings.company_name || 'Udhayam Agencies';
  const quoteNum = quotation.quotation_number;
  const grandTotal = Number(quotation.grand_total || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  const customerName = quotation.customer_name && quotation.customer_name.trim() 
    ? quotation.customer_name.trim() 
    : 'Valued Customer';

  const subject = `📄 Quotation ${quoteNum} from ${companyName} - ₹${grandTotal}`;

  // Use the exact Tamil message format requested by the user
  const textBody = formatWhatsAppMessage(quotation, items, settings, options);

  const bankName = settings.bank_name || 'Indian Bank';
  const bankAcc = settings.bank_account_no || '6659330152';
  const bankIfsc = settings.bank_ifsc ? settings.bank_ifsc.split(/[\s(]/)[0] : 'IDIB000P034';
  const gpayMatch = (settings.gpay_number || '+91 97156 22499').match(/\+?\d[\d\s-]{8,15}\d/);
  const gpayNumber = gpayMatch ? gpayMatch[0].trim() : '+91 97156 22499';

  let quoteDate = new Date().toLocaleDateString('en-GB');
  if (quotation.created_at) {
    try {
      const d = new Date(quotation.created_at);
      quoteDate = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    } catch (_) {}
  }

  const htmlBody = `
<!DOCTYPE html>
<html lang="ta">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    .header { background: #1e3a8a; color: #ffffff; padding: 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 20px; letter-spacing: 0.5px; }
    .header p { margin: 4px 0 0 0; font-size: 13px; color: #93c5fd; }
    .content { padding: 24px; font-size: 14px; line-height: 1.6; }
    .greeting { font-size: 16px; font-weight: bold; color: #0f172a; margin-bottom: 12px; }
    .quote-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 16px; margin: 16px 0; }
    .quote-box table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .quote-box td { padding: 4px 0; }
    .quote-box td.label { color: #64748b; font-weight: 500; }
    .quote-box td.value { color: #0f172a; font-weight: bold; text-align: right; }
    .total-val { font-size: 18px; color: #15803d; }
    .attachment-card { background: #eff6ff; border: 1px dashed #3b82f6; border-radius: 6px; padding: 12px 16px; margin: 16px 0; font-size: 13px; color: #1e40af; }
    .payment-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin: 16px 0; font-size: 13px; }
    .payment-title { font-weight: bold; color: #334155; margin-bottom: 8px; }
    .footer { background: #f1f5f9; padding: 16px 24px; font-size: 12px; color: #64748b; text-align: center; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${companyName.toUpperCase()}</h1>
      <p>Perundurai, Erode | Phone: +91 97156 22499</p>
    </div>
    <div class="content">
      <div class="greeting">🙏 வணக்கம் ${customerName},</div>
      <p>தங்களுக்கான quotation விவரங்கள் PDF-ல் இணைக்கப்பட்டுள்ளன.</p>
      
      <div class="quote-box">
        <table>
          <tr><td class="label">Quote No:</td><td class="value">${quoteNum}</td></tr>
          <tr><td class="label">Date:</td><td class="value">${quoteDate}</td></tr>
          <tr><td class="label">Total Items:</td><td class="value">${items ? items.length : 0} Item(s)</td></tr>
          <tr><td class="label">Grand Total (GST Incl.):</td><td class="value total-val">₹${grandTotal}</td></tr>
        </table>
      </div>

      <div class="attachment-card">
        📎 <b>Quotation PDF Document Attached:</b><br/>
        Detailed technical specifications, HSN breakdown, and terms are provided in the attached PDF file.
      </div>

      <div class="payment-box">
        <div class="payment-title">🏦 Payment Details:</div>
        <div>• <b>Bank:</b> ${bankName}</div>
        <div>• <b>A/c No:</b> ${bankAcc}</div>
        <div>• <b>IFSC:</b> ${bankIfsc}</div>
        <div>• <b>GPay / PhonePe:</b> ${gpayNumber}</div>
      </div>

      <p>📌 தயவுசெய்து இணைக்கப்பட்டுள்ள PDF-ஐ review செய்து கொள்ளவும். ஏதேனும் queries இருந்தால் எங்களைத் தொடர்புகொள்ளவும்.</p>
      <p>🙏 நன்றி!</p>
    </div>
    <div class="footer">
      <b>${companyName}</b><br/>
      41/10, KMR Complex, Old Bus Stand Road, Perundurai - 638052<br/>
      Contact: +91 97156 22499 / +91 88700 22499
    </div>
  </div>
</body>
</html>
  `;

  return {
    subject,
    text: textBody,
    html: htmlBody
  };
}

/**
 * Creates nodemailer transporter from settings or environment
 */
function createTransporter(settings) {
  const host = settings.smtp_host || process.env.SMTP_HOST;
  const port = Number(settings.smtp_port || process.env.SMTP_PORT || 587);
  const user = settings.smtp_user || process.env.SMTP_USER;
  const pass = settings.smtp_pass || process.env.SMTP_PASS;
  const secure = settings.smtp_secure === 'true' || port === 465;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    tls: { rejectUnauthorized: false }
  });
}

/**
 * Sends quotation email with PDF attachment
 */
async function sendQuotationEmail({ quotation, items, settings, recipientEmail, recipientName, pdfFilePath, options = {} }) {
  const emailContent = formatEmailContent(quotation, items, settings, options);
  const targetEmail = (recipientEmail || quotation.customer_email || '').trim();

  // Generate web compose links as instant 1-click helpers
  const mailtoLink = `mailto:${encodeURIComponent(targetEmail)}?subject=${encodeURIComponent(emailContent.subject)}&body=${encodeURIComponent(emailContent.text)}`;
  const gmailComposeLink = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(targetEmail)}&su=${encodeURIComponent(emailContent.subject)}&body=${encodeURIComponent(emailContent.text)}`;

  if (!targetEmail) {
    return {
      success: false,
      error: 'Recipient email address is required.',
      emailContent,
      mailtoLink,
      gmailComposeLink
    };
  }

  const transporter = createTransporter(settings);

  // If SMTP is not configured, return client fallback links so user can send via Gmail/Outlook with 1 click
  if (!transporter) {
    return {
      success: true,
      mode: 'client_fallback',
      status: 'smtp_not_configured',
      message: 'SMTP not configured on server. Use 1-Click Gmail or Mail Client to send with the downloaded PDF.',
      emailContent,
      mailtoLink,
      gmailComposeLink,
      recipientEmail: targetEmail
    };
  }

  // If SMTP is configured, send directly with PDF attachment
  try {
    const fromAddress = settings.smtp_from || settings.smtp_user || `"${settings.company_name || 'Udhayam Agencies'}" <${settings.company_email || 'noreply@udhayam.com'}>`;
    
    const mailOptions = {
      from: fromAddress,
      to: targetEmail,
      subject: emailContent.subject,
      text: emailContent.text,
      html: emailContent.html,
      attachments: []
    };

    if (pdfFilePath && fs.existsSync(pdfFilePath)) {
      mailOptions.attachments.push({
        filename: `${quotation.quotation_number}_Udhayam_Quotation.pdf`,
        path: pdfFilePath,
        contentType: 'application/pdf'
      });
    }

    const info = await transporter.sendMail(mailOptions);
    return {
      success: true,
      mode: 'smtp',
      status: 'sent',
      messageId: info.messageId,
      recipientEmail: targetEmail,
      emailContent,
      mailtoLink,
      gmailComposeLink
    };
  } catch (err) {
    return {
      success: false,
      mode: 'smtp_error',
      error: err.message,
      emailContent,
      mailtoLink,
      gmailComposeLink,
      recipientEmail: targetEmail
    };
  }
}

module.exports = {
  formatEmailContent,
  sendQuotationEmail
};
