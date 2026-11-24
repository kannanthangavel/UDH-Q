const express = require('express');
const router = express.Router();
const { db, logAudit } = require('../db/database');
const { requireAdmin } = require('../middleware/auth');
const { 
  ALERT_TARGET_NUMBERS, 
  formatSupplierAlertMessage, 
  checkAndGetDueBills, 
  recordAlertSent 
} = require('../services/supplierAlertService');

// GET /api/supplier-bills - List supplier bills
router.get('/', (req, res) => {
  try {
    const { search = '', status = 'all', page = 1, limit = 20 } = req.query;
    const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
    const searchTerm = `%${search.trim()}%`;

    let whereClause = '(supplier_name LIKE ? OR bill_number LIKE ?)';
    const params = [searchTerm, searchTerm];

    if (status !== 'all') {
      whereClause += ' AND status = ?';
      params.push(status);
    }

    const countStmt = db.prepare(`SELECT COUNT(*) as total FROM supplier_bills WHERE ${whereClause}`);
    const total = countStmt.get(...params).total;

    const listStmt = db.prepare(`
      SELECT * FROM supplier_bills
      WHERE ${whereClause}
      ORDER BY 
        CASE 
          WHEN status = 'Paid' THEN 3
          WHEN due_date < date('now') THEN 1
          WHEN due_date <= date('now', '+1 day') THEN 0
          ELSE 2
        END,
        due_date ASC
      LIMIT ? OFFSET ?
    `);

    const bills = listStmt.all(...params, parseInt(limit, 10), offset);

    res.json({
      bills,
      total,
      page: parseInt(page, 10),
      totalPages: Math.ceil(total / parseInt(limit, 10)) || 1
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/supplier-bills/due-alerts - Get bills due tomorrow or overdue
router.get('/due-alerts', (req, res) => {
  try {
    const dueBills = checkAndGetDueBills();
    res.json({ dueBills, targetNumbers: ALERT_TARGET_NUMBERS });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/supplier-bills - Create purchase bill entry
router.post('/', (req, res) => {
  try {
    const {
      supplier_name,
      bill_number,
      bill_date = new Date().toISOString().split('T')[0],
      due_date,
      bill_amount,
      paid_amount = 0,
      notes = ''
    } = req.body;

    if (!supplier_name || !supplier_name.trim()) {
      return res.status(400).json({ error: 'Supplier name is required' });
    }
    if (!bill_number || !bill_number.trim()) {
      return res.status(400).json({ error: 'Bill number is required' });
    }
    if (!due_date) {
      return res.status(400).json({ error: 'Due date is required' });
    }
    const parsedAmount = parseFloat(bill_amount) || 0;
    if (parsedAmount <= 0) {
      return res.status(400).json({ error: 'Bill amount must be greater than zero' });
    }

    const parsedPaid = parseFloat(paid_amount) || 0;
    let status = 'Pending';
    if (parsedPaid >= parsedAmount) {
      status = 'Paid';
    } else if (parsedPaid > 0) {
      status = 'Partially Paid';
    } else {
      const today = new Date().toISOString().split('T')[0];
      if (due_date < today) {
        status = 'Overdue';
      }
    }

    const insertStmt = db.prepare(`
      INSERT INTO supplier_bills (
        supplier_name, bill_number, bill_date, due_date,
        bill_amount, paid_amount, status, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = insertStmt.run(
      supplier_name.trim(),
      bill_number.trim(),
      bill_date,
      due_date,
      parsedAmount,
      parsedPaid,
      status,
      notes.trim(),
      req.user?.id || 1
    );

    logAudit(
      req.user?.id || 1,
      req.user?.email || 'kids@udhayam.com',
      req.user?.role || 'admin',
      'CREATE_SUPPLIER_BILL',
      'SUPPLIER_BILL',
      result.lastInsertRowid,
      `Created purchase bill for ${supplier_name} - ${bill_number} (Rs. ${parsedAmount}, Due: ${due_date})`
    );

    const created = db.prepare('SELECT * FROM supplier_bills WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ success: true, bill: created });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/supplier-bills/:id - Update purchase bill or record payment
router.put('/:id', (req, res) => {
  try {
    const bill = db.prepare('SELECT * FROM supplier_bills WHERE id = ?').get(req.params.id);
    if (!bill) {
      return res.status(404).json({ error: 'Purchase bill not found' });
    }

    const {
      supplier_name = bill.supplier_name,
      bill_number = bill.bill_number,
      bill_date = bill.bill_date,
      due_date = bill.due_date,
      bill_amount = bill.bill_amount,
      paid_amount = bill.paid_amount,
      status: requestedStatus,
      notes = bill.notes
    } = req.body;

    const parsedAmount = parseFloat(bill_amount) || bill.bill_amount;
    const parsedPaid = parseFloat(paid_amount) !== undefined ? parseFloat(paid_amount) : bill.paid_amount;

    let finalStatus = requestedStatus;
    if (!finalStatus) {
      if (parsedPaid >= parsedAmount) {
        finalStatus = 'Paid';
      } else if (parsedPaid > 0) {
        finalStatus = 'Partially Paid';
      } else {
        const today = new Date().toISOString().split('T')[0];
        finalStatus = due_date < today ? 'Overdue' : 'Pending';
      }
    }

    db.prepare(`
      UPDATE supplier_bills
      SET supplier_name = ?, bill_number = ?, bill_date = ?, due_date = ?,
          bill_amount = ?, paid_amount = ?, status = ?, notes = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(
      supplier_name.trim(),
      bill_number.trim(),
      bill_date,
      due_date,
      parsedAmount,
      parsedPaid,
      finalStatus,
      (notes || '').trim(),
      req.params.id
    );

    const updated = db.prepare('SELECT * FROM supplier_bills WHERE id = ?').get(req.params.id);
    res.json({ success: true, bill: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/supplier-bills/:id/send-alert - Generate WhatsApp alert dispatches
router.post('/:id/send-alert', (req, res) => {
  try {
    const bill = db.prepare('SELECT * FROM supplier_bills WHERE id = ?').get(req.params.id);
    if (!bill) {
      return res.status(404).json({ error: 'Purchase bill not found' });
    }

    const message = formatSupplierAlertMessage(bill);
    recordAlertSent(bill.id);

    // Build 1-click WhatsApp URLs for both requested numbers
    const urls = ALERT_TARGET_NUMBERS.map(phone => ({
      phone: `+91 ${phone}`,
      url: `https://api.whatsapp.com/send?phone=91${phone}&text=${encodeURIComponent(message)}`
    }));

    logAudit(
      req.user?.id || 1,
      req.user?.email || 'kids@udhayam.com',
      req.user?.role || 'admin',
      'SEND_SUPPLIER_ALERT',
      'SUPPLIER_BILL',
      bill.id,
      `Dispatched due payment alert for ${bill.supplier_name} - ${bill.bill_number} to ${ALERT_TARGET_NUMBERS.join(', ')}`
    );

    res.json({
      success: true,
      message: 'Payment alert prepared for WhatsApp dispatch',
      alertMessage: message,
      targets: ALERT_TARGET_NUMBERS,
      urls
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/supplier-bills/:id - Delete purchase bill
router.delete('/:id', requireAdmin, (req, res) => {
  try {
    const bill = db.prepare('SELECT * FROM supplier_bills WHERE id = ?').get(req.params.id);
    if (!bill) {
      return res.status(404).json({ error: 'Purchase bill not found' });
    }

    db.prepare('DELETE FROM supplier_bills WHERE id = ?').run(req.params.id);

    logAudit(
      req.user?.id || 1,
      req.user?.email || 'kids@udhayam.com',
      req.user?.role || 'admin',
      'DELETE_SUPPLIER_BILL',
      'SUPPLIER_BILL',
      req.params.id,
      `Deleted purchase bill ${bill.supplier_name} - ${bill.bill_number}`
    );

    res.json({ success: true, message: 'Purchase bill deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
