/**
 * n8n Workflow Automation Integration Service
 */
class N8nService {
  constructor(webhookUrl = process.env.N8N_WEBHOOK_URL) {
    this.webhookUrl = webhookUrl;
  }

  async triggerQuotationCreated(quotation) {
    if (!this.webhookUrl) return null;

    try {
      const res = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Event-Type': 'QUOTATION_CREATED'
        },
        body: JSON.stringify({
          event: 'QUOTATION_CREATED',
          timestamp: new Date().toISOString(),
          quotation
        })
      });
      return res.ok;
    } catch (err) {
      console.warn('[n8n] Failed triggering quotation webhook:', err.message);
      return false;
    }
  }
}

module.exports = { N8nService };
