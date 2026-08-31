/**
 * GooseFocus - Storage & State Management Module
 * Handles persistence with LocalStorage, backup/restore JSON, and state reactivity.
 */

const STORAGE_KEY = 'goosefocus_state_v2';

// Default initial state
const defaultState = {
  farmer: {
    name: 'Farmer You',
    level: 1,
    exp: 0,
    tierIndex: 0, // 0 to 5
    totalFocusSeconds: 0,
    feathers: 50, // Starting Golden Feathers
    streakDays: 1,
    lastActiveDate: new Date().toISOString().split('T')[0],
  },
  activeGoose: {
    name: 'Honky',
    title: 'ห่านฝึกหัด (Trainee Goose)',
    hat: 'straw_hat',
    glasses: 'none',
    skin: 'classic_white',
  },
  geeseList: [
    { id: 'goose_1', name: 'Honky', stage: 'adult', hat: 'straw_hat', glasses: 'none', skin: 'classic_white', hatchedAt: new Date().toISOString() },
    { id: 'goose_2', name: 'Chonky', stage: 'gosling', hat: 'none', glasses: 'none', skin: 'classic_white', hatchedAt: new Date().toISOString() },
    { id: 'goose_3', name: 'Pip', stage: 'egg', progress: 40, hat: 'none', glasses: 'none', skin: 'classic_white' }
  ],
  inventory: {
    hats: ['none', 'straw_hat'],
    glasses: ['none'],
    skins: ['classic_white'],
    decor: ['flower_bed']
  },
  activeDecor: ['flower_bed'],
  settings: {
    pomoWork: 25,
    pomoShort: 5,
    pomoLong: 15,
    soundEnabled: true,
    desktopNotify: true,
    idleDetectionEnabled: true,
    idleTimeoutMinutes: 10,
    theme: 'day',
    ambience: {
      rain: 0,
      pond: 0,
      crickets: 0,
      whitenoise: 0
    }
  },
  unlockedAchievements: ['first_honk', 'starter_farmer'],
  sessionsHistory: [], // Array of { id, timestamp, tag, durationMinutes, feathersEarned, expEarned, mode }
  customTags: []
};

class StateStore {
  constructor() {
    this.state = this.load();
    this.listeners = [];
  }

  load() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        return this.mergeWithDefault(parsed, defaultState);
      }
    } catch (e) {
      console.error('Failed to load state from localStorage:', e);
    }
    return JSON.parse(JSON.stringify(defaultState));
  }

  mergeWithDefault(saved, def) {
    const merged = { ...def, ...saved };
    merged.farmer = { ...def.farmer, ...(saved.farmer || {}) };
    merged.activeGoose = { ...def.activeGoose, ...(saved.activeGoose || {}) };
    merged.inventory = { ...def.inventory, ...(saved.inventory || {}) };
    merged.settings = { ...def.settings, ...(saved.settings || {}) };
    return merged;
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      this.notify();
    } catch (e) {
      console.error('Failed to save state to localStorage:', e);
    }
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notify() {
    this.listeners.forEach(fn => fn(this.state));
  }

  get() {
    return this.state;
  }

  update(fn) {
    fn(this.state);
    this.save();
  }

  addSessionLog(session) {
    this.update(s => {
      s.sessionsHistory.unshift(session);
      
      // Update totals
      const focusSeconds = (session.durationMinutes || 0) * 60;
      s.farmer.totalFocusSeconds += focusSeconds;
      s.farmer.feathers += (session.feathersEarned || 0);
      s.farmer.exp += (session.expEarned || 0);

      // Check level up (every 100 EXP = 1 Level)
      s.farmer.level = Math.floor(s.farmer.exp / 100) + 1;

      // Update hatching progress for incubating eggs
      s.geeseList.forEach(g => {
        if (g.stage === 'egg') {
          g.progress = (g.progress || 0) + Math.min(50, Math.floor(session.durationMinutes * 1.5));
          if (g.progress >= 100) {
            g.stage = 'gosling';
            g.hatchedAt = new Date().toISOString();
          }
        }
      });

      // Update streak
      const today = new Date().toISOString().split('T')[0];
      const lastDate = s.farmer.lastActiveDate;
      if (lastDate !== today) {
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
        if (lastDate === yesterday) {
          s.farmer.streakDays += 1;
        } else {
          s.farmer.streakDays = 1;
        }
        s.farmer.lastActiveDate = today;
      }
    });
  }

  exportJSON() {
    return JSON.stringify(this.state, null, 2);
  }

  importJSON(jsonStr) {
    try {
      const parsed = JSON.parse(jsonStr);
      this.state = this.mergeWithDefault(parsed, defaultState);
      this.save();
      return true;
    } catch (e) {
      console.error('Import failed:', e);
      return false;
    }
  }

  reset() {
    this.state = JSON.parse(JSON.stringify(defaultState));
    this.save();
  }
}

export const store = new StateStore();
