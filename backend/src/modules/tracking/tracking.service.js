const db = require('../../config/database');

// ─── Track any event ──────────────────────────────────────────────

const track = async ({
  user_id, session_id, event_type, page_url,
  referrer, metadata = {}, ip_address, user_agent
}) => {
  const { rows } = await db.query(
    `INSERT INTO tracking_events
       (user_id, session_id, event_type, page_url, referrer, metadata, ip_address, user_agent)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING id`,
    [user_id || null, session_id, event_type, page_url || null,
     referrer || null, JSON.stringify(metadata), ip_address || null, user_agent || null]
  );
  return rows[0];
};

// ─── UTM capture ─────────────────────────────────────────────────

const captureUTM = async ({ user_id, session_id, utm_source, utm_medium, utm_campaign, utm_term, utm_content, landing_page, referrer }) => {
  // Only insert if at least one UTM param present
  if (!utm_source && !utm_medium && !utm_campaign) return null;

  const { rows } = await db.query(
    `INSERT INTO utm_tracking
       (user_id, session_id, utm_source, utm_medium, utm_campaign, utm_term, utm_content, landing_page, referrer)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING id`,
    [user_id || null, session_id, utm_source, utm_medium,
     utm_campaign, utm_term, utm_content, landing_page, referrer]
  );
  return rows[0];
};

// ─── Conversion funnel ────────────────────────────────────────────

const recordFunnelStep = async ({ user_id, session_id, step, course_id, metadata = {} }) => {
  const { rows } = await db.query(
    `INSERT INTO conversion_funnel (user_id, session_id, step, course_id, metadata)
     VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [user_id || null, session_id, step, course_id || null, JSON.stringify(metadata)]
  );
  return rows[0];
};

// ─── Link session to user (on login/signup) ───────────────────────

const linkSessionToUser = async (userId, sessionId) => {
  await Promise.all([
    db.query(
      `UPDATE tracking_events SET user_id = $1 WHERE session_id = $2 AND user_id IS NULL`,
      [userId, sessionId]
    ),
    db.query(
      `UPDATE utm_tracking SET user_id = $1 WHERE session_id = $2 AND user_id IS NULL`,
      [userId, sessionId]
    ),
    db.query(
      `UPDATE conversion_funnel SET user_id = $1 WHERE session_id = $2 AND user_id IS NULL`,
      [userId, sessionId]
    ),
  ]);
};

module.exports = { track, captureUTM, recordFunnelStep, linkSessionToUser };
