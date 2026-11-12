# UD-QM REST API Documentation

All API endpoints are prefixed with `/api`. Authenticated endpoints accept a Bearer token in the `Authorization: Bearer <token>` header or `X-API-Key: <key>` header for external automation.

---

## 1. Authentication (`/api/auth`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Authenticate user (username, password) and return JWT session token |
| `GET` | `/api/auth/me` | Fetch currently logged-in user profile |
| `POST` | `/api/auth/logout` | Invalidate active user session token |
| `PUT` | `/api/auth/profile` | Update profile details (name, email, password) |

---

## 2. Quotations (`/api/quotations`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/quotations` | List quotations with search, date, customer, status, and pagination |
| `POST` | `/api/quotations` | Create a new quotation with auto-generated sequential number (`UDQ-YYYY-000001`) |
| `GET` | `/api/quotations/:id` | Get full quotation details with line items |
| `PUT` | `/api/quotations/:id` | Full quote edit, customer validation, item reconciliation, tax recalculation |
| `DELETE` | `/api/quotations/:id` | Cascading delete of quotation and its line items with audit trail |
| `PATCH` | `/api/quotations/:id/status` | Update status (`Draft`, `Created`, `Sent`, `Accepted`, `Rejected`) |
| `POST` | `/api/quotations/:id/duplicate` | Duplicate an existing quotation into a fresh quote |
| `GET` | `/api/quotations/:id/pdf` | Stream high-resolution, single-page A4 or A5 PDF binary (`?format=A4\|A5`) |
| `POST` | `/api/quotations/:id/audit-share` | Log share event to WhatsApp, email, or printout |

---

## 3. Product Catalogue & Search (`/api/products`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/products` | Search catalog with specs matching (`brand`, `category`, `search`, pagination) |
| `GET` | `/api/products/counts` | Get total counts across Paints, Accessories, and Categories |
| `GET` | `/api/products/:id` | Get individual product record |
| `POST` | `/api/products` | Create a new custom product |
| `PUT` | `/api/products/:id` | Update an existing product |
| `DELETE` | `/api/products/:id` | Delete product record |
| `POST` | `/api/products/feedback` | Train keyword engine with search feedback (`selected` / `swapped`) |

---

## 4. WhatsApp & Smart Order Parser (`/api/whatsapp`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/whatsapp/parse` | Parse messy WhatsApp customer text into structured items using 11-stage AI engine |
| `GET` | `/api/whatsapp/config` | Retrieve stored Meta Cloud API credentials & settings |
| `POST` | `/api/whatsapp/config` | Save Meta Cloud API configuration |
| `GET` | `/api/whatsapp/webhook` | Webhook verification endpoint for Meta WhatsApp Cloud API |
| `POST` | `/api/whatsapp/webhook` | Incoming event webhook from WhatsApp or n8n |
| `POST` | `/api/whatsapp/send` | Send WhatsApp message or PDF document to customer |

---

## 5. Customers (`/api/customers`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/customers` | Search & list customers with transaction history count |
| `POST` | `/api/customers` | Create a new customer profile |
| `PUT` | `/api/customers/:id` | Update customer phone, address, GSTIN, or notes |
| `DELETE` | `/api/customers/:id` | Delete customer record |
| `GET` | `/api/customers/:id/quotations` | List all historical quotations for this customer |

---

## 6. System Health & Settings

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Health check endpoint returning `{ status: "ok" }` |
| `GET` | `/api/settings` | Get company settings (name, address, bank, UPI, terms) |
| `POST` | `/api/settings` | Update company settings |
| `POST` | `/api/settings/logo` | Upload custom business logo (PNG/JPEG) |
| `POST` | `/api/settings/qr-code` | Upload custom UPI payment QR code |
| `GET` | `/api/settings/api-key` | Get active n8n integration API key |
| `POST` | `/api/settings/api-key/regenerate` | Regenerate API key for external bots & webhooks |
| `GET` | `/api/audit` | Fetch audit trails for compliance |
| `GET` | `/api/dashboard` | Dashboard analytics (sales, quote counts, popular items) |
| `GET` | `/api/price-list/pdf` | Stream official 7-column price list catalogue PDF |
