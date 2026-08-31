/**
 * GooseFocus - Multi-Mode Precision Focus Timer Engine
 * Supports Pomodoro, Stopwatch/Deep Work, and Target Goal with timestamp delta calculations.
 */

import { soundEngine } from './audio.js';
import { store } from './storage.js';

export class FocusTimer {
  constructor(onCompleteCallback, onTickCallback) {
    this.onComplete = onCompleteCallback;
    this.onTick = onTickCallback;

    this.mode = 'stopwatch'; // Default: Continuous Focus Hours Accumulator
    this.pomoPhase = 'work';
    this.activeTag = 'coding';
    this.targetMinutes = 30;

    this.isRunning = false;
    this.totalDurationSec = 0;
    this.remainingSec = 0;
    this.elapsedSec = 0;

    this.startTimestamp = null;
    this.lastTickTimestamp = null;
    this.intervalId = null;

    this.pomoCycleCount = 1;

    // Idle / AFK Activity Tracking (Mouse stillness detection)
    this.lastActivityTimestamp = Date.now();
    this.isIdlePaused = false;
    this.setupActivityTracking();

    // DOM Elements
    this.digitsDisplay = document.getElementById('timerTimeDisplay');
    this.actionBtn = document.getElementById('timerMainActionBtn');
    this.actionIcon = document.getElementById('mainActionIcon');
    this.actionText = document.getElementById('mainActionText');

    this.initFromSettings();
  }

  initFromSettings() {
    this.elapsedSec = 0;
    this.updateDisplay();
  }

  setMode(newMode) {
    if (this.isRunning) this.pause();
    this.mode = newMode;
    if (this.mode === 'stopwatch') {
      this.elapsedSec = 0;
    } else if (this.mode === 'target') {
      this.totalDurationSec = this.targetMinutes * 60;
      this.remainingSec = this.totalDurationSec;
    } else {
      this.setPomodoroPhase(this.pomoPhase);
    }
    this.updateDisplay();
  }

  setPomodoroPhase(phase) {
    if (this.isRunning) this.pause();
    this.pomoPhase = phase;
    const state = store.get();
    if (phase === 'work') {
      this.totalDurationSec = (state.settings.pomoWork || 25) * 60;
    } else if (phase === 'shortBreak') {
      this.totalDurationSec = (state.settings.pomoShort || 5) * 60;
    } else if (phase === 'longBreak') {
      this.totalDurationSec = (state.settings.pomoLong || 15) * 60;
    }
    this.remainingSec = this.totalDurationSec;
    this.updateDisplay();
  }

  setTargetMinutes(minutes) {
    if (this.isRunning) this.pause();
    this.targetMinutes = minutes;
    this.totalDurationSec = minutes * 60;
    this.remainingSec = this.totalDurationSec;
    this.updateDisplay();
  }

  setTag(tag) {
    this.activeTag = tag;
  }

  toggle() {
    if (this.isRunning) {
      this.pause();
    } else {
      this.start();
    }
  }

  setupActivityTracking() {
    const markActive = () => {
      this.lastActivityTimestamp = Date.now();
    };

    window.addEventListener('mousemove', markActive, { passive: true });
    window.addEventListener('pointermove', markActive, { passive: true });
    window.addEventListener('keydown', markActive, { passive: true });
    window.addEventListener('touchstart', markActive, { passive: true });
    window.addEventListener('scroll', markActive, { passive: true });
    window.addEventListener('click', markActive, { passive: true });
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.isIdlePaused = false;
    this.lastActivityTimestamp = Date.now();
    this.startTimestamp = Date.now();
    this.lastTickTimestamp = this.startTimestamp;

    soundEngine.playClick();
    this.updateButtonState(true);

    this.intervalId = setInterval(() => {
      this.tick();
    }, 100);
  }

  pause() {
    if (!this.isRunning) return;
    this.isRunning = false;
    clearInterval(this.intervalId);
    this.intervalId = null;

    soundEngine.playClick();
    this.updateButtonState(false);
  }

  resumeFromIdle() {
    this.lastActivityTimestamp = Date.now();
    this.isIdlePaused = false;
    const idleModal = document.getElementById('idleModal');
    if (idleModal) idleModal.classList.add('hidden');
    this.start();
  }

  handleIdleTimeout() {
    this.pause();
    this.isIdlePaused = true;
    soundEngine.playHonk(0.85);

    const idleModal = document.getElementById('idleModal');
    const idleDesc = document.getElementById('idleModalDesc');
    if (idleDesc) {
      idleDesc.textContent = 'ตรวจพบเมาส์และหน้าจอไม่ขยับเกิน 10 นาที ระบบหยุดนับเวลาชั่วคราวให้คุณเรียบร้อยแล้ว';
    }
    if (idleModal) {
      idleModal.classList.remove('hidden');
    }

    const state = store.get();
    if (state.settings.desktopNotify && 'Notification' in window && Notification.permission === 'granted') {
      new Notification('GooseFocus 🪿💤', {
        body: 'เมาส์ไม่ขยับเกิน 10 นาที ระบบหยุดเวลาชั่วคราวให้คุณแล้ว',
        icon: 'assets/favicon.svg'
      });
    }
  }

  reset() {
    this.pause();
    this.isIdlePaused = false;
    this.initFromSettings();
  }

