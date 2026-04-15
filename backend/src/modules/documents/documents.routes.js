const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, requireAdmin, optionalAuth } = require('../../middleware/auth');
const { validate }     = require('../../middleware/validate');
const { asyncHandler } = require('../../middleware/errorHandler');
const svc = require('./documents.service');

// ─── Public ──────────────────────────────────────────────────────

// GET /api/documents — list all active documents (no file_url exposed)
router.get('/', asyncHandler(async (req, res) => {
  const result = await svc.listDocuments({
    category: req.query.category,
    page:     parseInt(req.query.page  || 1),
    limit:    parseInt(req.query.limit || 12),
  });
  res.json({ success: true, ...result });
}));

// GET /api/documents/:id — document detail (no file_url)
router.get('/:id', asyncHandler(async (req, res) => {
  const doc = await svc.getDocumentById(req.params.id, false);
  if (!doc) return res.status(404).json({ success: false, message: 'Document not found' });
  res.json({ success: true, data: doc });
}));

// POST /api/documents/:id/download — log download + return file URL
router.post('/:id/download',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.ip;
    const result = await svc.downloadDocument(req.params.id, {
      userId:    req.user?.id,
      sessionId: req.body.session_id,
      ipAddress: ip,
    });
    res.json({ success: true, data: result });
  })
);

// ─── Admin ───────────────────────────────────────────────────────

// GET /api/documents/admin/stats — download analytics
router.get('/admin/stats',
  requireAuth, requireAdmin,
  asyncHandler(async (req, res) => {
    const data = await svc.getDownloadStats({
      days: parseInt(req.query.days || 30),
    });
    res.json({ success: true, data });
  })
);

// POST /api/documents — create new document
router.post('/',
  requireAuth, requireAdmin,
  [
    body('title').trim().notEmpty().withMessage('Title required'),
    body('file_url').isURL().withMessage('Valid file URL required'),
    body('category').optional().trim(),
    body('requires_login').optional().isBoolean(),
    body('pages').optional().isInt({ min: 0 }),
    body('sort_order').optional().isInt({ min: 0 }),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const doc = await svc.createDocument(req.body);
    res.status(201).json({ success: true, data: doc });
  })
);

// PUT /api/documents/:id — update document
router.put('/:id',
  requireAuth, requireAdmin,
  asyncHandler(async (req, res) => {
    const doc = await svc.updateDocument(req.params.id, req.body);
    res.json({ success: true, data: doc });
  })
);

// DELETE /api/documents/:id — remove document
router.delete('/:id',
  requireAuth, requireAdmin,
  asyncHandler(async (req, res) => {
    await svc.deleteDocument(req.params.id);
    res.json({ success: true, message: 'Document deleted' });
  })
);

module.exports = router;
