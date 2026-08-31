/**
 * GooseFocus - Pixel-Perfect Stardew Valley Autumn Farmstead & Collision Engine
 * 
 * Features:
 * 1. Exact Stardew Valley Layout: Green-roof log farmhouse, stone cottage, walled pumpkin garden,
 *    trellis crops, apple orchard with mushrooms, corner pond with pine tree, and top perimeter fence.
 * 2. Solid Wall & Gate Collision Engine: Geese cannot walk through stone walls, houses, or fences;
 *    they navigate smoothly along cobblestone paths and through open wooden gates!
 * 3. 10-Minute Day/Night Loop with cozy glowing windows, lantern lights, and night fireflies.
 * 4. Solid anatomical top-down geese with waddling steps, swimming ripples, and snug accessories.
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
    this.smokeParticles = [];

    this.timeTick = 0;
    this.isRaining = false;
    this.weatherTimer = 0;

    // 10-Minute Day/Night Cycle (600s loop)
    this.cycleDurationSec = 600;
    this.timeOfDayPhase = 0.25;

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
      { x: this.width * 0.15, y: this.height * 0.06, speed: 0.12, scale: 1.1, opacity: 0.18 },
      { x: this.width * 0.55, y: this.height * 0.12, speed: 0.08, scale: 0.85, opacity: 0.15 },
      { x: this.width * 0.85, y: this.height * 0.04, speed: 0.15, scale: 1.2, opacity: 0.2 }
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

    // Start inside valid walkable farm clearings
    const validSpawns = [
      { x: this.width * 0.18, y: this.height * 0.38 }, // Orchard
      { x: this.width * 0.58, y: this.height * 0.48 }, // Inside Pumpkin Garden
      { x: this.width * 0.36, y: this.height * 0.68 }, // Near Farmhouse Path
      { x: this.width * 0.72, y: this.height * 0.44 }, // Stone Wall Path
      { x: this.width * 0.84, y: this.height * 0.76 }  // Near Pond
    ];
    const spawn = isEgg ? { x: this.width * 0.26, y: this.height * 0.78 } : validSpawns[index % validSpawns.length];

    return {
      id: data.id || `goose_${index}`,
      name: data.name || 'Goose',
      stage: data.stage || 'adult',
      progress: data.progress || 0,
      hat: data.hat || 'none',
      glasses: data.glasses || 'none',
      skin: data.skin || 'classic_white',
      x: spawn.x + (Math.random() * 40 - 20),
      y: spawn.y + (Math.random() * 30 - 15),
      targetX: null,
      targetY: null,
      vx: 0,
      vy: 0,
      scale: isEgg ? 0.9 : (data.stage === 'gosling' ? 0.75 : 1.05),
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
    this.potentialDragGoose = null;
    this.draggedGoose = null;
    this.dragOffset = { x: 0, y: 0 };
    this.isDragging = false;
    this.pointerDownPos = { x: 0, y: 0 };

    this.canvas.addEventListener('pointerdown', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      this.pointerDownPos = { x: clickX, y: clickY };
      this.isDragging = false;

      let clickedGoose = null;
      for (const goose of this.geese) {
        const dist = Math.hypot(goose.x - clickX, goose.y - clickY);
        if (dist < 46 * goose.scale) {
          clickedGoose = goose;
          break;
        }
      }

      if (clickedGoose && clickedGoose.stage !== 'egg') {
        this.potentialDragGoose = clickedGoose;
        this.dragOffset = { x: clickedGoose.x - clickX, y: clickedGoose.y - clickY };
      } else if (clickedGoose && clickedGoose.stage === 'egg') {
        this.interactWithGoose(clickedGoose);
      } else {
        this.createRipple(clickX, clickY);
        this.geese.forEach(g => {
          if (g.stage !== 'egg' && Math.random() > 0.3) {
            const target = this.findNearestWalkable(clickX + (Math.random() * 60 - 30), clickY + (Math.random() * 60 - 30));
            g.targetX = target.x;
            g.targetY = target.y;
            g.state = 'wandering';
          }
        });
      }
    });

    window.addEventListener('pointermove', (e) => {
      if (!this.canvas) return;
      const rect = this.canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      if (this.potentialDragGoose && !this.isDragging) {
        if (Math.hypot(clickX - this.pointerDownPos.x, clickY - this.pointerDownPos.y) > 6) {
          this.isDragging = true;
          this.draggedGoose = this.potentialDragGoose;
          this.draggedGoose.isBeingHeld = true;
          this.draggedGoose.state = 'held';
          this.draggedGoose.targetX = null;
          this.draggedGoose.targetY = null;
          this.canvas.style.cursor = 'grabbing';
          soundEngine.playHonk(1.4);
          this.addSpeechBubble(this.draggedGoose.x, this.draggedGoose.y - 50, 'ว๊ายยย! ยกข้ามกำแพง 🪿✨');
        }
      }

      if (this.draggedGoose) {
        this.draggedGoose.x = Math.max(30, Math.min(this.width - 30, clickX + this.dragOffset.x));
        this.draggedGoose.y = Math.max(140, Math.min(this.height - 60, clickY + this.dragOffset.y));
        this.draggedGoose.wingAngle = Math.sin(this.timeTick * 0.8) * 0.9;
      }
    });

    window.addEventListener('pointerup', (e) => {
      if (this.isDragging && this.draggedGoose) {
        const inPond = this.isPointInPond(this.draggedGoose.x, this.draggedGoose.y);

        if (inPond) {
          this.draggedGoose.state = 'swimming';
          this.createRipple(this.draggedGoose.x, this.draggedGoose.y);
          this.createRipple(this.draggedGoose.x, this.draggedGoose.y + 12);
          this.addSpeechBubble(this.draggedGoose.x, this.draggedGoose.y - 45, 'ต๋อม! 💦 ว่ายน้ำสบายใจ');
          soundEngine.playClick();
        } else {
          this.draggedGoose.state = 'wandering';
          this.addSpeechBubble(this.draggedGoose.x, this.draggedGoose.y - 45, 'ตุ้บ! 🪿 ข้ามกำแพงสำเร็จ!');
          soundEngine.playHonk(1.0);

          // Landing dust puff
          for (let i = 0; i < 5; i++) {
            this.particles.push({
              x: this.draggedGoose.x + (Math.random() * 20 - 10),
              y: this.draggedGoose.y + 10,
              vx: (Math.random() - 0.5) * 2,
              vy: -Math.random() * 1.5 - 0.5,
              life: 30,
              maxLife: 30,
              type: 'feather',
              color: '#d97706'
            });
          }
        }

        this.draggedGoose.isBeingHeld = false;
        this.draggedGoose = null;
        this.potentialDragGoose = null;
        this.isDragging = false;
        this.canvas.style.cursor = 'default';
      } else if (this.potentialDragGoose) {
        this.interactWithGoose(this.potentialDragGoose);
        this.potentialDragGoose = null;
        this.isDragging = false;
      }
    });

    window.addEventListener('pointercancel', () => {
      if (this.draggedGoose) {
        this.draggedGoose.isBeingHeld = false;
        this.draggedGoose = null;
        this.potentialDragGoose = null;
        this.isDragging = false;
        this.canvas.style.cursor = 'default';
      }
    });
  }

  interactWithGoose(goose) {
    if (goose.stage === 'egg') {
      if ((goose.progress || 0) >= 100) {
        // Hatch the egg!
        soundEngine.playFanfare();
        goose.stage = 'gosling';
        goose.scale = 0.75;
        goose.state = 'honking';
        goose.stateTimer = 60;
        this.addSpeechBubble(goose.x, goose.y - 35, '🐣 กะเทาะเปลือกแล้ว! ยินดีต้อนรับลูกห่านตัวใหม่!');
        store.update(s => {
          const targetG = s.geeseList.find(item => item.id === goose.id);
          if (targetG) {
            targetG.stage = 'gosling';
            targetG.hatchedAt = new Date().toISOString();
          }
        });
        // Confetti explosion
        for (let i = 0; i < 16; i++) {
          this.particles.push({
            x: goose.x,
            y: goose.y - 15,
            vx: (Math.random() - 0.5) * 4.5,
            vy: -Math.random() * 3.5 - 1.5,
            life: 60,
            maxLife: 60,
            type: 'feather',
            color: ['#fbbf24', '#fde047', '#ffffff', '#38bdf8'][Math.floor(Math.random() * 4)]
          });
        }
      } else {
        soundEngine.playClick();
        this.addSpeechBubble(goose.x, goose.y - 30, `🥚 ไข่ห่านทองคำ (${goose.progress || 0}%) • โฟกัสต่อเพื่อฟัก! 🐣`);
      }
      return;
    }

    const pitch = goose.stage === 'gosling' ? 1.5 : (goose.skin === 'cosmic_deity' ? 0.7 : 1.0);
    soundEngine.playHonk(pitch);

    goose.isFlapping = true;
    goose.state = 'honking';
    goose.stateTimer = 50;

    const phrases = ['HONK! 🪿', 'ฮ้อนก์! ✨', 'ฟาร์มห่าน Stardew 🌾', 'สะสมชั่วโมงเพลินๆ ⏱️', 'ก้าบๆ ฟักทองยักษ์ 🎃'];
    const text = phrases[Math.floor(Math.random() * phrases.length)];
    this.addSpeechBubble(goose.x, goose.y - 45 * goose.scale, text);

    for (let i = 0; i < 5; i++) {
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
    const feedX = this.width * 0.58;
    const feedY = this.height * 0.48;

    for (let i = 0; i < 22; i++) {
      this.foodGrains.push({
        x: feedX + (Math.random() * 120 - 60),
        y: feedY + (Math.random() * 80 - 40),
        eaten: false,
        life: 350
      });
    }

    this.geese.forEach(g => {
      if (g.stage !== 'egg') {
        g.targetX = feedX + (Math.random() * 80 - 40);
        g.targetY = feedY + (Math.random() * 60 - 30);
        g.state = 'running_to_food';
      }
    });

    this.addSpeechBubble(feedX, feedY - 45, '🌾 โปรยอาหารในแปลงฟักทอง!');
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

  /* ==========================================================================
     SOLID WALL & OBSTACLE COLLISION ENGINE 🧱
     ========================================================================== */
  isWalkable(x, y) {
    // 1. Outer Screen Boundaries (Below top HUD bar)
    if (x < 40 || x > this.width - 40 || y < 145 || y > this.height - 75) {
      return false;
    }

    // 2. Top Perimeter Wooden Fence Box
    if (y < 165) return false;

    // 3. Green Log Farmhouse Building Footprint (Bottom-Left)
    const houseX = this.width * 0.22;
    const houseY = this.height * 0.58;
    const hW = 140;
    const hH = 145;
    if (x >= houseX - 10 && x <= houseX + hW + 10 && y >= houseY - 10 && y <= houseY + hH + 10) {
      return false;
    }

    // 4. Stone Cottage Footprint (Top-Right)
    const stoneX = this.width * 0.82;
    const stoneY = this.height * 0.16;
    const sW = 130;
    const sH = 120;
    if (x >= stoneX - 10 && x <= stoneX + sW + 10 && y >= stoneY - 10 && y <= stoneY + sH + 10) {
      return false;
    }

    // 5. Apple Tree Trunks Collision (Orchard)
    const trees = [
      { x: this.width * 0.10, y: this.height * 0.24 },
      { x: this.width * 0.28, y: this.height * 0.26 },
      { x: this.width * 0.15, y: this.height * 0.44 }
    ];
    for (const t of trees) {
      if (Math.hypot(x - t.x, y - t.y) < 22) return false;
    }

    // 6. Stone Walls Around Pumpkin Garden (With Open Gates!)
    const wLeft = this.width * 0.40;
    const wRight = this.width * 0.78;
    const wTop = this.height * 0.18;
    const wBottom = this.height * 0.78;

    const northGateX = this.width * 0.58;
    const westGateY = this.height * 0.44;
    const gateSize = 42;

    // North Stone Wall (Check with North Gate opening)
    if (Math.abs(y - wTop) < 14 && x >= wLeft - 8 && x <= wRight + 8) {
      const inNorthGate = Math.abs(x - northGateX) < gateSize / 2;
      if (!inNorthGate) return false;
    }

    // West Stone Wall (Check with West Gate opening)
    if (Math.abs(x - wLeft) < 14 && y >= wTop - 8 && y <= wBottom + 8) {
      const inWestGate = Math.abs(y - westGateY) < gateSize / 2;
      if (!inWestGate) return false;
    }

    // South Stone Wall
    if (Math.abs(y - wBottom) < 14 && x >= wLeft - 8 && x <= this.width * 0.58) {
      return false;
    }

    // East Stone Wall
    if (Math.abs(x - wRight) < 14 && y >= wTop - 8 && y <= this.height * 0.54) {
      return false;
    }

    // East Wall Extension to Lake
    const lakeWallY = this.height * 0.54;
    if (Math.abs(y - lakeWallY) < 14 && x >= this.width * 0.72 && x <= this.width) {
      return false;
    }

    return true;
  }

  findNearestWalkable(x, y) {
    if (this.isWalkable(x, y)) return { x, y };
    for (let r = 10; r <= 80; r += 10) {
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
        const testX = x + Math.cos(a) * r;
        const testY = y + Math.sin(a) * r;
        if (this.isWalkable(testX, testY)) return { x: testX, y: testY };
      }
    }
    return { x: this.width * 0.58, y: this.height * 0.48 }; // Default inside garden
  }

  isPointInPond(x, y) {
    const pondX = this.width * 0.86;
    const pondY = this.height * 0.78;
    const pondRx = this.width * 0.13;
    const pondRy = this.height * 0.16;

    const dx = (x - pondX) / pondRx;
    const dy = (y - pondY) / pondRy;
    return (dx * dx + dy * dy) <= 0.85;
  }

  update() {
    this.timeTick++;

    // 10-Minute Day/Night Loop Calculation (600 seconds)
    const nowSec = Date.now() / 1000;
    this.timeOfDayPhase = (nowSec % this.cycleDurationSec) / this.cycleDurationSec;

    this.updateClockHUD();

    // Chimney Smoke Particles
    if (Math.random() < 0.25) {
      const houseChimneyX = this.width * 0.22 + 120;
      const houseChimneyY = this.height * 0.58 + 8;
      this.smokeParticles.push({
        x: houseChimneyX + (Math.random() * 4 - 2),
        y: houseChimneyY,
        vx: (Math.random() - 0.2) * 0.4,
        vy: -Math.random() * 0.8 - 0.6,
        r: 4,
        life: 55,
        maxLife: 55
      });
    }

    for (let i = this.smokeParticles.length - 1; i >= 0; i--) {
      const sm = this.smokeParticles[i];
      sm.x += sm.vx;
      sm.y += sm.vy;
      sm.r += 0.12;
      sm.life--;
      if (sm.life <= 0) this.smokeParticles.splice(i, 1);
    }

    // Weather check
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
      if (c.x > this.width + 200) c.x = -200;
    });

    // Update Geese with Solid Collision Obstacle Checking
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
        if (roll < 0.55) {
          g.state = 'wandering';
          // Pick a valid random waypoint
          const rx = 60 + Math.random() * (this.width - 120);
          const ry = 180 + Math.random() * (this.height - 270);
          const validTarget = this.findNearestWalkable(rx, ry);
          g.targetX = validTarget.x;
          g.targetY = validTarget.y;
        } else if (roll < 0.8) {
          g.state = 'pecking';
        } else if (roll < 0.92 && inPond) {
          g.state = 'swimming';
        } else {
          g.state = 'sleeping';
        }
      }

      // Movement with Wall Collision Slide & Avoidance
      if (g.targetX !== null && g.targetY !== null) {
        const dx = g.targetX - g.x;
        const dy = g.targetY - g.y;
        const dist = Math.hypot(dx, dy);

        if (dist > 5) {
          const speed = (g.state === 'running_to_food' ? 2.3 : 1.1) * (inPond ? 0.65 : 1);
          const stepVx = (dx / dist) * speed;
          const stepVy = (dy / dist) * speed;

          // Check direct step
          if (this.isWalkable(g.x + stepVx, g.y + stepVy)) {
            g.vx = stepVx;
            g.vy = stepVy;
          } else if (this.isWalkable(g.x + stepVx, g.y)) {
            // Slide horizontally along wall
            g.vx = stepVx;
            g.vy = 0;
          } else if (this.isWalkable(g.x, g.y + stepVy)) {
            // Slide vertically along wall
            g.vx = 0;
            g.vy = stepVy;
          } else {
            // Blocked by corner/wall: find nearest open gate / bypass
            const northGate = { x: this.width * 0.58, y: this.height * 0.18 };
            const westGate = { x: this.width * 0.40, y: this.height * 0.44 };
            const distNorth = Math.hypot(g.x - northGate.x, g.y - northGate.y);
            const distWest = Math.hypot(g.x - westGate.x, g.y - westGate.y);
            const gate = distNorth < distWest ? northGate : westGate;
            g.targetX = gate.x;
            g.targetY = gate.y;
            g.vx *= -0.5;
            g.vy *= -0.5;
          }

          g.facing = g.vx > 0 ? 1 : (g.vx < 0 ? -1 : g.facing);
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

      // Safe step update
      if (this.isWalkable(g.x + g.vx, g.y + g.vy)) {
        g.x += g.vx;
        g.y += g.vy;
      } else {
        g.vx = 0;
        g.vy = 0;
      }

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
        x: this.width * 0.42 + Math.random() * (this.width * 0.35),
        y: this.height * 0.22 + Math.random() * (this.height * 0.52),
        vx: (Math.random() - 0.5) * 0.6,
        vy: (Math.random() - 0.5) * 0.6,
        life: 140,
        maxLife: 140,
        type: 'firefly'
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

    // 1. Base Autumn Earth & Cobblestone Path Network
    this.drawStardewGroundAndPaths(ctx);

    // 2. Top Perimeter Wooden Fence
    this.drawTopPerimeterFence(ctx);

    // 3. Apple Orchard & Autumn Foliage / Mushrooms (Top-Left)
    this.drawAppleOrchardAndBushes(ctx);

    // 4. Walled Garden with Giant Pumpkins, Trellises & Open Gates
    this.drawWalledGardenAndCrops(ctx);

    // 5. Corner Nature Pond with Pine Tree & Lilypads (Bottom-Right)
    this.drawCornerPondAndPine(ctx);

    // 6. Stone Cottage (Top-Right)
    this.drawStoneCottage(ctx);

    // 7. Green-Roofed Log Farmhouse Cabin with Smoking Chimney (Bottom-Left)
    this.drawGreenRoofFarmhouse(ctx);

    // 8. Nest & Golden Egg
    this.drawNestAndEgg(ctx);

    // 9. Water Ripples & Food Grains
    this.drawRipples(ctx);
    this.drawFoodGrains(ctx);

    // 10. Draw Geese Sorted by Y-Depth (Top-Down with Solid Continuous Necks)
    const sortedGeese = [...this.geese].sort((a, b) => a.y - b.y);
    sortedGeese.forEach(g => {
      if (g.stage !== 'egg') {
        this.drawTopDownGoose(ctx, g);
      }
    });

    // 11. Chimney Smoke & Fireflies Particles
    this.drawParticlesAndSmoke(ctx);

    // 12. Speech Bubbles
    this.drawSpeechBubbles(ctx);

    // 13. Dynamic Day/Night Lighting Filter & Warm Window Glows
    this.drawAmbientLightingAndLanterns(ctx);
  }

  /* ==========================================================================
     1. Base Autumn Earth & Cobblestone Path Network
     ========================================================================== */
  drawStardewGroundAndPaths(ctx) {
    const p = this.timeOfDayPhase;
    const isNight = (p >= 0.7 || p < 0.05);
    const isSunset = (p >= 0.5 && p < 0.7);

    // Rich Autumn Warm Soil Ground (Matching Stardew Valley Screenshot)
    const earthColor = isNight ? '#3b1c04' : (isSunset ? '#9a3412' : '#d97706');
    ctx.fillStyle = earthColor;
    ctx.fillRect(0, 0, this.width, this.height);

    // Earthy Soil Texture Patches
    ctx.fillStyle = isNight ? '#291102' : (isSunset ? '#7c2d12' : '#b45309');
    for (let i = 0; i < 45; i++) {
      const px = ((i * 197) % (this.width - 60)) + 30;
      const py = ((i * 137) % (this.height - 180)) + 150;
      ctx.beginPath();
      ctx.ellipse(px, py, 26, 14, 0.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Cobblestone Paved Paths (Connecting Orchard, Garden, House, and Lake)
    const cobbleColor = isNight ? '#475569' : '#d6d3d1';
    const mortarColor = isNight ? '#1e293b' : '#a8a29e';

    // Main Central North-South Cobblestone Path
    this.drawCobbleStrip(ctx, this.width * 0.55, this.height * 0.16, 55, this.height * 0.65, cobbleColor, mortarColor);
    // East-West Path to Farmhouse
    this.drawCobbleStrip(ctx, this.width * 0.24, this.height * 0.68, this.width * 0.35, 45, cobbleColor, mortarColor);
    // Path through West Gate
    this.drawCobbleStrip(ctx, this.width * 0.38, this.height * 0.43, 60, 36, cobbleColor, mortarColor);
  }

  drawCobbleStrip(ctx, x, y, w, h, stoneCol, mortarCol) {
    ctx.fillStyle = mortarCol;
    ctx.fillRect(x, y, w, h);

    ctx.fillStyle = stoneCol;
    const cols = Math.floor(w / 14);
    const rows = Math.floor(h / 14);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const sx = x + c * 14 + (r % 2 === 0 ? 0 : 7) + 2;
        const sy = y + r * 14 + 2;
        if (sx + 10 <= x + w && sy + 10 <= y + h) {
          ctx.beginPath();
          drawSafeRoundRect(ctx, sx, sy, 10, 10, 2);
          ctx.fill();
        }
      }
    }
  }

  /* ==========================================================================
     2. Top Perimeter Wooden Fence
     ========================================================================== */
  drawTopPerimeterFence(ctx) {
    const fenceY = 145;
    ctx.save();
    ctx.fillStyle = '#92400e'; // Wooden horizontal rails
    ctx.fillRect(0, fenceY, this.width, 10);
    ctx.fillRect(0, fenceY + 12, this.width, 10);

    // Vertical Wooden Fence Posts
    for (let fx = 10; fx < this.width; fx += 28) {
      ctx.fillStyle = '#78350f';
      ctx.fillRect(fx, fenceY - 8, 8, 34);
      // Post rounded cap
      ctx.beginPath();
      ctx.arc(fx + 4, fenceY - 8, 4, Math.PI, 0);
      ctx.fill();
    }
    ctx.restore();
  }

  /* ==========================================================================
     3. Apple Orchard & Autumn Foliage / Mushrooms (Top-Left)
     ========================================================================== */
  drawAppleOrchardAndBushes(ctx) {
    // 3 Lush Apple Trees with Red Fruit
    this.drawStardewAppleTree(ctx, this.width * 0.10, this.height * 0.24, 38);
    this.drawStardewAppleTree(ctx, this.width * 0.28, this.height * 0.26, 40);
    this.drawStardewAppleTree(ctx, this.width * 0.15, this.height * 0.44, 36);

    // Autumn Golden Bushes (พุ่มไม้สีส้มทอง)
    this.drawAutumnBush(ctx, this.width * 0.05, this.height * 0.28, 22);
    this.drawAutumnBush(ctx, this.width * 0.20, this.height * 0.22, 20);
    this.drawAutumnBush(ctx, this.width * 0.07, this.height * 0.46, 24);
    this.drawAutumnBush(ctx, this.width * 0.32, this.height * 0.42, 22);

    // Red & Blue Mushrooms on the ground (เห็ดสีแดงและน้ำเงิน)
    this.drawMushroom(ctx, this.width * 0.24, this.height * 0.46, '#ef4444'); // Red spotted
    this.drawMushroom(ctx, this.width * 0.16, this.height * 0.54, '#3b82f6'); // Blue mushroom
    this.drawMushroom(ctx, this.width * 0.08, this.height * 0.52, '#ef4444');
  }

  drawStardewAppleTree(ctx, x, y, radius) {
    ctx.save();
    // Tree Trunk with bark texture
    ctx.fillStyle = '#5c2c16';
    ctx.beginPath();
    ctx.moveTo(x - 8, y + radius * 0.9);
    ctx.lineTo(x + 8, y + radius * 0.9);
    ctx.lineTo(x + 5, y);
    ctx.lineTo(x - 5, y);
    ctx.closePath();
    ctx.fill();

    // Multi-Tone Green & Golden Autumn Canopy
    ctx.fillStyle = '#15803d';
    ctx.beginPath();
    ctx.arc(x, y - radius * 0.4, radius, 0, Math.PI * 2);
    ctx.arc(x - radius * 0.55, y, radius * 0.75, 0, Math.PI * 2);
    ctx.arc(x + radius * 0.55, y, radius * 0.75, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.arc(x - radius * 0.2, y - radius * 0.6, radius * 0.6, 0, Math.PI * 2);
    ctx.fill();

    // Red Apples (ผลแอปเปิ้ลสีแดง)
    ctx.fillStyle = '#dc2626';
    const apples = [
      { dx: -12, dy: -14 }, { dx: 14, dy: -18 }, { dx: -16, dy: 6 },
      { dx: 16, dy: 8 }, { dx: 2, dy: 12 }, { dx: 0, dy: -24 }
    ];
    apples.forEach(ap => {
      ctx.beginPath();
      ctx.arc(x + ap.dx, y + ap.dy, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fca5a5';
      ctx.beginPath();
      ctx.arc(x + ap.dx - 1, y + ap.dy - 1, 1.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#dc2626';
    });
    ctx.restore();
  }

  drawAutumnBush(ctx, x, y, size) {
    ctx.save();
    ctx.fillStyle = '#ea580c';
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.arc(x - size * 0.5, y + 4, size * 0.75, 0, Math.PI * 2);
    ctx.arc(x + size * 0.5, y + 4, size * 0.75, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(x, y - 4, size * 0.65, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawMushroom(ctx, x, y, capColor) {
    ctx.save();
    ctx.fillStyle = '#fef3c7'; // Stem
    ctx.fillRect(x - 2, y, 4, 7);

    ctx.fillStyle = capColor;
    ctx.beginPath();
    ctx.ellipse(x, y, 7, 5.5, 0, Math.PI, 0);
    ctx.fill();

    // White Spots on Cap
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x - 3, y - 2.5, 1.2, 0, Math.PI * 2);
    ctx.arc(x + 3, y - 2.5, 1.2, 0, Math.PI * 2);
    ctx.arc(x, y - 4, 1.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /* ==========================================================================
     4. Walled Garden with Giant Pumpkins, Trellises & Open Gates
     ========================================================================== */
  drawWalledGardenAndCrops(ctx) {
    const wLeft = this.width * 0.40;
    const wRight = this.width * 0.78;
    const wTop = this.height * 0.18;
    const wBottom = this.height * 0.78;

    const northGateX = this.width * 0.58;
    const westGateY = this.height * 0.44;

    ctx.save();

    // 1. Dark Tilled Soil for Pumpkins & Trellis Crops
    ctx.fillStyle = '#451a03';
    drawSafeRoundRect(ctx, wLeft + 15, wTop + 15, (wRight - wLeft) - 30, (wBottom - wTop) - 30, 10);
    ctx.fill();

    // 2. Rows of Giant Ripe Pumpkins (ฟักทองยักษ์ 4x5 ลูก)
    const pStartX = wLeft + 45;
    const pStartY = wTop + 110;
    const pCols = 5;
    const pRows = 4;
    const pGapX = 28;
    const pGapY = 24;

    for (let r = 0; r < pRows; r++) {
      for (let c = 0; c < pCols; c++) {
        const px = pStartX + c * pGapX;
        const py = pStartY + r * pGapY;

        // Pumpkin Vine & Leaf
        ctx.fillStyle = '#15803d';
        ctx.fillRect(px - 1, py - 10, 2, 4);

        // Giant Pumpkin Body (Ribbed Spheres)
        ctx.fillStyle = '#ea580c';
        ctx.beginPath();
        ctx.ellipse(px, py - 4, 11, 8.5, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.ellipse(px, py - 4, 8, 8.5, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#fb923c';
        ctx.beginPath();
        ctx.ellipse(px, py - 4, 4, 8, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 3. Trellis Berry Crops (North Section)
    const tStartX = wLeft + 20;
    const tStartY = wTop + 30;
    for (let i = 0; i < 4; i++) {
      const tx = tStartX + i * 26;
      this.drawTrellisCrop(ctx, tx, tStartY, '#dc2626'); // Red berries
    }

    const t2StartX = northGateX + 25;
    for (let i = 0; i < 4; i++) {
      const tx = t2StartX + i * 26;
      this.drawTrellisCrop(ctx, tx, tStartY, '#f59e0b'); // Golden corn / grapes
    }

    // 4. Blue Flower Rows (South Section)
    const bStartX = northGateX + 25;
    const bStartY = wTop + 175;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        this.drawBlueFlowerStalk(ctx, bStartX + c * 24, bStartY + r * 22);
      }
    }

    // 5. Scarecrow guarding the Garden
    const scX = this.width * 0.58;
    const scY = wBottom - 18;
    ctx.fillStyle = '#92400e';
    ctx.fillRect(scX - 2, scY - 14, 4, 28);
    ctx.fillRect(scX - 10, scY - 6, 20, 3);
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(scX - 6, scY - 6, 12, 10);
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.ellipse(scX, scY - 14, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // 6. Solid Stone Brick Walls (กำแพงหินก่อเรียงชั้น)
    const wallColor = '#64748b';
    const wallCap = '#94a3b8';

    // North Wall Left Segment
    this.drawStoneWall(ctx, wLeft, wTop, northGateX - wLeft - 20, 14, wallColor, wallCap);
    // North Wall Right Segment
    this.drawStoneWall(ctx, northGateX + 20, wTop, wRight - (northGateX + 20), 14, wallColor, wallCap);

    // West Wall Top Segment
    this.drawStoneWall(ctx, wLeft, wTop, 14, westGateY - wTop - 18, wallColor, wallCap);
    // West Wall Bottom Segment
    this.drawStoneWall(ctx, wLeft, westGateY + 18, 14, wBottom - (westGateY + 18), wallColor, wallCap);

    // South Wall Segment
    this.drawStoneWall(ctx, wLeft, wBottom, this.width * 0.58 - wLeft, 14, wallColor, wallCap);

    // East Wall Segment
    this.drawStoneWall(ctx, wRight, wTop, 14, this.height * 0.54 - wTop, wallColor, wallCap);
    this.drawStoneWall(ctx, this.width * 0.72, this.height * 0.54, this.width - this.width * 0.72, 14, wallColor, wallCap);

    // 7. Open Wooden Gates (North & West)
    this.drawOpenWoodenGate(ctx, northGateX - 18, wTop - 4, 36, 22, true);
    this.drawOpenWoodenGate(ctx, wLeft - 4, westGateY - 16, 22, 32, false);

    ctx.restore();
  }

  drawStoneWall(ctx, x, y, w, h, col, capCol) {
    ctx.fillStyle = '#334155';
    ctx.fillRect(x, y, w, h);

    ctx.fillStyle = col;
    drawSafeRoundRect(ctx, x + 1, y + 1, w - 2, h - 2, 2);
    ctx.fill();

    ctx.fillStyle = capCol;
    ctx.fillRect(x + 1, y, w - 2, 3);
  }

  drawOpenWoodenGate(ctx, x, y, w, h, isHorizontal) {
    ctx.fillStyle = '#78350f';
    if (isHorizontal) {
      // Gate Posts
      ctx.fillRect(x - 3, y - 4, 6, 28);
      ctx.fillRect(x + w - 3, y - 4, 6, 28);
      // Open Door Swing
      ctx.fillStyle = '#b45309';
      ctx.fillRect(x + 4, y, 12, 18);
    } else {
      ctx.fillRect(x - 4, y - 3, 28, 6);
      ctx.fillRect(x - 4, y + h - 3, 28, 6);
      ctx.fillStyle = '#b45309';
      ctx.fillRect(x, y + 4, 18, 12);
    }
  }

  drawTrellisCrop(ctx, x, y, fruitCol) {
    ctx.save();
    // Wooden Trellis Post
    ctx.fillStyle = '#92400e';
    ctx.fillRect(x - 2, y, 4, 38);
    ctx.fillRect(x - 10, y + 8, 20, 3);
    ctx.fillRect(x - 10, y + 22, 20, 3);

    // Leafy Green Vine
    ctx.fillStyle = '#15803d';
    ctx.beginPath();
    ctx.arc(x, y + 6, 8, 0, Math.PI * 2);
    ctx.arc(x - 6, y + 18, 7, 0, Math.PI * 2);
    ctx.arc(x + 6, y + 18, 7, 0, Math.PI * 2);
    ctx.arc(x, y + 30, 8, 0, Math.PI * 2);
    ctx.fill();

    // Ripe Fruit Clusters
    ctx.fillStyle = fruitCol;
    ctx.beginPath();
    ctx.arc(x - 4, y + 6, 3, 0, Math.PI * 2);
    ctx.arc(x + 4, y + 8, 3, 0, Math.PI * 2);
    ctx.arc(x - 2, y + 20, 3, 0, Math.PI * 2);
    ctx.arc(x + 4, y + 30, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawBlueFlowerStalk(ctx, x, y) {
    ctx.save();
    ctx.fillStyle = '#15803d';
    ctx.fillRect(x - 1, y, 2, 22);

    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(x - 4, y + 4, 3.5, 0, Math.PI * 2);
    ctx.arc(x + 4, y + 4, 3.5, 0, Math.PI * 2);
    ctx.arc(x - 4, y + 12, 3.5, 0, Math.PI * 2);
    ctx.arc(x + 4, y + 12, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /* ==========================================================================
     5. Corner Nature Pond with Pine Tree & Lilypads (Bottom-Right)
     ========================================================================== */
  drawCornerPondAndPine(ctx) {
    const pondX = this.width * 0.86;
    const pondY = this.height * 0.78;
    const pondRx = this.width * 0.13;
    const pondRy = this.height * 0.16;

    ctx.save();

    // Natural Shoreline
    ctx.fillStyle = '#78350f';
    ctx.beginPath();
    ctx.ellipse(pondX, pondY, pondRx + 8, pondRy + 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Golden Pebble Sand Edge
    ctx.fillStyle = '#ca8a04';
    ctx.beginPath();
    ctx.ellipse(pondX, pondY, pondRx + 3, pondRy + 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Crystal Clear Sky-Blue Water (สีฟ้าสดใส!)
    ctx.beginPath();
    ctx.ellipse(pondX, pondY, pondRx, pondRy, 0, 0, Math.PI * 2);
    const waterGrad = ctx.createRadialGradient(pondX, pondY, pondRx * 0.15, pondX, pondY, pondRx);
    waterGrad.addColorStop(0, '#7dd3fc');
    waterGrad.addColorStop(0.55, '#38bdf8');
    waterGrad.addColorStop(0.85, '#0284c7');
    waterGrad.addColorStop(1, '#0369a1');
    ctx.fillStyle = waterGrad;
    ctx.fill();

    // Water Shimmer Wave
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(pondX - 15, pondY - 15, 22, 0.2, 1.4);
    ctx.stroke();

    // Lily Pads & Lotus Flower
    ctx.fillStyle = '#15803d';
    ctx.beginPath();
    ctx.ellipse(pondX - 25, pondY - 10, 16, 10, 0.2, 0, Math.PI * 1.8);
    ctx.lineTo(pondX - 25, pondY - 10);
    ctx.fill();
    ctx.fillStyle = '#f43f5e';
    ctx.beginPath();
    ctx.arc(pondX - 23, pondY - 14, 5, 0, Math.PI * 2);
    ctx.fill();

    // Tall Evergreen Pine Tree (ต้นสนมุมขวาล่าง)
    const pineX = pondX + pondRx - 15;
    const pineY = pondY + pondRy - 10;
    this.drawPineTree(ctx, pineX, pineY, 34);

    ctx.restore();
  }

  drawPineTree(ctx, x, y, size) {
    ctx.save();
    ctx.fillStyle = '#5c2c16';
    ctx.fillRect(x - 5, y, 10, size * 0.8);

    ctx.fillStyle = '#065f46';
    for (let i = 0; i < 3; i++) {
      const ty = y - i * 18;
      const tw = size - i * 6;
      ctx.beginPath();
      ctx.moveTo(x - tw, ty);
      ctx.lineTo(x + tw, ty);
      ctx.lineTo(x, ty - 26);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  /* ==========================================================================
     6. Stone Cottage (Top-Right)
     ========================================================================== */
  drawStoneCottage(ctx) {
    const p = this.timeOfDayPhase;
    const isNight = (p >= 0.7 || p < 0.05);

    const stoneX = this.width * 0.82;
    const stoneY = this.height * 0.16;
    const sW = 125;
    const sH = 110;

    ctx.save();

    // Stone Masonry Walls
    ctx.fillStyle = '#475569';
    ctx.fillRect(stoneX, stoneY, sW, sH);

    // Stone Texture Blocks
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.5;
    for (let r = 0; r < 5; r++) {
      ctx.beginPath();
      ctx.moveTo(stoneX, stoneY + r * 20);
      ctx.lineTo(stoneX + sW, stoneY + r * 20);
      ctx.stroke();
    }

    // Gable Timber Roof
    ctx.fillStyle = '#451a03';
    ctx.beginPath();
    ctx.moveTo(stoneX - 10, stoneY);
    ctx.lineTo(stoneX + sW / 2, stoneY - 32);
    ctx.lineTo(stoneX + sW + 10, stoneY);
    ctx.closePath();
    ctx.fill();

    // Chimney with Stone Texture
    ctx.fillStyle = '#64748b';
    ctx.fillRect(stoneX + sW - 22, stoneY - 36, 16, 32);

    // Wooden Window (Glows Warm Yellow at Night!)
    const winX = stoneX + 22;
    const winY = stoneY + 28;
    if (isNight) {
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 18;
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(winX, winY, 26, 22);
      ctx.shadowBlur = 0;
    } else {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(winX, winY, 26, 22);
    }
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 2;
    ctx.strokeRect(winX, winY, 26, 22);

    // Wooden Door
    ctx.fillStyle = '#92400e';
    ctx.fillRect(stoneX + sW - 48, stoneY + sH - 42, 34, 42);

    ctx.restore();
  }

  /* ==========================================================================
     7. Green-Roofed Log Farmhouse Cabin with Smoking Chimney (Bottom-Left)
     ========================================================================== */
  drawGreenRoofFarmhouse(ctx) {
    const p = this.timeOfDayPhase;
    const isNight = (p >= 0.7 || p < 0.05);

    const houseX = this.width * 0.22;
    const houseY = this.height * 0.58;
    const hW = 135;
    const hH = 130;

    ctx.save();

    // Stone Chimney (Top-Right of Cabin)
    const chimX = houseX + hW - 24;
    const chimY = houseY - 24;
    ctx.fillStyle = '#475569';
    ctx.fillRect(chimX, chimY, 18, 38);
    ctx.fillStyle = '#334155';
    ctx.fillRect(chimX - 2, chimY - 4, 22, 6);

    // Light Wood Log Planks Siding
    ctx.fillStyle = '#fde047';
    ctx.fillRect(houseX, houseY, hW, hH);

    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 2;
    for (let y = houseY + 14; y < houseY + hH; y += 14) {
      ctx.beginPath();
      ctx.moveTo(houseX, y);
      ctx.lineTo(houseX + hW, y);
      ctx.stroke();
    }

    // Emerald Green Shingle Roof (Stardew Green Roof!)
    ctx.fillStyle = '#065f46';
    ctx.beginPath();
    ctx.moveTo(houseX - 16, houseY);
    ctx.lineTo(houseX + hW / 2, houseY - 42);
    ctx.lineTo(houseX + hW + 16, houseY);
    ctx.closePath();
    ctx.fill();

    // White / Gold Roof Trim
    ctx.strokeStyle = '#34d399';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(houseX - 16, houseY);
    ctx.lineTo(houseX + hW / 2, houseY - 42);
    ctx.lineTo(houseX + hW + 16, houseY);
    ctx.stroke();

    // Round Window (หน้าต่างทรงกลม)
    const winX = houseX + 32;
    const winY = houseY + 42;
    ctx.fillStyle = isNight ? '#fbbf24' : '#0284c7';
    ctx.beginPath();
    ctx.arc(winX, winY, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Teal Front Door (ประตูหน้าสีเขียวเทอร์ควอยซ์)
    const doorX = houseX + hW / 2 - 16;
    const doorY = houseY + hH - 56;
    const dW = 32;
    const dH = 56;
    ctx.fillStyle = '#0f766e';
    ctx.fillRect(doorX, doorY, dW, dH);
    ctx.strokeStyle = '#134e4a';
    ctx.lineWidth = 3;
    ctx.strokeRect(doorX, doorY, dW, dH);
    // Gold Door Knob
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(doorX + 6, doorY + dH / 2, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Sunflower Planter Pots beside the door
    this.drawSunflowerPot(ctx, doorX - 22, doorY + dH - 12);
    this.drawSunflowerPot(ctx, doorX + dW + 8, doorY + dH - 12);

    // Stone Porch Steps
    ctx.fillStyle = '#64748b';
    ctx.fillRect(doorX - 6, doorY + dH, dW + 12, 8);

    ctx.restore();
  }

  drawSunflowerPot(ctx, x, y) {
    ctx.save();
    // Terracotta Pot
    ctx.fillStyle = '#c2410c';
    ctx.fillRect(x, y, 16, 14);
    // Green Stalk
    ctx.fillStyle = '#15803d';
    ctx.fillRect(x + 7, y - 16, 2, 16);
    // Sunflower Blossom
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(x + 8, y - 18, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#78350f';
    ctx.beginPath();
    ctx.arc(x + 8, y - 18, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawNestAndEgg(ctx) {
    const nestX = this.width * 0.26;
    const nestY = this.height * 0.78;

    ctx.fillStyle = '#92400e';
    ctx.beginPath();
    ctx.ellipse(nestX, nestY, 26, 15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ca8a04';
    ctx.beginPath();
    ctx.ellipse(nestX, nestY - 2, 22, 11, 0, 0, Math.PI * 2);
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
     8. Top-Down Animated Goose with Solid, Fixed Neck
     ========================================================================== */
  drawTopDownGoose(ctx, g) {
    ctx.save();
    ctx.translate(g.x, g.y);
    ctx.scale(g.facing * g.scale, g.scale);

    const isSwimming = g.state === 'swimming';
    const isSleeping = g.state === 'sleeping';
    const isHeld = g.isBeingHeld;
    const bob = isHeld ? -18 + Math.sin(this.timeTick * 0.4) * 2 : (isSwimming ? Math.sin(g.wobble) * 2.5 : Math.abs(Math.sin(g.wobble)) * 2);

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

    // 1. Ground Shadow
    if (isHeld) {
      // Ground shadow stays down while goose is lifted in air
      ctx.fillStyle = 'rgba(0, 0, 0, 0.16)';
      ctx.beginPath();
      ctx.ellipse(0, 24, 15, 6, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (!isSwimming) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
      ctx.beginPath();
      ctx.ellipse(0, 18, 18, 7, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2. Animated Orange Webbed Feet
    if (!isSwimming) {
      const legStep = isHeld ? Math.sin(this.timeTick * 0.5) * 8 : Math.sin(g.stepPhase) * 6;
      ctx.fillStyle = legColor;

      // Left Foot
      ctx.fillRect(-6 + legStep, bob + 10, 3.5, 9);
      ctx.beginPath();
      ctx.moveTo(-8 + legStep, bob + 19);
      ctx.lineTo(-2 + legStep, bob + 19);
      ctx.lineTo(-5 + legStep, bob + 15);
      ctx.fill();

      // Right Foot
      ctx.fillRect(4 - legStep, bob + 10, 3.5, 9);
      ctx.beginPath();
      ctx.moveTo(2 - legStep, bob + 19);
      ctx.lineTo(8 - legStep, bob + 19);
      ctx.lineTo(5 - legStep, bob + 15);
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
    ctx.quadraticCurveTo(-24, bob - 8, -28, bob - 10);
    ctx.quadraticCurveTo(-20, bob + 4, -12, bob + 10);
    ctx.quadraticCurveTo(0, bob + 18, 14, bob + 10);
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

    // 5. SOLID CONTINUOUS NECK & HEAD (Fixed clipping)
    ctx.fillStyle = bodyColor;
    if (isSleeping) {
      ctx.beginPath();
      ctx.arc(6, bob - 4, 8, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(6, bob + 2);
      ctx.lineTo(16, bob - 22);
      ctx.lineTo(24, bob - 22);
      ctx.lineTo(16, bob + 2);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.arc(19, bob - 22, 8, 0, Math.PI * 2);
      ctx.fill();
    }

    // 6. Orange Beak
    ctx.fillStyle = beakColor;
    ctx.beginPath();
    if (isSleeping) {
      ctx.moveTo(12, bob - 4);
      ctx.lineTo(19, bob - 2);
      ctx.lineTo(12, bob);
    } else {
      ctx.moveTo(24, bob - 24);
      ctx.lineTo(33, bob - 21);
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

  drawParticlesAndSmoke(ctx) {
    // Chimney Smoke Particles
    this.smokeParticles.forEach(sm => {
      const alpha = sm.life / sm.maxLife;
      ctx.fillStyle = `rgba(226, 232, 240, ${alpha * 0.7})`;
      ctx.beginPath();
      ctx.arc(sm.x, sm.y, sm.r, 0, Math.PI * 2);
      ctx.fill();
    });

    // Rain / Fireflies / Feathers
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
     9. 10-Minute Dynamic Day/Night Lighting Filter & Cozy Lanterns
     ========================================================================== */
  drawAmbientLightingAndLanterns(ctx) {
    const p = this.timeOfDayPhase;
    const isNight = (p >= 0.7 || p < 0.05);

    // Stone Wall Gate Lanterns
    const lanterns = [
      { x: this.width * 0.58 - 20, y: this.height * 0.18 }, // North Gate Left
      { x: this.width * 0.58 + 20, y: this.height * 0.18 }, // North Gate Right
      { x: this.width * 0.40, y: this.height * 0.44 - 18 }, // West Gate Top
      { x: this.width * 0.22 + 135 / 2, y: this.height * 0.58 + 130 } // Farmhouse Porch
    ];

    lanterns.forEach(lt => {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(lt.x - 2, lt.y - 8, 4, 8);

      if (isNight) {
        ctx.save();
        const lightGrad = ctx.createRadialGradient(lt.x, lt.y - 4, 2, lt.x, lt.y - 4, 48);
        lightGrad.addColorStop(0, 'rgba(251, 191, 36, 0.95)');
        lightGrad.addColorStop(0.4, 'rgba(245, 158, 11, 0.4)');
        lightGrad.addColorStop(1, 'rgba(245, 158, 11, 0)');
        ctx.fillStyle = lightGrad;
        ctx.beginPath();
        ctx.arc(lt.x, lt.y - 4, 48, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#fef08a';
        ctx.fillRect(lt.x - 3, lt.y - 6, 6, 6);
        ctx.restore();
      } else {
        ctx.fillStyle = '#fde047';
        ctx.fillRect(lt.x - 3, lt.y - 6, 6, 6);
      }
    });

    // Ambient Lighting Shading
    if (p >= 0.5 && p < 0.7) {
      // Golden Sunset Twilight
      const sunsetAlpha = Math.sin(((p - 0.5) / 0.2) * Math.PI) * 0.22;
      ctx.fillStyle = `rgba(249, 115, 22, ${sunsetAlpha})`;
      ctx.fillRect(0, 0, this.width, this.height);
    } else if (isNight) {
      // Deep Cozy Night Ambient
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
