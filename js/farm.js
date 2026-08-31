/**
 * GooseFocus - Hyper-Polished Stardew Valley 2D Top-Down Living Farm Simulator
 * 
 * Upgrades:
 * 1. Fixed Goose Neck Clipping Bug: Unified anatomical head/neck Bezier path that never disappears.
 * 2. Crystal Clear Cyan/Sky-Blue Natural Pond with water shimmers, lilypads, and wooden fishing pier.
 * 3. Highly Detailed Stardew Valley Aesthetics: Tilled crops (wheat, sunflowers, pumpkins), red barn, stone well, apple trees, hay bales, fences, crates, campfire.
 * 4. Distinct 10-Minute Day/Night Cycle with real-time in-game clock, sunset golden hour, and midnight lantern/campfire glow.
 */

import { soundEngine } from './audio.js';
import { store } from './storage.js';

// Safe Cross-Browser Rounded Rect Helper
function drawSafeRoundRect(ctx, x, y, width, height, radius = 5) {
  if (typeof radius === 'number') {
    radius = Math.min(radius, width / 2, height / 2);
  }
  if (ctx.roundRect) {
    ctx.roundRect(x, y, width, height, radius);
    return;
  }
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y + width, y, radius);
  ctx.closePath();
}

export class FarmSimulator {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this.dpr = window.devicePixelRatio || 1;

    this.width = window.innerWidth || 1280;
    this.height = window.innerHeight || 800;

    this.geese = [];
    this.particles = [];
    this.foodGrains = [];
    this.ripples = [];
    this.speechBubbles = [];
    this.clouds = [];
    this.sparkles = [];

    this.timeTick = 0;
    this.isRaining = false;
    this.weatherTimer = 0;

    // 10-Minute Day/Night Cycle (600s loop)
    this.cycleDurationSec = 600;
    this.timeOfDayPhase = 0.25; // 0.0 -> 1.0

