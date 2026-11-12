const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * Verifies Meta WhatsApp Webhook signature using HMAC-SHA256
 */
function verifyWebhookSignature(rawBody, signatureHeader, appSecret) {
  if (!appSecret || !appSecret.trim()) {
    // If no secret configured, permit for development/testing
    return true;
  }

  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
    return false;
  }

  const expectedSignature = signatureHeader.split('=')[1];
  const hmac = crypto.createHmac('sha256', appSecret);
  hmac.update(rawBody);
  const calculatedSignature = hmac.digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(calculatedSignature, 'hex')
    );
  } catch (_) {
    return false;
  }
}

/**
 * Uploads PDF file as a media asset to Meta WhatsApp Cloud API
 */
async function uploadPdfMedia(phoneNumberId, accessToken, pdfFilePath, pdfFilename, apiVersion = 'v21.0') {
  if (!fs.existsSync(pdfFilePath)) {
    throw new Error(`PDF file does not exist at ${pdfFilePath}`);
  }

  const fileBuffer = fs.readFileSync(pdfFilePath);
  const blob = new Blob([fileBuffer], { type: 'application/pdf' });

  const formData = new FormData();
  formData.append('messaging_product', 'whatsapp');
  formData.append('file', blob, pdfFilename || 'quotation.pdf');
  formData.append('type', 'application/pdf');

  const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/media`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`
    },
    body: formData
  });

  const data = await res.json();
  if (!res.ok) {
    const errMsg = data.error ? data.error.message : JSON.stringify(data);
    throw new Error(`Meta Media Upload Failed: ${errMsg}`);
  }

  return data.id; // Returns media_id
}

/**
 * Sends PDF document message to customer via Meta WhatsApp Cloud API
 */
async function sendOfficialWhatsAppDocument({
  phoneNumberId,
  accessToken,
  recipientPhone,
  mediaId,
  filename,
  caption,
  apiVersion = 'v21.0'
}) {
  const cleanPhone = recipientPhone.replace(/[\s+-]/g, '');
  const formattedPhone = cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`;

  const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: formattedPhone,
    type: 'document',
    document: {
      id: mediaId,
      caption: caption || '',
      filename: filename || 'Quotation_Udhayam.pdf'
    }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  if (!res.ok) {
    const errMsg = data.error ? data.error.message : JSON.stringify(data);
    throw new Error(`Meta WhatsApp Send Failed: ${errMsg}`);
  }

  return {
    success: true,
    providerMessageId: data.messages && data.messages[0] ? data.messages[0].id : null,
    recipient: formattedPhone
  };
}

/**
 * Parses Meta Webhook Payload into structured events (Messages or StatusesParser)
 */
function parseMetaWebhook(body) {
  const events = { messages: [], statuses: [] };
  if (!body || body.object !== 'whatsapp_business_account') return events;

  const entries = body.entry || [];
  for (const entry of entries) {
    const changes = entry.changes || [];
    for (const change of changes) {
      if (change.field !== 'messages') continue;
      const value = change.value || {};
      const metadata = value.metadata || {};
      const contacts = value.contacts || [];

      // 1. Parse incoming messages
      if (value.messages && Array.isArray(value.messages)) {
        for (const msg of value.messages) {
          const contact = contacts.find(c => c.wa_id === msg.from) || {};
          const senderName = contact.profile ? contact.profile.name : 'Valued Customer';

          let rawContent = '';
          let mediaId = null;
          let mediaMime = null;
          let filename = null;

          if (msg.type === 'text' && msg.text) {
            rawContent = msg.text.body || '';
          } else if (msg.type === 'image' && msg.image) {
            rawContent = msg.image.caption || '[Image Received]';
            mediaId = msg.image.id;
            mediaMime = msg.image.mime_type;
          } else if (msg.type === 'document' && msg.document) {
            rawContent = msg.document.caption || '[Document Received]';
            mediaId = msg.document.id;
            mediaMime = msg.document.mime_type;
            filename = msg.document.filename;
          } else {
            rawContent = `[Unsupported message type: ${msg.type}]`;
          }


          events.messages.push({
            providerMessageId: msg.id,
            wamid: msg.id,
            senderPhone: msg.from,
            senderName,
            businessPhoneId: metadata.phone_number_id,
            messageType: msg.type,
            rawContent,
            text: rawContent,
            mediaId,
            mediaMimeType: mediaMime,
            mediaFilename: filename,
            timestamp: msg.timestamp ? new Date(Number(msg.timestamp) * 1000).toISOString() : new Date().toISOString()
          });
        }
      }

      // 2. Parse delivery statuses
      if (value.statuses && Array.isArray(value.statuses)) {
        for (const st of value.statuses) {
          events.statuses.push({
            providerMessageId: st.id,
            recipientPhone: st.recipient_id,
            status: st.status, // 'sent', 'delivered', 'read', 'failed'
            timestamp: st.timestamp ? new Date(Number(st.timestamp) * 1000).toISOString() : new Date().toISOString(),
            errors: st.errors || null
          });
        }
      }
    }
  }

  return events;
}


module.exports = {
  verifyWebhookSignature,
  uploadPdfMedia,
  sendOfficialWhatsAppDocument,
  parseMetaWebhook
};
