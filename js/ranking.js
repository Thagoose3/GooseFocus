/**
 * GooseFocus - Ranking, Farmer Tiers, Leaderboard & Achievements System
 */

import { store } from './storage.js';

export const FARMER_TIERS = [
  {
    tier: 1,
    name: 'Eggling Honker',
    thaiName: 'ผู้เริ่มเพาะไข่ห่าน',
    icon: '🥚',
    reqHours: 0,
    perk: 'ปลดล็อก: สระน้ำห่าน & โหมด Pomodoro พื้นฐาน',
    color: '#94a3b8'
  },
  {
    tier: 2,
    name: 'Pond Caretaker',
    thaiName: 'ผู้ดูแลสระห่าน',
    icon: '🌾',
    reqHours: 5,
    perk: 'ปลดล็อก: หมวกฟางชาวสวน & เสียงธรรมชาติสระน้ำ',
    color: '#10b981'
  },
  {
    tier: 3,
    name: 'Honk Commander',
    thaiName: 'ผู้บัญชาการฝูงห่าน',
    icon: '🪿',
    reqHours: 20,
    perk: 'ปลดล็อก: สกินห่านนินจาดำ & โหมด Deep Work',
    color: '#3b82f6'
  },
  {
    tier: 4,
    name: 'Golden Feather Knight',
    thaiName: 'อัศวินขนนกทองคำ',
    icon: '⚔️',
    reqHours: 50,
    perk: 'ปลดล็อก: หมวกอัศวิน & บูสต์ขนนกทองคำ +20%',
    color: '#f59e0b'
  },
  {
    tier: 5,
    name: 'Grand Honk Archon',
    thaiName: 'มหาจอมปราชญ์ห่านทองคำ',
    icon: '👑',
    reqHours: 100,
    perk: 'ปลดล็อก: สกิน Golden Honk & มงกุฎทองคำ',
    color: '#8b5cf6'
  },
  {
    tier: 6,
    name: 'Celestial Cosmic Goose',
    thaiName: 'เทพเจ้าห่านคอสมิกไร้ขอบเขต',
    icon: '🌌',
    reqHours: 250,
    perk: 'ปลดล็อก: ธีม Cosmic Universe & ปีกเรืองแสง',
    color: '#ec4899'
  }
];

