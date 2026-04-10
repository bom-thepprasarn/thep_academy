const router     = require('express').Router();
const passport   = require('passport');
const { body }   = require('express-validator');
const ctrl       = require('./auth.controller');
const { validate }     = require('../../middleware/validate');
const { requireAuth }  = require('../../middleware/auth');
const { authLimiter }  = require('../../middleware/rateLimiter');

// ─── Email / Password ───────────────────────────────────────────

router.post('/register',
  authLimiter,
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  ],
  validate,
  ctrl.register
);

router.post('/login',
  authLimiter,
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ],
  validate,
  ctrl.login
);

// ─── Token management ───────────────────────────────────────────

router.post('/refresh',  ctrl.refresh);
router.post('/logout',   ctrl.logout);
router.post('/logout-all', requireAuth, ctrl.logoutAll);

// ─── Current user ───────────────────────────────────────────────

router.get('/me', requireAuth, ctrl.me);

// ─── Google OAuth ───────────────────────────────────────────────

router.get('/google',
  passport.authenticate('google', { session: false, scope: ['profile', 'email'] })
);

router.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login' }),
  ctrl.oauthCallback
);

// ─── Facebook OAuth ─────────────────────────────────────────────

router.get('/facebook',
  passport.authenticate('facebook', { session: false, scope: ['email'] })
);

router.get('/facebook/callback',
  passport.authenticate('facebook', { session: false, failureRedirect: '/login' }),
  ctrl.oauthCallback
);

module.exports = router;
