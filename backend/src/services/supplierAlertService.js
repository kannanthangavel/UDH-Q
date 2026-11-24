const { db, logAudit } = require('../db/database');

const ALERT_TARGET_NUMBERS = ['9715622499', '8870022499'];

function formatSupplierAlertMessage(bill) {
  const formattedAmount = Number(bill.bill_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
  const pendingAmount = Number((bill.bill_amount || 0) - (bill.paid_amount || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 });

  return `⚠️ *SUPPLIER PAYMENT DUE ALERT*
Udhayam Agencies • Accounts Division

Dear Sir,

Payment is due to *${bill.supplier_name}*:

📄 *Bill No:* ${bill.bill_number}
📅 *Bill Date:* ${bill.bill_date}
⏳ *Due Date:* ${bill.due_date} (Payment Due Tomorrow)
💰 *Bill Amount:* ₹${formattedAmount}
⚖️ *Pending Amount:* ₹${pendingAmount}

The payment is due to be paid to ${bill.supplier_name}. Please initiate the payment transfer.

UDHAYAM AGENCIES - Perundurai
📞 +91 97156 22499 | +91 88700 22499`;
}

function checkAndGetDueBills() {
  // Find bills due tomorrow or overdue where alert has not been sent today
  const stmt = db.prepare(`
    SELECT * FROM supplier_bills
    WHERE status != 'Paid'
      AND due_date <= date('now', '+1 day')
    ORDER BY due_date ASC
  `);
  return stmt.all();
}

function recordAlertSent(billId) {
  db.prepare(`
    UPDATE supplier_bills
    SET alert_sent_at = datetime('now'), updated_at = datetime('now')
    WHERE id = ?
  `).run(billId);
}

module.exports = {
  ALERT_TARGET_NUMBERS,
  formatSupplierAlertMessage,
  checkAndGetDueBills,
  recordAlertSent
};