export const ACHIEVEMENTS = [
  {
    id: 'first_honk',
    title: 'เสียงร้องแรก (First Honk)',
    desc: 'คลิกทักทายเจ้าห่านในฟาร์มเป็นครั้งแรก',
    icon: '📢',
    rewardFeathers: 10,
    condition: (state) => true
  },
  {
    id: 'starter_farmer',
    title: 'ก้าวแรกสู่ชาวไร่',
    desc: 'โฟกัสสะสมครบ 15 นาทีแรก',
    icon: '🌾',
    rewardFeathers: 15,
    condition: (state) => state.farmer.totalFocusSeconds >= 15 * 60
  },
  {
    id: 'hatch_first_gosling',
    title: 'กำเนิดลูกห่าน',
    desc: 'ฟักไข่ห่านตัวแรกสำเร็จจนโตเป็นลูกห่าน',
    icon: '🐣',
    rewardFeathers: 30,
    condition: (state) => state.geeseList.some(g => g.stage === 'gosling' || g.stage === 'adult')
  },
  {
    id: 'streak_3_days',
    title: 'ความสม่ำเสมอ (Streak 3)',
    desc: 'โฟกัสต่อเนื่องกัน 3 วันติด',
    icon: '🔥',
    rewardFeathers: 25,
    condition: (state) => (state.farmer.streakDays || 1) >= 3
  },
  {
    id: 'streak_7_days',
    title: 'นักสู้สัปดาห์ (Streak 7)',
    desc: 'โฟกัสต่อเนื่องกัน 7 วันติด',
    icon: '⚡',
    rewardFeathers: 50,
    condition: (state) => (state.farmer.streakDays || 1) >= 7
  },
  {
    id: 'deep_work_marathon',
    title: 'สมาธิเหล็กไหล (Deep Work)',
    desc: 'โฟกัสในรอบเดียวต่อเนื่องเกิน 60 นาที',
    icon: '⏳',
    rewardFeathers: 40,
    condition: (state) => state.sessionsHistory.some(s => s.durationMinutes >= 60)
  },
  {
    id: 'feathers_century',
    title: 'เศรษฐีขนนก (100 Feathers)',
    desc: 'สะสมขนนกทองคำครบ 100 ชิ้น',
    icon: '🪶',
    rewardFeathers: 30,
    condition: (state) => state.farmer.feathers >= 100
  },
  {
    id: 'wardrobe_fashion',
    title: 'ห่านแฟชั่นนิสต้า',
    desc: 'สวมใส่หมวกหรือเครื่องประดับให้เจ้าห่าน',
    icon: '👒',
    rewardFeathers: 20,
    condition: (state) => state.activeGoose.hat !== 'none' || state.activeGoose.glasses !== 'none'
  },
  {
    id: 'night_owl_goose',
    title: 'ห่านนกฮูก (Night Owl)',
    desc: 'โฟกัสสำเร็จในช่วงเวลากลางคืน (22:00 - 04:00)',
    icon: '🌙',
    rewardFeathers: 30,
    condition: (state) => {
      return state.sessionsHistory.some(s => {
        const hour = new Date(s.timestamp).getHours();
        return hour >= 22 || hour < 4;
      });
    }
  },
  {
    id: 'tier_pond_caretaker',
    title: 'เลื่อนขั้น: Pond Caretaker',
    desc: 'สะสมชั่วโมงแตะ 5 ชั่วโมง (Tier 2)',
    icon: '🌊',
    rewardFeathers: 45,
    condition: (state) => (state.farmer.totalFocusSeconds / 3600) >= 5
  },
  {
    id: 'tier_honk_commander',
    title: 'เลื่อนขั้น: Honk Commander',
    desc: 'สะสมชั่วโมงแตะ 20 ชั่วโมง (Tier 3)',
    icon: '⚔️',
    rewardFeathers: 80,
    condition: (state) => (state.farmer.totalFocusSeconds / 3600) >= 20
  },
  {
    id: 'tag_master',
    title: 'ห่านรอบรู้ทุกศาสตร์',
    desc: 'โฟกัสครอบคลุม 4 แท็กกิจกรรมที่แตกต่างกัน',
    icon: '💻',
    rewardFeathers: 35,
    condition: (state) => {
      const tags = new Set(state.sessionsHistory.map(s => s.tag));
      return tags.size >= 4;
    }
  }
];

// Dynamic Simulated Community Rivals for Leaderboard
const MOCK_RIVALS = [
  { id: 'u1', name: 'GooseMaster_Pro', avatar: '👑🪿', tier: 'Grand Honk Archon', geese: 18, baseHoursDaily: 4.8, baseHoursWeekly: 32.5, baseHoursAllTime: 142.0 },
  { id: 'u2', name: 'CodeHonker_99', avatar: '💻🪿', tier: 'Golden Knight', geese: 12, baseHoursDaily: 3.5, baseHoursWeekly: 24.2, baseHoursAllTime: 88.5 },
  { id: 'u3', name: 'ZenPond_Guru', avatar: '🧘🪿', tier: 'Honk Commander', geese: 8, baseHoursDaily: 2.9, baseHoursWeekly: 18.4, baseHoursAllTime: 46.2 },
  { id: 'u4', name: 'StudyGoose_P', avatar: '📚🪿', tier: 'Pond Caretaker', geese: 5, baseHoursDaily: 2.1, baseHoursWeekly: 14.1, baseHoursAllTime: 28.0 },
  { id: 'u5', name: 'CoffeeHonk', avatar: '☕🪿', tier: 'Pond Caretaker', geese: 4, baseHoursDaily: 1.8, baseHoursWeekly: 11.5, baseHoursAllTime: 19.5 },
  { id: 'u6', name: 'NightOwl_Goose', avatar: '🌙🪿', tier: 'Eggling Honker', geese: 3, baseHoursDaily: 1.2, baseHoursWeekly: 8.0, baseHoursAllTime: 12.4 },
  { id: 'u7', name: 'Pip_The_Gosling', avatar: '🐥', tier: 'Eggling Honker', geese: 2, baseHoursDaily: 0.8, baseHoursWeekly: 5.2, baseHoursAllTime: 6.8 },
];

