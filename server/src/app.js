const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const { authMiddleware } = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const productRoutes = require('./routes/products');
const importRoutes = require('./routes/imports');
const quotationRoutes = require('./routes/quotations');
const priceListPdfRoutes = require('./routes/priceListPdf');
const customerRoutes = require('./routes/customers');
const settingRoutes = require('./routes/settings');
const auditRoutes = require('./routes/audit');
const whatsappRoutes = require('./routes/whatsapp');

const app = express();

// Enable CORS
app.use(cors({
  origin: true,
  credentials: true
}));

// Body parsers
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Static uploads directory for logos and files
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL === true || Boolean(process.env.VERCEL);
const uploadsDir = isVercel ? '/tmp/uploads' : path.join(__dirname, '../storage/uploads');
if (!fs.existsSync(uploadsDir)) {
  try {
    fs.mkdirSync(uploadsDir, { recursive: true });
  } catch (e) {}
}
const bundledUploads = path.join(__dirname, '../storage/uploads');
if (fs.existsSync(bundledUploads)) {
  app.use('/uploads', express.static(bundledUploads));
}
app.use('/uploads', express.static(uploadsDir));

// Attach Auth Middleware
app.use(authMiddleware);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/products', productRoutes);
app.use('/api/imports', importRoutes);
app.use('/api/quotations', quotationRoutes);
app.use('/api/price-list', priceListPdfRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/whatsapp', whatsappRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'UD-QM - Udhayam Agencies Quotation Management',
    timestamp: new Date().toISOString()
  });
});

// Serve frontend in production if built
const clientDist = path.join(__dirname, '../../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
      return res.sendFile(path.join(clientDist, 'index.html'));
    }
    next();
  });
}

// 404 handler for API routes
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  next();
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[SERVER ERROR]', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error'
  });
});

module.exports = app;
