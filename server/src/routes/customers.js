const express = require('express');
const router = express.Router();
const { db, logAudit } = require('../db/database');

// GET /api/customers - List customers with search & quote counts
router.get('/', (req, res) => {
  const { search } = req.query;

  let sql = `
    SELECT c.*,
           COUNT(q.id) as total_quotations,
           MAX(q.quotation_date) as last_quotation_date
    FROM customers c
    LEFT JOIN quotations q ON c.id = q.customer_id
  `;
  const params = [];

  if (search && search.trim()) {
    sql += ' WHERE c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ?';
    const q = `%${search.trim()}%`;
    params.push(q, q, q);
  }

  sql += ' GROUP BY c.id ORDER BY c.id DESC';

  const customers = db.prepare(sql).all(...params);
  res.json({ customers });
});

// POST /api/customers - Create new customer
router.post('/', (req, res) => {
  const { name, phone, email = '', address = '' } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Customer name is required' });
  }
  if (!phone || !phone.trim()) {
    return res.status(400).json({ error: 'Customer phone number is required' });
  }

  // Check for duplicate phone
  const existing = db.prepare('SELECT id, name FROM customers WHERE phone = ?').get(phone.trim());
  if (existing) {
    return res.status(400).json({
      error: `Customer with phone ${phone} already exists (${existing.name}).`,
      existingCustomer: existing
    });
  }

  const result = db.prepare(`
    INSERT INTO customers (name, phone, email, address)
    VALUES (?, ?, ?, ?)
  `).run(name.trim(), phone.trim(), email.trim(), address.trim());

  logAudit(
    req.user?.id || 1,
    req.user?.email || 'admin@udhayam.com',
    req.user?.role || 'admin',
    'CREATE_CUSTOMER',
    'CUSTOMER',
    result.lastInsertRowid,
    `Added new customer ${name} (${phone})`
  );

  res.json({
    success: true,
    customer: {
      id: result.lastInsertRowid,
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
      address: address.trim()
    }
  });
});

// PUT /api/customers/:id - Update customer
router.put('/:id', (req, res) => {
  const { name, phone, email = '', address = '' } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Customer name is required' });
  }
  if (!phone || !phone.trim()) {
    return res.status(400).json({ error: 'Customer phone number is required' });
  }

  db.prepare(`
    UPDATE customers
    SET name = ?, phone = ?, email = ?, address = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(name.trim(), phone.trim(), email.trim(), address.trim(), req.params.id);

  logAudit(
    req.user?.id || 1,
    req.user?.email || 'admin@udhayam.com',
    req.user?.role || 'admin',
    'UPDATE_CUSTOMER',
    'CUSTOMER',
    req.params.id,
    `Updated customer details for ${name}`
  );

  res.json({ success: true, message: 'Customer updated successfully' });
});

// GET /api/customers/:id/quotations - Get quotation history for customer
router.get('/:id/quotations', (req, res) => {
  const quotations = db.prepare('SELECT * FROM quotations WHERE customer_id = ? ORDER BY id DESC').all(req.params.id);
  res.json({ quotations });
});

module.exports = router;