export class RankingManager {
  constructor() {
    this.currentFilter = 'daily';
  }

  getCurrentTier(totalSeconds) {
    const hours = totalSeconds / 3600;
    for (let i = FARMER_TIERS.length - 1; i >= 0; i--) {
      if (hours >= FARMER_TIERS[i].reqHours) {
        return { ...FARMER_TIERS[i], index: i };
      }
    }
    return { ...FARMER_TIERS[0], index: 0 };
  }

  getNextTier(totalSeconds) {
    const current = this.getCurrentTier(totalSeconds);
    if (current.index < FARMER_TIERS.length - 1) {
      return FARMER_TIERS[current.index + 1];
    }
    return null;
  }

  renderTierRoadmap(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const state = store.get();
    const currentTier = this.getCurrentTier(state.farmer.totalFocusSeconds);
    const totalHours = (state.farmer.totalFocusSeconds / 3600).toFixed(1);

    container.innerHTML = FARMER_TIERS.map((tier, idx) => {
      const isUnlocked = idx <= currentTier.index;
      const isCurrent = idx === currentTier.index;

      return `
        <div class="tier-track-item ${isUnlocked ? 'unlocked' : ''} ${isCurrent ? 'current' : ''}">
          <div class="tier-track-icon">${tier.icon}</div>
          <div class="tier-track-info">
            <div class="tier-track-name">
              Tier ${tier.tier}: ${tier.name} (${tier.thaiName})
              ${isCurrent ? '<span class="badge-you" style="margin-left: 6px;">ปัจจุบัน</span>' : ''}
            </div>
            <div class="tier-track-req">เงื่อนไข: สะสมครบ ${tier.reqHours} ชั่วโมง (คุณมี: ${totalHours}h)</div>
            <div class="tier-track-perk">✨ ${tier.perk}</div>
          </div>
        </div>
      `;
    }).join('');

    const pill = document.getElementById('tierRoadmapCurrentPill');
    if (pill) {
      pill.textContent = `Tier ${currentTier.tier}: ${currentTier.name}`;
    }
  }

  renderAchievements(containerId, countId) {
    const container = document.getElementById(containerId);
    const countEl = document.getElementById(countId);
    if (!container) return;

    const state = store.get();
    const unlockedSet = new Set(state.unlockedAchievements || []);

    // Check newly unlocked
    ACHIEVEMENTS.forEach(ach => {
      if (!unlockedSet.has(ach.id) && ach.condition(state)) {
        unlockedSet.add(ach.id);
        store.update(s => {
          s.unlockedAchievements = Array.from(unlockedSet);
          s.farmer.feathers += ach.rewardFeathers;
        });
      }
    });

    container.innerHTML = ACHIEVEMENTS.map(ach => {
      const isUnlocked = unlockedSet.has(ach.id);
      return `
        <div class="achievement-badge-card ${isUnlocked ? 'unlocked' : 'locked'}" title="${ach.desc}">
          <div class="achieve-icon">${ach.icon}</div>
          <div class="achieve-title">${ach.title}</div>
          <div class="achieve-desc">${ach.desc}</div>
          <div class="earn-feathers" style="font-size: 0.7rem; margin-top: 2px;">+${ach.rewardFeathers} 🪶</div>
        </div>
      `;
    }).join('');

    if (countEl) {
      countEl.textContent = `ปลดล็อกแล้ว ${unlockedSet.size} / ${ACHIEVEMENTS.length} ตรา`;
    }
  }

