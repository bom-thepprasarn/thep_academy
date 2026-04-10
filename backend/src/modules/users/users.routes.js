const router  = require('express').Router();
const { body, query } = require('express-validator');
const { requireAuth, requireAdmin } = require('../../middleware/auth');
const { validate }   = require('../../middleware/validate');
const { asyncHandler } = require('../../middleware/errorHandler');
const usersService   = require('./users.service');

// ─── Current user profile ────────────────────────────────────────

router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const user = await usersService.getById(req.user.id);
  res.json({ success: true, data: user });
}));

router.put('/me',
  requireAuth,
  [
    body('name').optional().trim().notEmpty(),
    body('country').optional().trim(),
    body('language').optional().isIn(['th', 'en']),
    body('avatar_url').optional().isURL(),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const user = await usersService.updateProfile(req.user.id, req.body);
    res.json({ success: true, data: user });
  })
);

router.put('/me/password',
  requireAuth,
  [
    body('currentPassword').notEmpty(),
    body('newPassword').isLength({ min: 8 }),
  ],
  validate,
  asyncHandler(async (req, res) => {
    await usersService.changePassword(req.user.id, req.body);
    res.json({ success: true, message: 'Password updated' });
  })
);

router.get('/me/enrollments', requireAuth, asyncHandler(async (req, res) => {
  const enrollments = await usersService.getEnrollments(req.user.id);
  res.json({ success: true, data: enrollments });
}));

// ─── Admin routes ────────────────────────────────────────────────

router.get('/',
  requireAuth, requireAdmin,
  asyncHandler(async (req, res) => {
    const result = await usersService.listUsers({
      page:         parseInt(req.query.page  || 1),
      limit:        parseInt(req.query.limit || 20),
      search:       req.query.search,
      status:       req.query.status,
      login_method: req.query.login_method,
    });
    res.json({ success: true, ...result });
  })
);

router.get('/:id', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const user = await usersService.getById(req.params.id);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  res.json({ success: true, data: user });
}));

router.patch('/:id/status',
  requireAuth, requireAdmin,
  [body('status').isIn(['active', 'inactive', 'banned'])],
  validate,
  asyncHandler(async (req, res) => {
    const result = await usersService.setStatus(req.params.id, req.body.status);
    res.json({ success: true, data: result });
  })
);

module.exports = router;
