const router = require('express').Router();
const { requireAuth, requireAdmin } = require('../../middleware/auth');
const { asyncHandler } = require('../../middleware/errorHandler');
const svc = require('./admin.service');

// All admin routes require auth + admin role
router.use(requireAuth, requireAdmin);

// GET /api/admin/overview — KPI summary
router.get('/overview', asyncHandler(async (req, res) => {
  const data = await svc.getOverview();
  res.json({ success: true, data });
}));

// GET /api/admin/revenue?days=30 — revenue time series
router.get('/revenue', asyncHandler(async (req, res) => {
  const data = await svc.getRevenueTimeSeries({
    days: parseInt(req.query.days || 30),
  });
  res.json({ success: true, data });
}));

// GET /api/admin/active-users — DAU / WAU / MAU
router.get('/active-users', asyncHandler(async (req, res) => {
  const data = await svc.getActiveUsers();
  res.json({ success: true, data });
}));

// GET /api/admin/top-courses?limit=10&metric=revenue
router.get('/top-courses', asyncHandler(async (req, res) => {
  const data = await svc.getTopCourses({
    limit:  parseInt(req.query.limit || 10),
    metric: req.query.metric || 'revenue',
  });
  res.json({ success: true, data });
}));

// GET /api/admin/engagement?days=30 — user engagement time series
router.get('/engagement', asyncHandler(async (req, res) => {
  const data = await svc.getUserEngagement({
    days: parseInt(req.query.days || 30),
  });
  res.json({ success: true, data });
}));

// GET /api/admin/funnel?days=30 — conversion funnel
router.get('/funnel', asyncHandler(async (req, res) => {
  const data = await svc.getConversionFunnel({
    days: parseInt(req.query.days || 30),
  });
  res.json({ success: true, data });
}));

// GET /api/admin/utm?days=30 — UTM breakdown
router.get('/utm', asyncHandler(async (req, res) => {
  const data = await svc.getUTMBreakdown({
    days: parseInt(req.query.days || 30),
  });
  res.json({ success: true, data });
}));

// GET /api/admin/signups?days=30 — signup trend by method
router.get('/signups', asyncHandler(async (req, res) => {
  const data = await svc.getSignupTrend({
    days: parseInt(req.query.days || 30),
  });
  res.json({ success: true, data });
}));

module.exports = router;
