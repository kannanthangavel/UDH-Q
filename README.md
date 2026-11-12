# UD-QM — UDHAYAM AGENCIES QUOTATION MANAGEMENT
### Enterprise Monorepo • Paint Division • Production Architecture

A full-featured, responsive, production-ready quotation management platform built for the Paint Division of **UDHAYAM AGENCIES** (Perundurai, Erode).

---

## 🏗️ 1. Project Architecture & Monorepo Structure

The repository is organized into a clean, decoupled monorepo separating frontend UI from backend business logic:

```text
UD-QM/
│
├── frontend/                     # React 19 + Tailwind v4 Single-Page Application (Vercel)
│   ├── public/                   # Static icons & assets
│   ├── src/
│   │   ├── components/           # Shared UI (Navbar, Sidebar, ThemedDialog)
│   │   ├── context/              # React Context (AuthContext)
│   │   ├── pages/                # Quotations, CreateQuote, Dashboard, Customers, Settings
│   │   ├── services/             # Domain API services (authApi, quotationApi, productApi)
│   │   ├── utils/                # Indian number-to-words currency formatting
│   │   ├── App.jsx               # Application controller & routing
│   │   ├── main.jsx              # Client entry point
│   │   └── index.css             # Tailwind v4 styles
│   ├── .env.example
│   ├── package.json              # Frontend dependencies
│   ├── vercel.json               # Vercel SPA routing
│   └── vite.config.js
│
├── backend/                      # Node.js + Express REST API (Render)
│   ├── src/
│   │   ├── app.js                # Express app setup, CORS, and middleware
│   │   ├── server.js             # HTTP server entry point (PORT 5000 / 10000)
│   │   ├── db/                   # Better-SQLite3 connection, WAL mode & schemas
│   │   ├── middleware/           # JWT & single-user auth verification
│   │   ├── routes/               # Modular Express API endpoints
│   │   ├── services/             # Core business engines
│   │   │   ├── pdfService.js     # Single-page A4/A5 PDF generation with QR & Bank info
│   │   │   ├── excelService.js   # SheetJS rate sheet importer
│   │   │   ├── smartParser.js    # Unstructured order text extractor
│   │   │   └── product-matching/ # 11-stage AI product search & ranking engine
│   │   ├── integrations/         # External integrations
│   │   │   ├── whatsapp/         # Meta WhatsApp Cloud API client & webhooks
│   │   │   └── n8n/              # Automation trigger service & API key auth
│   │   └── utils/                # Security hashing & helpers
│   ├── storage/                  # SQLite database (5,331 seeded items) & uploads
│   ├── .env.example
│   ├── Dockerfile                # Production Docker build
│   └── package.json              # Backend dependencies
│
├── shared/                       # Shared constants & enumerations
│   └── constants/
│
├── docs/                         # Comprehensive Documentation
│   ├── architecture/             # High-level architecture & data flows
│   ├── api/                      # REST API endpoint reference
│   ├── deployment/               # Vercel & Render step-by-step guides
│   └── database/                 # Schema dictionary & Prisma migration guide
│
├── tests/                        # 24 Automated Node.js Native Test Suites
├── scripts/                      # PDF visual samples & verification tools
├── package.json                  # Root npm workspaces orchestrator
├── render.yaml                   # 1-Click Render Blueprint configuration
├── vercel.json                   # Root Vercel SPA build configuration
└── .gitignore                    # Robust secrets & build artifact exclusion rules
```

---

## ⚡ 2. Local Development

### Prerequisites
- Node.js 18+ (Node 20 recommended)
- npm 9+

### 1-Step Development Startup (Recommended)
From the root directory:
```bash
# Install all dependencies across frontend and backend workspaces
npm install

# Start both backend (port 5000) and frontend (port 5173) concurrently
npm run dev
```

### Starting Independently

#### Backend only:
```bash
cd backend
npm install
npm run dev
# Server running at http://localhost:5000
```

#### Frontend only:
```bash
cd frontend
npm install
npm run dev
# Frontend running at http://localhost:5173
```

---

## 🧪 3. Running Automated Tests

Run the complete 24-suite test runner covering calculations, product matching, PDF layouts, and API security:
```bash
npm test
```
*Current benchmark: 100% Top-1 accuracy across all 40+ domain matching scenarios.*

---

## 🌐 4. Cloud Deployments

### A. Backend on Render (`onrender.com`)
1. Connect your repository on [Render](https://dashboard.render.com).
2. Choose **Blueprint** (reads `render.yaml`) or **Web Service**:
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Port**: `10000`
3. Set environment variable: `NODE_ENV=production`.
4. Detailed guide: [`docs/deployment/RENDER.md`](docs/deployment/RENDER.md).

### B. Frontend on Vercel (`vercel.app`)
1. Import repository on [Vercel](https://vercel.com).
2. Set **Root Directory** to `frontend`.
3. Set **Environment Variable**:
   - `VITE_API_BASE_URL`: `https://ud-qm-backend.onrender.com` (Your Render backend URL).
4. Click **Deploy**.
5. Detailed guide: [`docs/deployment/VERCEL.md`](docs/deployment/VERCEL.md).

---

## 📲 5. WhatsApp & n8n Automation

### WhatsApp Sharing & Parsing
- **Smart Order Parser**: Real-time extraction of customer names, mobile numbers, and items with sister pack size detection (1Lt, 4Lt, 10Lt, 20Lt).
- **Direct WhatsApp Chat Redirection**: Opens `https://web.whatsapp.com/send/?phone=91...` directly into the customer's chat with an auto-downloaded official PDF.

### n8n Automation Webhook
- Configure custom API keys in **Settings → API Keys**.
- Authenticate requests using header: `X-API-Key: <your-api-key>`.
- Parse customer messages via `POST /api/whatsapp/parse` or trigger quotation alerts via `POST /api/whatsapp/send`.

---

## 🔐 6. Pre-Seeded Accounts

- **Admin**: `admin@udhayam.com` / `admin123` (Full pricing visibility, margin control, settings)
- **Staff**: `staff@udhayam.com` / `staff123` (Customer sale rate only, cost fields masked)
- **Default Profile**: Single-user quick access for shop floor billing.
