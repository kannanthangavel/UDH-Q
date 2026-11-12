const { db, getNextQuotationNumber, logAudit } = require('../db/database');
const { processWhatsAppMessage } = require('./smartParser');

class WhatsAppQuotationService {
  /**
   * Main entry point for processing incoming customer messages from n8n / Meta WhatsApp Cloud API
   *
   * @param {Object} payload
   * @param {Object} payload.customer - { phone, name }
   * @param {Object} payload.message - { id, type, text, normalizedText, timestamp }
   * @param {string} baseUrl - Base URL of the API for building quotation PDF links
   * @returns {Object} Standardized action response
   */
  async processIncomingMessage({ customer = {}, message = {}, baseUrl = '' }) {
    const rawPhone = customer.phone || '';
    const cleanPhone = rawPhone.replace(/[^\d+]/g, '');
    const customerName = (customer.name || '').trim() || 'WhatsApp Customer';
    const messageId = message.id || `msg_${Date.now()}`;
    const rawText = (message.text || '').trim();
    const normalizedText = (message.normalizedText || rawText).trim();

    if (!cleanPhone) {
      return {
        success: false,
        action: 'validation_error',
        message: 'Invalid or missing customer phone number.'
      };
    }

    if (!rawText) {
      return {
        success: false,
        action: 'validation_error',
        message: 'Empty message text received.'
      };
    }

    // 1. Message Deduplication / Idempotency Check
    const existingMsg = db.prepare('SELECT id, status, action, quotation_number FROM whatsapp_messages WHERE message_id = ?').get(messageId);
    if (existingMsg) {
      if (existingMsg.status === 'COMPLETED' || existingMsg.status === 'PROCESSING') {
        return {
          success: true,
          action: 'already_processed',
          messageId,
          quotationNumber: existingMsg.quotation_number,
          message: 'This message has already been processed.'
        };
      }
    } else {
      // Record incoming message in PROCESSING state
      db.prepare(`
        INSERT INTO whatsapp_messages (message_id, from_phone, customer_name, raw_text, normalized_text, status, action)
        VALUES (?, ?, ?, ?, ?, 'PROCESSING', 'pending')
      `).run(messageId, cleanPhone, customerName, rawText, normalizedText);
    }

    try {
      // 2. Check Active Multi-Step Conversation State
      const activeConv = db.prepare(`
        SELECT id, customer_phone, state, pending_context, expires_at
        FROM whatsapp_conversations
        WHERE customer_phone = ? AND datetime(expires_at) > datetime('now')
      `).get(cleanPhone);

      if (activeConv && activeConv.state === 'WAITING_CLARIFICATION' && activeConv.pending_context) {
        const resolved = this.handleClarificationReply({
          activeConv,
          customerInput: rawText,
          cleanPhone,
          customerName,
          baseUrl,
          messageId
        });

        if (resolved) {
          return resolved;
        }
      }

      // 3. Process Fresh Message via UD-QM Product Intelligence & Smart Parser
      const parseResult = processWhatsAppMessage(rawText);

      if (!parseResult.success || !parseResult.items || parseResult.items.length === 0) {
        this.updateMessageRecord(messageId, 'COMPLETED', 'product_not_found', null, null, 'No matching products identified.');
        return {
          success: false,
          action: 'product_not_found',
          message: 'Sorry, we could not find any matching products in our catalogue for your query. Please mention the product name, pack size (e.g., 1L, 4L, 20L, 40kg), and required quantity, or contact Udhayam Agencies directly at +91 97159 99933.'
        };
      }

      // Check for Customer Name / Phone extracted from message header if present
      const finalCustomerName = parseResult.customerName || customerName;
      const finalCustomerPhone = parseResult.customerPhone || cleanPhone;

      // 4. Inspect Items for Ambiguity
      const itemsToClarify = [];
      const confirmedItems = [];

      for (let i = 0; i < parseResult.items.length; i++) {
        const item = parseResult.items[i];
        const ambiguity = this.detectItemAmbiguity(item, rawText);

        if (ambiguity.isAmbiguous) {
          itemsToClarify.push({
            itemIndex: i,
            originalLine: item.originalLine,
            quantity: item.quantity || 1,
            unit: item.unit || 'Nos',
            options: ambiguity.options,
            clarificationQuestion: ambiguity.question
          });
        } else if (item.matchedProduct) {
          confirmedItems.push({
            product: item.matchedProduct,
            quantity: item.quantity || 1,
            unit: item.unit || item.matchedProduct.main_unit || 'Nos',
            originalLine: item.originalLine
          });
        }
      }

      // 5. If any item requires clarification, initiate conversation state
      if (itemsToClarify.length > 0) {
        const firstClarification = itemsToClarify[0];
        const pendingContext = {
          customerName: finalCustomerName,
          customerPhone: finalCustomerPhone,
          confirmedItems,
          itemsToClarify,
          currentClarificationIndex: 0
        };

        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24hr expiry

        db.prepare(`
          INSERT INTO whatsapp_conversations (customer_phone, customer_name, state, pending_context, last_message_id, expires_at, updated_at)
          VALUES (?, ?, 'WAITING_CLARIFICATION', ?, ?, ?, datetime('now'))
          ON CONFLICT(customer_phone) DO UPDATE SET
            state = 'WAITING_CLARIFICATION',
            pending_context = excluded.pending_context,
            last_message_id = excluded.last_message_id,
            expires_at = excluded.expires_at,
            updated_at = datetime('now')
        `).run(finalCustomerPhone, finalCustomerName, JSON.stringify(pendingContext), messageId, expiresAt);

        this.updateMessageRecord(messageId, 'COMPLETED', 'clarification_required');

        return {
          success: true,
          action: 'clarification_required',
          message: firstClarification.clarificationQuestion,
          options: firstClarification.options.map(o => o.label),
          itemContext: {
            originalRequirement: firstClarification.originalLine,
            pendingCount: itemsToClarify.length
          }
        };
      }

      // 6. All items confirmed with high confidence -> Generate Official Quotation
      if (confirmedItems.length === 0) {
        this.updateMessageRecord(messageId, 'COMPLETED', 'product_not_found', null, null, 'No high-confidence products matched.');
        return {
          success: false,
          action: 'product_not_found',
          message: 'Unable to confidently match the products from your message. Please provide exact product details or call our team at +91 97159 99933.'
        };
      }

      const quoteResult = this.createQuotationRecord({
        customerName: finalCustomerName,
        customerPhone: finalCustomerPhone,
        items: confirmedItems,
        baseUrl,
        messageId
      });

      this.updateMessageRecord(messageId, 'COMPLETED', 'quotation_generated', quoteResult.quotationId, quoteResult.quotationNumber);

      // Clean up conversation state
      db.prepare("UPDATE whatsapp_conversations SET state = 'IDLE', pending_context = NULL, updated_at = datetime('now') WHERE customer_phone = ?").run(finalCustomerPhone);

      return {
        success: true,
        action: 'quotation_generated',
        message: this.formatQuotationSummaryMessage(quoteResult),
        quotation: {
          id: quoteResult.quotationId,
          quotationNumber: quoteResult.quotationNumber,
          customerId: quoteResult.customerId,
          customerName: quoteResult.customerName,
          customerPhone: quoteResult.customerPhone,
          subtotal: quoteResult.subtotal,
          taxableValue: quoteResult.taxableValue,
          gstRate: quoteResult.gstRate,
          gstAmount: quoteResult.gstAmount,
          total: quoteResult.grandTotal,
          currency: 'INR',
          pdfUrl: quoteResult.pdfUrl,
          itemsCount: quoteResult.items.length,
          items: quoteResult.items
        }
      };

    } catch (err) {
      console.error('[WhatsAppQuotationService] Processing error:', err);
      this.updateMessageRecord(messageId, 'FAILED', 'system_error', null, null, err.message);
      return {
        success: false,
        action: 'system_error',
        message: 'Sorry, we are unable to process your request right now. Please try again shortly or contact our shop at +91 97159 99933.'
      };
    }
  }

