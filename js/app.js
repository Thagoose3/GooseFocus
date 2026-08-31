/**
 * GooseFocus - Application Entry Point & Controller
 * Orchestrates Fullscreen Farm Canvas, Streamlined Focus Timer, Modals (Ranking, Analytics, Audio, Settings)
 */

import { store } from './storage.js';
import { soundEngine } from './audio.js';
import { FarmSimulator } from './farm.js';
import { FocusTimer } from './timer.js';
import { rankingManager } from './ranking.js';
import { analyticsManager } from './analytics.js';

class AppController {
  constructor() {
    this.timer = null;
    this.farm = null;
    this.currentTheme = 'day';

    document.addEventListener('DOMContentLoaded', () => this.init());
  }

  init() {
    console.log('🪿 Initializing GooseFocus Full-Screen Farm...');

    // 1. Initialize Subsystems
    this.farm = new FarmSimulator('farmCanvas');

    this.timer = new FocusTimer(
      (sessionData) => this.handleSessionCompleted(sessionData),
      (currentSec, totalSec) => this.handleTimerTick(currentSec, totalSec)
    );

    // 2. Setup UI Components & Listeners
    this.setupTheme();
    this.setupFloatingFocusBar();
    this.setupFarmControls();
    this.setupModals();
    this.setupShortcuts();

    // 3. State Subscription
    store.subscribe((state) => {
      this.updateHeaderStats();
    });

    this.updateHeaderStats();

    // Welcome Toast
    setTimeout(() => {
      this.showToast('🪿 ยินดีต้อนรับสู่ฟาร์มห่าน GooseFocus! กดปุ่ม "เริ่มโฟกัส" เพื่อสะสมชั่วโมงได้เลย!');
    }, 600);
  }

  /**
   * Update Header Farmer Level, Tier, Feathers & Hours
   */
  updateHeaderStats() {
    const state = store.get();
    const totalHours = (state.farmer.totalFocusSeconds / 3600).toFixed(1);
    const tier = rankingManager.getCurrentTier(state.farmer.totalFocusSeconds);
    const expInCurrentLevel = state.farmer.exp % 100;

    // Header Tier & EXP
    const tierTitle = document.getElementById('headerTierTitle');
    const farmerLevel = document.getElementById('headerFarmerLevel');
    const tierIcon = document.getElementById('headerTierIcon');
    const expBar = document.getElementById('headerExpBar');

    if (tierTitle) tierTitle.textContent = tier.name;
    if (farmerLevel) farmerLevel.textContent = `Lv. ${state.farmer.level || 1}`;
    if (tierIcon) tierIcon.textContent = tier.icon;
    if (expBar) expBar.style.width = `${expInCurrentLevel}%`;

    // Currencies & Stats
    const feathersEl = document.getElementById('headerFeathers');
    const hoursEl = document.getElementById('headerTotalHours');
    const geeseEl = document.getElementById('headerGeeseCount');
    const streakEl = document.getElementById('farmCurrentStreak');

    if (feathersEl) feathersEl.textContent = state.farmer.feathers;
    if (hoursEl) hoursEl.textContent = `${totalHours}h`;
    if (geeseEl) geeseEl.textContent = state.geeseList.length;
    if (streakEl) streakEl.textContent = `${state.farmer.streakDays || 1} วัน`;
  }

  /**
   * Theme Switcher Dropdown
   */
  setupTheme() {
    const state = store.get();
    this.currentTheme = state.settings.theme || 'day';
    document.documentElement.setAttribute('data-theme', this.currentTheme);

    const toggleBtn = document.getElementById('themeToggleBtn');
    const menu = document.getElementById('themeDropdownMenu');
    const themeIcon = document.getElementById('themeIcon');

    const updateThemeIcon = (theme) => {
      if (theme === 'sunset') themeIcon.textContent = '🌅';
      else if (theme === 'night') themeIcon.textContent = '🌙';
      else if (theme === 'cosmic') themeIcon.textContent = '🌌';
      else themeIcon.textContent = '☀️';
    };
    updateThemeIcon(this.currentTheme);

    if (toggleBtn && menu) {
      toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.classList.toggle('show');
      });

