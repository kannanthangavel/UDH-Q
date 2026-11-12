const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const app = require('../backend/src/app');
const { db } = require('../backend/src/db/database');

let server;
let baseUrl;

test.before(async () => {
  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://localhost:${port}`;
      resolve();
    });
  });
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test('Quotation Edit and Delete API Lifecycle', async (t) => {
  let createdQuoteId = null;
  let quoteNumber = null;

  await t.test('1. Create an initial quotation for editing test', async () => {
    const res = await fetch(`${baseUrl}/api/quotations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_name: 'Edit Tester',
        customer_phone: '9842799999',
        customer_email: 'edittester@example.com',
        customer_address: 'Erode Perundurai Road',
        items: [
          {
            item_name: 'ABRO BLACK SPRAY PAINT',
            details: 'SP-39 Glossy',
            hsn_sac: '32082090',
            unit: 'Nos',
            quantity: 2,
            sale_rate: 160.00
          }
        ],
        discount_percent: 5,
        gst_rate: 18,
        is_tax_inclusive: true,
        delivery_charges: 50,
        paper_format: 'A4',
        notes: 'Initial test quotation'
      })
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.id);
    assert.ok(body.quotation_number);

    createdQuoteId = body.id;
    quoteNumber = body.quotation_number;
  });

  await t.test('2. Edit quotation via PUT /api/quotations/:id', async () => {
    // We update customer name, items (2 items now), discount to 10%, delivery charges to 100
    const updateRes = await fetch(`${baseUrl}/api/quotations/${createdQuoteId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_name: 'Edit Tester Updated',
        customer_phone: '9842799999',
        customer_email: 'updated@example.com',
        customer_address: 'KMR Complex, Perundurai',
        items: [
          {
            item_name: 'ABRO BLACK SPRAY PAINT',
            details: 'SP-39 Glossy',
            hsn_sac: '32082090',
            unit: 'Nos',
            quantity: 3, // updated qty from 2 to 3 => 3 * 160 = 480
            sale_rate: 160.00
          },
          {
            item_name: '2" COTTON ROLLER',
            details: 'Standard',
            hsn_sac: '96034020',
            unit: 'Nos',
            quantity: 4, // 4 * 25 = 100
            sale_rate: 25.00
          }
        ],
        discount_percent: 10, // subtotal = 580, disc 10% = 58, net = 522
        gst_rate: 18,
        is_tax_inclusive: true,
        delivery_charges: 100, // grandTotal = 522 + 100 = 622
        paper_format: 'A5',
        notes: 'Updated quote notes'
      })
    });

    assert.equal(updateRes.status, 200);
    const updateBody = await updateRes.json();
    assert.equal(updateBody.success, true);
    assert.equal(updateBody.quotation_number, quoteNumber);
    assert.equal(updateBody.grand_total, 622);

    // Verify database record has updated values
    const checkDb = db.prepare('SELECT * FROM quotations WHERE id = ?').get(createdQuoteId);
    assert.equal(checkDb.customer_name, 'Edit Tester Updated');
    assert.equal(checkDb.subtotal, 580);
    assert.equal(checkDb.discount_percent, 10);
    assert.equal(checkDb.discount_amount, 58);
    assert.equal(checkDb.grand_total, 622);
    assert.equal(checkDb.paper_format, 'A5');

    // Verify items in DB
    const itemsDb = db.prepare('SELECT * FROM quotation_items WHERE quotation_id = ?').all(createdQuoteId);
    assert.equal(itemsDb.length, 2);
    assert.equal(itemsDb[0].quantity, 3);
    assert.equal(itemsDb[1].quantity, 4);
  });

  await t.test('3. Delete quotation via DELETE /api/quotations/:id', async () => {
    const deleteRes = await fetch(`${baseUrl}/api/quotations/${createdQuoteId}`, {
      method: 'DELETE'
    });

    assert.equal(deleteRes.status, 200);
    const deleteBody = await deleteRes.json();
    assert.equal(deleteBody.success, true);

    // Verify quotation is deleted from DB
    const checkDeleted = db.prepare('SELECT * FROM quotations WHERE id = ?').get(createdQuoteId);
    assert.equal(checkDeleted, undefined);

    // Verify items are deleted from DB
    const checkItems = db.prepare('SELECT * FROM quotation_items WHERE quotation_id = ?').all(createdQuoteId);
    assert.equal(checkItems.length, 0);

    // Verify GET /api/quotations/:id returns 404
    const getRes = await fetch(`${baseUrl}/api/quotations/${createdQuoteId}`);
    assert.equal(getRes.status, 404);
  });
});
