/**
 * exam-engine.js — Core exam logic for Thep Academy Exam Simulator
 *
 * Two operating modes (set ExamEngine.mode before calling init()):
 *   'local' (default) — loads questions.json client-side (existing behaviour, zero breaking change)
 *   'api'             — fetches from /api/exam/* (backend-driven, answers never sent to client)
 *
 * Depends on:  exam-timer.js, session-recovery.js  (must be loaded first)
 *
 * Public API:
 *   ExamEngine.configure(opts)   — set mode, API base URL, exam type, etc.
 *   ExamEngine.init()            — load questions + check for saved session
 *   ExamEngine.startSession(override?) — begin exam (pass wrong-question array to retake)
 *   ExamEngine.goTo(index)       — navigate to question index
 *   ExamEngine.selectAnswer(letter) — record answer for current question
 *   ExamEngine.submit()          — score and return results object
 *   ExamEngine.getState()        — snapshot of current state (for external UI)
 *
 * The engine fires DOM CustomEvents so the HTML file can stay mostly untouched:
 *   'exam:ready'     — questions loaded, start button can be enabled
 *   'exam:question'  — navigate to a question  { detail: { q, cur, total, answered, secsLeft } }
 *   'exam:answered'  — answer recorded         { detail: { cur, answer } }
 *   'exam:results'   — exam submitted          { detail: ResultObject }
 *   'exam:error'     — something went wrong    { detail: { message } }
 */
"use strict";

