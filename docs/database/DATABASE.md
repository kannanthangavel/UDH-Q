# UD-QM Database Architecture & Data Dictionary

## Overview
UD-QM uses **Better-SQLite3** configured with **WAL (Write-Ahead Logging)** mode and foreign keys enabled. It is stored at `backend/storage/ud_qm.sqlite` and contains over **5,331 indexed products** across Asian Paints, Birla White, MRF, and painting accessories.

---

## Performance & Concurrency
- `PRAGMA journal_mode = WAL`: High-speed concurrent reads without blocking writes.
- `PRAGMA foreign_keys = ON`: Strict relational integrity for quotations, customers, and items.
- In cloud deployments (Render), the database file is placed on a persistent disk or seeded automatically on first launch from the bundled image.

---

## Relational Schema

### 1. `products`
Indexed catalog items with official pricing and pack specifications.
- `id` (INTEGER PK): Unique ID
- `product_code` (TEXT): Manufacturer code / SKU
- `product_name` (TEXT): Full commercial item name
- `category` (TEXT): Product family (`Paints & Coatings`, `Accessories`, etc.)
- `subcategory` (TEXT): Detailed subcategory
- `pack_size` (TEXT): Pack volume/weight (`1LT`, `4LT`, `10LT`, `20LT`, `40KG`, `2 INCH`, etc.)
- `unit` (TEXT): Measurement unit (`LTR`, `KG`, `NOS`, `BOX`)
- `hsn_code` (TEXT): HSN/SAC classification
- `gst_rate` (REAL): GST percentage (typically 18.00)
- `purchase_rate` (REAL): Cost rate (hidden from staff role)
- `dealer_rate` (REAL): Dealer price
- `mrp` (REAL): Maximum retail price
- `sales_rate` (REAL): Selling price including GST
- `is_active` (INTEGER): Active status flag (1 = Active)
- `search_vector` (TEXT): Pre-computed normalized keywords for sub-millisecond retrieval

### 2. `quotations`
Sequential official quotations issued to customers.
- `id` (INTEGER PK)
- `quotation_number` (TEXT UNIQUE): E.g. `UDQ-2026-000012`
- `customer_id` (INTEGER FK -> customers.id)
- `customer_name` (TEXT)
- `customer_phone` (TEXT)
- `customer_address` (TEXT)
- `customer_gstin` (TEXT)
- `quotation_date` (TEXT): Date in `YYYY-MM-DD`
- `validity_date` (TEXT): Expiry date
- `paper_format` (TEXT): `A4` or `A5`
- `status` (TEXT): `Draft`, `Created`, `Sent`, `Accepted`, `Rejected`
- `subtotal` (REAL)
- `discount_percent` (REAL)
- `discount_amount` (REAL)
- `gst_amount` (REAL)
- `delivery_charges` (REAL)
- `grand_total` (REAL)
- `notes` (TEXT)

### 3. `quotation_items`
Line items belonging to a quotation.
- `id` (INTEGER PK)
- `quotation_id` (INTEGER FK -> quotations.id ON DELETE CASCADE)
- `product_id` (INTEGER FK -> products.id)
- `item_name` (TEXT)
- `pack_size` (TEXT)
- `quantity` (REAL)
- `unit` (TEXT)
- `sale_rate` (REAL): GST-inclusive rate
- `tax_rate` (REAL): 18.0
- `line_total` (REAL)
- `details` (TEXT)

### 4. `customers`
Customer records and transaction histories.
- `id` (INTEGER PK)
- `name` (TEXT NOT NULL)
- `phone` (TEXT UNIQUE)
- `address` (TEXT)
- `gstin` (TEXT)

### 5. `settings`
Key-value configuration store for company name, logo, QR code, bank settlement, and API keys.

### 6. `audit_logs`
Compliance audit trails tracking every quotation creation, modification, deletion, and sharing event.

---

## Future Prisma Migration Path
If migrating to PostgreSQL with Prisma in the future:
1. Initialize Prisma schema: `npx prisma init` in `backend/`.
2. Map existing tables to `backend/prisma/schema.prisma`.
3. Generate migrations: `npx prisma migrate dev`.
4. Replace `Database` calls in repositories with `prisma.quotation.create()`.
The repository pattern implemented in `backend/` makes this transition seamless without touching business logic or frontend services.
