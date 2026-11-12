# UD-QM Enterprise Monorepo Architecture

## Overview
**UD-QM (Udhayam Quotation Management)** is an enterprise estimation and quotation platform built specifically for **Udhayam Agencies (Paint Division)**. It automates quotation preparation from large official price lists (5,300+ items across Asian Paints, Birla White, MRF, and accessories), eliminates human calculation errors, formats single-page A4/A5 PDFs, and supports WhatsApp order processing.

---

## High-Level Topology

```
                  ┌───────────────────────────────┐
                  │       Customer / Staff        │
                  └──────────────┬────────────────┘
                                 │
                 Browser / HTTPS │ WhatsApp Message
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Vercel Frontend (SPA)                       │
│  - React 19 + Tailwind v4 + Vite 8                              │
│  - Modular feature directories & UI layout                      │
│  - URL: https://ud-qm.vercel.app                                │
└────────────────────────────────┬────────────────────────────────┘
                                 │ HTTPS REST API (/api/*)
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Render Backend Web Service                    │
│  - Node.js (CommonJS) + Express 5                               │
│  - 11-Stage AI/NLP Product Matching Engine (100% Top-1 Acc)     │
│  - A4/A5 PDF Engine with dynamic UPI QR & Bank Settlement       │
│  - URL: https://ud-qm-backend.onrender.com                      │
└──────────────────┬──────────────────────────┬───────────────────┘
                   │                          │
                   ▼                          ▼
      ┌─────────────────────────┐    ┌───────────────────────────┐
      │   Better-SQLite3 DB     │    │ External Integrations     │
      │   - 5,331 Seeded Items  │    │ - Meta WhatsApp Cloud API │
      │   - WAL mode enabled    │    │ - n8n Webhook Automation  │
      │   - Storage: Persistent │    │ - X-API-Key Secure Auth   │
      └─────────────────────────┘    └───────────────────────────┘
```

---

## Monorepo Directory Layout

```text
UD-QM/
├── frontend/                     # React Single-Page Application (Vercel)
│   ├── public/                   # Static icons & manifest
│   ├── src/
│   │   ├── components/           # Shared UI (Navbar, Sidebar, ThemedDialog)
│   │   ├── context/              # Global React Context (AuthContext)
│   │   ├── pages/                # High-level route views
│   │   ├── services/             # Domain API clients (auth, quote, products)
│   │   ├── utils/                # Client formatting & Indian number to words
│   │   ├── App.jsx               # Main application controller
│   │   ├── main.jsx              # DOM entry point
│   │   └── index.css             # Tailwind v4 styles
│   ├── .env.example
│   ├── package.json
│   ├── vercel.json
│   └── vite.config.js
│
├── backend/                      # Express REST API & Engine (Render)
│   ├── src/
│   │   ├── app.js                # Express app configuration & middleware
│   │   ├── server.js             # HTTP server entry point
│   │   ├── db/                   # Database instance, schemas, & migrations
│   │   ├── middleware/           # JWT & single-user authentication
│   │   ├── routes/               # API endpoint routers
│   │   ├── services/             # Core business logic
│   │   │   ├── pdfService.js     # Single-page A4/A5 PDF generator
│   │   │   ├── excelService.js   # Rate sheet XLSX parser
│   │   │   ├── smartParser.js    # Unstructured order parser
│   │   │   └── product-matching/ # 11-stage AI product matcher
│   │   ├── integrations/         # External provider integrations
│   │   │   ├── whatsapp/         # Meta Graph API client & webhooks
│   │   │   └── n8n/              # Automation trigger service
│   │   └── utils/                # Security & currency converters
│   ├── storage/                  # SQLite database & uploaded files
│   ├── .env.example
│   ├── Dockerfile
│   └── package.json
│
├── shared/                       # Shared constants & enumerations
│   └── constants/
│
├── docs/                         # System Documentation
│   ├── architecture/
│   ├── api/
│   ├── deployment/
│   └── database/
│
├── tests/                        # 24 Automated Node.js Native Test Suites
├── scripts/                      # PDF visual samples & testing scripts
├── package.json                  # Root npm workspaces orchestrator
├── render.yaml                   # Render Blueprint for backend
└── vercel.json                   # Root Vercel configuration
```
