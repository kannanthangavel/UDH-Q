const { db } = require('../db/database');

function authMiddleware(req, res, next) {
  // 1. Check API Key Header for n8n / external webhook integrations
  const apiKeyHeader = req.headers['x-api-key'] || (req.headers['authorization']?.startsWith('ApiKey ') ? req.headers['authorization'].substring(7).trim() : null);
  if (apiKeyHeader) {
    const keyRow = db.prepare("SELECT value FROM settings WHERE key = 'api_key'").get();
    if (keyRow && keyRow.value && keyRow.value === apiKeyHeader) {
      const masterAdmin = db.prepare("SELECT id, name, email, role, avatar_url FROM users WHERE role = 'admin' LIMIT 1").get();
      req.user = masterAdmin || { id: 1, name: 'n8n Automation', email: 'n8n@udhayam.com', role: 'admin' };
      req.isApiKey = true;
      return next();
    }
  }

  let token = null;
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
    // Check if the bearer token is actually the API key
    if (token.startsWith('udqm_live_')) {
      const keyRow = db.prepare("SELECT value FROM settings WHERE key = 'api_key'").get();
      if (keyRow && keyRow.value && keyRow.value === token) {
        const masterAdmin = db.prepare("SELECT id, name, email, role, avatar_url FROM users WHERE role = 'admin' LIMIT 1").get();
        req.user = masterAdmin || { id: 1, name: 'n8n Automation', email: 'n8n@udhayam.com', role: 'admin' };
        req.isApiKey = true;
        return next();
      }
    }
  } else if (req.headers['x-auth-token']) {
    token = req.headers['x-auth-token'];
  }

  if (token) {
    const session = db.prepare(`
      SELECT s.*, u.id as user_id, u.name, u.email, u.role, u.avatar_url
      FROM user_sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.token = ? AND datetime(s.expires_at) > datetime('now')
    `).get(token);

    if (session) {
      req.user = {
        id: session.user_id,
        name: session.name,
        email: session.email,
        role: session.role,
        avatar_url: session.avatar_url,
        token: session.token
      };
      return next();
    }
  }

  // Fallback check for demo/header override if provided (e.g., testing from UI)
  const headerRole = req.headers['x-user-role'];
  if (headerRole === 'admin' || headerRole === 'staff') {
    const user = db.prepare('SELECT id, name, email, role, avatar_url FROM users WHERE role = ? LIMIT 1').get(headerRole);
    if (user) {
      req.user = user;
      return next();
    } else if (headerRole === 'staff') {
      req.user = { id: 999, name: 'Staff User', email: 'staff@udhayam.com', role: 'staff' };
      return next();
    }
  }

  // Default to master admin user Kids in single-user mode so operations don't get blocked
  const masterAdmin = db.prepare('SELECT id, name, email, role, avatar_url FROM users WHERE role = ? LIMIT 1').get('admin');
  req.user = masterAdmin || null;
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied: Administrator privileges required.' });
  }
  next();
}

// Strip internal pricing fields (DPL, Purc Rate, Cost) for non-admin users
function sanitizeProduct(product, isAdmin) {
  if (!product) return null;
  if (isAdmin) return product;

  // Clone and delete internal fields
  const safe = { ...product };
  delete safe.dpl;
  delete safe.purc_rate;
  delete safe.cost;
  return safe;
}

function sanitizeProducts(products, isAdmin) {
  if (isAdmin) return products;
  return products.map(p => sanitizeProduct(p, false));
}

module.exports = {
  authMiddleware,
  requireAuth,
  requireAdmin,
  sanitizeProduct,
  sanitizeProducts
};
