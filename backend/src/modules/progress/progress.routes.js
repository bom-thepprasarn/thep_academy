const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth } = require('../../middleware/auth');
const { validate }    = require('../../middleware/validate');
const { asyncHandler } = require('../../middleware/errorHandler');
const svc = require('./progress.service');

// POST /api/progress/enroll/:courseId
router.post('/enroll/:courseId', requireAuth, asyncHandler(async (req, res) => {
  const enrollment = await svc.enroll(req.user.id, req.params.courseId);
  res.status(201).json({ success: true, data: enrollment });
}));

// GET /api/progress/courses/:courseId — get full progress for a course
router.get('/courses/:courseId', requireAuth, asyncHandler(async (req, res) => {
  const progress = await svc.getCourseProgress(req.user.id, req.params.courseId);
  if (!progress) return res.status(404).json({ success: false, message: 'Not enrolled' });
  res.json({ success: true, data: progress });
}));

// POST /api/progress/lessons/:lessonId — update lesson progress
router.post('/lessons/:lessonId',
  requireAuth,
  [
    body('status').optional().isIn(['not_started', 'in_progress', 'completed']),
    body('time_spent_secs').optional().isInt({ min: 0 }),
    body('last_position_secs').optional().isInt({ min: 0 }),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const result = await svc.updateLessonProgress(req.user.id, req.params.lessonId, req.body);
    res.json({ success: true, data: result });
  })
);

// POST /api/progress/quiz/:lessonId — submit quiz
router.post('/quiz/:lessonId',
  requireAuth,
  [
    body('score').isFloat({ min: 0 }).withMessage('score required'),
    body('max_score').isFloat({ min: 1 }).withMessage('max_score required'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const result = await svc.submitQuiz(req.user.id, req.params.lessonId, req.body);
    res.status(201).json({ success: true, data: result });
  })
);

// GET /api/progress/quiz/:lessonId/history
router.get('/quiz/:lessonId/history', requireAuth, asyncHandler(async (req, res) => {
  const history = await svc.getQuizHistory(req.user.id, req.params.lessonId);
  res.json({ success: true, data: history });
}));

module.exports = router;
