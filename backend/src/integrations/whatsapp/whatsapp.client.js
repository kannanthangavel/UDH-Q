const { GRAPH_API_BASE, DEFAULT_HEADERS } = require('./whatsapp.constants');

class WhatsAppClient {
  constructor(config = {}) {
    this.phoneNumberId = config.phoneNumberId || process.env.META_PHONE_NUMBER_ID;
    this.accessToken = config.accessToken || process.env.META_ACCESS_TOKEN;
  }

  async sendTextMessage(to, text) {
    if (!this.phoneNumberId || !this.accessToken) {
      throw new Error('Meta WhatsApp credentials not configured.');
    }

    const url = `${GRAPH_API_BASE}/${this.phoneNumberId}/messages`;
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to.replace(/\D/g, ''),
      type: 'text',
      text: { body: text }
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        ...DEFAULT_HEADERS,
        Authorization: `Bearer ${this.accessToken}`
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `WhatsApp API error (${res.status})`);
    }

    return res.json();
  }

  async sendDocument(to, documentUrl, filename, caption = '') {
    if (!this.phoneNumberId || !this.accessToken) {
      throw new Error('Meta WhatsApp credentials not configured.');
    }

    const url = `${GRAPH_API_BASE}/${this.phoneNumberId}/messages`;
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to.replace(/\D/g, ''),
      type: 'document',
      document: {
        link: documentUrl,
        filename: filename || 'Quotation.pdf',
        caption: caption
      }
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        ...DEFAULT_HEADERS,
        Authorization: `Bearer ${this.accessToken}`
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `WhatsApp API document error (${res.status})`);
    }

    return res.json();
  }
}

module.exports = { WhatsAppClient };