  skip() {
    if (this.mode === 'pomodoro') {
      if (this.pomoPhase === 'work') {
        this.pomoCycleCount++;
        if (this.pomoCycleCount > 4) {
          this.pomoCycleCount = 1;
          this.setPomodoroPhase('longBreak');
        } else {
          this.setPomodoroPhase('shortBreak');
        }
      } else {
        this.setPomodoroPhase('work');
      }
      if (this.pomoCycleEl) {
        this.pomoCycleEl.textContent = this.pomoCycleCount;
      }
    } else {
      this.reset();
    }
  }

  tick() {
    const now = Date.now();

    // Permanent 10-minute AFK Idle Timeout Rule (Fair for Leaderboard competition)
    if (this.isRunning) {
      const idleLimitMs = 10 * 60 * 1000; // 10 minutes fixed
      const idleElapsedMs = now - this.lastActivityTimestamp;
      if (idleElapsedMs >= idleLimitMs) {
        this.handleIdleTimeout();
        return;
      }
    }

    const deltaMs = now - this.lastTickTimestamp;
    this.lastTickTimestamp = now;

    if (this.mode === 'stopwatch') {
      this.elapsedSec += deltaMs / 1000;
      this.updateDisplay();
      if (this.onTick) this.onTick(this.elapsedSec, 0);
    } else {
      this.remainingSec -= deltaMs / 1000;
      if (this.remainingSec <= 0) {
        this.remainingSec = 0;
        this.updateDisplay();
        this.finishSession();
        return;
      }
      this.updateDisplay();
      if (this.onTick) this.onTick(this.remainingSec, this.totalDurationSec);
    }
  }

  updateDisplay() {
    const secondsToShow = Math.floor(this.elapsedSec);
    const hrs = Math.floor(secondsToShow / 3600);
    const mins = Math.floor((secondsToShow % 3600) / 60);
    const secs = secondsToShow % 60;
    const timeStr = `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    if (this.digitsDisplay) {
      this.digitsDisplay.textContent = timeStr;
    }

    // Title bar update
    document.title = this.isRunning ? `(${timeStr}) GooseFocus 🪿` : `GooseFocus 🪿🌾 — ฟาร์มห่านสะสมชั่วโมง`;
  }

  updateHatchingMascot(ratio) {
    if (this.mode === 'pomodoro' && this.pomoPhase !== 'work') {
      if (this.mascotEmoji) this.mascotEmoji.textContent = '☕';
      if (this.hatchBadge) this.hatchBadge.textContent = '☕ กำลังพักผ่อน...';
      return;
    }

    if (ratio < 0.25) {
      if (this.mascotEmoji) this.mascotEmoji.textContent = '🥚';
      if (this.hatchBadge) this.hatchBadge.textContent = '🥚 ไข่กำลังบ่ม...';
    } else if (ratio < 0.55) {
      if (this.mascotEmoji) this.mascotEmoji.textContent = '🐣';
      if (this.hatchBadge) this.hatchBadge.textContent = '🐣 เปลือกไข่เริ่มร้าว!';
    } else if (ratio < 0.85) {
      if (this.mascotEmoji) this.mascotEmoji.textContent = '🐥';
      if (this.hatchBadge) this.hatchBadge.textContent = '🐥 ลูกห่านชะโงกหน้า!';
    } else {
      if (this.mascotEmoji) this.mascotEmoji.textContent = '🪿';
      if (this.hatchBadge) this.hatchBadge.textContent = '🪿 ห่านพร้อมบิน!';
    }
  }

  updateButtonState(running) {
    if (!this.actionBtn) return;
    if (running) {
      this.actionBtn.classList.add('running');
      if (this.actionIcon) this.actionIcon.textContent = '⏸';
      if (this.actionText) this.actionText.textContent = 'พักชั่วคราว (Pause)';
      
      const zenAction = document.getElementById('zenActionBtn');
      if (zenAction) zenAction.textContent = '⏸️ พักชั่วคราว';
    } else {
      this.actionBtn.classList.remove('running');
      if (this.actionIcon) this.actionIcon.textContent = '▶';
      if (this.actionText) this.actionText.textContent = 'เริ่มโฟกัส (Start)';

      const zenAction = document.getElementById('zenActionBtn');
      if (zenAction) zenAction.textContent = '▶️ ลุยต่อ (Resume)';
    }
  }

  finishSession() {
    this.pause();
    soundEngine.playFanfare();
    soundEngine.playHonk(1.2);

    let durationMins = 0;
    if (this.mode === 'stopwatch') {
      durationMins = Math.max(1, Math.round(this.elapsedSec / 60));
    } else {
      durationMins = Math.round(this.totalDurationSec / 60);
    }

    const feathers = Math.max(5, Math.round(durationMins * 0.6));
    const exp = Math.max(15, durationMins * 2);

    const sessionData = {
      id: 'sess_' + Date.now(),
      timestamp: new Date().toISOString(),
      tag: this.activeTag,
      durationMinutes: durationMins,
      feathersEarned: feathers,
      expEarned: exp,
      mode: this.mode
    };

    if (this.onComplete) {
      this.onComplete(sessionData);
    }

    // Auto advance pomodoro
    if (this.mode === 'pomodoro') {
      this.skip();
    } else {
      this.reset();
    }
  }
}
