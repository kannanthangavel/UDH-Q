require('dotenv').config();
const http = require('http');
const app = require('./src/app');

const PORT = parseInt(process.env.PORT || '5000', 10);

const server = http.createServer(app);

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.warn(`[Udhayam Quotation Maker] Port ${PORT} is already in use by another instance.`);
    console.warn(`[Udhayam Quotation Maker] Existing server process continues serving on http://localhost:${PORT}`);
    // Keep alive so concurrently doesn't terminate other services
    setInterval(() => {}, 60000);
  } else {
    console.error('[Udhayam Quotation Maker] Fatal server error:', err);
    process.exit(1);
  }
});

server.listen(PORT, () => {
  console.log(`[Udhayam Quotation Maker] Server running on http://localhost:${PORT}`);
  console.log(`[Udhayam Quotation Maker] Local SQLite storage ready.`);
});

process.on('SIGTERM', () => {
  console.log('Shutting down server gracefully...');
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  server.close(() => {
    process.exit(0);
  });
});
