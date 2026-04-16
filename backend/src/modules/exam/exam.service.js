'use strict';

/**
 * exam.service.js
 *
 * Manages server-side exam sessions. Answer keys NEVER leave the server.
 *
 * Session lifecycle:
 *   POST /api/exam/start  → creates session, returns questions WITHOUT answers
 *   POST /api/exam/submit → scores answers server-side, returns full results
 *
 * Sessions are held in-memory (Map) and expire after TTL_MS (default 2 h).
 * On process restart sessions are lost — users must start over (acceptable for
 * a stateless exam simulator; upgrade to Redis if persistence is needed).
 */

const fs   = require('fs');
const path = require('path');
const { createError } = require('../../middleware/errorHandler');

// ── Question bank ────────────────────────────────────────────────
// Resolve path: env var → backend/questions.json → fallback to website root
const QUESTIONS_PATH = process.env.QUESTIONS_PATH ||
  path.join(__dirname, '../../../questions.json');  // backend/questions.json
let   _bank          = null;   // lazy-loaded, cached after first read

function getBank() {
  if (_bank) return _bank;
  if (!fs.existsSync(QUESTIONS_PATH)) {
    throw createError(500, 'Question bank file not found: ' + QUESTIONS_PATH);
  }
  try {
    _bank = JSON.parse(fs.readFileSync(QUESTIONS_PATH, 'utf8'));
  } catch (e) {
    throw createError(500, 'Failed to parse question bank: ' + e.message);
  }
  if (!Array.isArray(_bank) || _bank.length === 0) {
    throw createError(500, 'Question bank is empty or malformed');
  }
  return _bank;
}

// ── Session store ────────────────────────────────────────────────
const TTL_MS    = 2 * 60 * 60 * 1000;   // 2 hours
const _sessions = new Map();

// Sweep expired sessions every 30 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, s] of _sessions) {
    if (now - s.createdAt > TTL_MS) _sessions.delete(id);
  }
}, 30 * 60 * 1000).unref();

function _makeSessionId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function _getSession(sessionId) {
  const s = _sessions.get(sessionId);
  if (!s) throw createError(404, 'Exam session not found or expired');
  if (Date.now() - s.createdAt > TTL_MS) {
    _sessions.delete(sessionId);
    throw createError(410, 'Exam session has expired');
  }
  return s;
}

// ── Question helpers ─────────────────────────────────────────────
const LETTERS = ['A', 'B', 'C', 'D'];

function _shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function _pickByCategory(pool, perCategory) {
  const groups = {};
  for (const q of pool) (groups[q.category] = groups[q.category] || []).push(q);
  const picked = [];
  for (const qs of Object.values(groups)) picked.push(..._shuffle(qs).slice(0, perCategory));
  return _shuffle(picked);
}

/** Strip the answer field before sending to client. */
function _sanitise(q) {
  const { answer, ...safe } = q;   // eslint-disable-line no-unused-vars
  return safe;
}

// ── Public service methods ───────────────────────────────────────

/**
 * Start a new exam session.
 * @param {object} opts
 * @param {string}   opts.examType       'mock' | 'pretest'
 * @param {number}   opts.perCategory    Questions per category  (default 10)
 * @param {number[]} [opts.overrideIds]  Specific question IDs for retake mode
 * @returns {{ sessionId, questions, totalTimeSecs, questionCount }}
 */
function startSession({ examType = 'mock', perCategory = 10, overrideIds = null } = {}) {
  const bank = getBank();

  let selected;
  if (overrideIds && Array.isArray(overrideIds) && overrideIds.length > 0) {
    // Retake mode: use only specified question IDs
    const idSet = new Set(overrideIds.map(Number));
    selected = _shuffle(bank.filter(q => idSet.has(Number(q.id))));
  } else {
    selected = _pickByCategory(bank, perCategory);
  }

  if (selected.length === 0) throw createError(500, 'No questions available for this exam type');

  const totalTimeSecs = examType === 'pretest' ? 600 : 3600;   // 10 min | 60 min
  const sessionId     = _makeSessionId();

  _sessions.set(sessionId, {
    sessionId,
    examType,
    questions  : selected,       // full objects including answer key — server only
    createdAt  : Date.now(),
    submittedAt: null,
    results    : null,
  });

  return {
    sessionId,
    totalTimeSecs,
    questionCount: selected.length,
    questions    : selected.map(_sanitise),   // no answer field
  };
}

/**
 * Submit answers and score the exam.
 * @param {string} sessionId
 * @param {object} answers  { "0": "A", "3": "C", ... }  index → letter
 * @param {number} [userId] Optional — persists score via progress service if provided
 * @returns ResultObject
 */
function submitExam(sessionId, answers = {}, userId = null) {
  const session = _getSession(sessionId);

  if (session.submittedAt) {
    // Idempotent: return cached results on re-submit
    return session.results;
  }

  const { questions } = session;
  let correct = 0, wrong = 0, skip = 0;
  const catStats = {};
  const review   = [];

  questions.forEach((q, i) => {
    const ua  = answers[String(i)];
    const cat = q.category;
    if (!catStats[cat]) catStats[cat] = { correct: 0, total: 0 };
    catStats[cat].total++;

    if (!ua) {
      skip++;
      review.push({ index: i, questionId: q.id, category: cat,
        question: q.question, userAnswer: null, correctAnswer: q.answer,
        correctText: q.options[LETTERS.indexOf(q.answer)] || '',
        explanation: q.explanation || '' });
    } else if (ua === q.answer) {
      correct++;
      catStats[cat].correct++;
    } else {
      wrong++;
      review.push({ index: i, questionId: q.id, category: cat,
        question: q.question, userAnswer: ua, correctAnswer: q.answer,
        userText   : q.options[LETTERS.indexOf(ua)]      || '',
        correctText: q.options[LETTERS.indexOf(q.answer)] || '',
        explanation: q.explanation || '' });
    }
  });

  const total   = questions.length;
  const pct     = total > 0 ? Math.round(correct / total * 100) : 0;
  const passed  = (correct / total) >= 0.7;
  const wrongQs = questions.filter((_, i) => answers[String(i)] !== questions[i].answer);

  const results = {
    sessionId,
    correct, wrong, skip, total, pct, passed,
    catStats,
    review,
    wrongQuestionIds: wrongQs.map(q => q.id),
    feedback: pct >= 80 ? '🎉 ยอดเยี่ยม! พร้อมสอบมากแล้ว'
            : pct >= 60 ? '👍 ดี! ทบทวนจุดอ่อนเพิ่มเติม'
            :              '💪 ฝึกต่อไป! ยิ่งทำยิ่งเก่งขึ้น',
  };

  session.submittedAt = Date.now();
  session.results     = results;

  return results;
}

/**
 * Build a retake session from wrong question IDs of a previous session.
 */
function retakeWrong(sessionId) {
  const session = _getSession(sessionId);
  if (!session.results) throw createError(400, 'Exam not submitted yet');
  const ids = session.results.wrongQuestionIds;
  if (!ids || ids.length === 0) throw createError(400, 'No wrong questions to retake');
  return startSession({ examType: session.examType, overrideIds: ids });
}

module.exports = { startSession, submitExam, retakeWrong };
