const express = require('express');
const router = express.Router();
const { db, logAudit } = require('../db/database');
const { verifyPassword, generateToken, hashPassword } = require('../utils/security');
const { requireAdmin, requireAuth } = require('../middleware/auth');

// POST /api/auth/login - Login with Username 'Kids' or email and Password '22499'
router.post('/login', (req, res) => {
  const { email, username, password } = req.body;
  const identifier = (username || email || '').trim();

  if (!identifier || !password) {
    return res.status(400).json({ error: 'Username / Email and password are required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?) OR LOWER(name) = LOWER(?) LIMIT 1').get(identifier, identifier);
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid username/email or password. Use Username: Kids, Password: 22499' });
  }

  const token = generateToken();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days

  db.prepare(`
    INSERT INTO user_sessions (token, user_id, expires_at)
    VALUES (?, ?, ?)
  `).run(token, user.id, expiresAt);

  logAudit(user.id, user.email, user.role, 'LOGIN', 'USER', user.id, `User ${user.name} logged in`);

  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar_url: user.avatar_url
    }
  });
});

// POST /api/auth/quick-switch (Instant role switch for demo / client testing)
router.post('/quick-switch', (req, res) => {
  const { role } = req.body;
  const targetRole = role === 'admin' ? 'admin' : 'staff';

  const user = db.prepare('SELECT * FROM users WHERE role = ? LIMIT 1').get(targetRole);
  if (!user) {
    return res.status(404).json({ error: `User with role ${targetRole} not found` });
  }

  const token = generateToken();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  db.prepare(`
    INSERT INTO user_sessions (token, user_id, expires_at)
    VALUES (?, ?, ?)
  `).run(token, user.id, expiresAt);

  logAudit(user.id, user.email, user.role, 'ROLE_SWITCH', 'USER', user.id, `Switched session to ${user.role} (${user.name})`);

  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar_url: user.avatar_url
    }
  });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  const token = req.user?.token;
  if (token) {
    db.prepare('DELETE FROM user_sessions WHERE token = ?').run(token);
  }
  res.json({ success: true, message: 'Logged out successfully' });
});

// GET /api/auth/me
router.get('/me', (req, res) => {
  if (!req.user) {
    const defaultUser = db.prepare('SELECT id, name, email, role, avatar_url FROM users LIMIT 1').get();
    return res.json({ user: defaultUser, isAuthenticated: false });
  }
  res.json({ user: req.user, isAuthenticated: true });
});

// GET /api/auth/users (Admin only)
router.get('/users', requireAdmin, (req, res) => {
  const users = db.prepare('SELECT id, name, email, role, avatar_url, created_at FROM users ORDER BY id ASC').all();
  res.json({ users });
});

// POST /api/auth/users (Admin only)
router.post('/users', requireAdmin, (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }

  const normalizedRole = role === 'admin' ? 'admin' : 'staff';
  try {
    const result = db.prepare(`
      INSERT INTO users (name, email, password_hash, role)
      VALUES (?, ?, ?, ?)
    `).run(name, email.toLowerCase().trim(), hashPassword(password), normalizedRole);

    logAudit(req.user.id, req.user.email, req.user.role, 'CREATE_USER', 'USER', result.lastInsertRowid, `Created user ${email} with role ${normalizedRole}`);

    res.json({
      success: true,
      user: {
        id: result.lastInsertRowid,
        name,
        email,
        role: normalizedRole
      }
    });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint')) {
      return res.status(400).json({ error: 'A user with this email already exists' });
    }
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// PUT /api/auth/profile - Update current user profile / password
router.put('/profile', (req, res) => {
  const userId = req.user?.id || 4; // Default to Kids
  const { name, email, password } = req.body;

  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required' });
  }

  try {
    if (password && password.trim()) {
      db.prepare(`
        UPDATE users
        SET name = ?, email = ?, password_hash = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(name.trim(), email.toLowerCase().trim(), hashPassword(password.trim()), userId);
    } else {
      db.prepare(`
        UPDATE users
        SET name = ?, email = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(name.trim(), email.toLowerCase().trim(), userId);
    }

    const updated = db.prepare('SELECT id, name, email, role, avatar_url FROM users WHERE id = ?').get(userId);

    logAudit(userId, email, 'admin', 'UPDATE_PROFILE', 'USER', userId, `Updated profile for user ${name}`);

    res.json({
      success: true,
      user: updated,
      message: 'Profile updated successfully'
    });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint')) {
      return res.status(400).json({ error: 'A user with this email already exists' });
    }
    res.status(500).json({ error: 'Failed to update profile: ' + err.message });
  }
});

module.exports = router;
