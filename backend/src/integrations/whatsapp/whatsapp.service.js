const { processWhatsAppMessage } = require('../../services/smartParser');
const { WhatsAppClient } = require('./whatsapp.client');

class WhatsAppService {
  constructor(config = {}) {
    this.client = new WhatsAppClient(config);
  }

  parseMessage(text) {
    return processWhatsAppMessage(text);
  }

  async sendQuotationSummary(to, summaryText) {
    return this.client.sendTextMessage(to, summaryText);
  }

  async sendQuotationPdf(to, pdfUrl, quotationNumber, caption) {
    const filename = `${quotationNumber || 'UDQ-Quotation'}.pdf`;
    return this.client.sendDocument(to, pdfUrl, filename, caption);
  }
}

module.exports = { WhatsAppService };
