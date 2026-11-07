# UD-QM — UDHAYAM AGENCIES QUOTATION MANAGEMENT
### Paint Division • Production-Ready Web Application

A full-featured, responsive, production-ready quotation management web application built specifically for the Paint Division of **UDHAYAM AGENCIES** (Perundurai, Erode).

---

## 🎨 1. Brand Identity & Theme

| Element | Color Name | Hex Code | Usage |
|---|---|---|---|
| Primary Header & Actions | **Deep Teal** | `#00545C` | Top navigation, primary headings, table headers, confirm buttons |
| Highlights & Badges | **Lime Green** | `#7DBA00` | "+ Create Quotation" action, active pills, accents, callouts |
| Application Background | **Light Neutral** | `#F5F8F5` | Main page canvas background |
| Content Surfaces | **Pure White** | `#FFFFFF` | Cards, forms, modal dialogs, printed pages |
| Dividers & Borders | **Border Grey** | `#E2E8F0` | Card borders, dividers, table gridlines |

---

## 🚀 2. Key Capabilities & Workflow Coverage

### 📑 1. Official Excel Rate Sheet Importer
- Single Source of Truth: Uses the actual rate sheet (e.g. `4. RATES [04.11.2026].xlsx`).
- Worksheets:
  - `PAINTS` worksheet → **PAINTS SECTION** (3,724 authentic products)
  - `ACCESS` worksheet → **ACCESSORIES SECTION** (1,607 authentic products)
- Fields Extracted: `S.No`, `Item Name`, `Sale Rate`, `DPL`, `Purc Rate`, `HSN/SAC`, `Main Unit`, `Cost`.
- Resilient Dynamic Header Detection: Automatically locates header row whether on row 0, 1, 4, etc.
- Preview & Validation Workflow:
  1. File selection (`.xlsx`, `.xls`, `.csv`).
  2. Displays selected filename.
  3. Pre-import preview with row counts, headers, and sample items.
  4. Duplicate detection (flags if previously imported with exact timestamp).
  5. 1-click confirm import or cancel.
  6. Atomic SQLite transaction logging new vs updated items.
  7. Detailed Import History trail.

### 🛡️ 2. Authentication & Role-Based Access Control
- **Administrator**:
  - Full visibility into internal pricing: `DPL`, `Purc Rate`, and `Cost`.
  - Override `Sale Rate` on quotation line items (with automated audit trail).
  - Import/update Excel price lists.
  - Access company settings, bank details, and user management.
- **Sales Staff**:
  - View only customer-facing `Sale Rate`.
  - Internal cost fields (`DPL`, `Purc Rate`, `Cost`) are **strictly masked** on both backend API and frontend UI.
  - Price editing is disabled (read-only customer rates).
- Pre-seeded Test Accounts:
  - **Admin**: `admin@udhayam.com` / `admin123`
  - **Staff**: `staff@udhayam.com` / `staff123`
- Client Demo Switcher: 1-click role switcher pill in the navigation bar to immediately demo Admin vs Staff perspectives.

### 🗂️ 3. All-in-One Price List & Catalogue Section
*Unified under "Price List & Catalogue" as requested:*
- **Tab 1: Product Catalogue**:
  - Instant live search by Item Name or HSN/SAC.
  - Switch between PAINTS (3,724) and ACCESSORIES (1,607) tabs.
  - Shows S.No, Item Name, HSN, Unit, Sale Rate. (Admin sees DPL, Purc, Cost).
  - Quick "+ Add to Quotation" button.
- **Tab 2: Product Price List PDF Generator**:
  - Direct generation from loaded products.
  - Section selector: `PAINTS`, `ACCESSORIES`, or `COMBINED`.
  - Paper layout selector: `A4 Full Page` vs `A5 Compact`.
  - Required 7 columns in exact specified order:
    1. `S. No.`
    2. `Item Name`
    3. `Details`
    4. `Sales Rate`
    5. `Qty` (*Blank write-in entry box for manual handwritten quantities*)
    6. `Unit`
    7. `HSN`
  - Download PDF button and Direct Print button.
  - Zero internal cost leakage in customer price lists.
- **Tab 3: Excel Rate Sheet & Import**:
  - Upload interface, preview engine, duplicate checker, and import history logs.
  - 1-click "Load Official 4. RATES [04.11.2026].xlsx" shortcut for instant re-seeding.