  /**
   * Detects ambiguity in matched item:
   * When top candidates have multiple brands or distinct products with close scores and user didn't specify brand
   */
  detectItemAmbiguity(item, fullMessageText = '') {
    if (!item.matchedProduct) {
      return { isAmbiguous: false, options: [], question: '' };
    }

    const candidates = item.candidates || [];
    if (candidates.length < 2) {
      return { isAmbiguous: false, options: [], question: '' };
    }

    const top1 = candidates[0];
    const top2 = candidates[1];

    // Check if score gap is narrow (<= 15% score difference) or identical score
    const scoreDiff = Math.abs(top1.score - top2.score);
    const scoreRatio = top1.score > 0 ? scoreDiff / top1.score : 0;

    // Extract brand tokens
    const brand1 = (top1.structuredDetails?.brand || top1.item_name || '').toUpperCase();
    const brand2 = (top2.structuredDetails?.brand || top2.item_name || '').toUpperCase();
    const isDifferentProductOrBrand = top1.id !== top2.id && (brand1 !== brand2 || top1.sale_rate !== top2.sale_rate);

    // If top 2 candidates are very close and user message does NOT specify the brand or exact title
    const lowerQuery = (item.originalLine || '').toLowerCase();
    const hasSpecifiedBrand = /\b(asian|mrf|berger|dr\s*fixit|birla|jk|tara)\b/i.test(lowerQuery);

    if (isDifferentProductOrBrand && scoreRatio <= 0.15 && !hasSpecifiedBrand) {
      // Gather top distinct options (up to 4)
      const options = [];
      const seenNames = new Set();

      for (const cand of candidates.slice(0, 4)) {
        const brandName = cand.structuredDetails?.brand || (cand.item_name.includes('ASIAN') ? 'Asian Paints' : cand.item_name.includes('MRF') ? 'MRF Vapocure' : cand.item_name.includes('BERGER') ? 'Berger' : 'Standard');
        const packSize = cand.packSize || cand.structuredDetails?.packSize || '';
        const rateStr = `₹${cand.sale_rate.toLocaleString('en-IN')}`;
        const label = `${brandName} ${cand.item_name} (${rateStr}${packSize ? ' / ' + packSize : ''})`;

        if (!seenNames.has(label)) {
          seenNames.add(label);
          options.push({
            id: cand.id,
            product: cand,
            brand: brandName,
            label: `${brandName} (${rateStr}${packSize ? ' / ' + packSize : ''})`
          });
        }
      }

      if (options.length >= 2) {
        const optionLines = options.map((opt, idx) => `${idx + 1}. ${opt.label}`).join('\n');
        const question = `Which brand do you need for "${item.originalLine}"?\n\n${optionLines}\n\nPlease reply with the number (e.g. 1 or 2).`;
        return { isAmbiguous: true, options, question };
      }
    }

    return { isAmbiguous: false, options: [], question: '' };
  }

