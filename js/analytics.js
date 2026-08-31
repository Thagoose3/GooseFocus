/**
 * GooseFocus - Analytics, Farm Grass Heatmap, Tag Distribution & Story Card Generator
 */

import { store } from './storage.js';
import { FARMER_TIERS } from './ranking.js';

export class AnalyticsManager {
  constructor() {}

  renderHeatmap(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const state = store.get();
    const sessions = state.sessionsHistory || [];

    // Map date string 'YYYY-MM-DD' -> total minutes
    const dayMap = {};
    sessions.forEach(s => {
      if (s.timestamp) {
        const dateStr = s.timestamp.split('T')[0];
        dayMap[dateStr] = (dayMap[dateStr] || 0) + (s.durationMinutes || 0);
      }
    });

    // Generate past 26 weeks (182 days) or 52 weeks (364 days)
    const totalDays = 52 * 7; // 364 days
    const today = new Date();
    const cells = [];

    for (let i = totalDays - 1; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 86400000);
      const dateStr = d.toISOString().split('T')[0];
      const mins = dayMap[dateStr] || 0;

      let level = 0;
      if (mins > 0 && mins < 25) level = 1;
      else if (mins >= 25 && mins < 60) level = 2;
      else if (mins >= 60 && mins < 120) level = 3;
      else if (mins >= 120) level = 4;

      cells.push(`
        <div class="heatmap-cell level-${level}" title="${dateStr}: โฟกัส ${mins} นาที"></div>
      `);
    }

