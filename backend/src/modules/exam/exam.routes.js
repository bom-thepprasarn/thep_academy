'use strict';

/**
 * exam.routes.js
 *
 * Mount at:  app.use('/api/exam', examRoutes)
 *
 * Endpoints
 * ─────────────────────────────────────────────────────────────────
 * POST /api/exam/start
 *   Body: { examType?, perCategory?, overrideIds? }
 *   → { sessionId, questions (no answers), totalTimeSecs, questionCount }
 *
 * POST /api/exam/submit
 *   Body: { sessionId, answers: { "0": "A", "1": "C", ... } }
 *   → full ResultObject (correct, wrong, skip, pct, catStats, review …)
 *
 * POST /api/exam/retake
 *   Body: { sessionId }   ← sessionId of a COMPLETED exam
 *   → same shape as /start, pre-loaded with wrong questions only
 *
 * Auth: all endpoints are PUBLIC (no requireAuth).
 *   Rationale: free mock exams don't require login.
 *   To gate behind auth, add `requireAuth` to any route below.
 */

const router = require('express').Router();
const { body, validationResult } = require('express-validator');
const { asyncHandler, createError } = require('../../middleware/errorHandler');
const svc = require('./exam.service');

// ── Validation helper ────────────────────────────────────────────
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, errors: errors.array() });
  }
  next();
}

// ── POST /api/exam/start ─────────────────────────────────────────
router.post(
  '/start',
  [
    body('examType')
      .optional()
      .isIn(['mock', 'pretest'])
      .withMessage('examType must be "mock" or "pretest"'),
    body('perCategory')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('perCategory must be between 1 and 50'),
    body('overrideIds')
      .optional()
      .isArray({ min: 1 })
      .withMessage('overrideIds must be a non-empty array'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { examType, perCategory, overrideIds } = req.body;
    const result = svc.startSession({ examType, perCategory, overrideIds });
    res.status(201).json({ success: true, data: result });
  })
);

// ── POST /api/exam/submit ────────────────────────────────────────
router.post(
  '/submit',
  [
    body('sessionId')
      .isString()
      .notEmpty()
      .withMessage('sessionId is required'),
    body('answers')
      .isObject()
      .withMessage('answers must be an object { "0": "A", ... }'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { sessionId, answers } = req.body;

    // Basic sanity: answer values must be A–D or absent
    const VALID = new Set(['A', 'B', 'C', 'D']);
    for (const [k, v] of Object.entries(answers)) {
      if (isNaN(Number(k))) throw createError(422, `Invalid answer key: ${k}`);
      if (!VALID.has(v))    throw createError(422, `Invalid answer value for key ${k}: ${v}`);
    }

    const results = svc.submitExam(sessionId, answers, req.user?.id);
    res.json({ success: true, data: results });
  })
);

// ── POST /api/exam/retake ────────────────────────────────────────
router.post(
  '/retake',
  [
    body('sessionId')
      .isString()
      .notEmpty()
      .withMessage('sessionId is required'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const result = svc.retakeWrong(req.body.sessionId);
    res.status(201).json({ success: true, data: result });
  })
);

module.exports = router;
