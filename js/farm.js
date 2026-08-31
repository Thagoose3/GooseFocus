/**
 * GooseFocus - Hyper-Detailed Realistic 2D Live Farm Simulation
 * Features:
 * 1. 10-Minute Dynamic 24-Hour Day/Night Loop (600s full cycle: Dawn, Day, Sunset, Night)
 * 2. Classic Rustic Red Barn with glowing night loft, Haystacks, Wooden Fences, Silo & Windmill
 * 3. Expansive Goose Lake with reflections, reeds, lotus flowers & caustics
 * 4. Realistic Anatomical Goose with curved neck, layered feathers, webbed feet, and exact accessory anchors
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
  ctx.arcTo(x, y, x + width, y, radius);
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

    this.windmillAngle = 0;
    this.timeTick = 0;
    this.isRaining = false;
    this.weatherTimer = 0;

    // 10-Minute Day/Night Cycle Parameters (600 seconds)
    this.cycleDurationSec = 600;
    this.timeOfDayPhase = 0.25; // 0.0 - 1.0

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
      { x: this.width * 0.1, y: this.height * 0.12, speed: 0.18, scale: 1.1, opacity: 0.8 },
      { x: this.width * 0.45, y: this.height * 0.08, speed: 0.12, scale: 0.9, opacity: 0.7 },
      { x: this.width * 0.8, y: this.height * 0.16, speed: 0.22, scale: 1.3, opacity: 0.85 },
      { x: this.width * 0.25, y: this.height * 0.22, speed: 0.15, scale: 0.75, opacity: 0.6 }
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

    return {
      id: data.id || `goose_${index}`,
      name: data.name || 'Goose',
      stage: data.stage || 'adult',
      progress: data.progress || 0,
      hat: data.hat || 'none',
      glasses: data.glasses || 'none',
      skin: data.skin || 'classic_white',
      x: isEgg ? this.width * 0.16 : 80 + Math.random() * Math.max(150, this.width - 240),
      y: isEgg ? this.height * 0.78 : 160 + Math.random() * Math.max(150, this.height - 300),
      targetX: null,
      targetY: null,
      vx: 0,
      vy: 0,
      scale: isEgg ? 0.85 : (data.stage === 'gosling' ? 0.75 : 1.15),
      facing: Math.random() > 0.5 ? 1 : -1,
      state: isEgg ? 'nesting' : 'wandering',
      stateTimer: Math.random() * 140 + 70,
      wobble: Math.random() * Math.PI * 2,
      wingAngle: 0,
      neckAngle: 0,
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
        if (dist < 46 * goose.scale) {
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
            g.targetX = clickX + (Math.random() * 90 - 45);
            g.targetY = clickY + (Math.random() * 90 - 45);
            g.state = 'wandering';
          }
        });
      }
    });
  }

  interactWithGoose(goose) {
    if (goose.stage === 'egg') {
      soundEngine.playClick();
      this.addSpeechBubble(goose.x, goose.y - 30, `🥚 บ่มแล้ว ${goose.progress || 0}%`);
      return;
    }

    const pitch = goose.stage === 'gosling' ? 1.5 : (goose.skin === 'cosmic_deity' ? 0.7 : 1.0);
    soundEngine.playHonk(pitch);

    goose.isFlapping = true;
    goose.state = 'honking';
    goose.stateTimer = 50;

    const phrases = ['HONK! 🪿', 'ฮ้อนก์! ✨', 'ตั้งใจโฟกัสนะ!', 'ฟาร์มห่านแสนสุข 🌾', 'ก้าบๆ สะสมชั่วโมง ⏱️'];
    const text = phrases[Math.floor(Math.random() * phrases.length)];
    this.addSpeechBubble(goose.x, goose.y - 45 * goose.scale, text);

    // Spawn feather particles
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
    const feedX = this.width * 0.48;
    const feedY = this.height * 0.66;

    // Scatter grains
    for (let i = 0; i < 18; i++) {
      this.foodGrains.push({
        x: feedX + (Math.random() * 180 - 90),
        y: feedY + (Math.random() * 90 - 45),
        eaten: false,
        life: 300
      });
    }

    this.geese.forEach(g => {
      if (g.stage !== 'egg') {
        g.targetX = feedX + (Math.random() * 130 - 65);
        g.targetY = feedY + (Math.random() * 80 - 40);
        g.state = 'running_to_food';
      }
    });

    this.addSpeechBubble(feedX, feedY - 45, '🌾 อาหารห่านแสนอร่อย!');
  }

  honkChorus() {
    this.geese.forEach((g, idx) => {
      setTimeout(() => {
        if (g.stage !== 'egg') {
          this.interactWithGoose(g);
        }
      }, idx * 170);
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

  update() {
    this.timeTick++;
    this.windmillAngle += 0.012;

    // 10-Minute Day/Night Loop Calculation (600 seconds)
    const nowSec = Date.now() / 1000;
    this.timeOfDayPhase = (nowSec % this.cycleDurationSec) / this.cycleDurationSec;

    // Random Weather Variations (gentle drizzle every few minutes)
    this.weatherTimer++;
    if (this.weatherTimer > 3600) { // ~60 seconds check
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
      if (c.x > this.width + 150) {
        c.x = -150;
      }
    });

    const pondX = this.width * 0.74;
    const pondY = this.height * 0.55;
    const pondRx = this.width * 0.24;
    const pondRy = this.height * 0.26;

    // Update Geese
    this.geese.forEach(g => {
      if (g.stage === 'egg') {
        g.wobble += 0.04;
        return;
      }

      g.wobble += 0.06;
      g.stateTimer--;

      // Check if in pond
      const dxPond = (g.x - pondX) / pondRx;
      const dyPond = (g.y - pondY) / pondRy;
      const inPond = (dxPond * dxPond + dyPond * dyPond) <= 0.85;

      if (inPond && g.state !== 'swimming' && g.state !== 'honking') {
        g.state = 'swimming';
        if (Math.random() < 0.04) this.createRipple(g.x, g.y + 12);
      } else if (!inPond && g.state === 'swimming') {
        g.state = 'wandering';
      }

      // State timer transitions
      if (g.stateTimer <= 0) {
        g.stateTimer = Math.random() * 180 + 90;
        const roll = Math.random();
        if (roll < 0.45) {
          g.state = 'wandering';
          g.targetX = 60 + Math.random() * (this.width - 120);
          g.targetY = 140 + Math.random() * (this.height - 240);
        } else if (roll < 0.7) {
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

        if (dist > 6) {
          const speed = (g.state === 'running_to_food' ? 2.4 : 1.15) * (inPond ? 0.65 : 1);
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

      // Keep within canvas pasture
      g.x = Math.max(30, Math.min(this.width - 30, g.x));
      g.y = Math.max(120, Math.min(this.height - 80, g.y));

      // Flapping wing & neck animation
      if (g.isFlapping) {
        g.wingAngle = Math.sin(this.timeTick * 0.45) * 0.7;
        g.neckAngle = Math.sin(this.timeTick * 0.3) * 0.2;
        if (g.stateTimer <= 0) g.isFlapping = false;
      } else {
        g.wingAngle = Math.sin(g.wobble) * 0.07;
        g.neckAngle = Math.sin(g.wobble * 0.7) * 0.06;
      }
    });

    // Update Ripples
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i];
      r.r += 0.65;
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
      for (let i = 0; i < 2; i++) {
        this.particles.push({
          x: Math.random() * this.width,
          y: -10,
          vx: -1.6,
          vy: 9 + Math.random() * 4,
          life: 45,
          type: 'rain'
        });
      }
    }

    // Night Fireflies
    const isNight = this.timeOfDayPhase >= 0.7 || this.timeOfDayPhase < 0.05;
    if (isNight && Math.random() < 0.22) {
      this.particles.push({
        x: Math.random() * this.width,
        y: 100 + Math.random() * (this.height - 150),
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
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

  draw() {
    const ctx = this.ctx;
    if (!ctx) return;

    ctx.clearRect(0, 0, this.width, this.height);

    // 1. Dynamic 10-Minute Sky & Celestial Bodies (Sun, Moon, Stars, Clouds)
    this.drawSkyAndAtmosphere(ctx);

    // 2. Distant Layered Mountains & Rolling Pasture Hills
    this.drawHillsAndMountains(ctx);

    // 3. Realistic Classic Red Barn & Grain Silo
    this.drawClassicBarnAndSilo(ctx);

    // 4. Windmill, Wooden Fences & Haystacks
    this.drawFarmStructuresAndDecor(ctx);

    // 5. Expansive Goose Lake, Lotus Flowers, Reeds & Caustics
    this.drawRealisticPond(ctx);

    // 6. Trees & Lush Foliage
    this.drawTreesAndFoliage(ctx);

    // 7. Water Ripples
    this.drawRipples(ctx);

    // 8. Food Grains
    this.drawFoodGrains(ctx);

    // 9. Nest & Golden Egg
    this.drawNestAndEgg(ctx);

    // 10. Sort Geese by Y-Depth & Draw Realistic Anatomical Geese
    const sortedGeese = [...this.geese].sort((a, b) => a.y - b.y);
    sortedGeese.forEach(g => {
      if (g.stage !== 'egg') {
        this.drawRealisticGoose(ctx, g);
      }
    });

    // 11. Particles (Rain, Night Fireflies, Feathers)
    this.drawParticles(ctx);

    // 12. Speech Bubbles
    this.drawSpeechBubbles(ctx);

    // 13. Dynamic Day/Night Lighting Filter Overlay
    this.drawAmbientLightingOverlay(ctx);
  }

  /* ==========================================================================
     1. Dynamic Sky & Atmosphere (10-Minute Day/Night Cycle)
     ========================================================================== */
  drawSkyAndAtmosphere(ctx) {
    const p = this.timeOfDayPhase; // 0.0 -> 1.0 (600s loop)
    const grad = ctx.createLinearGradient(0, 0, 0, this.height * 0.7);

    // Sky Color Interpolation based on 10-Minute Cycle
    if (p < 0.2) {
      // Dawn / Sunrise (00:00 - 02:00)
      grad.addColorStop(0, '#f472b6'); // Rose pink
      grad.addColorStop(0.4, '#fed7aa'); // Soft apricot
      grad.addColorStop(1, '#fef08a'); // Warm morning gold
    } else if (p < 0.5) {
      // Day (02:00 - 05:00)
      grad.addColorStop(0, '#38bdf8'); // Clear sky blue
      grad.addColorStop(0.6, '#bae6fd'); // Light cyan
      grad.addColorStop(1, '#e0f2fe'); // Soft horizon
    } else if (p < 0.7) {
      // Sunset & Twilight (05:00 - 07:00)
      grad.addColorStop(0, '#831843'); // Deep crimson
      grad.addColorStop(0.4, '#ea580c'); // Sunset orange
      grad.addColorStop(0.8, '#f59e0b'); // Golden amber
      grad.addColorStop(1, '#fdba74'); // Warm glow
    } else {
      // Starry Night (07:00 - 10:00)
      grad.addColorStop(0, '#030712'); // Deep space
      grad.addColorStop(0.5, '#0f172a'); // Midnight slate
      grad.addColorStop(1, '#1e293b'); // Horizon twilight
    }

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.width, this.height);

    // Stars at Night
    if (p >= 0.65 || p < 0.1) {
      const starAlpha = p >= 0.7 ? Math.min(1, (p - 0.7) / 0.1) : (0.1 - p) / 0.1;
      ctx.save();
      ctx.fillStyle = `rgba(255, 255, 255, ${starAlpha * 0.85})`;
      for (let i = 0; i < 45; i++) {
        const sx = ((i * 137.5) % this.width);
        const sy = ((i * 93.3) % (this.height * 0.42));
        const sr = (i % 3 === 0) ? 1.8 : 1.1;
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Sun & Moon Trajectories (Smooth Arc Across Sky)
    const sunAngle = (p * Math.PI * 2) - Math.PI / 2; // -90deg at dawn
    const orbitCenterX = this.width * 0.5;
    const orbitCenterY = this.height * 0.55;
    const orbitRx = this.width * 0.44;
    const orbitRy = this.height * 0.42;

    const sunX = orbitCenterX + Math.cos(sunAngle) * orbitRx;
    const sunY = orbitCenterY + Math.sin(sunAngle) * orbitRy;

    const moonAngle = sunAngle + Math.PI; // Opposite position
    const moonX = orbitCenterX + Math.cos(moonAngle) * orbitRx;
    const moonY = orbitCenterY + Math.sin(moonAngle) * orbitRy;

    // Draw Sun
    if (sunY < this.height * 0.6) {
      ctx.save();
      // Sun Corona Glow
      const sunGrad = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 55);
      sunGrad.addColorStop(0, '#fef08a');
      sunGrad.addColorStop(0.3, p >= 0.5 ? '#f97316' : '#fbbf24');
      sunGrad.addColorStop(1, 'rgba(251, 191, 36, 0)');
      ctx.fillStyle = sunGrad;
      ctx.beginPath();
      ctx.arc(sunX, sunY, 55, 0, Math.PI * 2);
      ctx.fill();

      // Sun Core Sphere
      ctx.fillStyle = p >= 0.5 ? '#fb923c' : '#ffffff';
      ctx.beginPath();
      ctx.arc(sunX, sunY, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Draw Moon
    if (moonY < this.height * 0.6) {
      ctx.save();
      // Moon Halo
      const moonGrad = ctx.createRadialGradient(moonX, moonY, 8, moonX, moonY, 40);
      moonGrad.addColorStop(0, 'rgba(224, 242, 254, 0.9)');
      moonGrad.addColorStop(0.5, 'rgba(186, 230, 253, 0.3)');
      moonGrad.addColorStop(1, 'rgba(186, 230, 253, 0)');
      ctx.fillStyle = moonGrad;
      ctx.beginPath();
      ctx.arc(moonX, moonY, 40, 0, Math.PI * 2);
      ctx.fill();

      // Moon Sphere
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.arc(moonX, moonY, 18, 0, Math.PI * 2);
      ctx.fill();

      // Moon Craters
      ctx.fillStyle = 'rgba(203, 213, 225, 0.6)';
      ctx.beginPath();
      ctx.arc(moonX - 4, moonY - 3, 3.5, 0, Math.PI * 2);
      ctx.arc(moonX + 5, moonY + 4, 4.5, 0, Math.PI * 2);
      ctx.arc(moonX - 2, moonY + 6, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Fluffy Clouds
    ctx.save();
    this.clouds.forEach(c => {
      const cloudShade = (p >= 0.7 || p < 0.1) ? 'rgba(51, 65, 85, 0.5)' : ((p >= 0.5 && p < 0.7) ? 'rgba(254, 205, 211, 0.75)' : `rgba(255, 255, 255, ${c.opacity})`);
      ctx.fillStyle = cloudShade;
      ctx.beginPath();
      ctx.arc(c.x, c.y, 22 * c.scale, 0, Math.PI * 2);
      ctx.arc(c.x + 20 * c.scale, c.y - 10 * c.scale, 28 * c.scale, 0, Math.PI * 2);
      ctx.arc(c.x + 48 * c.scale, c.y - 4 * c.scale, 24 * c.scale, 0, Math.PI * 2);
      ctx.arc(c.x + 68 * c.scale, c.y + 4 * c.scale, 18 * c.scale, 0, Math.PI * 2);
      ctx.closePath();
      ctx.fill();
    });
    ctx.restore();
  }

  /* ==========================================================================
     2. Layered Mountains & Rolling Pasture Hills
     ========================================================================== */
  drawHillsAndMountains(ctx) {
    const p = this.timeOfDayPhase;
    const isNight = (p >= 0.7 || p < 0.1);
    const isSunset = (p >= 0.5 && p < 0.7);

    // Far Distant Mountains
    ctx.fillStyle = isNight ? '#0b192c' : (isSunset ? '#7c2d12' : '#64748b');
    ctx.beginPath();
    ctx.moveTo(0, this.height * 0.44);
    ctx.lineTo(this.width * 0.18, this.height * 0.32);
    ctx.lineTo(this.width * 0.38, this.height * 0.42);
    ctx.lineTo(this.width * 0.62, this.height * 0.28);
    ctx.lineTo(this.width * 0.82, this.height * 0.38);
    ctx.lineTo(this.width, this.height * 0.33);
    ctx.lineTo(this.width, this.height);
    ctx.lineTo(0, this.height);
    ctx.fill();

    // Back Rolling Hill (Olive Green)
    ctx.fillStyle = isNight ? '#064e3b' : (isSunset ? '#9a3412' : '#15803d');
    ctx.beginPath();
    ctx.moveTo(0, this.height * 0.46);
    ctx.quadraticCurveTo(this.width * 0.35, this.height * 0.38, this.width * 0.65, this.height * 0.45);
    ctx.quadraticCurveTo(this.width * 0.88, this.height * 0.5, this.width, this.height * 0.42);
    ctx.lineTo(this.width, this.height);
    ctx.lineTo(0, this.height);
    ctx.fill();

    // Middle Green Pasture (Vibrant Grass)
    ctx.fillStyle = isNight ? '#047857' : (isSunset ? '#c2410c' : '#22c55e');
    ctx.beginPath();
    ctx.moveTo(0, this.height * 0.54);
    ctx.quadraticCurveTo(this.width * 0.4, this.height * 0.46, this.width, this.height * 0.52);
    ctx.lineTo(this.width, this.height);
    ctx.lineTo(0, this.height);
    ctx.fill();

    // Foreground Lush Green Meadow
    ctx.fillStyle = isNight ? '#065f46' : (isSunset ? '#ea580c' : '#4ade80');
    ctx.beginPath();
    ctx.moveTo(0, this.height * 0.62);
    ctx.quadraticCurveTo(this.width * 0.3, this.height * 0.56, this.width * 0.7, this.height * 0.65);
    ctx.quadraticCurveTo(this.width * 0.9, this.height * 0.68, this.width, this.height * 0.6);
    ctx.lineTo(this.width, this.height);
    ctx.lineTo(0, this.height);
    ctx.fill();
  }

  /* ==========================================================================
     3. Classic Rustic Red Barn & Grain Silo
     ========================================================================== */
  drawClassicBarnAndSilo(ctx) {
    const p = this.timeOfDayPhase;
    const isNight = (p >= 0.7 || p < 0.1);

    // Barn Location on the left pasture
    const barnX = this.width * 0.22;
    const barnY = this.height * 0.48;
    const bW = 120;
    const bH = 85;

    ctx.save();

    // Silo (Beside Barn)
    const siloX = barnX - 35;
    const siloY = barnY - 20;
    const sW = 28;
    const sH = 105;

    // Silo Body (Metallic Cylinder)
    const siloGrad = ctx.createLinearGradient(siloX, 0, siloX + sW, 0);
    siloGrad.addColorStop(0, '#94a3b8');
    siloGrad.addColorStop(0.5, '#f1f5f9');
    siloGrad.addColorStop(1, '#64748b');
    ctx.fillStyle = siloGrad;
    ctx.fillRect(siloX, siloY, sW, sH);

    // Silo Dome Cap
    ctx.fillStyle = '#64748b';
    ctx.beginPath();
    ctx.arc(siloX + sW / 2, siloY, sW / 2, Math.PI, 0);
    ctx.fill();

    // Barn Main Building (Rustic Red Wood)
    const barnGrad = ctx.createLinearGradient(barnX, 0, barnX + bW, 0);
    barnGrad.addColorStop(0, '#991b1b');
    barnGrad.addColorStop(0.5, '#b91c1c');
    barnGrad.addColorStop(1, '#7f1d1d');
    ctx.fillStyle = barnGrad;
    ctx.fillRect(barnX, barnY, bW, bH);

    // Barn Planks Texture
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.12)';
    ctx.lineWidth = 1;
    for (let x = barnX + 12; x < barnX + bW; x += 12) {
      ctx.beginPath();
      ctx.moveTo(x, barnY);
      ctx.lineTo(x, barnY + bH);
      ctx.stroke();
    }

    // Gambrel Barn Roof
    ctx.fillStyle = '#450a0a'; // Dark rustic roof
    ctx.beginPath();
    ctx.moveTo(barnX - 12, barnY);
    ctx.lineTo(barnX + 18, barnY - 32);
    ctx.lineTo(barnX + bW - 18, barnY - 32);
    ctx.lineTo(barnX + bW + 12, barnY);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#262626';
    ctx.lineWidth = 2;
    ctx.stroke();

    // White Roof Trim
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(barnX - 12, barnY);
    ctx.lineTo(barnX + 18, barnY - 32);
    ctx.lineTo(barnX + bW - 18, barnY - 32);
    ctx.lineTo(barnX + bW + 12, barnY);
    ctx.stroke();

    // Rooftop Cupola & Weather Vane
    const cupolaX = barnX + bW / 2;
    const cupolaY = barnY - 32;
    ctx.fillStyle = '#b91c1c';
    ctx.fillRect(cupolaX - 10, cupolaY - 14, 20, 14);
    ctx.fillStyle = '#450a0a';
    ctx.beginPath();
    ctx.moveTo(cupolaX - 14, cupolaY - 14);
    ctx.lineTo(cupolaX + 14, cupolaY - 14);
    ctx.lineTo(cupolaX, cupolaY - 24);
    ctx.closePath();
    ctx.fill();

    // Weather Vane Goose
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cupolaX, cupolaY - 24);
    ctx.lineTo(cupolaX, cupolaY - 34);
    ctx.stroke();
    ctx.font = '10px sans-serif';
    ctx.fillText('🪿', cupolaX - 6, cupolaY - 35);

    // Barn Double Doors with White X Braces
    const doorW = 44;
    const doorH = 46;
    const doorX = barnX + (bW - doorW) / 2;
    const doorY = barnY + bH - doorH;

    ctx.fillStyle = '#450a0a';
    ctx.fillRect(doorX, doorY, doorW, doorH);

    // White Cross Braces (X)
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 3;
    ctx.strokeRect(doorX, doorY, doorW, doorH);
    ctx.beginPath();
    // Left Door X
    ctx.moveTo(doorX, doorY);
    ctx.lineTo(doorX + doorW / 2, doorY + doorH);
    ctx.moveTo(doorX + doorW / 2, doorY);
    ctx.lineTo(doorX, doorY + doorH);
    // Right Door X
    ctx.moveTo(doorX + doorW / 2, doorY);
    ctx.lineTo(doorX + doorW, doorY + doorH);
    ctx.moveTo(doorX + doorW, doorY);
    ctx.lineTo(doorX + doorW / 2, doorY + doorH);
    ctx.stroke();

    // Upper Loft Window (Glows warm yellow at Night!)
    const loftX = barnX + bW / 2 - 11;
    const loftY = barnY + 8;
    const loftW = 22;
    const loftH = 18;

    if (isNight) {
      // Cozy Night Light Glow
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 16;
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

    ctx.restore();
  }

  /* ==========================================================================
     4. Windmill, Wooden Fences & Golden Haystacks
     ========================================================================== */
  drawFarmStructuresAndDecor(ctx) {
    // 1. Detailed Windmill (Far Left Hill)
    const wmX = this.width * 0.08;
    const wmY = this.height * 0.44;

    ctx.save();
    // Stone Base
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.moveTo(wmX - 16, wmY + 80);
    ctx.lineTo(wmX + 16, wmY + 80);
    ctx.lineTo(wmX + 10, wmY);
    ctx.lineTo(wmX - 10, wmY);
    ctx.closePath();
    ctx.fill();

    // Windmill Cap
    ctx.fillStyle = '#7f1d1d';
    ctx.beginPath();
    ctx.moveTo(wmX - 12, wmY);
    ctx.lineTo(wmX + 12, wmY);
    ctx.lineTo(wmX, wmY - 16);
    ctx.closePath();
    ctx.fill();

    // Rotating Lattice Blades
    ctx.translate(wmX, wmY);
    ctx.rotate(this.windmillAngle);
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      ctx.rotate(Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, 52);
      // Lattice grid
      ctx.rect(-5, 12, 10, 36);
      ctx.stroke();
    }
    ctx.restore();

    // 2. Post-and-Rail Wooden Fences (Pasture Border)
    ctx.save();
    ctx.strokeStyle = '#78350f'; // Dark wood
    ctx.lineWidth = 2.5;

    const fenceStartX = this.width * 0.34;
    const fenceEndX = this.width * 0.58;
    const fenceY = this.height * 0.58;

    // Horizontal Rails
    ctx.beginPath();
    ctx.moveTo(fenceStartX, fenceY);
    ctx.lineTo(fenceEndX, fenceY + 12);
    ctx.moveTo(fenceStartX, fenceY + 10);
    ctx.lineTo(fenceEndX, fenceY + 22);
    ctx.stroke();

    // Vertical Posts
    for (let fx = fenceStartX; fx <= fenceEndX; fx += 32) {
      const fy = fenceY + ((fx - fenceStartX) / (fenceEndX - fenceStartX)) * 12;
      ctx.fillStyle = '#92400e';
      ctx.fillRect(fx - 2.5, fy - 6, 5, 28);
    }
    ctx.restore();

    // 3. Golden Haystacks (กองฟางข้าว)
    const hayX = this.width * 0.36;
    const hayY = this.height * 0.53;
    ctx.save();
    ctx.fillStyle = '#eab308';
    ctx.beginPath();
    ctx.ellipse(hayX, hayY, 26, 18, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#ca8a04';
    ctx.beginPath();
    ctx.ellipse(hayX - 12, hayY + 5, 18, 14, 0, Math.PI, 0);
    ctx.fill();
    ctx.restore();
  }

  /* ==========================================================================
     5. Expansive Goose Lake, Lotus Flowers & Reeds
     ========================================================================== */
  drawRealisticPond(ctx) {
    const p = this.timeOfDayPhase;
    const isNight = (p >= 0.7 || p < 0.1);
    const isSunset = (p >= 0.5 && p < 0.7);

    const pondX = this.width * 0.74;
    const pondY = this.height * 0.55;
    const pondRx = this.width * 0.24;
    const pondRy = this.height * 0.26;

    ctx.save();

    // Lake Shore (Muddy Edge)
    ctx.beginPath();
    ctx.ellipse(pondX, pondY, pondRx + 6, pondRy + 6, -0.05, 0, Math.PI * 2);
    ctx.fillStyle = '#78350f';
    ctx.fill();

    // Water Body
    ctx.beginPath();
    ctx.ellipse(pondX, pondY, pondRx, pondRy, -0.05, 0, Math.PI * 2);

    const waterGrad = ctx.createRadialGradient(pondX, pondY, pondRx * 0.15, pondX, pondY, pondRx);
    if (isNight) {
      waterGrad.addColorStop(0, '#0369a1');
      waterGrad.addColorStop(0.7, '#075985');
      waterGrad.addColorStop(1, '#0c4a6e');
    } else if (isSunset) {
      waterGrad.addColorStop(0, '#fb923c');
      waterGrad.addColorStop(0.6, '#0284c7');
      waterGrad.addColorStop(1, '#0369a1');
    } else {
      waterGrad.addColorStop(0, '#38bdf8');
      waterGrad.addColorStop(0.6, '#0284c7');
      waterGrad.addColorStop(1, '#0369a1');
    }

    ctx.fillStyle = waterGrad;
    ctx.fill();

    // Water Shore Highlight Wave
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.stroke();

    // Floating Lotus Flowers & Lily Pads
    this.drawLotusPad(ctx, pondX - 60, pondY + 25, 18, '#15803d', '#f43f5e');
    this.drawLotusPad(ctx, pondX + 70, pondY - 20, 22, '#166534', '#fbcfe8');
    this.drawLotusPad(ctx, pondX + 30, pondY + 50, 16, '#15803d', '#fb7185');

    // Reed Bushes (ต้นกกริมน้ำ)
    this.drawReedBush(ctx, pondX - pondRx + 20, pondY - 15);
    this.drawReedBush(ctx, pondX + pondRx - 30, pondY + 20);

    ctx.restore();
  }

  drawLotusPad(ctx, x, y, size, padColor, flowerColor) {
    ctx.save();
    // Lily Pad
    ctx.fillStyle = padColor;
    ctx.beginPath();
    ctx.ellipse(x, y, size, size * 0.55, 0.2, 0, Math.PI * 1.8);
    ctx.lineTo(x, y);
    ctx.closePath();
    ctx.fill();

    // Pink Lotus Flower
    ctx.fillStyle = flowerColor;
    ctx.beginPath();
    ctx.arc(x + 2, y - 4, size * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(x + 2, y - 4, size * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawReedBush(ctx, x, y) {
    ctx.save();
    ctx.strokeStyle = '#15803d';
    ctx.lineWidth = 2;
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath();
      ctx.moveTo(x + i * 4, y);
      ctx.quadraticCurveTo(x + i * 8, y - 25, x + i * 6, y - 45);
      ctx.stroke();

      // Reed Flower Tip (Brown corncob)
      ctx.fillStyle = '#78350f';
      drawSafeRoundRect(ctx, x + i * 6 - 2, y - 42, 4, 12, 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /* ==========================================================================
     6. Trees & Lush Foliage
     ========================================================================== */
  drawTreesAndFoliage(ctx) {
    const p = this.timeOfDayPhase;
    const isNight = (p >= 0.7 || p < 0.1);

    // Large Oak Tree near Pond
    const treeX = this.width * 0.94;
    const treeY = this.height * 0.48;

    ctx.save();
    // Trunk
    ctx.fillStyle = '#5c2c16';
    ctx.beginPath();
    ctx.moveTo(treeX - 12, treeY + 70);
    ctx.lineTo(treeX + 12, treeY + 70);
    ctx.lineTo(treeX + 6, treeY);
    ctx.lineTo(treeX - 6, treeY);
    ctx.closePath();
    ctx.fill();

    // Layered Canopy
    const leafColor1 = isNight ? '#064e3b' : '#15803d';
    const leafColor2 = isNight ? '#047857' : '#22c55e';

    ctx.fillStyle = leafColor1;
    ctx.beginPath();
    ctx.arc(treeX, treeY - 20, 36, 0, Math.PI * 2);
    ctx.arc(treeX - 25, treeY + 5, 28, 0, Math.PI * 2);
    ctx.arc(treeX + 25, treeY + 5, 30, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = leafColor2;
    ctx.beginPath();
    ctx.arc(treeX - 10, treeY - 32, 26, 0, Math.PI * 2);
    ctx.arc(treeX + 12, treeY - 28, 24, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  drawNestAndEgg(ctx) {
    const nestX = this.width * 0.16;
    const nestY = this.height * 0.78;

    // Woven Straw Nest
    ctx.fillStyle = '#92400e';
    ctx.beginPath();
    ctx.ellipse(nestX, nestY, 28, 15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ca8a04';
    ctx.beginPath();
    ctx.ellipse(nestX, nestY - 2, 24, 11, 0, 0, Math.PI * 2);
    ctx.fill();

    // Egg
    const egg = this.geese.find(g => g.stage === 'egg');
    if (egg) {
      ctx.save();
      ctx.translate(nestX, nestY - 14);
      ctx.rotate(Math.sin(egg.wobble) * 0.14);

      // Egg Shading
      const eggGrad = ctx.createRadialGradient(-3, -4, 2, 0, 0, 16);
      eggGrad.addColorStop(0, '#ffffff');
      eggGrad.addColorStop(0.7, '#fef08a');
      eggGrad.addColorStop(1, '#eab308');
      ctx.fillStyle = eggGrad;
      ctx.beginPath();
      ctx.ellipse(0, 0, 13, 17, 0, 0, Math.PI * 2);
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
     7. Realistic Anatomical Goose & Accessories
     ========================================================================== */
  drawRealisticGoose(ctx, g) {
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
      ctx.fillStyle = 'rgba(0, 0, 0, 0.16)';
      ctx.beginPath();
      ctx.ellipse(0, 20, 20, 7, 0, 0, Math.PI * 2);
      ctx.fill();

      // 2. Realistic Legs & Webbed Feet (พังผืดเท้าห่าน)
      const legStep = Math.sin(g.stepPhase) * 6;
      ctx.fillStyle = legColor;

      // Left Leg & Webbed Foot
      ctx.fillRect(-7 + legStep, 10, 3.5, 10);
      ctx.beginPath();
      ctx.moveTo(-9 + legStep, 20);
      ctx.lineTo(-2 + legStep, 20);
      ctx.lineTo(-5 + legStep, 16);
      ctx.fill();

      // Right Leg & Webbed Foot
      ctx.fillRect(4 - legStep, 10, 3.5, 10);
      ctx.beginPath();
      ctx.moveTo(2 - legStep, 20);
      ctx.lineTo(9 - legStep, 20);
      ctx.lineTo(6 - legStep, 16);
      ctx.fill();
    } else {
      // Swimming Water Wake Ripple
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(0, bob + 6, 24, 8, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 3. Plump Goose Body & Upturned Tail Feathers
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.moveTo(-16, bob + 2); // Tail start
    ctx.quadraticCurveTo(-26, bob - 8, -30, bob - 12); // Upturned Tail Tip
    ctx.quadraticCurveTo(-22, bob + 2, -14, bob + 10);
    ctx.quadraticCurveTo(0, bob + 18, 16, bob + 10); // Belly
    ctx.quadraticCurveTo(24, bob + 2, 18, bob - 6); // Breast
    ctx.quadraticCurveTo(8, bob - 12, -16, bob + 2); // Back
    ctx.closePath();
    ctx.fill();

    // Body Shadow Undertone
    ctx.fillStyle = shadeColor;
    ctx.beginPath();
    ctx.moveTo(-12, bob + 8);
    ctx.quadraticCurveTo(0, bob + 18, 16, bob + 10);
    ctx.quadraticCurveTo(4, bob + 14, -12, bob + 8);
    ctx.fill();

    // 4. Layered Wing Feathers
    ctx.save();
    ctx.translate(-4, bob - 2);
    ctx.rotate(g.wingAngle);
    ctx.fillStyle = shadeColor;
    ctx.beginPath();
    ctx.ellipse(0, 0, 15, 9, -0.15, 0, Math.PI * 2);
    ctx.fill();

    // Wing Primary Feathers detail
    ctx.strokeStyle = bodyColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-8, 2);
    ctx.lineTo(10, 4);
    ctx.moveTo(-4, -2);
    ctx.lineTo(12, 0);
    ctx.stroke();
    ctx.restore();

    // 5. Graceful Curved S-Neck & Head
    ctx.save();
    ctx.translate(14, bob - 4);
    ctx.rotate(g.neckAngle);

    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    if (isSleeping) {
      // Head tucked backward peacefully
      ctx.arc(-8, -4, 8, 0, Math.PI * 2);
    } else {
      // S-Curved Neck rising up
      ctx.moveTo(-4, 6);
      ctx.quadraticCurveTo(2, -10, 6, -26);
      ctx.arc(10, -28, 8, 0, Math.PI * 2); // Head Sphere
      ctx.lineTo(4, 6);
    }
    ctx.fill();

    // 6. Orange Beak with Nostril
    ctx.fillStyle = beakColor;
    ctx.beginPath();
    if (isSleeping) {
      ctx.moveTo(-2, -4);
      ctx.lineTo(6, -2);
      ctx.lineTo(-2, 0);
    } else {
      ctx.moveTo(16, -30);
      ctx.lineTo(28, -26); // Beak tip
      ctx.lineTo(15, -22);
    }
    ctx.closePath();
    ctx.fill();

    // Dark Nostril Dot
    if (!isSleeping) {
      ctx.fillStyle = '#78350f';
      ctx.beginPath();
      ctx.arc(18, -28, 1, 0, Math.PI * 2);
      ctx.fill();
    }

    // 7. Expressive Dark Eye
    ctx.fillStyle = '#0f172a';
    if (isSleeping) {
      // Closed resting eye curve
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#334155';
      ctx.beginPath();
      ctx.arc(10, -28, 3, 0.2, Math.PI - 0.2);
      ctx.stroke();
    } else {
      // Alert Shiny Eye
      ctx.beginPath();
      ctx.arc(11, -30, 2.2, 0, Math.PI * 2);
      ctx.fill();
      // White highlight
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(11.8, -30.8, 0.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // 8. Snugly Attached Head Accessories (Accurate Head Anchors!)
    this.drawFittedAccessories(ctx, g, 10, -28);

    ctx.restore(); // Neck rotate restore

    ctx.restore(); // Main translate restore
  }

  drawFittedAccessories(ctx, g, headX, headY) {
    if (g.hat === 'straw_hat') {
      ctx.save();
      ctx.translate(headX - 1, headY - 8);
      ctx.fillStyle = '#fde047'; // Straw yellow
      ctx.beginPath();
      ctx.ellipse(0, 0, 14, 4, -0.1, 0, Math.PI * 2); // Brim
      ctx.fill();
      ctx.strokeStyle = '#ca8a04';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Hat Crown
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      drawSafeRoundRect(ctx, -6, -9, 12, 9, 2);
      ctx.fill();

      // Red Ribbon Band
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
      ctx.fillRect(2, -23, 3, 3); // Gold tip
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
      ctx.fillRect(headX + 1, headY - 3, 12, 5);
      ctx.fillRect(headX + 4, headY - 4, 3, 2); // Bridge
      ctx.restore();
    }
  }

  drawRipples(ctx) {
    ctx.lineWidth = 1.5;
    this.ripples.forEach(r => {
      ctx.beginPath();
      ctx.ellipse(r.x, r.y, r.r * 1.6, r.r * 0.8, 0, 0, Math.PI * 2);
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

      ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.94})`;
      ctx.beginPath();
      drawSafeRoundRect(ctx, b.x - textWidth / 2 - 9, b.y - 20, textWidth + 18, 24, 12);
      ctx.fill();

      ctx.fillStyle = `rgba(15, 23, 42, ${alpha})`;
      ctx.textAlign = 'center';
      ctx.fillText(b.text, b.x, b.y - 4);
    });
  }

  /* ==========================================================================
     8. Dynamic Day/Night Lighting Overlay Filter
     ========================================================================== */
  drawAmbientLightingOverlay(ctx) {
    const p = this.timeOfDayPhase;

    // Sunset Warm Golden Hour Tint (0.50 - 0.70)
    if (p >= 0.5 && p < 0.7) {
      const sunsetAlpha = Math.sin(((p - 0.5) / 0.2) * Math.PI) * 0.18;
      ctx.fillStyle = `rgba(249, 115, 22, ${sunsetAlpha})`;
      ctx.fillRect(0, 0, this.width, this.height);
    }
    // Deep Night Moonlight Tint (0.70 - 1.0)
    else if (p >= 0.7 || p < 0.05) {
      const nightAlpha = p >= 0.7 ? Math.min(0.35, ((p - 0.7) / 0.1) * 0.35) : (0.05 - p) / 0.05 * 0.35;
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
