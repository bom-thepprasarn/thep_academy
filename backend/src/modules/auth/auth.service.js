const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db      = require('../../config/database');

// ─── Token helpers ───────────────────────────────────────────────

const signAccessToken = (userId, role) =>
  jwt.sign(
    { sub: userId, role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

const signRefreshToken = (userId) =>
  jwt.sign(
    { sub: userId, jti: uuidv4() },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' }
  );

const issueTokens = async (user) => {
  const accessToken  = signAccessToken(user.id, user.role);
  const refreshToken = signRefreshToken(user.id);

  // Store refresh token in DB (allows invalidation)
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
  await db.query(
    'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
    [user.id, refreshToken, expiresAt]
  );

  return { accessToken, refreshToken };
};

// ─── Auth service ────────────────────────────────────────────────

const register = async ({ name, email, password, country, language }) => {
  const existing = await db.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
  if (existing.rows.length > 0) {
    const err = new Error('Email already registered');
    err.statusCode = 409;
    throw err;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const { rows } = await db.query(
    `INSERT INTO users (name, email, password_hash, login_method, country, language)
     VALUES ($1, $2, $3, 'email', $4, $5)
     RETURNING id, name, email, role, status, avatar_url, signup_date`,
    [name, email.toLowerCase(), passwordHash, country || null, language || 'th']
  );

  const user   = rows[0];
  const tokens = await issueTokens(user);
  return { user, ...tokens };
};

const login = async (userFromPassport) => {
  // Update last login timestamp
  await db.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [userFromPassport.id]);

  const tokens = await issueTokens(userFromPassport);
  const { password_hash, google_id, facebook_id, ...safeUser } = userFromPassport;
  return { user: safeUser, ...tokens };
};

const oauthLogin = async (userFromPassport) => {
  await db.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [userFromPassport.id]);
  const tokens = await issueTokens(userFromPassport);
  const { password_hash, google_id, facebook_id, ...safeUser } = userFromPassport;
  return { user: safeUser, ...tokens };
};

const refreshAccessToken = async (incomingRefreshToken) => {
  let payload;
  try {
    payload = jwt.verify(incomingRefreshToken, process.env.JWT_REFRESH_SECRET);
  } catch {
    const err = new Error('Invalid or expired refresh token');
    err.statusCode = 401;
    throw err;
  }

  // Check token exists in DB (not revoked)
  const { rows } = await db.query(
    'SELECT * FROM refresh_tokens WHERE token = $1 AND expires_at > NOW()',
    [incomingRefreshToken]
  );
  if (!rows[0]) {
    const err = new Error('Refresh token revoked or expired');
    err.statusCode = 401;
    throw err;
  }

  const { rows: userRows } = await db.query(
    'SELECT id, role, status FROM users WHERE id = $1',
    [payload.sub]
  );
  const user = userRows[0];
  if (!user || user.status !== 'active') {
    const err = new Error('User not found or inactive');
    err.statusCode = 401;
    throw err;
  }

  // Rotate refresh token
  await db.query('DELETE FROM refresh_tokens WHERE token = $1', [incomingRefreshToken]);
  const newTokens = await issueTokens(user);
  return newTokens;
};

const logout = async (refreshToken) => {
  if (refreshToken) {
    await db.query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);
  }
};

const logoutAll = async (userId) => {
  await db.query('DELETE FROM refresh_tokens WHERE user_id = $1', [userId]);
};

module.exports = { register, login, oauthLogin, refreshAccessToken, logout, logoutAll };