const ExamEngine = (() => {

  // ── Config ──────────────────────────────────────────────────────
  let cfg = {
    mode            : 'local',          // 'local' | 'api'
    localDataUrl: "/assets/data/questions.json"', // used in local mode
    apiBase         : '/api/exam',      // used in api mode
    examType        : 'mock',           // 'mock' | 'pretest'
    questionCount   : 50,               // total questions per session
    perCategory     : 10,               // questions per category (local mode)
    totalTimeSecs   : 3600,             // 60 min default
    urgentThreshold : 300,              // 5 min warning
    saveEveryN      : 5,                // checkpoint after every N answers
    passThreshold   : 0.7,
    scoreColors     : { good: 0.8, fair: 0.6 },
  };

  // ── Private state ────────────────────────────────────────────────
  let _bank      = [];          // full question bank (local mode)
  let _session   = [];          // active question list (no answers in api mode)
  let _answers   = {};          // { questionIndex: 'A'|'B'|'C'|'D' }
  let _cur       = 0;
  let _sessionId = null;        // api mode: server session token
  let _timer     = null;
  let _running   = false;

  const LETTERS = ['A', 'B', 'C', 'D'];

  // ── Public: configure ────────────────────────────────────────────
  function configure(opts = {}) {
    cfg = Object.assign({}, cfg, opts);
  }

  // ── Public: init ─────────────────────────────────────────────────
  async function init() {
    try {
      if (cfg.mode === 'api') {
        // API mode: just signal ready — questions fetched on start
        _emit('exam:ready', { mode: 'api' });
      } else {
        // Local mode: fetch JSON bank
        const res  = await fetch(cfg.localDataUrl);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        _bank = await res.json();
        _validateBank(_bank);
        _emit('exam:ready', { mode: 'local', total: _bank.length });
      }
    } catch (e) {
      _emit('exam:error', { message: 'โหลดข้อสอบไม่สำเร็จ: ' + e.message });
      throw e;
    }
  }

  // ── Public: startSession ─────────────────────────────────────────
  /**
   * @param {Array|null} override  Pass array of question objects to retake specific questions.
   */
  async function startSession(override = null) {
    _answers   = {};
    _cur       = 0;
    _running   = true;
    SessionRecovery.clear();

    // Check for saved session first (only on a fresh start, not retake)
    if (!override) {
      const saved = SessionRecovery.promptResume();
      if (saved) {
        return _restoreSession(saved);
      }
    }

    try {
      if (cfg.mode === 'api') {
        await _startApiSession(override);
      } else {
        _startLocalSession(override);
      }
    } catch (e) {
      _running = false;
      _emit('exam:error', { message: 'เริ่มข้อสอบไม่สำเร็จ: ' + e.message });
      throw e;
    }
  }

  // ── Public: navigate ─────────────────────────────────────────────
  function goTo(index) {
    if (!_running) return;
    const clamped = Math.max(0, Math.min(index, _session.length - 1));
    _cur = clamped;
    _emitQuestion();
  }

  function next() { goTo(_cur + 1); }
  function prev() { goTo(_cur - 1); }

  // ── Public: selectAnswer ─────────────────────────────────────────
  function selectAnswer(letter) {
    if (!_running) return;
    if (!LETTERS.includes(letter)) return;

    _answers[_cur] = letter;
    _emit('exam:answered', { cur: _cur, answer: letter });

    // Checkpoint every N answers
    const count = Object.keys(_answers).length;
    if (count % cfg.saveEveryN === 0) _checkpoint();
  }

  // ── Public: submit ───────────────────────────────────────────────
  async function submit() {
    if (!_running) return;
    _running = false;
    if (_timer) _timer.stop();
    SessionRecovery.clear();

    try {
      let results;
      if (cfg.mode === 'api') {
        results = await _submitToApi();
      } else {
        results = _scoreLocally();
      }
      _emit('exam:results', results);
      return results;
    } catch (e) {
      _running = true; // allow retry
      _emit('exam:error', { message: 'ส่งข้อสอบไม่สำเร็จ: ' + e.message });
      throw e;
    }
  }

  // ── Public: getState ─────────────────────────────────────────────
  function getState() {
    return {
      mode      : cfg.mode,
      cur       : _cur,
      total     : _session.length,
      answered  : Object.keys(_answers).length,
      answers   : Object.assign({}, _answers),
      secsLeft  : _timer ? _timer.getSecsLeft() : cfg.totalTimeSecs,
      running   : _running,
      sessionId : _sessionId,
    };
  }

  // ── Local mode internals ─────────────────────────────────────────
  function _startLocalSession(override) {
    _session = override ? _shuffle(override) : _pickQuestions(_bank, cfg.perCategory);
    _startTimer();
    _emitQuestion();
  }

  function _pickQuestions(pool, n) {
    const groups = {};
    for (const q of pool) (groups[q.category] = groups[q.category] || []).push(q);
    const picked = [];
    for (const qs of Object.values(groups)) picked.push(..._shuffle(qs).slice(0, n));
    return _shuffle(picked);
  }

  function _scoreLocally() {
    let correct = 0, wrong = 0, skip = 0;
    const catStats = {};
    const review   = [];

    _session.forEach((q, i) => {
      const ua  = _answers[i];
      const cat = q.category;
      if (!catStats[cat]) catStats[cat] = { correct: 0, total: 0 };
      catStats[cat].total++;

      if (!ua) {
        skip++;
        review.push({ index: i, q, userAnswer: null, correct: q.answer });
      } else if (ua === q.answer) {
        correct++;
        catStats[cat].correct++;
      } else {
        wrong++;
        review.push({ index: i, q, userAnswer: ua, correct: q.answer });
      }
    });

    const total = _session.length;
    const pct   = total > 0 ? Math.round(correct / total * 100) : 0;

    return {
      correct, wrong, skip, total, pct,
      catStats,
      review,
      passed   : (correct / total) >= cfg.passThreshold,
      feedback : _feedback(pct),
      wrongQuestions: _session.filter((_, i) => _answers[i] !== _session[i].answer),
    };
  }

  // ── API mode internals ───────────────────────────────────────────
  async function _startApiSession(override) {
    const body = {
      examType      : cfg.examType,
      questionCount : cfg.questionCount,
      perCategory   : cfg.perCategory,
    };
    if (override) body.overrideIds = override.map(q => q.id);

    const data = await _apiFetch('POST', '/start', body);
    _sessionId        = data.sessionId;
    _session          = data.questions;   // [{id, category, question, options, passage?}] NO answers
    cfg.totalTimeSecs = data.totalTimeSecs || cfg.totalTimeSecs;

    _startTimer();
    _emitQuestion();
  }

  async function _submitToApi() {
    const data = await _apiFetch('POST', '/submit', {
      sessionId : _sessionId,
      answers   : _answers,   // { "0": "A", "1": "C", ... }
    });
    // Server returns scored results — same shape as _scoreLocally()
    return data;
  }

  async function _apiFetch(method, path, body) {
    const res = await fetch(cfg.apiBase + path, {
      method,
      headers  : { 'Content-Type': 'application/json' },
      credentials: 'include',
      body     : body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'API error ' + res.status);
    return json.data || json;
  }

  // ── Timer ────────────────────────────────────────────────────────
  function _startTimer(resumeFrom = null) {
    if (_timer) _timer.stop();

    _timer = new ExamTimer({
      duration         : cfg.totalTimeSecs,
      urgentThreshold  : cfg.urgentThreshold,
      onTick(secsLeft, formatted, isUrgent) {
        // Update timer display
        const el = document.getElementById('timer');
        if (el) {
          el.textContent = formatted;
          el.classList.toggle('urgent', isUrgent);
        }
        // Checkpoint every minute
        if (secsLeft > 0 && secsLeft % 60 === 0) _checkpoint();
      },
      onExpire() {
        alert('⏰ หมดเวลา! ระบบส่งข้อสอบให้อัตโนมัติ');
        submit();
      },
    });

    _timer.start(resumeFrom);
  }

  // ── Session restore ──────────────────────────────────────────────
  function _restoreSession(saved) {
    _session   = saved.session   || [];
    _answers   = saved.answers   || {};
    _cur       = saved.cur       || 0;
    _sessionId = saved.sessionId || null;
    _running   = true;

    const secsLeft = saved.secsLeft;
    _startTimer(secsLeft);
    _emitQuestion();
  }

  // ── Checkpoint ───────────────────────────────────────────────────
  function _checkpoint() {
    SessionRecovery.save({
      session   : _session,
      answers   : _answers,
      cur       : _cur,
      sessionId : _sessionId,
      secsLeft  : _timer ? _timer.getSecsLeft() : cfg.totalTimeSecs,
      examType  : cfg.examType,
    });
  }

  // ── Helpers ──────────────────────────────────────────────────────
  function _shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function _feedback(pct) {
    if (pct >= cfg.scoreColors.good * 100) return '🎉 ยอดเยี่ยม! พร้อมสอบมากแล้ว';
    if (pct >= cfg.scoreColors.fair * 100) return '👍 ดี! ทบทวนจุดอ่อนเพิ่มเติม';
    return '💪 ฝึกต่อไป! ยิ่งทำยิ่งเก่งขึ้น';
  }

  function _validateBank(bank) {
    if (!Array.isArray(bank) || bank.length === 0) throw new Error('Question bank is empty');
    const required = ['id', 'category', 'question', 'options', 'answer'];
    const sample   = bank[0];
    for (const f of required) {
      if (!(f in sample)) throw new Error('Question missing field: ' + f);
    }
  }

  function _emitQuestion() {
    const q = _session[_cur];
    if (!q) return;
    _emit('exam:question', {
      q,
      cur      : _cur,
      total    : _session.length,
      answered : Object.keys(_answers).length,
      selected : _answers[_cur] || null,
      secsLeft : _timer ? _timer.getSecsLeft() : cfg.totalTimeSecs,
      isFirst  : _cur === 0,
      isLast   : _cur === _session.length - 1,
    });
  }

  function _emit(eventName, detail) {
    document.dispatchEvent(new CustomEvent(eventName, { detail }));
  }

  // ── Expose public API ────────────────────────────────────────────
  return { configure, init, startSession, goTo, next, prev, selectAnswer, submit, getState };

})();