  /**
   * Handles customer replies to clarification prompts (e.g. replying "1" or "Asian Paints")
   */
  handleClarificationReply({ activeConv, customerInput, cleanPhone, customerName, baseUrl, messageId }) {
    let pendingContext;
    try {
      pendingContext = JSON.parse(activeConv.pending_context);
    } catch (e) {
      return null;
    }

    const { itemsToClarify, confirmedItems, currentClarificationIndex = 0 } = pendingContext;
    const currentClarification = itemsToClarify[currentClarificationIndex];

    if (!currentClarification) {
      return null;
    }

    // Check if input is a number matching options
    const inputTrim = customerInput.trim();
    let selectedOption = null;

    if (/^\d+$/.test(inputTrim)) {
      const choiceIdx = parseInt(inputTrim, 10) - 1;
      if (choiceIdx >= 0 && choiceIdx < currentClarification.options.length) {
        selectedOption = currentClarification.options[choiceIdx];
      }
    } else {
      // Fuzzy / keyword match against options
      const inputLower = inputTrim.toLowerCase();
      selectedOption = currentClarification.options.find(opt =>
        opt.label.toLowerCase().includes(inputLower) ||
        (opt.brand && opt.brand.toLowerCase().includes(inputLower))
      );
    }

    if (!selectedOption) {
      // Invalid option replied
      const optionLines = currentClarification.options.map((opt, idx) => `${idx + 1}. ${opt.label}`).join('\n');
      return {
        success: true,
        action: 'clarification_required',
        message: `Please reply with a valid option number (1 to ${currentClarification.options.length}):\n\n${optionLines}`,
        options: currentClarification.options.map(o => o.label)
      };
    }

    // Apply chosen product
    confirmedItems.push({
      product: selectedOption.product,
      quantity: currentClarification.quantity || 1,
      unit: currentClarification.unit || selectedOption.product.main_unit || 'Nos',
      originalLine: currentClarification.originalLine
    });

    const nextIndex = currentClarificationIndex + 1;
    if (nextIndex < itemsToClarify.length) {
      // More clarifications pending
      pendingContext.currentClarificationIndex = nextIndex;
      const nextClarification = itemsToClarify[nextIndex];

      db.prepare(`
        UPDATE whatsapp_conversations
        SET pending_context = ?, last_message_id = ?, updated_at = datetime('now')
        WHERE customer_phone = ?
      `).run(JSON.stringify(pendingContext), messageId, cleanPhone);

      this.updateMessageRecord(messageId, 'COMPLETED', 'clarification_required');

      return {
        success: true,
        action: 'clarification_required',
        message: nextClarification.clarificationQuestion,
        options: nextClarification.options.map(o => o.label)
      };
    }

    // All items resolved! Create official quotation
    const quoteResult = this.createQuotationRecord({
      customerName: pendingContext.customerName || customerName,
      customerPhone: cleanPhone,
      items: confirmedItems,
      baseUrl,
      messageId
    });

    this.updateMessageRecord(messageId, 'COMPLETED', 'quotation_generated', quoteResult.quotationId, quoteResult.quotationNumber);

    // Reset conversation state
    db.prepare("UPDATE whatsapp_conversations SET state = 'IDLE', pending_context = NULL, updated_at = datetime('now') WHERE customer_phone = ?").run(cleanPhone);

    return {
      success: true,
      action: 'quotation_generated',
      message: this.formatQuotationSummaryMessage(quoteResult),
      quotation: {
        id: quoteResult.quotationId,
        quotationNumber: quoteResult.quotationNumber,
        customerId: quoteResult.customerId,
        customerName: quoteResult.customerName,
        customerPhone: quoteResult.customerPhone,
        subtotal: quoteResult.subtotal,
        taxableValue: quoteResult.taxableValue,
        gstRate: quoteResult.gstRate,
        gstAmount: quoteResult.gstAmount,
        total: quoteResult.grandTotal,
        currency: 'INR',
        pdfUrl: quoteResult.pdfUrl,
        itemsCount: quoteResult.items.length,
        items: quoteResult.items
      }
    };
  }

