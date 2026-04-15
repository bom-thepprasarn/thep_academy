const db = require('../../config/database');

// ─── Enrollment ──────────────────────────────────────────────────

const enroll = async (userId, courseId) => {
  // Check course exists & is published
  const { rows: courseRows } = await db.query(
    `SELECT id, price FROM courses WHERE id = $1 AND status = 'published'`, [courseId]
  );
  if (!courseRows[0]) throw Object.assign(new Error('Course not found or not published'), { statusCode: 404 });

  // Upsert enrollment (in case of free re-enroll)
  const { rows } = await db.query(
    `INSERT INTO enrollments (user_id, course_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id, course_id) DO UPDATE SET last_accessed_at = NOW()
     RETURNING *`,
    [userId, courseId]
  );
  return rows[0];
};

const isEnrolled = async (userId, courseId) => {
  const { rows } = await db.query(
    'SELECT id FROM enrollments WHERE user_id = $1 AND course_id = $2',
    [userId, courseId]
  );
  return rows.length > 0;
};

// ─── Lesson Progress ─────────────────────────────────────────────

const updateLessonProgress = async (userId, lessonId, { status, time_spent_secs, last_position_secs }) => {
  // Fetch lesson to get course_id
  const { rows: lessonRows } = await db.query(
    'SELECT course_id FROM lessons WHERE id = $1', [lessonId]
  );
  if (!lessonRows[0]) throw Object.assign(new Error('Lesson not found'), { statusCode: 404 });
  const courseId = lessonRows[0].course_id;

  const completedAt = status === 'completed' ? 'NOW()' : 'NULL';

  const { rows } = await db.query(
    `INSERT INTO lesson_progress
       (user_id, lesson_id, course_id, status, time_spent_secs, last_position_secs, completed_at, last_watched_at)
     VALUES ($1, $2, $3, $4, $5, $6, ${completedAt === 'NOW()' ? 'NOW()' : 'NULL'}, NOW())
     ON CONFLICT (user_id, lesson_id) DO UPDATE SET
       status             = EXCLUDED.status,
       time_spent_secs    = lesson_progress.time_spent_secs + EXCLUDED.time_spent_secs,
       last_position_secs = EXCLUDED.last_position_secs,
       completed_at       = CASE WHEN EXCLUDED.status = 'completed' THEN NOW() ELSE lesson_progress.completed_at END,
       last_watched_at    = NOW()
     RETURNING *`,
    [userId, lessonId, courseId, status || 'in_progress', time_spent_secs || 0, last_position_secs || 0]
  );

  // Recalculate course completion %
  await recalculateCourseCompletion(userId, courseId);

  return rows[0];
};

const recalculateCourseCompletion = async (userId, courseId) => {
  const { rows } = await db.query(
    `SELECT
       COUNT(*) FILTER (WHERE lp.status = 'completed') AS completed,
       c.total_lessons
     FROM courses c
     LEFT JOIN lessons l ON l.course_id = c.id
     LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.user_id = $1
     WHERE c.id = $2
     GROUP BY c.total_lessons`,
    [userId, courseId]
  );

  const total     = parseInt(rows[0]?.total_lessons || 0, 10);
  const completed = parseInt(rows[0]?.completed || 0, 10);
  const pct       = total > 0 ? Math.round((completed / total) * 100 * 100) / 100 : 0;
  const completedAt = pct >= 100 ? ', completed_at = COALESCE(completed_at, NOW())' : '';

  await db.query(
    `UPDATE enrollments
     SET completion_percentage = $1,
         last_accessed_at = NOW()
         ${completedAt}
     WHERE user_id = $2 AND course_id = $3`,
    [pct, userId, courseId]
  );

  return pct;
};

const getCourseProgress = async (userId, courseId) => {
  const { rows: enrollment } = await db.query(
    `SELECT * FROM enrollments WHERE user_id = $1 AND course_id = $2`,
    [userId, courseId]
  );
  if (!enrollment[0]) return null;

  const { rows: lessonProgress } = await db.query(
    `SELECT lp.*, l.title, l.duration_secs, l.sort_order
     FROM lesson_progress lp
     JOIN lessons l ON l.id = lp.lesson_id
     WHERE lp.user_id = $1 AND lp.course_id = $2
     ORDER BY l.sort_order`,
    [userId, courseId]
  );

  return { enrollment: enrollment[0], lessons: lessonProgress };
};

// ─── Quiz Scores ─────────────────────────────────────────────────

const submitQuiz = async (userId, lessonId, { score, max_score, passed }) => {
  const { rows } = await db.query(
    `INSERT INTO quiz_scores (user_id, lesson_id, score, max_score, passed)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [userId, lessonId, score, max_score, passed ?? (score / max_score >= 0.7)]
  );
  return rows[0];
};

const getQuizHistory = async (userId, lessonId) => {
  const { rows } = await db.query(
    `SELECT * FROM quiz_scores WHERE user_id = $1 AND lesson_id = $2 ORDER BY taken_at DESC`,
    [userId, lessonId]
  );
  return rows;
};

module.exports = {
  enroll, isEnrolled, updateLessonProgress, getCourseProgress, submitQuiz, getQuizHistory
};