    container.innerHTML = cells.join('');
  }

  renderTagBreakdown(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const state = store.get();
    const sessions = state.sessionsHistory || [];

    const tagColors = {
      coding: '#10b981',
      study: '#3b82f6',
      thesis: '#8b5cf6',
      work: '#f59e0b',
      writing: '#ec4899',
      creative: '#14b8a6'
    };

    const tagNames = {
      coding: '💻 โค้ดดิ่ง',
      study: '📚 อ่านหนังสือ',
      thesis: '🎓 ทำวิจัย/Thesis',
      work: '💼 ทำงาน',
      writing: '✍️ เขียนงาน',
      creative: '🎨 ออกแบบ'
    };

    const tagMinutes = {};
    let totalMinutes = 0;

    sessions.forEach(s => {
      const tag = s.tag || 'coding';
      const m = s.durationMinutes || 0;
      tagMinutes[tag] = (tagMinutes[tag] || 0) + m;
      totalMinutes += m;
    });

    if (totalMinutes === 0) {
      container.innerHTML = `
        <div style="color: var(--text-muted); font-size: 0.82rem; text-align: center; padding: 1.5rem 0;">
          ยังไม่มีข้อมูลบันทึก เริ่มต้นโฟกัสเพื่อดูสถิตินะ!
        </div>
      `;
      return;
    }

    const sortedTags = Object.keys(tagMinutes).sort((a, b) => tagMinutes[b] - tagMinutes[a]);

    container.innerHTML = sortedTags.map(tag => {
      const mins = tagMinutes[tag];
      const percent = Math.round((mins / totalMinutes) * 100);
      const color = tagColors[tag] || '#10b981';
      const name = tagNames[tag] || tag;
      const hours = (mins / 60).toFixed(1);

      return `
        <div class="tag-stat-row">
          <div class="tag-stat-header">
            <span>${name}</span>
            <span>${hours} ชม. (${percent}%)</span>
          </div>
          <div class="tag-stat-bar-wrap">
            <div class="tag-stat-bar" style="width: ${percent}%; background: ${color};"></div>
          </div>
        </div>
      `;
    }).join('');
  }

  renderHistoryList(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const state = store.get();
    const sessions = state.sessionsHistory || [];

    if (sessions.length === 0) {
      container.innerHTML = `
        <div style="color: var(--text-muted); font-size: 0.82rem; text-align: center; padding: 1.5rem 0;">
          ยังไม่มีรอบการทำงานที่บันทึก
        </div>
      `;
      return;
    }

    const tagColors = {
      coding: '#10b981',
      study: '#3b82f6',
      thesis: '#8b5cf6',
      work: '#f59e0b',
      writing: '#ec4899',
      creative: '#14b8a6'
    };

    container.innerHTML = sessions.slice(0, 20).map(s => {
      const d = new Date(s.timestamp);
      const timeStr = `${d.toLocaleDateString('th-TH', { month: 'short', day: 'numeric' })} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      const color = tagColors[s.tag] || '#10b981';

      return `
        <div class="history-item">
          <div class="history-item-left">
            <span class="history-tag-pill" style="background: ${color};">${s.tag}</span>
            <span class="history-time">${timeStr}</span>
          </div>
          <div class="history-item-right">
            <span class="earn-feathers">+${s.feathersEarned || 0} 🪶</span>
            <span class="history-duration">${s.durationMinutes || 0}m</span>
          </div>
        </div>
      `;
    }).join('');
  }

  renderKPIs() {
    const state = store.get();
    const totalHours = (state.farmer.totalFocusSeconds / 3600).toFixed(1);
    const hatchedCount = state.geeseList.filter(g => g.stage !== 'egg').length;

    const kpiTotal = document.getElementById('kpiTotalHours');
    const kpiStreak = document.getElementById('kpiCurrentStreak');
    const kpiHatched = document.getElementById('kpiHatchedGeese');
    const kpiFeathers = document.getElementById('kpiTotalFeathers');

    if (kpiTotal) kpiTotal.textContent = `${totalHours} ชั่วโมง`;
    if (kpiStreak) kpiStreak.textContent = `${state.farmer.streakDays || 1} วันต่อเนื่อง`;
    if (kpiHatched) kpiHatched.textContent = `${hatchedCount} ตัว`;
    if (kpiFeathers) kpiFeathers.textContent = `${state.farmer.feathers} ขนนก`;
  }

  /**
   * Generates a stunning 9:16 vertical Story Card on Canvas
   */
  generateStoryCard(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const w = 600;
    const h = 800;
    canvas.width = w;
    canvas.height = h;

    const state = store.get();
    const totalHours = (state.farmer.totalFocusSeconds / 3600).toFixed(1);
    const streak = state.farmer.streakDays || 1;
    const tier = FARMER_TIERS[state.farmer.tierIndex || 0] || FARMER_TIERS[0];

    // Background Gradient
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#064e3b');
    grad.addColorStop(0.5, '#022c22');
    grad.addColorStop(1, '#0f172a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Glow Circles
    ctx.beginPath();
    ctx.arc(w * 0.8, 120, 180, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(w * 0.2, h * 0.75, 160, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(245, 158, 11, 0.12)';
    ctx.fill();

    function drawSafeRect(x, y, width, height, radius) {
      if (ctx.roundRect) {
        ctx.roundRect(x, y, width, height, radius);
        return;
      }
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.arcTo(x + width, y, x + width, y + height, radius);
      ctx.arcTo(x + width, y + height, x, y + height, radius);
      ctx.arcTo(x, y + height, x, y, radius);
      ctx.arcTo(x, y, x + width, y, radius);
      ctx.closePath();
    }

    // Card Glass Container
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    drawSafeRect(40, 40, w - 80, h - 80, 24);
    ctx.fill();
    ctx.stroke();

    // Header Logo & Branding
    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 26px "Nunito", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🪿 GooseFocus Daily Report', w / 2, 95);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '16px "Prompt", sans-serif';
    ctx.fillText(new Date().toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }), w / 2, 125);

    // Big Goose Centerpiece
    ctx.font = '72px sans-serif';
    ctx.fillText('🪿✨', w / 2, 220);

    // Farmer Name & Tier Badge
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px "Prompt", sans-serif';
    ctx.fillText(state.farmer.name || 'Farmer You', w / 2, 280);

    ctx.fillStyle = '#34d399';
    ctx.font = 'bold 18px "Prompt", sans-serif';
    ctx.fillText(`🌾 Tier: ${tier.name} (Lv. ${state.farmer.level || 1})`, w / 2, 310);

    // Stat Box 1: Focus Hours
    ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.beginPath();
    drawSafeRect(80, 350, w - 160, 90, 16);
    ctx.fill();

    ctx.fillStyle = '#94a3b8';
    ctx.font = '16px "Prompt", sans-serif';
    ctx.fillText('⏱️ เวลาโฟกัสสะสมทั้งหมด', w / 2, 385);

    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 36px "Space Grotesk", monospace';
    ctx.fillText(`${totalHours} Hours`, w / 2, 425);

    // Stat Box 2: Streak & Geese
    ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.beginPath();
    drawSafeRect(80, 460, (w - 180) / 2, 90, 16);
    ctx.fill();

    ctx.fillStyle = '#94a3b8';
    ctx.font = '14px "Prompt", sans-serif';
    ctx.fillText('🔥 Daily Streak', 80 + (w - 180) / 4, 495);
    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 28px "Space Grotesk", sans-serif';
    ctx.fillText(`${streak} วัน`, 80 + (w - 180) / 4, 532);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.beginPath();
    drawSafeRect(80 + (w - 180) / 2 + 20, 460, (w - 180) / 2, 90, 16);
    ctx.fill();

    ctx.fillStyle = '#94a3b8';
    ctx.font = '14px "Prompt", sans-serif';
    ctx.fillText('🪶 ขนนกทองคำ', 80 + (w - 180) * 0.75 + 20, 495);
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 28px "Space Grotesk", sans-serif';
    ctx.fillText(`${state.farmer.feathers}`, 80 + (w - 180) * 0.75 + 20, 532);

    // Quote Footer
    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'italic 16px "Prompt", sans-serif';
    ctx.fillText('"ทุกนาทีที่คุณตั้งใจ จะกลายเป็นฝูงห่านที่เติบโต"', w / 2, 620);

    // Watermark
    ctx.fillStyle = '#64748b';
    ctx.font = '14px "Prompt", sans-serif';
    ctx.fillText('Thagoose Daily Life Ecosystem • https://thagoose3.github.io', w / 2, 710);
  }
}

export const analyticsManager = new AnalyticsManager();
