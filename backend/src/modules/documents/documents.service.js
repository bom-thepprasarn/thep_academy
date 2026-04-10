const db = require('../../config/database');

// ─── List documents (public) ──────────────────────────────────────

const listDocuments = async ({ category, page = 1, limit = 12 }) => {
  const offset = (page - 1) * limit;
  const params = [true];
  const conditions = ['is_active = $1'];

  if (category) {
    params.push(category);
    conditions.push(`category = $${params.length}`);
  }

  const where = `WHERE ${conditions.join(' AND ')}`;
  params.push(limit, offset);

  const { rows } = await db.query(
    `SELECT id, title, description, category, thumbnail_url,
            pages, file_size_kb, file_type, requires_login,
            download_count, sort_order, created_at
     FROM free_documents
     ${where}
     ORDER BY sort_order ASC, created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  const { rows: countRows } = await db.query(
    `SELECT COUNT(*) FROM free_documents ${where}`,
    params.slice(0, params.length - 2)
  );

  return { documents: rows, total: parseInt(countRows[0].count, 10), page, limit };
};

const getDocumentById = async (id, includeUrl = false) => {
  const fields = includeUrl
    ? 'id, title, description, category, file_url, thumbnail_url, pages, file_size_kb, file_type, requires_login, download_count, is_active, sort_order, created_at'
    : 'id, title, description, category, thumbnail_url, pages, file_size_kb, file_type, requires_login, download_count, sort_order, created_at';

  const { rows } = await db.query(
    `SELECT ${fields} FROM free_documents WHERE id = $1`, [id]
  );
  return rows[0] || null;
};

// ─── Download — returns signed URL and logs the event ────────────

const downloadDocument = async (documentId, { userId, sessionId, ipAddress }) => {
  const doc = await getDocumentById(documentId, true); // include file_url
  if (!doc) throw Object.assign(new Error('Document not found'), { statusCode: 404 });
  if (!doc.is_active) throw Object.assign(new Error('Document not available'), { statusCode: 410 });

  if (doc.requires_login && !userId) {
    throw Object.assign(new Error('Login required to download this document'), { statusCode: 401 });
  }

  // Log download
  await db.query(
    `INSERT INTO document_downloads (document_id, user_id, session_id, ip_address)
     VALUES ($1, $2, $3, $4)`,
    [documentId, userId || null, sessionId || null, ipAddress || null]
  );

  // Increment counter
  await db.query(
    'UPDATE free_documents SET download_count = download_count + 1 WHERE id = $1',
    [documentId]
  );

  return { file_url: doc.file_url, title: doc.title };
};

// ─── Admin: CRUD ─────────────────────────────────────────────────

const createDocument = async (data) => {
  const {
    title, description, category, file_url,
    thumbnail_url, pages = 0, file_size_kb = 0,
    file_type = 'pdf', requires_login = true, sort_order = 0
  } = data;

  const { rows } = await db.query(
    `INSERT INTO free_documents
       (title, description, category, file_url, thumbnail_url, pages, file_size_kb, file_type, requires_login, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING *`,
    [title, description, category, file_url, thumbnail_url,
     pages, file_size_kb, file_type, requires_login, sort_order]
  );
  return rows[0];
};

const updateDocument = async (id, data) => {
  const allowed = [
    'title', 'description', 'category', 'file_url', 'thumbnail_url',
    'pages', 'file_size_kb', 'file_type', 'requires_login', 'is_active', 'sort_order'
  ];
  const fields = [];
  const values = [];
  let idx = 1;

  for (const key of allowed) {
    if (data[key] !== undefined) {
      fields.push(`${key} = $${idx++}`);
      values.push(data[key]);
    }
  }
  if (!fields.length) throw Object.assign(new Error('No fields to update'), { statusCode: 400 });

  values.push(id);
  const { rows } = await db.query(
    `UPDATE free_documents SET ${fields.join(', ')}, updated_at = NOW()
     WHERE id = $${idx} RETURNING *`,
    values
  );
  return rows[0];
};

const deleteDocument = async (id) => {
  await db.query('DELETE FROM free_documents WHERE id = $1', [id]);
};

// ─── Admin analytics ──────────────────────────────────────────────

const getDownloadStats = async ({ days = 30 }) => {
  const { rows } = await db.query(`
    SELECT
      fd.id, fd.title, fd.category,
      fd.download_count                               AS total_downloads,
      COUNT(dd.id) FILTER (
        WHERE dd.downloaded_at >= NOW() - INTERVAL '${parseInt(days)} days'
      )                                               AS downloads_period,
      COUNT(DISTINCT dd.user_id)                      AS unique_users
    FROM free_documents fd
    LEFT JOIN document_downloads dd ON dd.document_id = fd.id
    WHERE fd.is_active = TRUE
    GROUP BY fd.id
    ORDER BY total_downloads DESC
  `);
  return rows;
};

module.exports = {
  listDocuments, getDocumentById, downloadDocument,
  createDocument, updateDocument, deleteDocument, getDownloadStats,
};
