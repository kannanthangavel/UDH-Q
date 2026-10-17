# Udhayam Quotation Maker
## Excel-Based Quotation Automation (Trial Web Application)

A professional browser-based quotation automation tool tailored for businesses (specifically hardware and building materials suppliers like **Udhayam Agencies**) that receive unstructured customer product requirements via WhatsApp and need to prepare accurate, editable, professional quotations using an Excel price list as the single source of truth.

---

## 🌟 Key Features

1. **Flexible Excel Price List Importer**:
   - Supports `.xlsx` and `.xls` workbooks.
   - Worksheet selector with automatic row counts and preview.
   - Header row picker with first 10-20 rows visual inspection.
   - Flexible column auto-mapping: Product Name, Details/Specifications, HSN/SAC Code, Unit, Sales Rate, Purchase Rate, and GST %.
   - Pre-import validation engine detecting missing prices, duplicate item codes, and missing units.
   - Price-list versioning: historical quotations retain immutable rate snapshots; updating the price list never alters past quotations.

2. **WhatsApp Message NLP & Deterministic Parser**:
   - Parses unstructured WhatsApp messages (e.g., *"20 bags OPC cement, 10 numbers of 12mm steel rods, 5 paint buckets. Please prepare a quotation."*).
   - Extracts quantities, standardized units (`bags`, `nos`, `pieces`, `buckets`, `kg`, `litres`, `box`, `pkt`), and specifications (`12mm`, `10mm`, `1lt`, `20L`, `50kg`).
   - Detects Tanglish and shorthand phrases.
   - Bill lookup detection: alerts the operator if a message requests an existing bill (e.g. *"UD12345 bill send pannunga"*) rather than a new quotation.
   - Detects requested document type (GST Quotation vs Estimation) and paper size (A4 vs A5).

3. **Multi-Stage Product Matching Engine**:
   - Single source of truth: active price list in SQLite.
   - Matching stages: Exact item code -> Exact normalized name -> Name + Specification -> Product Aliases -> Controlled fuzzy match.
   - Ambiguity & Conflict Protection: Never matches a `10mm` rod to a `12mm` rod query. Vague queries present a candidate selection drawer.
   - Never fabricates prices or assumes missing quantities.

4. **Quotation Calculations & Document Modes**:
   - Decimal-safe monetary arithmetic avoiding floating point rounding errors.
   - Tax-inclusive (retail/Udhayam standard) and tax-exclusive calculations.
   - GST Breakdown: CGST (50%) + SGST (50%) for intra-state or IGST for inter-state.
   - Indian Number formatting: `₹ 1,23,456.00`.
   - Indian Number to Words generator: `Rupees One Lakh Twenty Three Thousand Four Hundred and Fifty Six Only`.
   - Configurable document modes: **GST Quotation** or **Estimation**.
   - Configurable paper sizes: **A5 (Default)** or **A4**.

5. **Professional Server-Side PDF Generation (PDFKit)**:
   - Native A5 and A4 geometry and styling.
   - Includes seller header (**Udhayam Agencies**, Perundurai address, GSTIN, phone, email).
   - Customer details, quote number, date, validity, and payment terms.
   - Clean product table: S.No, Product Name & Details, HSN Code, Unit, Rate (incl. tax), GST %, Total.
   - Totals box with tax breakdown, amount in words, and authorized signatory.
   - **Bank & GPay details at bottom**:
     - **Bank Name**: Indian Bank
     - **Account Number**: 6659330152
     - **IFSC / Branch**: Perundurai (IDIB000P034)
     - **GPay Number**: +91 97156 22499 (MS Udhayam Agencies)

6. **Manual & Official WhatsApp Sharing Workflow**:
   - Generates pre-formatted WhatsApp quote summary message.
   - Formats direct `https://wa.me/<phone>?text=...` links for WhatsApp Web or desktop app.
   - Clear instructions to attach the downloaded PDF before sending.
   - Tracks sharing states: `pdf_generated` -> `pdf_downloaded` -> `whatsapp_opened` -> `sent`.
   - Pluggable adapter interface ready for official WhatsApp Business Cloud API.

7. **Audit Activity Trail**:
   - Immutable log of all events: price list imports, manual price overrides, quotation drafts, finalizations, PDF generations, and WhatsApp sharing attempts.

8. **Trial Mode & Demo Data**:
   - High-visibility banner when demo data is active: `DEMO DATA — NOT ACTUAL UDHAYAM PRICING`.
   - Clear separation between demo data and real uploaded Excel files.
   - One-click sample Excel workbook download matching Udhayam columns.

---

## 🏗️ Technology Stack

- **Frontend**: React 19, Vite 8, Tailwind CSS v4, Lucide React icons.
- **Language**: Strict **JavaScript only** (`.js`, `.jsx` - NO TypeScript).
- **Backend**: Node.js v24, Express.js v5.
- **Database**: SQLite (via `better-sqlite3`).
- **Excel Engine**: SheetJS (`xlsx`).
- **PDF Engine**: PDFKit.
- **Testing**: Vitest (6 test suites, 22 unit & integration tests).

---

## 🚀 Quick Start Instructions

### 1. Installation
In the project root directory:
```bash
npm install
npm install --prefix client
```

### 2. Run in Development Mode
Starts both backend Express server (port 5000) and frontend Vite dev server (port 5173 with proxy):
```bash
npm start
```
Open your browser at: `http://localhost:5173`

### 3. Production Build & Run
```bash
npm run build
npm run server
```
Open your browser at: `http://localhost:5000` (Express serves both API and the built React SPA).

### 4. Run Automated Tests
```bash
npm test
```

---

## 📊 Typical Excel Columns for Udhayam Price List

The flexible importer automatically maps or lets you map these standard columns:
- **Product Name**: Name of the item (e.g. `As EN golden Brown 1lt`)
- **Details**: Product specifications (e.g. `1 Litre Golden Brown Enamel Paint`, `12mm Fe550D`)
- **HSN Code**: Tax classification code (e.g. `92030111`)
- **Sales Rate**: Selling rate including tax (e.g. `290.00`)
- **Purchase rate**: Cost price (e.g. `245.00`)
- **Unit**: Unit of measurement (e.g. `1Nos`, `bags`, `nos`, `buckets`, `kg`)

You can click **"Download Sample Excel"** directly from the **Price List** or **Settings** page to obtain a ready-to-test workbook.

---

## 📱 WhatsApp Sharing Workflow

1. Operator finalizes the quotation and reviews A5/A4 layout.
2. Clicking **"Finalize & Generate PDF"** compiles the PDFKit document.
3. Clicking **"Share WhatsApp"** opens the prepared modal:
   - Click **"1. Download PDF"** to save the file locally.
   - Click **"2. Open WhatsApp"** to launch `https://wa.me/<phone>` with pre-filled message text.
   - The operator attaches the downloaded PDF to the customer chat and sends it.
4. The status is recorded in the Audit trail.
