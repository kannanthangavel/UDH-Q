/**
 * Meta WhatsApp Cloud API Webhook Handler
 */
function handleWebhookVerification(req, res) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  const expectedToken = process.env.META_VERIFY_TOKEN;

  if (mode === 'subscribe' && token === expectedToken) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
}

function parseIncomingMessage(body) {
  try {
    const entry = body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const message = changes?.value?.messages?.[0];
    const contact = changes?.value?.contacts?.[0];

    if (!message) return null;

    return {
      messageId: message.id,
      from: message.from,
      senderName: contact?.profile?.name || '',
      timestamp: message.timestamp,
      type: message.type,
      text: message.text?.body || ''
    };
  } catch (e) {
    return null;
  }
}

module.exports = {
  handleWebhookVerification,
  parseIncomingMessage
};