  /**
   * Atomically creates a formal quotation in UD-QM database
   */
  createQuotationRecord({ customerName, customerPhone, items, baseUrl, messageId }) {
    let finalCustomerId = null;

    // 1. Find or create customer
    const existingCust = db.prepare('SELECT id, name FROM customers WHERE phone = ?').get(customerPhone);
    if (existingCust) {
      finalCustomerId = existingCust.id;
    } else {
      const newCust = db.prepare(`
        INSERT INTO customers (name, phone, email, address)
        VALUES (?, ?, '', '')
      `).run(customerName, customerPhone);
      finalCustomerId = newCust.lastInsertRowid;
    }

    // 2. Calculate Line Items (Tax Inclusive 18% GST by default)
    let calculatedSubtotal = 0;
    const processedItems = [];

    const getProduct = db.prepare('SELECT id, item_name, details, sale_rate, hsn_sac, main_unit FROM products WHERE id = ?');

    for (const it of items) {
      const prod = it.product.id ? getProduct.get(it.product.id) : null;
      const rate = prod ? prod.sale_rate : (it.product.sale_rate || 0);
      const qty = Math.max(0.01, parseFloat(it.quantity) || 1);
      const lineTotal = Math.round(qty * rate * 100) / 100;
      calculatedSubtotal += lineTotal;

      processedItems.push({
        product_id: prod?.id || it.product.id || null,
        item_name: prod?.item_name || it.product.item_name || 'Item',
        details: prod?.details || it.product.details || '',
        hsn_sac: prod?.hsn_sac || it.product.hsn_sac || '32089090',
        unit: it.unit || prod?.main_unit || 'Nos',
        quantity: qty,
        sale_rate: rate,
        line_total: lineTotal
      });
    }

    const subtotal = Math.round(calculatedSubtotal * 100) / 100;
    const gstRate = 18;
    const taxableValue = Math.round((subtotal / (1 + (gstRate / 100))) * 100) / 100;
    const gstAmount = Math.round((subtotal - taxableValue) * 100) / 100;
    const grandTotal = subtotal; // Tax inclusive

    const todayStr = new Date().toISOString().split('T')[0];
    const validUntilStr = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    let quotationId = null;
    let quoteNumber = null;

    const transaction = db.transaction(() => {
      quoteNumber = getNextQuotationNumber();

      const insertQuote = db.prepare(`
        INSERT INTO quotations (
          quotation_number, customer_id, customer_name, customer_phone, customer_email, customer_address,
          created_by, quotation_date, validity_date, status, subtotal, discount_percent, discount_amount,
          gst_rate, gst_amount, delivery_charges, grand_total, paper_format, notes
        ) VALUES (?, ?, ?, ?, '', '', 'WhatsApp Automation', ?, ?, 'Created', ?, 0, 0, ?, ?, 0, ?, 'A4', ?)
      `);

      const result = insertQuote.run(
        quoteNumber,
        finalCustomerId,
        customerName,
        customerPhone,
        todayStr,
        validUntilStr,
        subtotal,
        gstRate,
        gstAmount,
        grandTotal,
        `Auto-generated from WhatsApp requirement (${messageId})`
      );

      quotationId = result.lastInsertRowid;

      const insertItem = db.prepare(`
        INSERT INTO quotation_items (
          quotation_id, product_id, item_name, details, hsn_sac, unit, quantity, sale_rate, line_total, is_price_overridden, original_sale_rate
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
      `);

      for (const item of processedItems) {
        insertItem.run(
          quotationId,
          item.product_id,
          item.item_name,
          item.details,
          item.hsn_sac,
          item.unit,
          item.quantity,
          item.sale_rate,
          item.line_total,
          item.sale_rate
        );
      }

      logAudit(
        1,
        'n8n@udhayam.com',
        'admin',
        'CREATE_QUOTATION_WHATSAPP',
        'QUOTATION',
        String(quotationId),
        `Auto-created quotation ${quoteNumber} from WhatsApp message`
      );
    });

    transaction();

    const normalizedBaseUrl = (baseUrl || 'http://localhost:5000').replace(/\/+$/, '');
    const pdfUrl = `${normalizedBaseUrl}/api/quotations/${quotationId}/pdf`;

    return {
      quotationId,
      quotationNumber: quoteNumber,
      customerId: finalCustomerId,
      customerName,
      customerPhone,
      subtotal,
      taxableValue,
      gstRate,
      gstAmount,
      grandTotal,
      pdfUrl,
      items: processedItems
    };
  }