    if (this.canvas && this.ctx) {
      this.initCanvas();
      this.initClouds();
      this.initEntities();
      this.setupEventListeners();
      this.animate = this.animate.bind(this);
      requestAnimationFrame(this.animate);
    }
  }

  initCanvas() {
    const resize = () => {
      this.width = window.innerWidth;
      this.height = window.innerHeight;
      this.canvas.width = this.width * this.dpr;
      this.canvas.height = this.height * this.dpr;
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.scale(this.dpr, this.dpr);
    };
    window.addEventListener('resize', resize);
    resize();
  }

  initClouds() {
    this.clouds = [
      { x: this.width * 0.15, y: this.height * 0.08, speed: 0.12, scale: 1.1, opacity: 0.2 },
      { x: this.width * 0.55, y: this.height * 0.16, speed: 0.09, scale: 0.85, opacity: 0.16 },
      { x: this.width * 0.85, y: this.height * 0.06, speed: 0.15, scale: 1.3, opacity: 0.22 }
    ];
  }

  initEntities() {
    const state = store.get();
    const geeseData = state.geeseList || [];

    this.geese = geeseData.map((g, idx) => {
      return this.createGoose(g, idx);
    });
  }

  createGoose(data, index) {
    const isEgg = data.stage === 'egg';

    const spawnX = isEgg ? this.width * 0.24 : 120 + Math.random() * Math.max(150, this.width - 240);
    const spawnY = isEgg ? this.height * 0.72 : 200 + Math.random() * Math.max(150, this.height - 320);

    return {
      id: data.id || `goose_${index}`,
      name: data.name || 'Goose',
      stage: data.stage || 'adult',
      progress: data.progress || 0,
      hat: data.hat || 'none',
      glasses: data.glasses || 'none',
      skin: data.skin || 'classic_white',
      x: spawnX,
      y: spawnY,
      targetX: null,
      targetY: null,
      vx: 0,
      vy: 0,
      scale: isEgg ? 0.9 : (data.stage === 'gosling' ? 0.75 : 1.1),
      facing: Math.random() > 0.5 ? 1 : -1,
      state: isEgg ? 'nesting' : 'wandering',
      stateTimer: Math.random() * 140 + 70,
      wobble: Math.random() * Math.PI * 2,
      wingAngle: 0,
      isFlapping: false,
      stepPhase: 0,
    };
  }

  setupEventListeners() {
    this.canvas.addEventListener('pointerdown', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      let clickedGoose = null;
      for (const goose of this.geese) {
        const dist = Math.hypot(goose.x - clickX, goose.y - clickY);
        if (dist < 48 * goose.scale) {
          clickedGoose = goose;
          break;
        }
      }

      if (clickedGoose) {
        this.interactWithGoose(clickedGoose);
      } else {
        this.createRipple(clickX, clickY);
        this.geese.forEach(g => {
          if (g.stage !== 'egg' && Math.random() > 0.3) {
            g.targetX = Math.max(80, Math.min(this.width - 80, clickX + (Math.random() * 90 - 45)));
            g.targetY = Math.max(190, Math.min(this.height - 100, clickY + (Math.random() * 90 - 45)));
            g.state = 'wandering';
          }
        });
      }
    });
  }

  interactWithGoose(goose) {
    if (goose.stage === 'egg') {
      soundEngine.playClick();
      this.addSpeechBubble(goose.x, goose.y - 30, `🥚 ฟักแล้ว ${goose.progress || 0}%`);
      return;
    }

    const pitch = goose.stage === 'gosling' ? 1.5 : (goose.skin === 'cosmic_deity' ? 0.7 : 1.0);
    soundEngine.playHonk(pitch);

    goose.isFlapping = true;
    goose.state = 'honking';
    goose.stateTimer = 50;

    const phrases = ['HONK! 🪿', 'ฮ้อนก์! ✨', 'ตั้งใจสะสมชั่วโมงนะ!', 'ฟาร์มห่านแสนสุข 🌾', 'ก้าบๆ โฟกัสยาวๆ ⏱️'];
    const text = phrases[Math.floor(Math.random() * phrases.length)];
    this.addSpeechBubble(goose.x, goose.y - 48 * goose.scale, text);

    // Spawn feather particles
    for (let i = 0; i < 6; i++) {
      this.particles.push({
        x: goose.x + (Math.random() * 24 - 12),
        y: goose.y - 25,
        vx: (Math.random() - 0.5) * 2.5,
        vy: -Math.random() * 2.5 - 1.2,
        life: 50,
        maxLife: 50,
        type: 'feather',
        color: goose.skin === 'golden_honk' ? '#fbbf24' : '#ffffff'
      });
    }
  }

  feedGeese() {
    soundEngine.playClick();
    const feedX = this.width * 0.45;
    const feedY = this.height * 0.62;

    for (let i = 0; i < 22; i++) {
      this.foodGrains.push({
        x: feedX + (Math.random() * 160 - 80),
        y: feedY + (Math.random() * 100 - 50),
        eaten: false,
        life: 350
      });
    }

    this.geese.forEach(g => {
      if (g.stage !== 'egg') {
        g.targetX = feedX + (Math.random() * 120 - 60);
        g.targetY = feedY + (Math.random() * 80 - 40);
        g.state = 'running_to_food';
      }
    });

    this.addSpeechBubble(feedX, feedY - 45, '🌾 โปรยเมล็ดข้าวโพดทองคำ!');
  }

  honkChorus() {
    this.geese.forEach((g, idx) => {
      setTimeout(() => {
        if (g.stage !== 'egg') {
          this.interactWithGoose(g);
        }
      }, idx * 160);
    });
  }

  toggleWeather() {
    this.isRaining = !this.isRaining;
    soundEngine.playClick();
    if (this.isRaining) {
      soundEngine.setAmbienceVolume('rain', 40);
    } else {
      soundEngine.setAmbienceVolume('rain', 0);
    }
  }

  createRipple(x, y) {
    this.ripples.push({ x, y, r: 4, maxR: 35, alpha: 0.85 });
  }

  addSpeechBubble(x, y, text) {
    this.speechBubbles.push({ x, y, text, life: 85, maxLife: 85 });
  }

  // Check if position is inside the blue pond
  isPointInPond(x, y) {
    const pondX = this.width * 0.72;
    const pondY = this.height * 0.58;
    const pondRx = this.width * 0.22;
    const pondRy = this.height * 0.24;

    const dx = (x - pondX) / pondRx;
    const dy = (y - pondY) / pondRy;
    return (dx * dx + dy * dy) <= 0.82;
  }

  update() {
    this.timeTick++;

    // 10-Minute Day/Night Loop Calculation (600 seconds)
    const nowSec = Date.now() / 1000;
    this.timeOfDayPhase = (nowSec % this.cycleDurationSec) / this.cycleDurationSec;

    // Update in-game top clock pill if element exists
    this.updateClockHUD();

    // Random Weather Variations
    this.weatherTimer++;
    if (this.weatherTimer > 3600) {
      this.weatherTimer = 0;
      if (Math.random() < 0.25 && !this.isRaining) {
        this.isRaining = true;
        soundEngine.setAmbienceVolume('rain', 35);
      } else if (this.isRaining && Math.random() < 0.5) {
        this.isRaining = false;
        soundEngine.setAmbienceVolume('rain', 0);
      }
    }

    // Clouds Drift
    this.clouds.forEach(c => {
      c.x += c.speed;
      if (c.x > this.width + 200) {
        c.x = -200;
      }
    });

    // Update Geese with Top-Down Boundaries
    this.geese.forEach(g => {
      if (g.stage === 'egg') {
        g.wobble += 0.04;
        return;
      }

      g.wobble += 0.06;
      g.stateTimer--;

      const inPond = this.isPointInPond(g.x, g.y);

      if (inPond && g.state !== 'swimming' && g.state !== 'honking') {
        g.state = 'swimming';
        if (Math.random() < 0.04) this.createRipple(g.x, g.y + 10);
      } else if (!inPond && g.state === 'swimming') {
        g.state = 'wandering';
      }

      // State timer transitions
      if (g.stateTimer <= 0) {
        g.stateTimer = Math.random() * 180 + 90;
        const roll = Math.random();
        if (roll < 0.5) {
          g.state = 'wandering';
          g.targetX = 80 + Math.random() * (this.width - 160);
          g.targetY = 190 + Math.random() * (this.height - 290);
        } else if (roll < 0.75) {
          g.state = 'pecking';
        } else if (roll < 0.9 && inPond) {
          g.state = 'swimming';
        } else {
          g.state = 'sleeping';
        }
      }

      // Movement towards targets
      if (g.targetX !== null && g.targetY !== null) {
        const dx = g.targetX - g.x;
        const dy = g.targetY - g.y;
        const dist = Math.hypot(dx, dy);

        if (dist > 5) {
          const speed = (g.state === 'running_to_food' ? 2.3 : 1.1) * (inPond ? 0.65 : 1);
          g.vx = (dx / dist) * speed;
          g.vy = (dy / dist) * speed;
          g.facing = g.vx > 0 ? 1 : -1;
          g.stepPhase += 0.22;
        } else {
          g.targetX = null;
          g.targetY = null;
          g.vx = 0;
          g.vy = 0;
          if (g.state === 'running_to_food') g.state = 'pecking';
        }
      } else {
        g.vx *= 0.88;
        g.vy *= 0.88;
        g.stepPhase += 0.08;
      }

      g.x += g.vx;
      g.y += g.vy;

      // STRICT TOP-DOWN FARM BOUNDS (Strictly below the HUD bar, strictly on farm ground)
      g.x = Math.max(60, Math.min(this.width - 60, g.x));
      g.y = Math.max(180, Math.min(this.height - 90, g.y));

      // Flapping wing animation
      if (g.isFlapping) {
        g.wingAngle = Math.sin(this.timeTick * 0.45) * 0.7;
        if (g.stateTimer <= 0) g.isFlapping = false;
      } else {
        g.wingAngle = Math.sin(g.wobble) * 0.07;
      }
    });

    // Update Ripples
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i];
      r.r += 0.6;
      r.alpha -= 0.018;
      if (r.alpha <= 0) this.ripples.splice(i, 1);
    }

    // Update Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life--;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    // Rain Particles
    if (this.isRaining) {
      for (let i = 0; i < 3; i++) {
        this.particles.push({
          x: Math.random() * this.width,
          y: -10,
          vx: -1.8,
          vy: 10 + Math.random() * 4,
          life: 45,
          type: 'rain'
        });
      }
    }

    // Night Fireflies
    const isNight = this.timeOfDayPhase >= 0.7 || this.timeOfDayPhase < 0.05;
    if (isNight && Math.random() < 0.28) {
      this.particles.push({
        x: Math.random() * this.width,
        y: 160 + Math.random() * (this.height - 240),
        vx: (Math.random() - 0.5) * 0.6,
        vy: (Math.random() - 0.5) * 0.6,
        life: 140,
        maxLife: 140,
        type: 'firefly'
      });
    }

    // Campfire Sparkles
    if (isNight && Math.random() < 0.35) {
      const fireX = this.width * 0.52;
      const fireY = this.height * 0.74;
      this.particles.push({
        x: fireX + (Math.random() * 12 - 6),
        y: fireY - 10,
        vx: (Math.random() - 0.5) * 1.2,
        vy: -Math.random() * 2 - 1.5,
        life: 35,
        maxLife: 35,
        type: 'spark'
      });
    }

    // Speech Bubbles
    for (let i = this.speechBubbles.length - 1; i >= 0; i--) {
      const b = this.speechBubbles[i];
      b.y -= 0.35;
      b.life--;
      if (b.life <= 0) this.speechBubbles.splice(i, 1);
    }
  }

  updateClockHUD() {
    let clockEl = document.getElementById('farmClockPill');
    if (!clockEl) {
      const brandPill = document.querySelector('.galaxy-brand-pill');
      if (brandPill) {
        clockEl = document.createElement('div');
        clockEl.id = 'farmClockPill';
        clockEl.className = 'farm-clock-pill';
        brandPill.parentNode.insertBefore(clockEl, brandPill.nextSibling);
      }
    }

    if (clockEl) {
      const p = this.timeOfDayPhase;
      // Convert 0..1 phase to 24-hour time: 0.0 = 06:00 (Dawn), 0.25 = 12:00 (Noon), 0.5 = 18:00 (Sunset), 0.75 = 00:00 (Midnight)
      const totalMinutes = Math.floor(((p * 24 + 6) % 24) * 60);
      const hours = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
      const mins = String(totalMinutes % 60).padStart(2, '0');

      let icon = '☀️';
      let period = 'กลางวัน (Day)';
      if (p < 0.15) {
        icon = '🌅';
        period = 'เช้าตรู่ (Sunrise)';
      } else if (p < 0.5) {
        icon = '☀️';
        period = 'กลางวัน (Day)';
      } else if (p < 0.7) {
        icon = '🌇';
        period = 'พลบค่ำ (Sunset)';
      } else {
        icon = '🌙';
        period = 'ค่ำคืน (Night)';
      }

      clockEl.innerHTML = `<span style="font-size: 1rem;">${icon}</span> <span>${hours}:${mins} น. • ${period}</span>`;
    }
  }

  draw() {
    const ctx = this.ctx;
    if (!ctx) return;

    ctx.clearRect(0, 0, this.width, this.height);

    // 1. Top-Down Grassland Base & Warm Dirt Pathways
    this.drawTopDownTerrain(ctx);

    // 2. Tilled Crop Fields (Wheat, Sunflowers, Strawberries, Pumpkins)
    this.drawCropFields(ctx);

    // 3. Crystal Clear Cyan/Sky-Blue Organic Pond & Wooden Pier
    this.drawOrganicPond(ctx);

    // 4. Stardew 2.5D Red Barn, Silo, Chicken Coop & Wooden Fences
    this.drawStardewBarnAndStructures(ctx);

    // 5. Apple Trees, Hay Bales, Stone Well, Campfire & Night Lanterns
    this.drawDecorationsAndTrees(ctx);

    // 6. Water Ripples & Food Grains
    this.drawRipples(ctx);
    this.drawFoodGrains(ctx);

    // 7. Nest & Golden Egg
    this.drawNestAndEgg(ctx);

    // 8. Draw Top-Down 2.5D Geese sorted by Y-depth (with Fixed Solid Neck)
    const sortedGeese = [...this.geese].sort((a, b) => a.y - b.y);
    sortedGeese.forEach(g => {
      if (g.stage !== 'egg') {
        this.drawTopDownGoose(ctx, g);
      }
    });

    // 9. Particles (Rain, Night Fireflies, Campfire Sparks, Feathers)
    this.drawParticles(ctx);

    // 10. Speech Bubbles
    this.drawSpeechBubbles(ctx);

    // 11. 10-Minute Dynamic Day/Night Lighting Filter & Cozy Lantern/Campfire Glow
    this.drawAmbientLightingAndLanterns(ctx);
  }

  /* ==========================================================================
     1. Top-Down Grassland Base & Warm Dirt Pathways
     ========================================================================== */
  drawTopDownTerrain(ctx) {
    const p = this.timeOfDayPhase;
    const isNight = (p >= 0.7 || p < 0.05);
    const isSunset = (p >= 0.5 && p < 0.7);

    // Base Grass Color
    const grassColor = isNight ? '#064e3b' : (isSunset ? '#166534' : '#22c55e');
    ctx.fillStyle = grassColor;
    ctx.fillRect(0, 0, this.width, this.height);

    // Subtle Grass Tuft Texture
    ctx.fillStyle = isNight ? '#047857' : (isSunset ? '#15803d' : '#4ade80');
    for (let i = 0; i < 40; i++) {
      const gx = ((i * 187) % (this.width - 100)) + 50;
      const gy = ((i * 123) % (this.height - 220)) + 170;
      ctx.beginPath();
      ctx.ellipse(gx, gy, 22, 11, 0.3, 0, Math.PI * 2);
      ctx.fill();

      // Tiny Wild Flowers (Daisies & Buttercups)
      if (i % 3 === 0) {
        ctx.fillStyle = (i % 2 === 0) ? '#ffffff' : '#fde047';
        ctx.beginPath();
        ctx.arc(gx + 6, gy - 4, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = isNight ? '#047857' : '#4ade80';
      }
    }

    // Dirt Pathways (Stardew Style Warm Soil Paths)
    const dirtColor = isNight ? '#451a03' : (isSunset ? '#78350f' : '#b45309');
    ctx.fillStyle = dirtColor;

    // Main horizontal path from Barn across to Pond & Pier
    ctx.beginPath();
    ctx.moveTo(this.width * 0.12, this.height * 0.46);
    ctx.quadraticCurveTo(this.width * 0.38, this.height * 0.44, this.width * 0.54, this.height * 0.56);
    ctx.quadraticCurveTo(this.width * 0.62, this.height * 0.64, this.width * 0.72, this.height * 0.62);
    ctx.lineTo(this.width * 0.72, this.height * 0.70);
    ctx.quadraticCurveTo(this.width * 0.6, this.height * 0.72, this.width * 0.52, this.height * 0.62);
    ctx.quadraticCurveTo(this.width * 0.36, this.height * 0.52, this.width * 0.12, this.height * 0.54);
    ctx.closePath();
    ctx.fill();

    // Cobblestone accents on the path
    ctx.fillStyle = isNight ? '#334155' : '#94a3b8';
    for (let i = 0; i < 22; i++) {
      const cx = this.width * 0.16 + (i * (this.width * 0.52 / 22));
      const cy = this.height * 0.49 + Math.sin(i * 0.6) * 16;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 5.5, 4, i * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* ==========================================================================
     2. Tilled Crop Fields (Wheat, Sunflowers, Strawberries, Pumpkins)
     ========================================================================== */
  drawCropFields(ctx) {
    const fieldX = this.width * 0.36;
    const fieldY = this.height * 0.22;
    const fW = 180;
    const fH = 135;

    ctx.save();

    // Tilled Dark Soil Patch
    ctx.fillStyle = '#451a03';
    drawSafeRoundRect(ctx, fieldX, fieldY, fW, fH, 12);
    ctx.fill();
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Furrow Lines (แปลงยกร่องดิน)
    const rows = 4;
    const cols = 5;
    const rowH = fH / (rows + 1);
    const colW = fW / (cols + 1);

    for (let r = 1; r <= rows; r++) {
      const ry = fieldY + r * rowH;
      ctx.strokeStyle = '#290e02';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(fieldX + 10, ry);
      ctx.lineTo(fieldX + fW - 10, ry);
      ctx.stroke();

      for (let c = 1; c <= cols; c++) {
        const cx = fieldX + c * colW;

        if (r === 1) {
          // Golden Wheat (ข้าวสาลีสีทอง)
          ctx.fillStyle = '#f59e0b';
          ctx.beginPath();
          ctx.arc(cx, ry - 6, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#15803d';
          ctx.fillRect(cx - 1, ry - 3, 2, 6);
        } else if (r === 2) {
          // Sunflowers (ดอกทานตะวันสดใส)
          ctx.fillStyle = '#fbbf24';
          ctx.beginPath();
          ctx.arc(cx, ry - 8, 7, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#78350f';
          ctx.beginPath();
          ctx.arc(cx, ry - 8, 3.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#15803d';
          ctx.fillRect(cx - 1, ry - 4, 2, 7);
        } else if (r === 3) {
          // Strawberries (สตรอว์เบอร์รีแดงฉ่ำ)
          ctx.fillStyle = '#15803d';
          ctx.beginPath();
          ctx.arc(cx, ry - 4, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.arc(cx - 2, ry - 3, 3, 0, Math.PI * 2);
          ctx.arc(cx + 2, ry - 3, 3, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Plump Orange Pumpkins (ฟักทองสีส้ม)
          ctx.fillStyle = '#f97316';
          ctx.beginPath();
          ctx.ellipse(cx, ry - 5, 7, 5.5, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#15803d';
          ctx.fillRect(cx - 1, ry - 9, 2, 4); // Vine stem
        }
      }
    }

    // Cute Scarecrow (หุ่นไล่กา)
    const scX = fieldX + fW + 16;
    const scY = fieldY + fH / 2;
    ctx.fillStyle = '#92400e';
    ctx.fillRect(scX - 2, scY - 14, 4, 28);
    ctx.fillRect(scX - 10, scY - 6, 20, 3);
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(scX - 6, scY - 6, 12, 10);
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.ellipse(scX, scY - 14, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /* ==========================================================================
     3. Crystal Clear Cyan/Sky-Blue Organic Pond with Lotus & Wooden Pier
     ========================================================================== */
  drawOrganicPond(ctx) {
    const p = this.timeOfDayPhase;
    const isNight = (p >= 0.7 || p < 0.05);

    const pondX = this.width * 0.72;
    const pondY = this.height * 0.58;
    const pondRx = this.width * 0.22;
    const pondRy = this.height * 0.24;

    ctx.save();

    // 1. Natural Mud & Sandy Pebble Shoreline
    ctx.fillStyle = isNight ? '#291405' : '#78350f';
    ctx.beginPath();
    ctx.ellipse(pondX, pondY, pondRx + 10, pondRy + 10, -0.08, 0, Math.PI * 2);
    ctx.fill();

    // Golden Sand Edge Ring
    ctx.fillStyle = '#ca8a04';
    ctx.beginPath();
    ctx.ellipse(pondX, pondY, pondRx + 4, pondRy + 4, -0.08, 0, Math.PI * 2);
    ctx.fill();

    // Smooth Shore Pebbles
    ctx.fillStyle = '#64748b';
    for (let i = 0; i < 18; i++) {
      const angle = (i / 18) * Math.PI * 2;
      const px = pondX + Math.cos(angle) * (pondRx + 5);
      const py = pondY + Math.sin(angle) * (pondRy + 5);
      ctx.beginPath();
      ctx.ellipse(px, py, 6, 4, angle, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2. Crystal Clear Cyan & Sky-Blue Water Body (บ่อน้ำสีฟ้าสดใส!)
    ctx.beginPath();
    ctx.ellipse(pondX, pondY, pondRx, pondRy, -0.08, 0, Math.PI * 2);

    const waterGrad = ctx.createRadialGradient(pondX, pondY, pondRx * 0.15, pondX, pondY, pondRx);
    if (isNight) {
      // Midnight Deep Cyan
      waterGrad.addColorStop(0, '#0284c7');
      waterGrad.addColorStop(0.65, '#0369a1');
      waterGrad.addColorStop(1, '#0c4a6e');
    } else {
      // Sparkling Crystal Sky-Blue (ฟ้าสดใสประกายน้ำ)
      waterGrad.addColorStop(0, '#7dd3fc'); // Light sky cyan core
      waterGrad.addColorStop(0.55, '#38bdf8'); // Radiant vibrant blue
      waterGrad.addColorStop(0.85, '#0284c7'); // Deep rich blue edge
      waterGrad.addColorStop(1, '#0369a1');
    }

    ctx.fillStyle = waterGrad;
    ctx.fill();

    // Water Shimmer Highlights (ประกายคลื่นน้ำสีขาว)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(pondX - 20, pondY - 20, 28, 0.2, 1.4);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(pondX + 40, pondY + 15, 34, 3.2, 4.4);
    ctx.stroke();

    // 3. Wooden Fishing Pier / Dock (สะพานไม้ท่าน้ำ)
    const pierX = pondX - pondRx + 10;
    const pierY = pondY - 12;
    const pierW = 78;
    const pierH = 34;

    ctx.fillStyle = isNight ? '#451a03' : '#92400e';
    drawSafeRoundRect(ctx, pierX, pierY, pierW, pierH, 4);
    ctx.fill();

    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 1.5;
    for (let px = pierX + 10; px < pierX + pierW; px += 10) {
      ctx.beginPath();
      ctx.moveTo(px, pierY);
      ctx.lineTo(px, pierY + pierH);
      ctx.stroke();
    }

    // Pier Support Posts
    ctx.fillStyle = '#451a03';
    ctx.fillRect(pierX + pierW - 8, pierY + pierH, 6, 12);
    ctx.fillRect(pierX + pierW - 8, pierY - 8, 6, 10);

    // 4. Floating Water Lily Pads & Pink Lotus
    this.drawLilyPad(ctx, pondX + 45, pondY - 35, 22, '#15803d', '#f43f5e');
    this.drawLilyPad(ctx, pondX - 30, pondY + 45, 26, '#166534', '#fbcfe8');
    this.drawLilyPad(ctx, pondX + 65, pondY + 30, 19, '#15803d', '#fb7185');

    // 5. Reeds (ต้นกกริมน้ำ)
    this.drawReeds(ctx, pondX + pondRx - 25, pondY - 20);
    this.drawReeds(ctx, pondX - 50, pondY - pondRy + 15);

    ctx.restore();
  }

  drawLilyPad(ctx, x, y, size, padColor, flowerColor) {
    ctx.save();
    ctx.fillStyle = padColor;
    ctx.beginPath();
    ctx.ellipse(x, y, size, size * 0.58, 0.2, 0, Math.PI * 1.8);
    ctx.lineTo(x, y);
    ctx.closePath();
    ctx.fill();

    // Pink Lotus Flower
    ctx.fillStyle = flowerColor;
    ctx.beginPath();
    ctx.arc(x + 2, y - 4, size * 0.32, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(x + 2, y - 4, size * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawReeds(ctx, x, y) {
    ctx.save();
    ctx.strokeStyle = '#15803d';
    ctx.lineWidth = 2;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(x + i * 5, y);
      ctx.quadraticCurveTo(x + i * 8, y - 18, x + i * 6, y - 36);
      ctx.stroke();

      ctx.fillStyle = '#78350f';
      drawSafeRoundRect(ctx, x + i * 6 - 2, y - 34, 4, 10, 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /* ==========================================================================
     4. Stardew 2.5D Red Barn, Silo & Wooden Fences
     ========================================================================== */
  drawStardewBarnAndStructures(ctx) {
    const p = this.timeOfDayPhase;
    const isNight = (p >= 0.7 || p < 0.05);

    const barnX = this.width * 0.1;
    const barnY = this.height * 0.22;
    const bW = 140;
    const bH = 95;

    ctx.save();

    // Grain Silo (ถังไซโลข้างโรงนา)
    const siloX = barnX - 32;
    const siloY = barnY + 5;
    const sW = 26;
    const sH = 85;

    const siloGrad = ctx.createLinearGradient(siloX, 0, siloX + sW, 0);
    siloGrad.addColorStop(0, '#94a3b8');
    siloGrad.addColorStop(0.5, '#f1f5f9');
    siloGrad.addColorStop(1, '#64748b');
    ctx.fillStyle = siloGrad;
    ctx.fillRect(siloX, siloY, sW, sH);

    ctx.fillStyle = '#64748b';
    ctx.beginPath();
    ctx.arc(siloX + sW / 2, siloY, sW / 2, Math.PI, 0);
    ctx.fill();

    // Barn Building (2.5D Rustic Red Barn)
    const barnGrad = ctx.createLinearGradient(barnX, 0, barnX + bW, 0);
    barnGrad.addColorStop(0, '#991b1b');
    barnGrad.addColorStop(0.5, '#b91c1c');
    barnGrad.addColorStop(1, '#7f1d1d');
    ctx.fillStyle = barnGrad;
    ctx.fillRect(barnX, barnY, bW, bH);

    // Barn Shingle Gambrel Roof
    ctx.fillStyle = '#450a0a';
    ctx.beginPath();
    ctx.moveTo(barnX - 14, barnY);
    ctx.lineTo(barnX + 22, barnY - 32);
    ctx.lineTo(barnX + bW - 22, barnY - 32);
    ctx.lineTo(barnX + bW + 14, barnY);
    ctx.closePath();
    ctx.fill();

    // White Roof Trim
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(barnX - 14, barnY);
    ctx.lineTo(barnX + 22, barnY - 32);
    ctx.lineTo(barnX + bW - 22, barnY - 32);
    ctx.lineTo(barnX + bW + 14, barnY);
    ctx.stroke();

    // Double Barn Doors with White X
    const doorW = 46;
    const doorH = 48;
    const doorX = barnX + (bW - doorW) / 2;
    const doorY = barnY + bH - doorH;

    ctx.fillStyle = '#450a0a';
    ctx.fillRect(doorX, doorY, doorW, doorH);

    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 3;
    ctx.strokeRect(doorX, doorY, doorW, doorH);
    ctx.beginPath();
    ctx.moveTo(doorX, doorY);
    ctx.lineTo(doorX + doorW / 2, doorY + doorH);
    ctx.moveTo(doorX + doorW / 2, doorY);
    ctx.lineTo(doorX, doorY + doorH);
    ctx.moveTo(doorX + doorW / 2, doorY);
    ctx.lineTo(doorX + doorW, doorY + doorH);
    ctx.moveTo(doorX + doorW, doorY);
    ctx.lineTo(doorX + doorW / 2, doorY + doorH);
    ctx.stroke();

    // Upper Loft Window (Glows Warm Yellow at Night!)
    const loftX = barnX + bW / 2 - 12;
    const loftY = barnY + 8;
    const loftW = 24;
    const loftH = 20;

    if (isNight) {
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 18;
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(loftX, loftY, loftW, loftH);
      ctx.shadowBlur = 0;
    } else {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(loftX, loftY, loftW, loftH);
    }
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(loftX, loftY, loftW, loftH);

    // Weather Vane on Roof
    const cupolaX = barnX + bW / 2;
    const cupolaY = barnY - 32;
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cupolaX, cupolaY);
    ctx.lineTo(cupolaX, cupolaY - 14);
    ctx.stroke();
    ctx.font = '10px sans-serif';
    ctx.fillText('🪿', cupolaX - 6, cupolaY - 15);

    // Wooden Fences around the Barn Pen
    const fenceY = barnY + bH + 8;
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(barnX - 20, fenceY);
    ctx.lineTo(barnX + bW + 20, fenceY);
    ctx.moveTo(barnX - 20, fenceY + 12);
    ctx.lineTo(barnX + bW + 20, fenceY + 12);
    ctx.stroke();

    for (let fx = barnX - 20; fx <= barnX + bW + 20; fx += 25) {
      ctx.fillStyle = '#92400e';
      ctx.fillRect(fx - 2, fenceY - 6, 4, 26);
    }

    ctx.restore();
  }

  /* ==========================================================================
     5. Apple Trees, Hay Bales, Stone Well, Campfire & Night Lanterns
     ========================================================================== */
  drawDecorationsAndTrees(ctx) {
    const p = this.timeOfDayPhase;
    const isNight = (p >= 0.7 || p < 0.05);

    // 1. Lush Apple Tree (Right Top Corner)
    this.drawAppleTree(ctx, this.width * 0.88, this.height * 0.24, 42);

    // 2. Small Apple Tree (Left Bottom)
    this.drawAppleTree(ctx, this.width * 0.08, this.height * 0.65, 34);

    // 3. Stone Water Well (บ่อน้ำโบราณ)
    const wellX = this.width * 0.28;
    const wellY = this.height * 0.44;
    ctx.save();
    ctx.fillStyle = '#64748b';
    ctx.beginPath();
    ctx.ellipse(wellX, wellY, 18, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0284c7';
    ctx.beginPath();
    ctx.ellipse(wellX, wellY, 13, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Well Roof
    ctx.fillStyle = '#78350f';
    ctx.fillRect(wellX - 16, wellY - 24, 4, 24);
    ctx.fillRect(wellX + 12, wellY - 24, 4, 24);
    ctx.fillStyle = '#991b1b';
    ctx.beginPath();
    ctx.moveTo(wellX - 20, wellY - 24);
    ctx.lineTo(wellX, wellY - 36);
    ctx.lineTo(wellX + 20, wellY - 24);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 4. Golden Hay Bales (กองฟางม้วน)
    const hayX = this.width * 0.26;
    const hayY = this.height * 0.35;
    ctx.save();
    ctx.fillStyle = '#eab308';
    ctx.beginPath();
    ctx.ellipse(hayX, hayY, 18, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ca8a04';
    ctx.beginPath();
    ctx.ellipse(hayX + 15, hayY + 4, 14, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 5. Cozy Campfire near the Pier (กองไฟอบอุ่น)
    const fireX = this.width * 0.52;
    const fireY = this.height * 0.74;
    ctx.save();
    // Stone Circle
    ctx.fillStyle = '#475569';
    for (let i = 0; i < 7; i++) {
      const fa = (i / 7) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(fireX + Math.cos(fa) * 12, fireY + Math.sin(fa) * 7, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    // Fire Wood Logs
    ctx.fillStyle = '#78350f';
    ctx.fillRect(fireX - 8, fireY - 3, 16, 5);
    ctx.fillRect(fireX - 3, fireY - 8, 6, 14);

    // Glowing Flames
    const flicker = Math.sin(this.timeTick * 0.3) * 2;
    ctx.fillStyle = '#ea580c';
    ctx.beginPath();
    ctx.arc(fireX, fireY - 6 + flicker, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(fireX, fireY - 7 + flicker, 4.5, 0, Math.PI * 2);
    ctx.fill();

    if (isNight) {
      // Warm Campfire Radial Glow
      const fireGlow = ctx.createRadialGradient(fireX, fireY - 6, 4, fireX, fireY - 6, 65);
      fireGlow.addColorStop(0, 'rgba(251, 146, 60, 0.85)');
      fireGlow.addColorStop(0.5, 'rgba(245, 158, 11, 0.35)');
      fireGlow.addColorStop(1, 'rgba(245, 158, 11, 0)');
      ctx.fillStyle = fireGlow;
      ctx.beginPath();
      ctx.arc(fireX, fireY - 6, 65, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawAppleTree(ctx, x, y, radius) {
    ctx.save();
    ctx.fillStyle = '#5c2c16';
    ctx.fillRect(x - 8, y, 16, radius * 0.9);

    ctx.fillStyle = '#15803d';
    ctx.beginPath();
    ctx.arc(x, y - radius * 0.4, radius, 0, Math.PI * 2);
    ctx.arc(x - radius * 0.6, y, radius * 0.75, 0, Math.PI * 2);
    ctx.arc(x + radius * 0.6, y, radius * 0.75, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.arc(x - radius * 0.2, y - radius * 0.6, radius * 0.65, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(x - 12, y - 10, 4, 0, Math.PI * 2);
    ctx.arc(x + 15, y - 15, 4, 0, Math.PI * 2);
    ctx.arc(x + 2, y + 8, 4, 0, Math.PI * 2);
    ctx.arc(x - 18, y + 6, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawNestAndEgg(ctx) {
    const nestX = this.width * 0.24;
    const nestY = this.height * 0.72;

    ctx.fillStyle = '#92400e';
    ctx.beginPath();
    ctx.ellipse(nestX, nestY, 28, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ca8a04';
    ctx.beginPath();
    ctx.ellipse(nestX, nestY - 2, 24, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    const egg = this.geese.find(g => g.stage === 'egg');
    if (egg) {
      ctx.save();
      ctx.translate(nestX, nestY - 14);
      ctx.rotate(Math.sin(egg.wobble) * 0.14);

      const eggGrad = ctx.createRadialGradient(-3, -4, 2, 0, 0, 16);
      eggGrad.addColorStop(0, '#ffffff');
      eggGrad.addColorStop(0.7, '#fef08a');
      eggGrad.addColorStop(1, '#eab308');
      ctx.fillStyle = eggGrad;
      ctx.beginPath();
      ctx.ellipse(0, 0, 14, 18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ca8a04';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      if ((egg.progress || 0) > 50) {
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-5, -6);
        ctx.lineTo(0, -1);
        ctx.lineTo(-3, 4);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  /* ==========================================================================
     6. Top-Down Animated Goose with Solid, Fixed Neck Path
     ========================================================================== */
  drawTopDownGoose(ctx, g) {
    ctx.save();
    ctx.translate(g.x, g.y);
    ctx.scale(g.facing * g.scale, g.scale);

    const isSwimming = g.state === 'swimming';
    const isSleeping = g.state === 'sleeping';
    const bob = isSwimming ? Math.sin(g.wobble) * 2.5 : Math.abs(Math.sin(g.wobble)) * 2;

    // Palette per Skin
    let bodyColor = '#ffffff';
    let shadeColor = '#e2e8f0';
    let beakColor = '#f97316';
    let legColor = '#ea580c';

    if (g.skin === 'golden_honk') {
      bodyColor = '#fef08a';
      shadeColor = '#fde047';
      beakColor = '#d97706';
      legColor = '#b45309';
    } else if (g.skin === 'cosmic_deity') {
      bodyColor = '#e0e7ff';
      shadeColor = '#818cf8';
      beakColor = '#c084fc';
      legColor = '#9333ea';
    } else if (g.skin === 'ninja_black') {
      bodyColor = '#334155';
      shadeColor = '#1e293b';
      beakColor = '#f97316';
      legColor = '#c2410c';
    }

    // 1. Soft Shadow on ground
    if (!isSwimming) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
      ctx.beginPath();
      ctx.ellipse(0, 18, 18, 7, 0, 0, Math.PI * 2);
      ctx.fill();

      // 2. Animated Orange Webbed Feet
      const legStep = Math.sin(g.stepPhase) * 6;
      ctx.fillStyle = legColor;

      // Left Foot
      ctx.fillRect(-6 + legStep, 10, 3.5, 9);
      ctx.beginPath();
      ctx.moveTo(-8 + legStep, 19);
      ctx.lineTo(-2 + legStep, 19);
      ctx.lineTo(-5 + legStep, 15);
      ctx.fill();

      // Right Foot
      ctx.fillRect(4 - legStep, 10, 3.5, 9);
      ctx.beginPath();
      ctx.moveTo(2 - legStep, 19);
      ctx.lineTo(8 - legStep, 19);
      ctx.lineTo(5 - legStep, 15);
      ctx.fill();
    } else {
      // Swimming Water Wake Ring
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(0, bob + 5, 22, 9, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 3. Plump Goose Body
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.moveTo(-14, bob + 2);
    ctx.quadraticCurveTo(-24, bob - 8, -28, bob - 10); // Tail
    ctx.quadraticCurveTo(-20, bob + 4, -12, bob + 10);
    ctx.quadraticCurveTo(0, bob + 18, 14, bob + 10); // Belly
    ctx.quadraticCurveTo(22, bob + 2, 16, bob - 6);
    ctx.quadraticCurveTo(6, bob - 12, -14, bob + 2);
    ctx.closePath();
    ctx.fill();

    // Body Shadow Undertone
    ctx.fillStyle = shadeColor;
    ctx.beginPath();
    ctx.moveTo(-10, bob + 8);
    ctx.quadraticCurveTo(0, bob + 18, 14, bob + 10);
    ctx.quadraticCurveTo(2, bob + 14, -10, bob + 8);
    ctx.fill();

    // 4. Layered Wing Feathers
    ctx.save();
    ctx.translate(-4, bob - 2);
    ctx.rotate(g.wingAngle);
    ctx.fillStyle = shadeColor;
    ctx.beginPath();
    ctx.ellipse(0, 0, 14, 8, -0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 5. SOLID CONTINUOUS NECK (Guaranteed Never to Disappear / Clip!)
    ctx.fillStyle = bodyColor;
    if (isSleeping) {
      // Head tucked onto back
      ctx.beginPath();
      ctx.arc(6, bob - 4, 8, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Solid unified neck column
      ctx.beginPath();
      ctx.moveTo(6, bob + 2);
      ctx.lineTo(16, bob - 22);
      ctx.lineTo(24, bob - 22);
      ctx.lineTo(16, bob + 2);
      ctx.closePath();
      ctx.fill();

      // Solid Head Sphere
      ctx.beginPath();
      ctx.arc(19, bob - 22, 8, 0, Math.PI * 2);
      ctx.fill();
    }

    // 6. Orange Beak with Nostril
    ctx.fillStyle = beakColor;
    ctx.beginPath();
    if (isSleeping) {
      ctx.moveTo(12, bob - 4);
      ctx.lineTo(19, bob - 2);
      ctx.lineTo(12, bob);
    } else {
      ctx.moveTo(24, bob - 24);
      ctx.lineTo(33, bob - 21); // Beak tip
      ctx.lineTo(24, bob - 18);
    }
    ctx.closePath();
    ctx.fill();

    // 7. Expressive Dark Eye
    ctx.fillStyle = '#0f172a';
    if (isSleeping) {
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#334155';
      ctx.beginPath();
      ctx.arc(16, bob - 22, 2.5, 0.2, Math.PI - 0.2);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(19, bob - 24, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(19.7, bob - 24.7, 0.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // 8. Snugly Attached Head Accessories
    this.drawFittedAccessories(ctx, g, 19, bob - 22);

    ctx.restore();
  }

  drawFittedAccessories(ctx, g, headX, headY) {
    if (g.hat === 'straw_hat') {
      ctx.save();
      ctx.translate(headX - 1, headY - 8);
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.ellipse(0, 0, 14, 4, -0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ca8a04';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      drawSafeRoundRect(ctx, -6, -9, 12, 9, 2);
      ctx.fill();

      ctx.fillStyle = '#dc2626';
      ctx.fillRect(-6, -3, 12, 3);
      ctx.restore();
    } else if (g.hat === 'wizard_hat') {
      ctx.save();
      ctx.translate(headX, headY - 8);
      ctx.fillStyle = '#6366f1';
      ctx.beginPath();
      ctx.ellipse(0, 0, 14, 4, -0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-9, 0);
      ctx.lineTo(9, 0);
      ctx.lineTo(3, -22);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(2, -23, 3, 3);
      ctx.restore();
    } else if (g.hat === 'crown') {
      ctx.save();
      ctx.translate(headX, headY - 8);
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.moveTo(-7, 0);
      ctx.lineTo(-8, -10);
      ctx.lineTo(-3, -5);
      ctx.lineTo(0, -12);
      ctx.lineTo(3, -5);
      ctx.lineTo(8, -10);
      ctx.lineTo(7, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    if (g.glasses === 'sunglasses') {
      ctx.save();
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(headX + 2, headY - 3, 11, 4.5);
      ctx.fillRect(headX + 5, headY - 4, 3, 2);
      ctx.restore();
    }
  }

  drawRipples(ctx) {
    ctx.lineWidth = 1.5;
    this.ripples.forEach(r => {
      ctx.beginPath();
      ctx.ellipse(r.x, r.y, r.r * 1.5, r.r * 0.8, 0, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, 255, 255, ${r.alpha})`;
      ctx.stroke();
    });
  }

  drawFoodGrains(ctx) {
    ctx.fillStyle = '#f59e0b';
    this.foodGrains.forEach(f => {
      ctx.beginPath();
      ctx.arc(f.x, f.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  drawParticles(ctx) {
    this.particles.forEach(p => {
      if (p.type === 'rain') {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + p.vx, p.y + p.vy);
        ctx.stroke();
      } else if (p.type === 'firefly') {
        const alpha = Math.sin((p.life / p.maxLife) * Math.PI);
        ctx.fillStyle = `rgba(167, 243, 208, ${alpha})`;
        ctx.shadowColor = '#34d399';
        ctx.shadowBlur = 9;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      } else if (p.type === 'spark') {
        const alpha = p.life / p.maxLife;
        ctx.fillStyle = `rgba(251, 191, 36, ${alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.8, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'feather') {
        ctx.fillStyle = p.color || '#ffffff';
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, 3, 7, 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }

  drawSpeechBubbles(ctx) {
    this.speechBubbles.forEach(b => {
      const alpha = Math.min(1, b.life / 20);
      ctx.font = 'bold 12px "Nunito", "Prompt", sans-serif';
      const textWidth = ctx.measureText(b.text).width;

      ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.95})`;
      ctx.beginPath();
      drawSafeRoundRect(ctx, b.x - textWidth / 2 - 9, b.y - 20, textWidth + 18, 24, 12);
      ctx.fill();

      ctx.fillStyle = `rgba(15, 23, 42, ${alpha})`;
      ctx.textAlign = 'center';
      ctx.fillText(b.text, b.x, b.y - 4);
    });
  }

  /* ==========================================================================
     7. Dynamic Day/Night Lighting Filter & Farm Lanterns
     ========================================================================== */
  drawAmbientLightingAndLanterns(ctx) {
    const p = this.timeOfDayPhase;
    const isNight = (p >= 0.7 || p < 0.05);

    // 1. Post Lanterns along the pathways
    const lanterns = [
      { x: this.width * 0.35, y: this.height * 0.44 },
      { x: this.width * 0.56, y: this.height * 0.54 },
      { x: this.width * 0.73, y: this.height * 0.65 }
    ];

    lanterns.forEach(lt => {
      // Wooden Pole
      ctx.fillStyle = '#5c2c16';
      ctx.fillRect(lt.x - 2, lt.y - 18, 4, 20);

      // Lantern Lamp Cap
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.moveTo(lt.x - 6, lt.y - 18);
      ctx.lineTo(lt.x + 6, lt.y - 18);
      ctx.lineTo(lt.x, lt.y - 24);
      ctx.closePath();
      ctx.fill();

      if (isNight) {
        ctx.save();
        const lightGrad = ctx.createRadialGradient(lt.x, lt.y - 14, 2, lt.x, lt.y - 14, 46);
        lightGrad.addColorStop(0, 'rgba(251, 191, 36, 0.95)');
        lightGrad.addColorStop(0.4, 'rgba(245, 158, 11, 0.4)');
        lightGrad.addColorStop(1, 'rgba(245, 158, 11, 0)');
        ctx.fillStyle = lightGrad;
        ctx.beginPath();
        ctx.arc(lt.x, lt.y - 14, 46, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#fef08a';
        ctx.fillRect(lt.x - 3, lt.y - 17, 6, 6);
        ctx.restore();
      } else {
        ctx.fillStyle = '#fde047';
        ctx.fillRect(lt.x - 3, lt.y - 17, 6, 6);
      }
    });

    // 2. Ambient Shading Overlay (Clear Day / Sunset / Night Differences)
    if (p >= 0.5 && p < 0.7) {
      // Golden Twilight Tint (พลบค่ำ)
      const sunsetAlpha = Math.sin(((p - 0.5) / 0.2) * Math.PI) * 0.22;
      ctx.fillStyle = `rgba(249, 115, 22, ${sunsetAlpha})`;
      ctx.fillRect(0, 0, this.width, this.height);
    } else if (isNight) {
      // Deep Atmospheric Midnight Blue Tint (ค่ำคืน)
      const nightAlpha = p >= 0.7 ? Math.min(0.48, ((p - 0.7) / 0.1) * 0.48) : (0.05 - p) / 0.05 * 0.48;
      ctx.fillStyle = `rgba(15, 23, 42, ${nightAlpha})`;
      ctx.fillRect(0, 0, this.width, this.height);
    }
  }

  animate() {
    try {
      this.update();
      this.draw();
    } catch (err) {
      console.error('Farm render error:', err);
    }
    requestAnimationFrame(this.animate);
  }

  refreshEntities() {
    this.initEntities();
  }
}
