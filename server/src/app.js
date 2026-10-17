const express = require('express');
const cors = require('cors');
const path = require('path');
const priceListsRouter = require('./routes/priceLists');
const parserRouter = require('./routes/parser');
const quotationsRouter = require('./routes/quotations');
const settingsRouter = require('./routes/settings');
const auditRouter = require('./routes/audit');
const dashboardRouter = require('./routes/dashboard');
const demoRouter = require('./routes/demo');
const whatsappRouter = require('./routes/whatsapp');
const notificationsRouter = require('./routes/notifications');

const app = express();

// Security and middleware
app.use(cors());
app.use(express.json({
  limit: '15mb',
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  }
}));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'Udhayam Quotation Maker',
    version: '2.0.0-enterprise',
    time: new Date().toISOString()
  });
});

// Mount modular API routes
app.use('/api/pricelists', priceListsRouter);
app.use('/api/parse-message', parserRouter);
app.use('/api/quotations', quotationsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/audit', auditRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/demo', demoRouter);
app.use('/api/whatsapp', whatsappRouter);
app.use('/api/notifications', notificationsRouter);

// Serve production frontend assets if built
const fs = require('fs');
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'An internal server error occurred.',
    timestamp: new Date().toISOString()
  });
});

module.exports = app;
