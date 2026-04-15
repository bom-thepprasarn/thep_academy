const bcrypt = require('bcryptjs');
const db     = require('../../config/database');

const SAFE_FIELDS = `
  id, name, email, login_method, avatar_url,
  country, language, role, status,
  signup_date, last_login_at, created_at, updated_at
`;

const getById = async (id) => {
  const { rows } = await db.query(
    `SELECT ${SAFE_FIELDS} FROM users WHERE id = $1`, [id]
  );
  return rows[0] || null;
};

const updateProfile = async (userId, { name, country, language, avatar_url }) => {
  const { rows } = await db.query(
    `UPDATE users
     SET name       = COALESCE($1, name),
         country    = COALESCE($2, country),
         language   = COALESCE($3, language),
         avatar_url = COALESCE($4, avatar_url),
         updated_at = NOW()
     WHERE id = $5
     RETURNING ${SAFE_FIELDS}`,
    [name, country, language, avatar_url, userId]
  );
  return rows[0];
};

const changePassword = async (userId, { currentPassword, newPassword }) => {
  const { rows } = await db.query(
    'SELECT password_hash, login_method FROM users WHERE id = $1', [userId]
  );
  const user = rows[0];
  if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });
  if (user.login_method !== 'email') {
    throw Object.assign(new Error('OAuth users cannot set a password here'), { statusCode: 400 });
  }

  const valid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!valid) throw Object.assign(new Error('Current password is incorrect'), { statusCode: 401 });

  const newHash = await bcrypt.hash(newPassword, 12);
  await db.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [newHash, userId]);
};

const getEnrollments = async (userId) => {
  const { rows } = await db.query(
    `SELECT e.*, c.title, c.thumbnail_url, c.category, c.total_lessons, c.total_duration_secs
     FROM enrollments e
     JOIN courses c ON c.id = e.course_id
     WHERE e.user_id = $1
     ORDER BY e.last_accessed_at DESC NULLS LAST`,
    [userId]
  );
  return rows;
};

// ─── Admin: list all users ───────────────────────────────────────

const listUsers = async ({ page = 1, limit = 20, search, status, login_method }) => {
  const offset = (page - 1) * limit;
  const params = [];
  const conditions = [];

  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(name ILIKE $${params.length} OR email ILIKE $${params.length})`);
  }
  if (status) {
    params.push(status);
    conditions.push(`status = $${params.length}`);
  }
  if (login_method) {
    params.push(login_method);
    conditions.push(`login_method = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  params.push(limit, offset);
  const { rows } = await db.query(
    `SELECT ${SAFE_FIELDS} FROM users ${where}
     ORDER BY created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  const countParams = params.slice(0, params.length - 2);
  const { rows: countRows } = await db.query(
    `SELECT COUNT(*) FROM users ${where}`, countParams
  );

  return { users: rows, total: parseInt(countRows[0].count, 10), page, limit };
};

const setStatus = async (userId, status) => {
  const { rows } = await db.query(
    `UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id, status`,
    [status, userId]
  );
  return rows[0];
};

module.exports = { getById, updateProfile, changePassword, getEnrollments, listUsers, setStatus };
