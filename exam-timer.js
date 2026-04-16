/**
 * exam-timer.js — Reusable countdown timer for Thep Academy exam simulator
 * Usage:
 *   const timer = new ExamTimer({ duration: 3600, onTick, onExpire });
 *   timer.start();          // fresh start
 *   timer.start(savedSecs); // resume from saved checkpoint
 *   timer.stop();
 *   timer.getSecsLeft();
 */
"use strict";

class ExamTimer {
  /**
   * @param {object} opts
   * @param {number}   opts.duration         Total seconds (e.g. 3600 = 60 min)
   * @param {function} opts.onTick           Called every second: (secsLeft, formatted, isUrgent)
   * @param {function} opts.onExpire         Called when timer reaches 0
   * @param {number}  [opts.urgentThreshold] Seconds left before "urgent" flag (default 300 = 5 min)
   */
  constructor({ duration, onTick, onExpire, urgentThreshold = 300 }) {
    if (typeof duration !== 'number' || duration <= 0) throw new Error('ExamTimer: duration must be a positive number');
    if (typeof onTick !== 'function')   throw new Error('ExamTimer: onTick must be a function');
    if (typeof onExpire !== 'function') throw new Error('ExamTimer: onExpire must be a function');

    this.duration          = duration;
    this.secsLeft          = duration;
    this.onTick            = onTick;
    this.onExpire          = onExpire;
    this.urgentThreshold   = urgentThreshold;
    this._intervalId       = null;
    this._running          = false;
  }

  /** Start (or resume from a saved checkpoint). */
  start(resumeFromSecs = null) {
    if (this._running) this.stop(); // prevent double-start

    if (resumeFromSecs !== null && Number.isFinite(resumeFromSecs)) {
      this.secsLeft = Math.max(0, resumeFromSecs);
    }

    if (this.secsLeft <= 0) { this.onExpire(); return; }

    this._running = true;
    // Fire immediately so UI shows correct value before first tick
    this._emit();

    this._intervalId = setInterval(() => {
      this.secsLeft = Math.max(0, this.secsLeft - 1);
      this._emit();
      if (this.secsLeft <= 0) {
        this.stop();
        this.onExpire();
      }
    }, 1000);
  }

  /** Stop (pause) the timer without resetting. */
  stop() {
    clearInterval(this._intervalId);
    this._intervalId = null;
    this._running    = false;
  }

  /** Stop and reset to original duration. */
  reset() {
    this.stop();
    this.secsLeft = this.duration;
  }

  /** @returns {number} Seconds remaining. */
  getSecsLeft() { return this.secsLeft; }

  /** @returns {boolean} */
  isRunning() { return this._running; }

  // ── private ──────────────────────────────────────────────────────
  _emit() {
    const isUrgent  = this.secsLeft <= this.urgentThreshold;
    const formatted = this._format(this.secsLeft);
    this.onTick(this.secsLeft, formatted, isUrgent);
  }

  _format(secs) {
    const m = String(Math.floor(secs / 60)).padStart(2, '0');
    const s = String(secs % 60).padStart(2, '0');
    return m + ':' + s;
  }
}
