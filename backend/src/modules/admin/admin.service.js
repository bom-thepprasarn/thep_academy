const db = require('../../config/database');

// ─── Overview KPIs ───────────────────────────────────────────────

const getOverview = async () => {
  const [users, revenue, enrollments, courses] = await Promise.all([
    db.query(`
      SELECT
        COUNT(*)                                           AS total_users,
        COUNT(*) FILTER (WHERE status = 'active')          AS active_users,
        COUNT(*) FILTER (WHERE signup_date >= NOW() - INTERVAL '30 days') AS new_users_30d,
        COUNT(*) FILTER (WHERE signup_date >= NOW() - INTERVAL '7 days')  AS new_users_7d
      FROM users
    `),
    db.query(`
      SELECT
        COALESCE(SUM(price) FILTER (WHERE payment_status = 'completed'), 0)                               AS total_revenue,
        COALESCE(SUM(price) FILTER (WHERE payment_status = 'completed' AND payment_date >= NOW() - INTERVAL '30 days'), 0) AS revenue_30d,
        COALESCE(SUM(price) FILTER (WHERE payment_status = 'completed' AND payment_date >= NOW() - INTERVAL '7 days'),  0) AS revenue_7d,
        COUNT(*) FILTER (WHERE payment_status = 'completed')                                               AS total_orders,
        COUNT(*) FILTER (WHERE payment_status = 'completed' AND payment_date >= NOW() - INTERVAL '30 days') AS orders_30d
      FROM orders
    `),
    db.query(`
      SELECT
        COUNT(*)                                                   AS total_enrollments,
        COUNT(*) FILTER (WHERE completion_percentage = 100)        AS completed_enrollments,
        COUNT(*) FILTER (WHERE enrolled_at >= NOW() - INTERVAL '30 days') AS enrollments_30d
      FROM enrollments
    `),
    db.query(`
      SELECT
        COUNT(*)                                        AS total_courses,
        COUNT(*) FILTER (WHERE status = 'published')   AS published_courses
      FROM courses
    `),
  ]);

  return {
    users:       users.rows[0],
    revenue:     revenue.rows[0],
    enrollments: enrollments.rows[0],
    courses:     courses.rows[0],
  };
};

// ─── Revenue over time ───────────────────────────────────────────

const getRevenueTimeSeries = async ({ days = 30 }) => {
  const { rows } = await db.query(`
    SELECT
      DATE(payment_date)          AS date,
      COUNT(*)                    AS orders,
      SUM(price)                  AS revenue
    FROM orders
    WHERE payment_status = 'completed'
      AND payment_date >= NOW() - INTERVAL '${parseInt(days)} days'
    GROUP BY DATE(payment_date)
    ORDER BY date
  `);
  return rows;
};

// ─── Active users (daily/weekly/monthly) ─────────────────────────

const getActiveUsers = async () => {
  const { rows } = await db.query(`
    SELECT
      COUNT(DISTINCT user_id) FILTER (WHERE created_at >= NOW() - INTERVAL '1 day')   AS dau,
      COUNT(DISTINCT user_id) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')  AS wau,
      COUNT(DISTINCT user_id) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') AS mau
    FROM tracking_events
    WHERE user_id IS NOT NULL
  `);
  return rows[0];
};

// ─── Top courses ─────────────────────────────────────────────────

const getTopCourses = async ({ limit = 10, metric = 'revenue' }) => {
  const orderBy = metric === 'enrollments' ? 'enrollment_count' : 'total_revenue';
  const { rows } = await db.query(`
    SELECT
      c.id, c.title, c.category, c.price, c.thumbnail_url,
      COUNT(DISTINCT e.user_id)                              AS enrollment_count,
      COALESCE(SUM(o.price) FILTER (WHERE o.payment_status = 'completed'), 0) AS total_revenue,
      ROUND(AVG(e.completion_percentage), 1)                 AS avg_completion
    FROM courses c
    LEFT JOIN enrollments e ON e.course_id = c.id
    LEFT JOIN orders o ON o.course_id = c.id
    WHERE c.status = 'published'
    GROUP BY c.id
    ORDER BY ${orderBy} DESC
    LIMIT $1
  `, [limit]);
  return rows;
};

// ─── User engagement ─────────────────────────────────────────────

const getUserEngagement = async ({ days = 30 }) => {
  const { rows } = await db.query(`
    SELECT
      DATE(created_at)            AS date,
      COUNT(*)                    AS total_events,
      COUNT(DISTINCT user_id)     AS unique_users,
      COUNT(*) FILTER (WHERE event_type = 'page_view')       AS page_views,
      COUNT(*) FILTER (WHERE event_type = 'course_view')     AS course_views,
      COUNT(*) FILTER (WHERE event_type = 'lesson_complete') AS lesson_completions
    FROM tracking_events
    WHERE created_at >= NOW() - INTERVAL '${parseInt(days)} days'
    GROUP BY DATE(created_at)
    ORDER BY date
  `);
  return rows;
};

// ─── Conversion funnel analysis ───────────────────────────────────

const getConversionFunnel = async ({ days = 30 }) => {
  const { rows } = await db.query(`
    SELECT
      step,
      COUNT(DISTINCT session_id)  AS sessions,
      COUNT(DISTINCT user_id)     AS users
    FROM conversion_funnel
    WHERE created_at >= NOW() - INTERVAL '${parseInt(days)} days'
    GROUP BY step
    ORDER BY
      CASE step
        WHEN 'visit'           THEN 1
        WHEN 'signup'          THEN 2
        WHEN 'course_view'     THEN 3
        WHEN 'checkout_start'  THEN 4
        WHEN 'purchase'        THEN 5
        ELSE 6
      END
  `);
  return rows;
};

// ─── UTM source breakdown ────────────────────────────────────────

const getUTMBreakdown = async ({ days = 30 }) => {
  const { rows } = await db.query(`
    SELECT
      utm_source,
      utm_medium,
      utm_campaign,
      COUNT(DISTINCT session_id) AS sessions,
      COUNT(DISTINCT user_id)    AS users
    FROM utm_tracking
    WHERE created_at >= NOW() - INTERVAL '${parseInt(days)} days'
      AND utm_source IS NOT NULL
    GROUP BY utm_source, utm_medium, utm_campaign
    ORDER BY sessions DESC
    LIMIT 50
  `);
  return rows;
};

// ─── User signup trend ────────────────────────────────────────────

const getSignupTrend = async ({ days = 30 }) => {
  const { rows } = await db.query(`
    SELECT
      DATE(signup_date)          AS date,
      COUNT(*)                   AS signups,
      COUNT(*) FILTER (WHERE login_method = 'email')    AS email_signups,
      COUNT(*) FILTER (WHERE login_method = 'google')   AS google_signups,
      COUNT(*) FILTER (WHERE login_method = 'facebook') AS facebook_signups
    FROM users
    WHERE signup_date >= NOW() - INTERVAL '${parseInt(days)} days'
    GROUP BY DATE(signup_date)
    ORDER BY date
  `);
  return rows;
};

module.exports = {
  getOverview, getRevenueTimeSeries, getActiveUsers,
  getTopCourses, getUserEngagement, getConversionFunnel,
  getUTMBreakdown, getSignupTrend,
};
