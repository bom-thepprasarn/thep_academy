/**
 * session-recovery.js — localStorage checkpoint for exam sessions
 * Saves exam state every N questions so the user can resume after a refresh.
 *
 * Usage:
 *   SessionRecovery.save(state);   // call after each answer
 *   const state = SessionRecovery.load(); // returns null if none / expired
 *   SessionRecovery.clear();
 *   SessionRecovery.hasSession();  // quick boolean check
 */
"use strict";

const SessionRecovery = (() => {

  const STORAGE_KEY  = 'thep_exam_checkpoint';
  const TTL_MS       = 2 * 60 * 60 * 1000; // 2 hours

  /**
   * Save the current exam state.
   * @param {object} state - Plain object that can be JSON-serialised.
   *   Recommended fields: { sessionId, examType, answers, cur, secsLeft, session }
   */
  function save(state) {
    try {
      const payload = Object.assign({}, state, { _savedAt: Date.now() });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {
      // Storage full or private-mode restriction — fail silently
      console.warn('[SessionRecovery] save failed:', e.message);
    }
  }

  /**
   * Load a saved checkpoint.
   * @returns {object|null} Saved state, or null if expired / missing / corrupt.
   */
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;

      const state = JSON.parse(raw);

      // Expire check
      if (!state._savedAt || (Date.now() - state._savedAt) > TTL_MS) {
        clear();
        return null;
      }

      return state;
    } catch (e) {
      console.warn('[SessionRecovery] load failed:', e.message);
      return null;
    }
  }

  /** Remove saved checkpoint. */
  function clear() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
  }

  /** @returns {boolean} True if a valid (non-expired) checkpoint exists. */
  function hasSession() {
    return load() !== null;
  }

  /**
   * Ask the user if they want to resume, then load or clear.
   * Returns the saved state if they confirm, null otherwise.
   * @param {string} [promptMsg] Custom confirm message.
   */
  function promptResume(promptMsg) {
    const saved = load();
    if (!saved) return null;

    const answered = Object.keys(saved.answers || {}).length;
    const total    = (saved.session || []).length;
    const msg      = promptMsg ||
      `พบข้อสอบที่ค้างอยู่ (ตอบไปแล้ว ${answered}/${total} ข้อ)\nต้องการทำต่อจากที่ค้างไว้ไหม?`;

    if (window.confirm(msg)) return saved;
    clear();
    return null;
  }

  return { save, load, clear, hasSession, promptResume };

})();
