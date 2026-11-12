const express = require('express');
const router = express.Router();
const { db } = require('../db/database');

/**
 * GET /api/dashboard/metrics
 * Returns true operational dashboard metrics and recent quotations
 */
router.get('/metrics', (req, res) => {
  try {
    // 1. Active Price List Info
    const activePriceList = db.prepare(`
      SELECT id, filename, sheet_name, version, is_demo, is_active,
             imported_at, total_rows, valid_products_count, warnings_count
      FROM price_lists
      WHERE is_active = 1
      LIMIT 1
    `).get();

    // 2. Product Count in active list
    let totalProducts = 0;
    if (activePriceList) {
      totalProducts = db.prepare('SELECT COUNT(*) as count FROM products WHERE price_list_id = ?').get(activePriceList.id).count;
    }

    // 3. Quotation stats
    const totalQuotations = db.prepare('SELECT COUNT(*) as count FROM quotations').get().count;
    const draftQuotations = db.prepare("SELECT COUNT(*) as count FROM quotations WHERE status = 'draft'").get().count;
    const finalizedQuotations = db.prepare("SELECT COUNT(*) as count FROM quotations WHERE status = 'finalized'").get().count;
    const finalizedToday = db.prepare("SELECT COUNT(*) as count FROM quotations WHERE status = 'finalized' AND date(created_at) = date('now')").get().count;
    const pdfsGeneratedCount = db.prepare("SELECT COUNT(*) as count FROM quotations WHERE pdf_filename IS NOT NULL").get().count;

    // 4. WhatsApp Automation Stats
    const totalWhatsApp = db.prepare('SELECT COUNT(*) as count FROM whatsapp_messages').get()?.count || 0;
    const draftsReady = db.prepare("SELECT COUNT(*) as count FROM whatsapp_messages WHERE processing_status = 'draft_ready'").get()?.count || 0;
    const needsReview = db.prepare("SELECT COUNT(*) as count FROM whatsapp_messages WHERE processing_status = 'needs_review'").get()?.count || 0;
    const clarificationNeeded = db.prepare("SELECT COUNT(*) as count FROM whatsapp_messages WHERE processing_status = 'needs_clarification'").get()?.count || 0;

    // 5. Recent Quotations (latest 6)
    const recentQuotations = db.prepare(`
      SELECT q.id, q.quotation_number, q.customer_name, q.customer_phone,
             q.created_at, q.grand_total, q.document_type, q.paper_size,
             q.status, q.approval_status, q.pdf_filename, q.is_stale_pdf, q.whatsapp_status,
             (SELECT COUNT(*) FROM quotation_items WHERE quotation_id = q.id) as item_count
      FROM quotations q
      ORDER BY q.id DESC
      LIMIT 6
    `).all();

    // 6. Attention Queue (Drafts awaiting approval or with matching review items)
    const pendingAttentionQueue = db.prepare(`
      SELECT q.id, q.quotation_number, q.customer_name, q.customer_phone, q.created_at,
             q.grand_total, q.document_type, q.paper_size, q.approval_status,
             (SELECT COUNT(*) FROM quotation_items WHERE quotation_id = q.id) as item_count,
             (SELECT COUNT(*) FROM quotation_items WHERE quotation_id = q.id AND (match_status != 'Exact Match' OR unit_price <= 0)) as review_items_count,
             wm.raw_content as message_snippet
      FROM quotations q
      LEFT JOIN whatsapp_messages wm ON q.whatsapp_message_id = wm.id
      WHERE q.status = 'draft' AND (q.approval_status IS NULL OR q.approval_status != 'approved')
      ORDER BY q.id DESC
      LIMIT 5
    `).all();

    // 7. Recent WhatsApp Activity
    const recentWhatsAppActivity = db.prepare(`
      SELECT wm.id, wm.sender_phone, wm.sender_name, wm.raw_content, wm.received_at,
             wm.processing_status, wm.intent, wm.quotation_id,
             q.quotation_number, q.grand_total
      FROM whatsapp_messages wm
      LEFT JOIN quotations q ON wm.quotation_id = q.id
      ORDER BY wm.id DESC
      LIMIT 6
    `).all();

    res.json({
      success: true,
      metrics: {
        activePriceList: activePriceList || null,
        totalProducts,
        totalQuotations,
        draftQuotations,
        finalizedQuotations,
        finalizedToday,
        pdfsGeneratedCount,
        totalWhatsApp,
        draftsReady,
        needsReview,
        clarificationNeeded
      },
      recentQuotations,
      pendingAttentionQueue,
      recentWhatsAppActivity
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
