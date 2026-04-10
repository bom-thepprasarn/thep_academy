const passport = require('passport');

/**
 * Require a valid JWT. Attaches user to req.user.
 */
const requireAuth = (req, res, next) => {
  passport.authenticate('jwt', { session: false }, (err, user) => {
    if (err)   return next(err);
    if (!user) return res.status(401).json({ success: false, message: 'Unauthorized — please login' });
    req.user = user;
    next();
  })(req, res, next);
};

/**
 * Require admin role.
 */
const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Forbidden — admin access required' });
  }
  next();
};

/**
 * Optional auth — attaches user if token present, does not block.
 */
const optionalAuth = (req, res, next) => {
  passport.authenticate('jwt', { session: false }, (err, user) => {
    if (!err && user) req.user = user;
    next();
  })(req, res, next);
};

module.exports = { requireAuth, requireAdmin, optionalAuth };
