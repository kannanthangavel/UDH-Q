/**
 * aiParserService.js
 * Pluggable AI / Trained Model Parsing Interface for Udhayam Quotation Maker
 * 
 * Future-Ready Architecture:
 * When a custom fine-tuned model (e.g. HuggingFace / Vertex AI / Local Python ONNX / LLM endpoint)
 * is ready, this adapter seamlessly connects without breaking existing deterministic parsing.
 */

const { parseNaturalLanguageMessage } = require('./messageParser');

class AIParserService {
  constructor(config = {}) {
    this.provider = config.provider || process.env.AI_PARSER_PROVIDER || 'local_rule_engine'; // 'local_rule_engine' | 'custom_trained_model' | 'cloud_llm'
    this.modelEndpoint = config.modelEndpoint || process.env.AI_MODEL_ENDPOINT || null;
    this.apiKey = config.apiKey || process.env.AI_API_KEY || null;
  }

  /**
   * Main parsing dispatcher
   * @param {string} rawText Raw customer WhatsApp message
   * @param {object} options Context such as active price list ID or customer history
   */
  async parseMessage(rawText, options = {}) {
    // 1. If custom fine-tuned model is configured in the future:
    if (this.provider === 'custom_trained_model' && this.modelEndpoint) {
      try {
        return await this._callTrainedModel(rawText, options);
      } catch (err) {
        console.warn('Trained AI model call failed, falling back to local deterministic rule engine:', err.message);
        return this._callLocalRuleEngine(rawText);
      }
    }

    // 2. Default high-precision deterministic regex & rule-based parser
    return this._callLocalRuleEngine(rawText);
  }

  /**
   * Local high-performance rule engine (messageParser.js)
   */
  _callLocalRuleEngine(rawText) {
    return parseNaturalLanguageMessage(rawText);
  }

  /**
   * Stub for future trained model / fine-tuned endpoint
   */
  async _callTrainedModel(rawText, options) {
    const response = await fetch(this.modelEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey ? { 'Authorization': `Bearer ${this.apiKey}` } : {})
      },
      body: JSON.stringify({
        text: rawText,
        options
      })
    });

    if (!response.ok) {
      throw new Error(`AI model returned HTTP ${response.status}`);
    }

    const data = await response.json();
    return data;
  }
}

const defaultAIParser = new AIParserService();

module.exports = {
  AIParserService,
  defaultAIParser
};