### ⚡ 4. 4-Step Quotation Wizard
- **Step 1 — Customer Details**:
  - Search existing customers by name or phone with instant autofill.
  - Or enter new customer (Name, Phone, Email, Delivery/Site Address).
  - Automatic validation preventing empty or invalid records.
- **Step 2 — Products Selection**:
  - Live product search in PAINTS or ACCESSORIES.
  - Quantity controls (`-`, `+`, direct decimal input).
  - Immediate line total recalculation.
  - Admin price override badge with audit logging.
  - Prevents accidental duplicates.
- **Step 3 — Review & Calculations**:
  - Decimal-safe financial calculations:
    - $\text{Line Total} = \text{Quantity} \times \text{Sale Rate}$
    - $\text{Subtotal} = \sum \text{Line Totals}$
    - $\text{Discount Amount} = \text{Subtotal} \times \text{Discount \%} \div 100$
    - $\text{Discounted Amount} = \text{Subtotal} - \text{Discount Amount}$
    - $\text{GST Amount} = \text{Discounted Amount} \times \text{GST Rate \%} \div 100$
    - $\text{Grand Total} = \text{Discounted Amount} + \text{GST Amount} + \text{Delivery Charges}$
  - Supported GST rates: `0%`, `5%`, `12%`, `18%` (default), `28%`.
  - Validity date picker (default 7 days).
  - Payment and delivery notes.
  - Paper layout toggle (`A4 Full Page` vs `A5 Compact`).
- **Step 4 — Create & Share**:
  - Generates server-issued unique sequential quotation number: `UDQ-YYYY-000001`.
  - Immutable snapshots: updating Excel later will never modify past quotations.

### 📄 5. Quotation PDF (A4 & A5)
- Server-side PDF generation via **PDFKit** (streamed directly with vector graphics).
- In-browser printable preview with `@media print` CSS.
- Contents:
  - Official Udhayam Agencies Logo.
  - Company Header: Business Name, Paint Division, Address, Phone, Email, GSTIN.
  - Quotation Meta: Quote Number, Date, Validity Date, Document Mode.
  - Customer Information: Name, Phone, Email, Site Address.
  - Line Items Table: S.No, Item Description, HSN/SAC, Unit, Qty, Rate (₹), Total (₹).
  - Summary: Subtotal, Discount, GST (rate and amount), Delivery, Grand Total.
  - Amount in Indian Words (e.g., `Rupees One Lakh Twenty Three Thousand Four Hundred Fifty Six Only`).
  - Bank & GPay Details:
    - **Bank**: Indian Bank, Perundurai Branch
    - **Account Name**: Udhayam Agencies
    - **Account Number**: 6659330152
    - **IFSC**: IDIB000P034
    - **GPay**: +91 97156 22499 (MS Udhayam Agencies)
  - Terms & Notes: Standard Udhayam terms.
  - Authorized Signatory stamp box.

### 📲 6. WhatsApp & Email Sharing
- **Share on WhatsApp**:
  - Formats official link: `https://wa.me/91<PHONE_NUMBER>?text=<URL_ENCODED_MESSAGE>`
  - Normalizes phone numbers (stripping spaces, symbols, leading 0 or +91).
  - Review modal with recipient number, message preview, and 1-click copy.
  - Direct "Download PDF First" shortcut and clear instructions on attaching PDF.
  - Records sharing event in audit log and marks quotation as `Shared`.
- **Share via Email**:
  - Generates pre-filled `mailto:` link with quotation subject and itemized summary.
  - Records sharing event in audit log.

### 🖼️ 7. Company Logo & Profile Image Upload
*As specifically requested by the client:*
- Manage company logo directly in **Settings → Company Profile & Logo**.
- Live preview card showing the active logo thumbnail.
- Drag & drop or upload new logo image (`.png`, `.jpg`, `.jpeg`, `.webp`, `.svg`).
- Instant update across the navigation header, Quotation PDFs, and Price List PDFs.
- 1-click button to restore official default `udhayam_logo.png`.

---

## 🛠️ 3. Technology Stack

