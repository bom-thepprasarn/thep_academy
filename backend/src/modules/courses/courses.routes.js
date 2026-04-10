const router = require('express').Router();
const { body, param } = require('express-validator');
const { requireAuth, requireAdmin, optionalAuth } = require('../../middleware/auth');
const { validate }    = require('../../middleware/validate');
const { asyncHandler } = require('../../middleware/errorHandler');
const svc = require('./courses.service');

// ─── Public / Student ────────────────────────────────────────────

router.get('/', optionalAuth, asyncHandler(async (req, res) => {
  const isAdmin = req.user?.role === 'admin';
  const result = await svc.listCourses({
    page:     parseInt(req.query.page  || 1),
    limit:    parseInt(req.query.limit || 12),
    category: req.query.category,
    status:   isAdmin ? req.query.status : 'published',
    search:   req.query.search,
  });
  res.json({ success: true, ...result });
}));

router.get('/:id', optionalAuth, asyncHandler(async (req, res) => {
  const isAdmin = req.user?.role === 'admin';
  const course  = await svc.getCourseById(req.params.id, isAdmin);
  if (!course) return res.status(404).json({ success: false, message: 'Course not found' });
  res.json({ success: true, data: course });
}));

// ─── Admin: manage courses ───────────────────────────────────────

router.post('/',
  requireAuth, requireAdmin,
  [
    body('title').trim().notEmpty(),
    body('price').optional().isFloat({ min: 0 }),
    body('category').optional().trim(),
    body('level').optional().isIn(['beginner', 'intermediate', 'advanced']),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const course = await svc.createCourse(req.body);
    res.status(201).json({ success: true, data: course });
  })
);

router.put('/:id',
  requireAuth, requireAdmin,
  asyncHandler(async (req, res) => {
    const course = await svc.updateCourse(req.params.id, req.body);
    res.json({ success: true, data: course });
  })
);

router.delete('/:id',
  requireAuth, requireAdmin,
  asyncHandler(async (req, res) => {
    await svc.deleteCourse(req.params.id);
    res.json({ success: true, message: 'Course deleted' });
  })
);

// ─── Lessons (nested under course) ──────────────────────────────

router.get('/:courseId/lessons', optionalAuth, asyncHandler(async (req, res) => {
  const lessons = await svc.getLessonsByCourse(req.params.courseId);
  res.json({ success: true, data: lessons });
}));

router.post('/:courseId/lessons',
  requireAuth, requireAdmin,
  [
    body('title').trim().notEmpty(),
    body('duration_secs').optional().isInt({ min: 0 }),
    body('sort_order').optional().isInt({ min: 0 }),
    body('is_free').optional().isBoolean(),
    body('lesson_type').optional().isIn(['video', 'text', 'quiz']),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const lesson = await svc.createLesson(req.params.courseId, req.body);
    res.status(201).json({ success: true, data: lesson });
  })
);

router.put('/:courseId/lessons/:lessonId',
  requireAuth, requireAdmin,
  asyncHandler(async (req, res) => {
    const lesson = await svc.updateLesson(req.params.lessonId, req.body);
    res.json({ success: true, data: lesson });
  })
);

router.delete('/:courseId/lessons/:lessonId',
  requireAuth, requireAdmin,
  asyncHandler(async (req, res) => {
    await svc.deleteLesson(req.params.lessonId);
    res.json({ success: true, message: 'Lesson deleted' });
  })
);

module.exports = router;
