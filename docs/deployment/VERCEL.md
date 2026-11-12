# Deploying UD-QM Frontend to Vercel (vercel.com)

Vercel provides edge CDN delivery, instant cache invalidation, and fast builds for the React/Vite single-page application.

---

## Deployment Steps

1. Push your repository to **GitHub**.
2. Log in to [vercel.com](https://vercel.com).
3. Click **Add New...** → **Project**.
4. Import your `UD-QM` repository.
5. In **Project Configuration**:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `frontend` *(Click Edit and select `frontend`)*
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
6. In **Environment Variables**, add:
   - `VITE_API_BASE_URL`: `https://ud-qm-backend.onrender.com` *(Your Render backend URL)*
7. Click **Deploy**.

---

## Verifying the Deployment

1. Visit your assigned Vercel URL (e.g. `https://ud-qm.vercel.app`).
2. The dashboard will load with live statistics from your Render backend.
3. Test creating a quotation or testing search: all requests will seamlessly communicate with the Render API.

---

## Same-Origin Reverse Proxy Alternative
If you prefer not to use cross-origin API calls, the root [vercel.json](file:///c:/Users/SAN/Documents/UD-QM/vercel.json) can also proxy `/api/*` requests directly to your Render backend:
```json
{
  "version": 2,
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "https://ud-qm-backend.onrender.com/api/$1"
    },
    {
      "source": "/uploads/(.*)",
      "destination": "https://ud-qm-backend.onrender.com/uploads/$1"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```
