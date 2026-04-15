const db = require('../../config/database');

// ─── Coupon validation ────────────────────────────────────────────

const validateCoupon = async (code, courseId, purchaseAmount) => {
  const { rows } = await db.query(
    `SELECT * FROM coupons
     WHERE code = $1
       AND is_active = TRUE
       AND (expires_at IS NULL OR expires_at > NOW())
       AND (max_uses IS NULL OR uses_count < max_uses)
       AND (course_id IS NULL OR course_id = $2)
       AND min_purchase <= $3`,
    [code.toUpperCase(), courseId, purchaseAmount]
  );
  const coupon = rows[0];
  if (!coupon) throw Object.assign(new Error('Invalid or expired coupon'), { statusCode: 400 });

  const discount =
    coupon.discount_type === 'percentage'
      ? Math.round(purchaseAmount * (coupon.discount_value / 100) * 100) / 100
      : Math.min(coupon.discount_value, purchaseAmount);

  return { coupon, discount };
};

// ─── Create order ────────────────────────────────────────────────

const createOrder = async (userId, courseId, { coupon_code, payment_method } = {}) => {
  // Verify course exists
  const { rows: courseRows } = await db.query(
    `SELECT id, price FROM courses WHERE id = $1 AND status = 'published'`, [courseId]
  );
  const course = courseRows[0];
  if (!course) throw Object.assign(new Error('Course not found'), { statusCode: 404 });

  // Check not already ordered
  const { rows: existing } = await db.query(
    `SELECT id FROM orders WHERE user_id = $1 AND course_id = $2 AND payment_status = 'completed'`,
    [userId, courseId]
  );
  if (existing.length) throw Object.assign(new Error('Already purchased'), { statusCode: 409 });

  let finalPrice    = parseFloat(course.price);
  let discountAmt   = 0;
  let couponId      = null;

  // Apply coupon
  if (coupon_code) {
    const { coupon, discount } = await validateCoupon(coupon_code, courseId, finalPrice);
    discountAmt = discount;
    finalPrice  = Math.max(0, finalPrice - discount);
    couponId    = coupon.id;
  }

  const { rows } = await db.query(
    `INSERT INTO orders
       (user_id, course_id, price, original_price, discount_amount, coupon_code, coupon_id, payment_method)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [userId, courseId, finalPrice, course.price, discountAmt,
     coupon_code || null, couponId, payment_method || null]
  );
  return rows[0];
};

// ─── Complete order (called by payment webhook) ───────────────────

const completeOrder = async (orderId, transactionId) => {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `UPDATE orders
       SET payment_status = 'completed', payment_date = NOW(), transaction_id = $1
       WHERE id = $2 AND payment_status = 'pending'
       RETURNING *`,
      [transactionId, orderId]
    );
    const order = rows[0];
    if (!order) throw Object.assign(new Error('Order not found or already completed'), { statusCode: 404 });

    // Auto-enroll user in course
    await client.query(
      `INSERT INTO enrollments (user_id, course_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, course_id) DO NOTHING`,
      [order.user_id, order.course_id]
    );

    // Increment coupon usage
    if (order.coupon_id) {
      await client.query(
        'UPDATE coupons SET uses_count = uses_count + 1 WHERE id = $1', [order.coupon_id]
      );
    }

    await client.query('COMMIT');
    return order;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// ─── Get orders ───────────────────────────────────────────────────

const getOrdersByUser = async (userId) => {
  const { rows } = await db.query(
    `SELECT o.*, c.title AS course_title, c.thumbnail_url
     FROM orders o
     JOIN courses c ON c.id = o.course_id
     WHERE o.user_id = $1
     ORDER BY o.created_at DESC`,
    [userId]
  );
  return rows;
};

const getOrderById = async (orderId, userId = null) => {
  const condition = userId ? 'AND o.user_id = $2' : '';
  const params    = userId ? [orderId, userId] : [orderId];
  const { rows } = await db.query(
    `SELECT o.*, c.title AS course_title FROM orders o JOIN courses c ON c.id = o.course_id
     WHERE o.id = $1 ${condition}`,
    params
  );
  return rows[0] || null;
};

// ─── Admin: all orders ────────────────────────────────────────────

const listOrders = async ({ page = 1, limit = 20, payment_status, from_date, to_date }) => {
  const offset = (page - 1) * limit;
  const params = [];
  const conditions = [];

  if (payment_status) {
    params.push(payment_status);
    conditions.push(`o.payment_status = $${params.length}`);
  }
  if (from_date) {
    params.push(from_date);
    conditions.push(`o.created_at >= $${params.length}`);
  }
  if (to_date) {
    params.push(to_date);
    conditions.push(`o.created_at <= $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(limit, offset);

  const { rows } = await db.query(
    `SELECT o.*, u.name AS user_name, u.email AS user_email, c.title AS course_title
     FROM orders o
     JOIN users u ON u.id = o.user_id
     JOIN courses c ON c.id = o.course_id
     ${where}
     ORDER BY o.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  const { rows: countRows } = await db.query(
    `SELECT COUNT(*) FROM orders o ${where}`,
    params.slice(0, params.length - 2)
  );

  return { orders: rows, total: parseInt(countRows[0].count, 10), page, limit };
};

module.exports = { validateCoupon, createOrder, completeOrder, getOrdersByUser, getOrderById, listOrders };