- **Backend**: Node.js v24, Express.js v5
- **Database**: SQLite with `better-sqlite3` (WAL mode enabled, foreign keys enforced)
- **Excel Engine**: SheetJS (`xlsx`)
- **PDF Engine**: PDFKit
- **Frontend**: React 19, Vite 8, Tailwind CSS v4, Lucide React icons
- **Testing**: Node.js native test runner (`node --test`)

---

## 📦 4. Quick Start & Run Instructions

### 1. Run in Development Mode
Starts backend API on port `5000` and Vite dev server on port `5173` with proxy:
```bash
npm run dev
```
Open browser at: `http://localhost:5173`

### 2. Run in Production Mode
Builds the client SPA into `client/dist` and launches the unified Express server:
```bash
npm run build
npm start
```
Open browser at: `http://localhost:5000`

### 3. Run Automated Tests
```bash
npm test
```
All 12 unit and integration tests will execute covering calculations, Excel parsing, number-to-words, database persistence, role masking, and PDF generation.

---

## 📁 5. Project File Structure

```
c:\Users\SAN\Documents\UD-QM\
├── package.json                   # Root scripts & dependencies
├── .env.example                   # Environment configuration example
├── .env                           # Local environment config
├── README.md                      # Complete system documentation
├── server/
│   ├── src/
│   │   ├── server.js              # Server entry point
│   │   ├── app.js                 # Express app & middleware setup
│   │   ├── db/
│   │   │   └── database.js        # SQLite schema, indices & seed data
│   │   ├── middleware/
│   │   │   └── auth.js            # Role-based auth & data masking
│   │   ├── routes/
│   │   │   ├── auth.js            # Login, sessions, quick-switch
│   │   │   ├── dashboard.js       # KPI metrics & recent quotations
│   │   │   ├── products.js        # Catalogue & search (staff masked)
│   │   │   ├── imports.js         # Excel parser, preview & commit
│   │   │   ├── quotations.js      # Quotation wizard & PDFKit stream
│   │   │   ├── priceListPdf.js    # 7-column Price List PDF stream
│   │   │   ├── customers.js       # Customer directory & history
│   │   │   ├── settings.js        # Company profile & logo uploader
│   │   │   └── audit.js           # Immutable audit activity trail
│   │   ├── services/
│   │   │   ├── excelService.js    # SheetJS workbook parser & validator
│   │   │   └── pdfService.js      # High-fidelity PDFKit generator
│   │   └── utils/
│   │       ├── security.js        # PBKDF2 password hashing & SHA-256
│   │       └── numberToWords.js   # Indian number to words generator
│   └── storage/
│       ├── ud_qm.sqlite           # Persistent SQLite database
│       └── uploads/
│           ├── logos/             # Company logos (includes udhayam_logo.png)
│           └── rates/             # Seed rate sheets
├── client/
│   ├── package.json               # Client dependencies
│   ├── vite.config.js             # Vite 8 & Tailwind v4 config with proxy
│   ├── index.html                 # HTML shell with fonts & title
│   ├── src/
│   │   ├── main.jsx               # React entry point
│   │   ├── App.jsx                # Layout & page routing
│   │   ├── index.css              # Brand colors & @media print CSS
│   │   ├── api/
│   │   │   └── client.js          # Unified API service
│   │   ├── context/
│   │   │   └── AuthContext.jsx    # Auth state & 1-click role switcher
│   │   ├── components/
│   │   │   ├── Navbar.jsx         # Teal/Lime header with role switcher
│   │   │   ├── QuotationPdfModal.jsx  # In-browser preview & print
│   │   │   ├── WhatsAppShareModal.jsx # WhatsApp link & message preview
│   │   │   └── EmailShareModal.jsx    # Email draft modal
│   │   └── pages/
│   │       ├── Dashboard.jsx      # KPI cards & recent quotations
│   │       ├── CreateQuotation.jsx# 4-step quotation wizard
│   │       ├── Quotations.jsx     # Quotation management list
│   │       ├── PriceListAndCatalogue.jsx # All-in-one catalogue & Excel import
│   │       ├── Customers.jsx      # Customer directory & history
│   │       └── Settings.jsx       # Profile, bank, logo uploader & users
└── tests/
    ├── quotation.test.js          # Generator, Words, Excel & DB tests
    ├── api.test.js                # Calculation & Customer uniqueness tests
    └── e2e.test.js                # Full HTTP API & PDF streaming tests
```
