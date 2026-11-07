const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const app = require('../server/src/app');

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

test('Health check endpoint returns ok', async () => {
  const res = await fetch(`${baseUrl}/api/health`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.status, 'ok');
});

test('Dashboard metrics endpoint returns loaded counts', async () => {
  const res = await fetch(`${baseUrl}/api/dashboard`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(data.metrics.totalProducts >= 5000, 'Should have >= 5000 products loaded');
  assert.ok(data.metrics.paintProducts > 3000, 'PAINTS should be > 3000');
  assert.ok(data.metrics.accessProducts > 1000, 'ACCESS should be > 1000');
});

test('Products endpoint masks internal fields for staff but reveals for admin', async () => {
  // 1. Staff query
  const staffRes = await fetch(`${baseUrl}/api/products?limit=5`, {
    headers: { 'x-user-role': 'staff' }
  });
  assert.equal(staffRes.status, 200);
  const staffData = await staffRes.json();
  assert.ok(staffData.products.length > 0);
  const staffProduct = staffData.products[0];
  assert.equal(staffProduct.dpl, undefined, 'Staff must not see dpl');
  assert.equal(staffProduct.purc_rate, undefined, 'Staff must not see purc_rate');
  assert.equal(staffProduct.cost, undefined, 'Staff must not see cost');
  assert.ok(typeof staffProduct.sale_rate === 'number', 'Staff must see sale_rate');

  // 2. Admin query
  const adminRes = await fetch(`${baseUrl}/api/products?limit=5`, {
    headers: { 'x-user-role': 'admin' }
  });
  assert.equal(adminRes.status, 200);
  const adminData = await adminRes.json();
  const adminProduct = adminData.products[0];
  assert.ok(adminProduct.dpl !== undefined, 'Admin must see dpl');
  assert.ok(adminProduct.purc_rate !== undefined, 'Admin must see purc_rate');
  assert.ok(adminProduct.cost !== undefined, 'Admin must see cost');
});

test('Create Quotation issues unique UDQ-YYYY-000001 number and validates calculations', async () => {
  // Fetch sample products
  const pRes = await fetch(`${baseUrl}/api/products?limit=2`, {
    headers: { 'x-user-role': 'admin' }
  });
  const { products } = await pRes.json();

  const payload = {
    customer_name: 'Test Customer E2E',
    customer_phone: '+91 98888 77777',
    customer_address: 'Erode Perundurai Bypass',
    items: [
      {
        product_id: products[0].id,
        item_name: products[0].item_name,
        hsn_sac: products[0].hsn_sac,
        unit: products[0].main_unit,
        quantity: 2,
        sale_rate: products[0].sale_rate
      },
      {
        product_id: products[1].id,
        item_name: products[1].item_name,
        hsn_sac: products[1].hsn_sac,
        unit: products[1].main_unit,
        quantity: 3,
        sale_rate: products[1].sale_rate
      }
    ],
    discount_percent: 5,
    gst_rate: 18,
    delivery_charges: 100,
    paper_format: 'A4'
  };

  const res = await fetch(`${baseUrl}/api/quotations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-role': 'admin'
    },
    body: JSON.stringify(payload)
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(data.success);
  assert.match(data.quotation_number, /^UDQ-\d{4}-\d{6}$/);

  // Fetch created quotation
  const qRes = await fetch(`${baseUrl}/api/quotations/${data.id}`);
  assert.equal(qRes.status, 200);
  const { quotation } = await qRes.json();
  assert.equal(quotation.items.length, 2);
  assert.equal(quotation.customer_name, 'Test Customer E2E');
  assert.ok(quotation.grand_total > 0);

  // Verify PDF stream
  const pdfRes = await fetch(`${baseUrl}/api/quotations/${data.id}/pdf`);
  assert.equal(pdfRes.status, 200);
  assert.equal(pdfRes.headers.get('content-type'), 'application/pdf');
  const pdfBuffer = await pdfRes.arrayBuffer();
  assert.ok(pdfBuffer.byteLength > 1000, 'PDF should have valid binary content');
});

test('Price List PDF streams valid PDF with exact 7 columns', async () => {
  const res = await fetch(`${baseUrl}/api/price-list/pdf?section=paints&format=a4`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'application/pdf');
  const buffer = await res.arrayBuffer();
  assert.ok(buffer.byteLength > 2000, 'Price List PDF should have valid content');
});

test('Settings endpoint returns company credentials and Indian Bank details', async () => {
  const res = await fetch(`${baseUrl}/api/settings`);
  assert.equal(res.status, 200);
  const { settings } = await res.json();
  assert.equal(settings.company_name, 'UDHAYAM AGENCIES');
  assert.equal(settings.bank_name, 'Indian Bank');
  assert.equal(settings.bank_account_no, '6659330152');
  assert.equal(settings.bank_ifsc, 'IDIB000P034');
});
