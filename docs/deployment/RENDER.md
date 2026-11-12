# Deploying UD-QM Backend to Render (onrender.com)

Render is the recommended hosting environment for the **UD-QM Backend** because it provides:
- Native Node.js long-running process runtime.
- Seamless C++ native build support for `better-sqlite3`.
- Persistent Disk support for the SQLite database and uploaded QR/logos.
- Built-in HTTPS with automatic TLS certificates.

---

## Method 1: 1-Click Render Blueprint (Recommended)

1. Push your repository to **GitHub**.
2. Log in to [dashboard.render.com](https://dashboard.render.com).
3. Click **New +** → **Blueprint**.
4. Select your `UD-QM` repository.
5. Render will automatically detect `render.yaml`:
   - Service Name: `ud-qm-backend`
   - Runtime: `Node`
   - Root Directory: `backend`
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Port: `10000`
   - Health Check: `/api/health`
6. Click **Apply**.
7. Render will build and assign your URL:
   `https://ud-qm-backend.onrender.com`

---

## Method 2: Manual Web Service Setup

If configuring manually on Render without Blueprint:
- **Type**: Web Service
- **Name**: `ud-qm-backend`
- **Region**: Singapore (or nearest to India)
- **Branch**: `main`
- **Root Directory**: `backend`
- **Runtime**: `Node`
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Instance Type**: Free (or Starter with Persistent Disk)

### Environment Variables on Render
Configure these in **Environment** settings:

| Variable | Value | Description |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Enables production optimizations |
| `PORT` | `10000` | Render default web service port |
| `SESSION_SECRET` | *(Random 32-char string)* | Session signing secret |
| `STORAGE_DIR` | `/var/data/storage` | Optional persistent disk path |
| `META_ACCESS_TOKEN` | *(From Meta App)* | Optional: Meta WhatsApp Cloud API |
| `META_PHONE_NUMBER_ID`| *(From Meta App)* | Optional: WhatsApp Phone Number ID |
| `UDQM_API_KEY` | *(From Settings)* | API Key for n8n automation |

### Health Check Verification
After deployment finishes:
```bash
curl https://ud-qm-backend.onrender.com/api/health
```
Response:
```json
{
  "status": "ok",
  "app": "UD-QM - Udhayam Agencies Quotation Management",
  "timestamp": "..."
}
```
