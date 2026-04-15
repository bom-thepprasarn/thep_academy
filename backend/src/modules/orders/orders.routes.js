const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, requireAdmin } = require('../../middleware/auth');
const { validate }    = require('../../middleware/validate');
const { asyncHandler } = require('../../middleware/errorHandler');
const svc = require('./orders.service');

// POST /api/orders — create order (student)
router.post('/',
  requireAuth,
  [
    body('course_id').isUUID().withMessage('Valid course_id required'),
    body('coupon_code').optional().trim(),
    body('payment_method').optional().trim(),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const order = await svc.createOrder(req.user.id, req.body.course_id, req.body);
    res.status(201).json({ success: true, data: order });
  })
);

// POST /api/orders/webhook/complete — payment gateway webhook
// In production: verify webhook signature before processing
router.post('/webhook/complete',
  asyncHandler(async (req, res) => {
    const { order_id, transaction_id } = req.body;
    if (!order_id || !transaction_id) {
      return res.status(400).json({ success: false, message: 'order_id and transaction_id required' });
    }
    const order = await svc.completeOrder(order_id, transaction_id);
    res.json({ success: true, data: order });
  })
);

// GET /api/orders/me — list my orders
router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const orders = await svc.getOrdersByUser(req.user.id);
  res.json({ success: true, data: orders });
}));

// GET /api/orders/me/:orderId — get single order
router.get('/me/:orderId', requireAuth, asyncHandler(async (req, res) => {
  const order = await svc.getOrderById(req.params.orderId, req.user.id);
  if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
  res.json({ success: true, data: order });
}));

// POST /api/orders/validate-coupon
router.post('/validate-coupon',
  requireAuth,
  [
    body('code').trim().notEmpty(),
    body('course_id').isUUID(),
    body('amount').isFloat({ min: 0 }),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { code, course_id, amount } = req.body;
    const result = await svc.validateCoupon(code, course_id, amount);
    res.json({ success: true, data: { discount: result.discount, coupon_type: result.coupon.discount_type } });
  })
);

// ─── Admin ───────────────────────────────────────────────────────

router.get('/', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const result = await svc.listOrders({
    page:           parseInt(req.query.page || 1),
    limit:          parseInt(req.query.limit || 20),
    payment_status: req.query.payment_status,
    from_date:      req.query.from_date,
    to_date:        req.query.to_date,
  });
  res.json({ success: true, ...result });
}));

router.get('/:orderId', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const order = await svc.getOrderById(req.params.orderId);
  if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
  res.json({ success: true, data: order });
}));

module.exports = router;