  formatQuotationSummaryMessage(q) {
    const itemLines = q.items.map((it, idx) =>
      `• ${it.item_name}: ${it.quantity} ${it.unit} @ ₹${it.sale_rate.toLocaleString('en-IN')} = ₹${it.line_total.toLocaleString('en-IN')}`
    ).join('\n');

    return `Hello ${q.customerName},

Your official quotation has been generated:

📋 *Quotation No:* ${q.quotationNumber}
📅 *Date:* ${new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}
⏱ *Validity:* 15 Days

*Items:*
${itemLines}

───────────────
💰 *Grand Total:* ₹${q.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
_(Inclusive of 18% GST)_

The official PDF quotation is attached below.

Thank you for choosing *Udhayam Agencies*!`;
  }

  updateMessageRecord(messageId, status, action, quotationId = null, quotationNumber = null, errorMessage = null) {
    try {
      db.prepare(`
        UPDATE whatsapp_messages
        SET status = ?, action = ?, quotation_id = ?, quotation_number = ?, error_message = ?, updated_at = datetime('now')
        WHERE message_id = ?
      `).run(status, action, quotationId, quotationNumber, errorMessage, messageId);
    } catch (e) {
      console.warn('[WhatsAppQuotationService] Failed updating message record:', e.message);
    }
  }
}

module.exports = { WhatsAppQuotationService };
