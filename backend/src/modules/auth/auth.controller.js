const passport     = require('passport');
const authService  = require('./auth.service');
const { asyncHandler } = require('../../middleware/errorHandler');

// ─── Email/Password ─────────────────────────────────────────────

const register = asyncHandler(async (req, res) => {
  const { name, email, password, country, language } = req.body;
  const result = await authService.register({ name, email, password, country, language });
  res.status(201).json({ success: true, data: result });
});

const login = (req, res, next) => {
  passport.authenticate('local', { session: false }, async (err, user, info) => {
    if (err)   return next(err);
    if (!user) return res.status(401).json({ success: false, message: info?.message || 'Login failed' });
    try {
      const result = await authService.login(user);
      res.json({ success: true, data: result });
    } catch (e) {
      next(e);
    }
  })(req, res, next);
};

// ─── Refresh token ──────────────────────────────────────────────

const refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ success: false, message: 'Refresh token required' });
  const tokens = await authService.refreshAccessToken(refreshToken);
  res.json({ success: true, data: tokens });
});

// ─── Logout ─────────────────────────────────────────────────────

const logout = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  await authService.logout(refreshToken);
  res.json({ success: true, message: 'Logged out' });
});

const logoutAll = asyncHandler(async (req, res) => {
  await authService.logoutAll(req.user.id);
  res.json({ success: true, message: 'Logged out from all devices' });
});

// ─── OAuth callbacks ─────────────────────────────────────────────

const oauthCallback = (req, res, next) => {
  // req.user set by passport strategy
  authService.oauthLogin(req.user)
    .then(({ accessToken, refreshToken, user }) => {
      // Redirect to frontend with tokens in query params
      // In production consider using secure httpOnly cookies instead
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      res.redirect(
        `${frontendUrl}/auth/callback?token=${accessToken}&refresh=${refreshToken}`
      );
    })
    .catch(next);
};

// ─── Me (current user) ──────────────────────────────────────────

const me = asyncHandler(async (req, res) => {
  res.json({ success: true, data: req.user });
});

module.exports = { register, login, refresh, logout, logoutAll, oauthCallback, me };