      document.addEventListener('click', () => {
        menu.classList.remove('show');
      });

      menu.querySelectorAll('.theme-option').forEach(opt => {
        opt.addEventListener('click', () => {
          const newTheme = opt.getAttribute('data-theme');
          this.currentTheme = newTheme;
          document.documentElement.setAttribute('data-theme', newTheme);
          updateThemeIcon(newTheme);

          menu.querySelectorAll('.theme-option').forEach(o => o.classList.remove('active'));
          opt.classList.add('active');
          menu.classList.remove('show');

          store.update(s => {
            s.settings.theme = newTheme;
          });

          this.showToast(`🎨 สลับเป็นธีม ${opt.textContent}`);
        });
      });
    }
  }

  /**
   * Floating Bottom Focus Controller Bar
   */
  setupFloatingFocusBar() {
    // Activity Tag Selector
    const tagBtns = document.querySelectorAll('.mini-tag-chip');
    tagBtns.forEach(tagBtn => {
      tagBtn.addEventListener('click', () => {
        soundEngine.playClick();
        tagBtns.forEach(t => t.classList.remove('active'));
        tagBtn.classList.add('active');
        const tag = tagBtn.getAttribute('data-tag');
        this.timer.setTag(tag);
        this.showToast(`🏷️ เลือกหมวดหมู่: ${tagBtn.textContent.trim()}`);
      });
    });

    // Primary Action Button (Start / Pause)
    const mainActionBtn = document.getElementById('timerMainActionBtn');
    if (mainActionBtn) {
      mainActionBtn.addEventListener('click', () => this.timer.toggle());
    }

    // Reset Button
    const resetBtn = document.getElementById('timerResetBtn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        soundEngine.playClick();
        this.timer.reset();
        this.showToast('⏱️ รีเซ็ตเวลารอบนี้เรียบร้อย');
      });
    }
  }

  /**
   * Farm Simulator Controls
   */
  setupFarmControls() {
    const feedBtn = document.getElementById('feedGeeseBtn');
    if (feedBtn) {
      feedBtn.addEventListener('click', () => this.farm.feedGeese());
    }

    const honkChorusBtn = document.getElementById('honkChorusBtn');
    if (honkChorusBtn) {
      honkChorusBtn.addEventListener('click', () => this.farm.honkChorus());
    }

    const toggleWeatherBtn = document.getElementById('toggleWeatherBtn');
    if (toggleWeatherBtn) {
      toggleWeatherBtn.addEventListener('click', () => this.farm.toggleWeather());
    }

    const logoBtn = document.getElementById('logoHonkBtn');
    if (logoBtn) {
      logoBtn.addEventListener('click', (e) => {
        e.preventDefault();
        soundEngine.playHonk(1.0);
        this.showToast('🪿 HONK! เจ้าห่านส่งเสียงทักทาย!');
      });
    }
  }

  /**
   * Modals: Ranking, Analytics, Audio Mixer, Settings, Idle & Story
   */
  setupModals() {
    // 1. 🏆 Ranking Modal Trigger
    const openRankingBtn = document.getElementById('openRankingBtn');
    const rankingModal = document.getElementById('rankingModal');
    if (openRankingBtn && rankingModal) {
      openRankingBtn.addEventListener('click', () => {
        soundEngine.playClick();
        rankingManager.renderTierRoadmap('tiersRoadmapTrack');
        rankingManager.renderLeaderboard(rankingManager.currentFilter);
        rankingModal.classList.remove('hidden');
      });
    }

    // Ranking Filter Tabs
    const filterTabs = document.querySelectorAll('.filter-tab');
    filterTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        soundEngine.playClick();
        filterTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const filter = tab.getAttribute('data-filter');
        rankingManager.renderLeaderboard(filter);
      });
    });

    // 2. 📊 Analytics Modal Trigger
    const openAnalyticsBtn = document.getElementById('openAnalyticsBtn');
    const analyticsModal = document.getElementById('analyticsModal');
    if (openAnalyticsBtn && analyticsModal) {
      openAnalyticsBtn.addEventListener('click', () => {
        soundEngine.playClick();
        analyticsManager.renderHeatmap('heatmapGrid');
        analyticsManager.renderTagBreakdown('tagBreakdownList');
        analyticsManager.renderHistoryList('historySessionsList');
        analyticsManager.renderKPIs();
        analyticsModal.classList.remove('hidden');
      });
    }

    // 3. 🎧 Audio Mixer Modal Trigger
    const openAudioBtn = document.getElementById('openAudioModalBtn');
    const audioModal = document.getElementById('audioModal');
    const muteAllBtn = document.getElementById('muteAllAudioBtn');

    if (openAudioBtn && audioModal) {
      openAudioBtn.addEventListener('click', () => {
        soundEngine.playClick();
        audioModal.classList.remove('hidden');
      });
    }

    ['Rain', 'Pond', 'Crickets', 'PinkNoise'].forEach(name => {
      const slider = document.getElementById(`vol${name}`);
      const label = document.getElementById(`labelVol${name}`);
      const soundType = name.toLowerCase();

      if (slider && label) {
        slider.addEventListener('input', () => {
          const val = parseInt(slider.value, 10);
          label.textContent = `${val}%`;
          soundEngine.setAmbienceVolume(soundType === 'pinknoise' ? 'whitenoise' : soundType, val);
          this.updateAudioPlayingIndicator();
        });
      }
    });

    if (muteAllBtn) {
      muteAllBtn.addEventListener('click', () => {
        soundEngine.muteAll();
        ['Rain', 'Pond', 'Crickets', 'PinkNoise'].forEach(name => {
          const slider = document.getElementById(`vol${name}`);
          const label = document.getElementById(`labelVol${name}`);
          if (slider) slider.value = 0;
          if (label) label.textContent = '0%';
        });
        this.updateAudioPlayingIndicator();
        this.showToast('🔇 ปิดเสียงบรรยากาศทั้งหมดแล้ว');
      });
    }

    // 4. ⚙️ Settings Modal
    const openSettingsBtn = document.getElementById('openSettingsBtn');
    const settingsModal = document.getElementById('settingsModal');
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    const exportBtn = document.getElementById('exportDataBtn');
    const importInput = document.getElementById('importDataInput');
    const resetBtn = document.getElementById('resetAllDataBtn');

    if (openSettingsBtn && settingsModal) {
      openSettingsBtn.addEventListener('click', () => {
        soundEngine.playClick();
        settingsModal.classList.remove('hidden');
      });
    }

    if (saveSettingsBtn) {
      saveSettingsBtn.addEventListener('click', () => {
        soundEngine.playClick();
        if (settingsModal) settingsModal.classList.add('hidden');
        this.showToast('⚙️ บันทึกการตั้งค่าเรียบร้อยแล้ว');
      });
    }

    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        const jsonStr = store.exportJSON();
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `goosefocus-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        this.showToast('📥 ส่งออกไฟล์สำรองข้อมูล JSON สำเร็จ');
      });
    }

    if (importInput) {
      importInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
          const success = store.importJSON(event.target.result);
          if (success) {
            this.farm.refreshEntities();
            this.updateHeaderStats();
            this.showToast('📤 นำเข้าข้อมูลสำเร็จแล้ว!');
            if (settingsModal) settingsModal.classList.add('hidden');
          } else {
            alert('นำเข้าไฟล์ไม่สำเร็จ กรุณาตรวจสอบความถูกต้องของไฟล์ JSON');
          }
        };
        reader.readAsText(file);
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (confirm('คุณแน่ใจหรือไม่ว่าต้องการล้างข้อมูลทั้งหมด? (ไม่สามารถย้อนกลับได้)')) {
          store.reset();
          this.farm.refreshEntities();
          this.updateHeaderStats();
          if (settingsModal) settingsModal.classList.add('hidden');
          this.showToast('🗑️ ล้างข้อมูลระบบเริ่มต้นใหม่เรียบร้อย');
        }
      });
    }

    // 5. 💤 AFK Idle Modal Resume
    const idleResumeBtn = document.getElementById('idleResumeBtn');
    if (idleResumeBtn) {
      idleResumeBtn.addEventListener('click', () => {
        soundEngine.playClick();
        this.timer.resumeFromIdle();
        this.showToast('🪿 ยินดีต้อนรับกลับมา! นับเวลาโฟกัสต่อแล้ว');
      });
    }

    // 6. 📸 Story Share Modal & Download
    const openShareBtn = document.getElementById('openShareStoryBtn');
    const shareModal = document.getElementById('shareCardModal');
    const downloadBtn = document.getElementById('downloadStoryCardBtn');

    if (openShareBtn && shareModal) {
      openShareBtn.addEventListener('click', () => {
        soundEngine.playClick();
        shareModal.classList.remove('hidden');
        analyticsManager.generateStoryCard('storyShareCanvas');
      });
    }

    if (downloadBtn) {
      downloadBtn.addEventListener('click', () => {
        soundEngine.playFanfare();
        const canvas = document.getElementById('storyShareCanvas');
        if (canvas) {
          const link = document.createElement('a');
          link.download = `GooseFocus-DailyStory-${new Date().toISOString().split('T')[0]}.png`;
          link.href = canvas.toDataURL('image/png');
          link.click();
          this.showToast('💾 ดาวน์โหลดรูปภาพเรียบร้อยแล้ว!');
        }
      });
    }

    // Generic Modal Close Buttons
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
      btn.addEventListener('click', () => {
        const modalId = btn.getAttribute('data-close-modal');
        const m = document.getElementById(modalId);
        if (m) m.classList.add('hidden');
      });
    });
  }

  updateAudioPlayingIndicator() {
    const dot = document.getElementById('audioPlayingDot');
    if (!dot) return;
    const isPlaying = Object.values(soundEngine.gainNodes).some(g => g !== null);
    if (isPlaying) {
      dot.classList.add('active');
    } else {
      dot.classList.remove('active');
    }
  }

  /**
   * Handle Session Finished
   */
  handleSessionCompleted(sessionData) {
    store.addSessionLog(sessionData);
    this.updateHeaderStats();

    // Show celebration modal
    const modal = document.getElementById('sessionCompleteModal');
    if (modal) {
      document.getElementById('completeTagName').textContent = sessionData.tag;
      document.getElementById('completeMinutes').textContent = `${sessionData.durationMinutes} นาที`;
      document.getElementById('rewardFeathersEarned').textContent = `+${sessionData.feathersEarned} ขนนกทองคำ`;
      document.getElementById('rewardExpEarned').textContent = `+${sessionData.expEarned} EXP ฟาร์ม`;

      modal.classList.remove('hidden');
      this.triggerConfetti();
    }

    const claimBtn = document.getElementById('claimRewardBtn');
    if (claimBtn) {
      claimBtn.onclick = () => {
        soundEngine.playClick();
        if (modal) modal.classList.add('hidden');
        this.showToast(`🌾 เก็บเกี่ยว +${sessionData.feathersEarned} 🪶 เรียบร้อย!`);
      };
    }
  }

  handleTimerTick(currentSec, totalSec) {}

  triggerConfetti() {
    const canvas = document.getElementById('confettiCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    const pieces = [];
    const colors = ['#10b981', '#fbbf24', '#3b82f6', '#ec4899', '#8b5cf6'];

    for (let i = 0; i < 70; i++) {
      pieces.push({
        x: canvas.width / 2,
        y: canvas.height / 2,
        vx: (Math.random() - 0.5) * 12,
        vy: -Math.random() * 10 - 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 8 + 4,
        rot: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 0.2,
        life: 80
      });
    }

    const renderConfetti = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;
      pieces.forEach(p => {
        if (p.life > 0) {
          alive = true;
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.3;
          p.rot += p.vRot;
          p.life--;

          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
          ctx.restore();
        }
      });

      if (alive) {
        requestAnimationFrame(renderConfetti);
      }
    };
    renderConfetti();
  }

  setupShortcuts() {
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.code === 'Space') {
        e.preventDefault();
        this.timer.toggle();
      } else if (e.code === 'Escape') {
        document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.add('hidden'));
      }
    });
  }

  showToast(message) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(15px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }
}

// Instantiate App Controller
new AppController();
