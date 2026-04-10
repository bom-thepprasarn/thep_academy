const db = require('../../config/database');

// ─── Courses ─────────────────────────────────────────────────────

const listCourses = async ({ page = 1, limit = 12, category, status = 'published', search }) => {
  const offset = (page - 1) * limit;
  const params = [status];
  const conditions = ['c.status = $1'];

  if (category) {
    params.push(category);
    conditions.push(`c.category = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(c.title ILIKE $${params.length} OR c.description ILIKE $${params.length})`);
  }

  const where = `WHERE ${conditions.join(' AND ')}`;
  params.push(limit, offset);

  const { rows } = await db.query(
    `SELECT c.id, c.title, c.short_description, c.category, c.price, c.original_price,
            c.thumbnail_url, c.level, c.language, c.status,
            c.total_lessons, c.total_duration_secs, c.enrolled_count,
            c.rating_avg, c.rating_count, c.created_at
     FROM courses c ${where}
     ORDER BY c.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  const { rows: countRows } = await db.query(
    `SELECT COUNT(*) FROM courses c ${where}`,
    params.slice(0, params.length - 2)
  );

  return { courses: rows, total: parseInt(countRows[0].count, 10), page, limit };
};

const getCourseById = async (courseId, includeUnpublished = false) => {
  const statusCondition = includeUnpublished ? '' : `AND status = 'published'`;
  const { rows } = await db.query(
    `SELECT * FROM courses WHERE id = $1 ${statusCondition}`, [courseId]
  );
  if (!rows[0]) return null;

  const { rows: lessons } = await db.query(
    `SELECT id, title, description, duration_secs, sort_order, is_free, lesson_type
     FROM lessons WHERE course_id = $1 ORDER BY sort_order`,
    [courseId]
  );

  return { ...rows[0], lessons };
};

const createCourse = async (data) => {
  const {
    title, description, short_description, category,
    price = 0, original_price, thumbnail_url, trailer_url, level = 'beginner', language = 'th'
  } = data;

  const { rows } = await db.query(
    `INSERT INTO courses
       (title, description, short_description, category, price, original_price,
        thumbnail_url, trailer_url, level, language, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'draft')
     RETURNING *`,
    [title, description, short_description, category, price, original_price,
     thumbnail_url, trailer_url, level, language]
  );
  return rows[0];
};

const updateCourse = async (courseId, data) => {
  const fields = [];
  const values = [];
  let idx = 1;

  const allowed = [
    'title','description','short_description','category','price','original_price',
    'thumbnail_url','trailer_url','level','language','status'
  ];

  for (const key of allowed) {
    if (data[key] !== undefined) {
      fields.push(`${key} = $${idx++}`);
      values.push(data[key]);
    }
  }
  if (!fields.length) throw Object.assign(new Error('No fields to update'), { statusCode: 400 });

  values.push(courseId);
  const { rows } = await db.query(
    `UPDATE courses SET ${fields.join(', ')}, updated_at = NOW()
     WHERE id = $${idx} RETURNING *`,
    values
  );
  return rows[0];
};

const deleteCourse = async (courseId) => {
  await db.query('DELETE FROM courses WHERE id = $1', [courseId]);
};

// ─── Lessons ─────────────────────────────────────────────────────

const getLessonsByCourse = async (courseId) => {
  const { rows } = await db.query(
    'SELECT * FROM lessons WHERE course_id = $1 ORDER BY sort_order',
    [courseId]
  );
  return rows;
};

const createLesson = async (courseId, data) => {
  const { title, description, video_url, duration_secs = 0, sort_order = 0, is_free = false, lesson_type = 'video' } = data;
  const { rows } = await db.query(
    `INSERT INTO lessons (course_id, title, description, video_url, duration_secs, sort_order, is_free, lesson_type)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [courseId, title, description, video_url, duration_secs, sort_order, is_free, lesson_type]
  );
  return rows[0];
};

const updateLesson = async (lessonId, data) => {
  const fields = [];
  const values = [];
  let idx = 1;
  const allowed = ['title','description','video_url','duration_secs','sort_order','is_free','lesson_type'];

  for (const key of allowed) {
    if (data[key] !== undefined) {
      fields.push(`${key} = $${idx++}`);
      values.push(data[key]);
    }
  }
  if (!fields.length) throw Object.assign(new Error('No fields to update'), { statusCode: 400 });

  values.push(lessonId);
  const { rows } = await db.query(
    `UPDATE lessons SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING *`,
    values
  );
  return rows[0];
};

const deleteLesson = async (lessonId) => {
  await db.query('DELETE FROM lessons WHERE id = $1', [lessonId]);
};

module.exports = {
  listCourses, getCourseById, createCourse, updateCourse, deleteCourse,
  getLessonsByCourse, createLesson, updateLesson, deleteLesson,
};