  getLeaderboardList(filter) {
    const state = store.get();
    const myTotalHours = state.farmer.totalFocusSeconds / 3600;
    
    // Calculate my hours for daily / weekly / all-time from history
    let myFilterHours = myTotalHours;
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    if (filter === 'daily') {
      const dailyMinutes = state.sessionsHistory
        .filter(s => s.timestamp.startsWith(todayStr))
        .reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
      myFilterHours = dailyMinutes / 60;
    } else if (filter === 'weekly') {
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
      const weeklyMinutes = state.sessionsHistory
        .filter(s => new Date(s.timestamp) >= sevenDaysAgo)
        .reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
      myFilterHours = (weeklyMinutes / 60) + (myTotalHours > 0 ? 1.5 : 0);
    }

    const currentTier = this.getCurrentTier(state.farmer.totalFocusSeconds);

    const userEntry = {
      id: 'player_you',
      name: state.farmer.name || 'Farmer You',
      avatar: '🪿',
      tier: currentTier.name,
      geese: state.geeseList.length,
      hours: myFilterHours,
      isYou: true
    };

    const rivals = MOCK_RIVALS.map(r => {
      let hours = r.baseHoursAllTime;
      if (filter === 'daily') hours = r.baseHoursDaily;
      else if (filter === 'weekly') hours = r.baseHoursWeekly;
      return {
        id: r.id,
        name: r.name,
        avatar: r.avatar,
        tier: r.tier,
        geese: r.geese,
        hours: hours,
        isYou: false
      };
    });

    const fullList = [...rivals, userEntry].sort((a, b) => b.hours - a.hours);
    return fullList;
  }

  renderLeaderboard(filter = 'daily') {
    this.currentFilter = filter;
    const list = this.getLeaderboardList(filter);

    // Podium (Top 3)
    const podiumEl = document.getElementById('leaderboardPodium');
    if (podiumEl && list.length >= 3) {
      const [first, second, third] = [list[0], list[1], list[2]];
      podiumEl.innerHTML = `
        <!-- Rank 2 -->
        <div class="podium-step podium-2">
          <div class="podium-avatar">
            ${second.avatar}
            <span class="podium-rank-badge">🥈</span>
          </div>
          <div class="podium-name">${second.name}</div>
          <div class="podium-hours">${second.hours.toFixed(1)}h</div>
          <div class="podium-block">2</div>
        </div>

        <!-- Rank 1 -->
        <div class="podium-step podium-1">
          <div class="podium-avatar">
            ${first.avatar}
            <span class="podium-rank-badge">🥇</span>
          </div>
          <div class="podium-name">${first.name}</div>
          <div class="podium-hours">${first.hours.toFixed(1)}h</div>
          <div class="podium-block">1</div>
        </div>

        <!-- Rank 3 -->
        <div class="podium-step podium-3">
          <div class="podium-avatar">
            ${third.avatar}
            <span class="podium-rank-badge">🥉</span>
          </div>
          <div class="podium-name">${third.name}</div>
          <div class="podium-hours">${third.hours.toFixed(1)}h</div>
          <div class="podium-block">3</div>
        </div>
      `;
    }

    // Table Body
    const tbody = document.getElementById('leaderboardTableBody');
    if (tbody) {
      tbody.innerHTML = list.map((item, index) => {
        const rank = index + 1;
        const rankMedal = rank === 1 ? '🥇' : (rank === 2 ? '🥈' : (rank === 3 ? '🥉' : `#${rank}`));
        return `
          <tr style="${item.isYou ? 'background: var(--primary-light); font-weight: 700;' : ''}">
            <td><strong>${rankMedal}</strong></td>
            <td>
              <div class="table-user-cell">
                <span class="table-avatar">${item.avatar}</span>
                <span>${item.name}</span>
                ${item.isYou ? '<span class="badge-you">YOU</span>' : ''}
              </div>
            </td>
            <td><span class="text-secondary">${item.tier}</span></td>
            <td>🪿 ${item.geese}</td>
            <td><strong class="text-emerald">${item.hours.toFixed(1)} ชม.</strong></td>
          </tr>
        `;
      }).join('');
    }

    // My Sticky Rank Bar
    const myIndex = list.findIndex(item => item.isYou);
    const myItem = list[myIndex];
    const stickyBar = document.getElementById('myRankStickyBar');
    if (stickyBar && myItem) {
      stickyBar.querySelector('.my-rank-pos').textContent = `#${myIndex + 1}`;
      document.getElementById('myRankHoursDisplay').textContent = `${myItem.hours.toFixed(1)} ชม.`;
      
      const navBadge = document.getElementById('navRankBadge');
      if (navBadge) navBadge.textContent = `#${myIndex + 1}`;
    }
  }
}

export const rankingManager = new RankingManager();
