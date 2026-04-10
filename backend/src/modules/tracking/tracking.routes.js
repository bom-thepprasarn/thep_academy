const router = require('express').Router();
const { body } = require('express-validator');
const { optionalAuth } = require('../../middleware/auth');
const { validate }     = require('../../middleware/validate');
const { asyncHandler } = require('../../middleware/errorHandler');
const svc = require('./tracking.service');

// POST /api/track — log any client-side event
router.post('/',
  optionalAuth,
  [
    body('session_id').trim().notEmpty().withMessage('session_id required'),
    body('event_type').trim().notEmpty().withMessage('event_type required'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.ip;
    await svc.track({
      user_id:    req.user?.id,
      session_id: req.body.session_id,
      event_type: req.body.event_type,
      page_url:   req.body.page_url,
      referrer:   req.body.referrer,
      metadata:   req.body.metadata || {},
      ip_address: ip,
      user_agent: req.headers['user-agent'],
    });
    res.json({ success: true });
  })
);

// POST /api/track/utm — capture UTM parameters on landing
router.post('/utm',
  optionalAuth,
  [body('session_id').trim().notEmpty()],
  validate,
  asyncHandler(async (req, res) => {
    await svc.captureUTM({ user_id: req.user?.id, ...req.body });
    res.json({ success: true });
  })
);

// POST /api/track/funnel — record conversion funnel step
router.post('/funnel',
  optionalAuth,
  [
    body('session_id').trim().notEmpty(),
    body('step').isIn(['visit', 'signup', 'course_view', 'checkout_start', 'purchase']),
  ],
  validate,
  asyncHandler(async (req, res) => {
    await svc.recordFunnelStep({ user_id: req.user?.id, ...req.body });
    res.json({ success: true });
  })
);

// POST /api/track/link-session — link anonymous session to user after login
router.post('/link-session',
  asyncHandler(async (req, res) => {
    const { user_id, session_id } = req.body;
    if (!user_id || !session_id) {
      return res.status(400).json({ success: false, message: 'user_id and session_id required' });
    }
    await svc.linkSessionToUser(user_id, session_id);
    res.json({ success: true });
  })
);

module.exports = router;
