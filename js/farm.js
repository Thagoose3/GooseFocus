/**
 * GooseFocus - 2D Interactive Live Goose Farm Simulator
 * Manages canvas rendering, physics, goose behaviors, pond, windmill, day/night cycle, and particles.
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

    this.width = window.innerWidth || 1200;
    this.height = window.innerHeight || 800;

    this.geese = [];
    this.particles = [];
    this.foodGrains = [];
    this.ripples = [];
    this.speechBubbles = [];

    this.windmillAngle = 0;
    this.timeTick = 0;
    this.isRaining = false;
    this.weatherType = 'clear';

    if (this.canvas && this.ctx) {
      this.initCanvas();
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
      x: isEgg ? this.width * 0.18 : 80 + Math.random() * Math.max(100, this.width - 200),
      y: isEgg ? this.height * 0.76 : 140 + Math.random() * Math.max(100, this.height - 280),
      targetX: null,
      targetY: null,
      vx: 0,
      vy: 0,
      scale: isEgg ? 0.8 : (data.stage === 'gosling' ? 0.75 : 1.15),
      facing: Math.random() > 0.5 ? 1 : -1,
      state: isEgg ? 'nesting' : 'wandering',
      stateTimer: Math.random() * 120 + 60,
      wobble: Math.random() * Math.PI * 2,
      wingAngle: 0,
      isFlapping: false,
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
        if (dist < 42 * goose.scale) {
          clickedGoose = goose;
          break;
        }
      }

      if (clickedGoose) {
        this.interactWithGoose(clickedGoose);
      } else {
        // Walk waypoint or spawn click ripples
        this.createRipple(clickX, clickY);
        this.geese.forEach(g => {
          if (g.stage !== 'egg' && Math.random() > 0.35) {
            g.targetX = clickX + (Math.random() * 80 - 40);
            g.targetY = clickY + (Math.random() * 80 - 40);
            g.state = 'wandering';
          }
        });
      }
    });
  }

  interactWithGoose(goose) {
    if (goose.stage === 'egg') {
      soundEngine.playClick();
      this.addSpeechBubble(goose.x, goose.y - 25, `🥚 บ่มแล้ว ${goose.progress || 0}%`);
      return;
    }

    const pitch = goose.stage === 'gosling' ? 1.5 : (goose.skin === 'cosmic_deity' ? 0.7 : 1.0);
    soundEngine.playHonk(pitch);

    goose.isFlapping = true;
    goose.state = 'honking';
    goose.stateTimer = 40;

    const phrases = ['HONK! 🪿', 'ฮ้อนก์! ✨', 'ตั้งใจโฟกัสนะ!', 'ขนนกทองคำรออยู่ 🪶', 'ก้าบๆ 🌾'];
    const text = phrases[Math.floor(Math.random() * phrases.length)];
    this.addSpeechBubble(goose.x, goose.y - 35 * goose.scale, text);

    // Spawn heart / feather particles
    for (let i = 0; i < 4; i++) {
      this.particles.push({
        x: goose.x + (Math.random() * 20 - 10),
        y: goose.y - 20,
        vx: (Math.random() - 0.5) * 2,
        vy: -Math.random() * 2 - 1,
        life: 45,
        maxLife: 45,
        type: 'feather',
        color: goose.skin === 'golden_honk' ? '#fbbf24' : '#ffffff'
      });
    }
  }

  feedGeese() {
    soundEngine.playClick();
    const feedX = this.width * 0.48;
    const feedY = this.height * 0.65;

    // Scatter 15 seeds
    for (let i = 0; i < 15; i++) {
      this.foodGrains.push({
        x: feedX + (Math.random() * 160 - 80),
        y: feedY + (Math.random() * 80 - 40),
        eaten: false,
        life: 250
      });
    }

    this.geese.forEach(g => {
      if (g.stage !== 'egg') {
        g.targetX = feedX + (Math.random() * 120 - 60);
        g.targetY = feedY + (Math.random() * 70 - 35);
        g.state = 'running_to_food';
      }
    });

    this.addSpeechBubble(feedX, feedY - 40, '🌾 อาหารห่านแสนอร่อย!');
  }

  honkChorus() {
    this.geese.forEach((g, idx) => {
      setTimeout(() => {
        if (g.stage !== 'egg') {
          this.interactWithGoose(g);
        }
      }, idx * 180);
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
    this.ripples.push({ x, y, r: 4, maxR: 28, alpha: 0.8 });
  }

  addSpeechBubble(x, y, text) {
    this.speechBubbles.push({ x, y, text, life: 75, maxLife: 75 });
  }

  update() {
    this.timeTick++;
    this.windmillAngle += 0.015;

    const pondX = this.width * 0.74;
    const pondY = this.height * 0.54;
    const pondRx = this.width * 0.22;
    const pondRy = this.height * 0.25;

    // Update Geese
    this.geese.forEach(g => {
      if (g.stage === 'egg') {
        g.wobble += 0.04;
        return;
      }

      g.wobble += 0.08;
      g.stateTimer--;

      // Check if in pond
      const dxPond = (g.x - pondX) / pondRx;
      const dyPond = (g.y - pondY) / pondRy;
      const inPond = (dxPond * dxPond + dyPond * dyPond) <= 0.85;

      if (inPond && g.state !== 'swimming' && g.state !== 'honking') {
        g.state = 'swimming';
        if (Math.random() < 0.03) this.createRipple(g.x, g.y + 10);
      } else if (!inPond && g.state === 'swimming') {
        g.state = 'wandering';
      }

      // State timer transitions
      if (g.stateTimer <= 0) {
        g.stateTimer = Math.random() * 180 + 80;
        const roll = Math.random();
        if (roll < 0.45) {
          g.state = 'wandering';
          g.targetX = 60 + Math.random() * (this.width - 120);
          g.targetY = 120 + Math.random() * (this.height - 220);
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

        if (dist > 5) {
          const speed = (g.state === 'running_to_food' ? 2.4 : 1.1) * (inPond ? 0.6 : 1);
          g.vx = (dx / dist) * speed;
          g.vy = (dy / dist) * speed;
          g.facing = g.vx > 0 ? 1 : -1;
        } else {
          g.targetX = null;
          g.targetY = null;
          g.vx = 0;
          g.vy = 0;
          if (g.state === 'running_to_food') g.state = 'pecking';
        }
      } else {
        g.vx *= 0.9;
        g.vy *= 0.9;
      }

      g.x += g.vx;
      g.y += g.vy;

      // Bound within canvas
      g.x = Math.max(30, Math.min(this.width - 30, g.x));
      g.y = Math.max(100, Math.min(this.height - 80, g.y));

      // Flapping wing animation
      if (g.isFlapping) {
        g.wingAngle = Math.sin(this.timeTick * 0.4) * 0.6;
        if (g.stateTimer <= 0) g.isFlapping = false;
      } else {
        g.wingAngle = Math.sin(g.wobble) * 0.08;
      }
    });

    // Update Ripples
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i];
      r.r += 0.6;
      r.alpha -= 0.02;
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

    // Update Rain
    if (this.isRaining && Math.random() < 0.6) {
      this.particles.push({
        x: Math.random() * this.width,
        y: -10,
        vx: -1.5,
        vy: 8 + Math.random() * 4,
        life: 40,
        type: 'rain'
      });
    }

    // Night Fireflies
    const theme = document.documentElement.getAttribute('data-theme') || 'day';
    if ((theme === 'night' || theme === 'cosmic') && Math.random() < 0.15) {
      this.particles.push({
        x: Math.random() * this.width,
        y: 80 + Math.random() * (this.height - 120),
        vx: (Math.random() - 0.5) * 0.6,
        vy: (Math.random() - 0.5) * 0.6,
        life: 120,
        maxLife: 120,
        type: 'firefly'
      });
    }

    // Update Speech Bubbles
    for (let i = this.speechBubbles.length - 1; i >= 0; i--) {
      const b = this.speechBubbles[i];
      b.y -= 0.3;
      b.life--;
      if (b.life <= 0) this.speechBubbles.splice(i, 1);
    }
  }

  draw() {
    const ctx = this.ctx;
    if (!ctx) return;
    const theme = document.documentElement.getAttribute('data-theme') || 'day';

    ctx.clearRect(0, 0, this.width, this.height);

    // 1. Sky & Horizon
    this.drawSky(ctx, theme);

    // 2. Rolling Green Farm Hills
    this.drawHills(ctx, theme);

    // 3. Farm Pond & Water
    this.drawPond(ctx, theme);

    // 4. Windmill & Farm Props
    this.drawProps(ctx, theme);

    // 5. Ripples on Water
    this.drawRipples(ctx);

    // 6. Food Grains
    this.drawFoodGrains(ctx);

    // 7. Nest & Egg
    this.drawNestAndEgg(ctx);

    // 8. Sort entities by Y for depth & Draw Geese
    const sortedGeese = [...this.geese].sort((a, b) => a.y - b.y);
    sortedGeese.forEach(g => {
      if (g.stage !== 'egg') {
        this.drawGoose(ctx, g);
      }
    });

    // 9. Particles (Rain, Fireflies, Feathers)
    this.drawParticles(ctx);

    // 10. Speech Bubbles
    this.drawSpeechBubbles(ctx);
  }

  drawSky(ctx, theme) {
    const grad = ctx.createLinearGradient(0, 0, 0, this.height);
    if (theme === 'sunset') {
      grad.addColorStop(0, '#fbcfe8');
      grad.addColorStop(0.5, '#fed7aa');
      grad.addColorStop(1, '#fdba74');
    } else if (theme === 'night') {
      grad.addColorStop(0, '#0f172a');
      grad.addColorStop(0.6, '#1e293b');
      grad.addColorStop(1, '#064e3b');
    } else if (theme === 'cosmic') {
      grad.addColorStop(0, '#3b0764');
      grad.addColorStop(0.6, '#0f172a');
      grad.addColorStop(1, '#1e1b4b');
    } else {
      // Day
      grad.addColorStop(0, '#bae6fd');
      grad.addColorStop(0.5, '#e0f2fe');
      grad.addColorStop(1, '#dcfce7');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.width, this.height);

    // Sun / Moon / Stars
    if (theme === 'day' || theme === 'sunset') {
      ctx.beginPath();
      ctx.arc(this.width * 0.15, 60, 28, 0, Math.PI * 2);
      ctx.fillStyle = theme === 'sunset' ? '#f43f5e' : '#fbbf24';
      ctx.shadowColor = theme === 'sunset' ? '#f43f5e' : '#f59e0b';
      ctx.shadowBlur = 20;
      ctx.fill();
      ctx.shadowBlur = 0;
    } else {
      // Glowing Moon
      ctx.beginPath();
      ctx.arc(this.width * 0.15, 55, 22, 0, Math.PI * 2);
      ctx.fillStyle = '#fef08a';
      ctx.shadowColor = '#fef08a';
      ctx.shadowBlur = 25;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  drawHills(ctx, theme) {
    ctx.fillStyle = theme === 'night' ? '#064e3b' : (theme === 'cosmic' ? '#1e1b4b' : (theme === 'sunset' ? '#ea580c' : '#4ade80'));
    
    // Back Hill
    ctx.beginPath();
    ctx.moveTo(0, this.height * 0.45);
    ctx.quadraticCurveTo(this.width * 0.3, this.height * 0.35, this.width * 0.6, this.height * 0.42);
    ctx.quadraticCurveTo(this.width * 0.85, this.height * 0.48, this.width, this.height * 0.38);
    ctx.lineTo(this.width, this.height);
    ctx.lineTo(0, this.height);
    ctx.fill();

    // Foreground Main Hill
    ctx.fillStyle = theme === 'night' ? '#047857' : (theme === 'cosmic' ? '#2e1065' : (theme === 'sunset' ? '#c2410c' : '#86efac'));
    ctx.beginPath();
    ctx.moveTo(0, this.height * 0.52);
    ctx.quadraticCurveTo(this.width * 0.4, this.height * 0.46, this.width, this.height * 0.54);
    ctx.lineTo(this.width, this.height);
    ctx.lineTo(0, this.height);
    ctx.fill();
  }

  drawPond(ctx, theme) {
    const pondX = this.width * 0.74;
    const pondY = this.height * 0.54;
    const pondRx = this.width * 0.22;
    const pondRy = this.height * 0.25;

    ctx.save();
    ctx.beginPath();
    ctx.ellipse(pondX, pondY, pondRx, pondRy, 0, 0, Math.PI * 2);
    
    const waterGrad = ctx.createRadialGradient(pondX, pondY, pondRx * 0.1, pondX, pondY, pondRx);
    if (theme === 'night') {
      waterGrad.addColorStop(0, '#0284c7');
      waterGrad.addColorStop(1, '#0369a1');
    } else if (theme === 'cosmic') {
      waterGrad.addColorStop(0, '#818cf8');
      waterGrad.addColorStop(1, '#4338ca');
    } else {
      waterGrad.addColorStop(0, '#67e8f9');
      waterGrad.addColorStop(1, '#06b6d4');
    }
    ctx.fillStyle = waterGrad;
    ctx.fill();

    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.stroke();

    // Lilypads
    ctx.fillStyle = '#15803d';
    ctx.beginPath();
    ctx.ellipse(pondX - 40, pondY + 20, 14, 8, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(pondX + 50, pondY - 15, 16, 9, -0.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  drawProps(ctx, theme) {
    // Windmill on the left hill
    const wmX = this.width * 0.12;
    const wmY = this.height * 0.45;

    // Windmill Body
    ctx.fillStyle = theme === 'night' ? '#1e293b' : '#f8fafc';
    ctx.beginPath();
    ctx.moveTo(wmX - 16, wmY + 70);
    ctx.lineTo(wmX + 16, wmY + 70);
    ctx.lineTo(wmX + 10, wmY);
    ctx.lineTo(wmX - 10, wmY);
    ctx.closePath();
    ctx.fill();

    // Windmill Roof
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.moveTo(wmX - 14, wmY);
    ctx.lineTo(wmX + 14, wmY);
    ctx.lineTo(wmX, wmY - 18);
    ctx.closePath();
    ctx.fill();

    // Rotating Blades
    ctx.save();
    ctx.translate(wmX, wmY);
    ctx.rotate(this.windmillAngle);
    ctx.fillStyle = '#cbd5e1';
    for (let i = 0; i < 4; i++) {
      ctx.rotate(Math.PI / 2);
      ctx.beginPath();
      drawSafeRoundRect(ctx, -4, 0, 8, 48, 3);
      ctx.fill();
    }
    ctx.restore();
  }

  drawNestAndEgg(ctx) {
    const nestX = this.width * 0.22;
    const nestY = this.height * 0.74;

    // Nest
    ctx.fillStyle = '#92400e';
    ctx.beginPath();
    ctx.ellipse(nestX, nestY, 26, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    // Egg
    const egg = this.geese.find(g => g.stage === 'egg');
    if (egg) {
      ctx.save();
      ctx.translate(nestX, nestY - 12);
      ctx.rotate(Math.sin(egg.wobble) * 0.15);

      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.ellipse(0, 0, 12, 16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#eab308';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Cracks if progress > 50%
      if ((egg.progress || 0) > 50) {
        ctx.strokeStyle = '#78350f';
        ctx.beginPath();
        ctx.moveTo(-4, -6);
        ctx.lineTo(0, -2);
        ctx.lineTo(-2, 3);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  drawGoose(ctx, g) {
    ctx.save();
    ctx.translate(g.x, g.y);
    ctx.scale(g.facing * g.scale, g.scale);

    const isSwimming = g.state === 'swimming';
    const isSleeping = g.state === 'sleeping';
    const bob = isSwimming ? Math.sin(g.wobble) * 2 : Math.abs(Math.sin(g.wobble)) * 2;

    // Goose Skin Colors
    let bodyColor = '#ffffff';
    let beakColor = '#f59e0b';
    let wingColor = '#e2e8f0';

    if (g.skin === 'golden_honk') {
      bodyColor = '#fef08a';
      wingColor = '#fbbf24';
      beakColor = '#d97706';
    } else if (g.skin === 'cosmic_deity') {
      bodyColor = '#e0e7ff';
      wingColor = '#818cf8';
      beakColor = '#c084fc';
    } else if (g.skin === 'ninja_black') {
      bodyColor = '#334155';
      wingColor = '#1e293b';
      beakColor = '#f97316';
    }

    // Shadow on ground
    if (!isSwimming) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
      ctx.beginPath();
      ctx.ellipse(0, 16, 16, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      // Orange Feet
      ctx.fillStyle = '#ea580c';
      const legOffset = Math.sin(g.wobble * 2) * 5;
      ctx.fillRect(-6 + legOffset, 10, 3, 7);
      ctx.fillRect(3 - legOffset, 10, 3, 7);
    }

    // Body
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.ellipse(0, bob, 18, 13, 0, 0, Math.PI * 2);
    ctx.fill();

    // Wing
    ctx.save();
    ctx.translate(-4, bob - 2);
    ctx.rotate(g.wingAngle);
    ctx.fillStyle = wingColor;
    ctx.beginPath();
    ctx.ellipse(0, 0, 11, 7, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Neck & Head
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    if (isSleeping) {
      ctx.arc(8, bob - 4, 7, 0, Math.PI * 2);
    } else {
      ctx.moveTo(8, bob + 4);
      ctx.quadraticCurveTo(14, bob - 14, 15, bob - 20);
      ctx.arc(16, bob - 22, 6.5, 0, Math.PI * 2);
      ctx.lineTo(8, bob + 4);
    }
    ctx.fill();

    // Beak
    ctx.fillStyle = beakColor;
    ctx.beginPath();
    if (isSleeping) {
      ctx.moveTo(14, bob - 4);
      ctx.lineTo(21, bob - 2);
      ctx.lineTo(14, bob);
    } else {
      ctx.moveTo(21, bob - 24);
      ctx.lineTo(31, bob - 21);
      ctx.lineTo(21, bob - 18);
    }
    ctx.closePath();
    ctx.fill();

    // Eye
    ctx.fillStyle = '#0f172a';
    if (isSleeping) {
      ctx.fillRect(16, bob - 23, 3, 1.5);
    } else {
      ctx.beginPath();
      ctx.arc(17, bob - 23, 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(17.5, bob - 23.5, 1, 1);
    }

    // Equipped Accessories (Hat / Glasses)
    this.drawAccessories(ctx, g, bob);

    ctx.restore();
  }

  drawAccessories(ctx, g, bob) {
    const headX = 16;
    const headY = bob - 22;

    if (g.hat === 'straw_hat') {
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.ellipse(headX, headY - 6, 12, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      drawSafeRoundRect(ctx, headX - 6, headY - 14, 12, 8, 2);
      ctx.fill();
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(headX - 6, headY - 8, 12, 2);
    } else if (g.hat === 'wizard_hat') {
      ctx.fillStyle = '#6366f1';
      ctx.beginPath();
      ctx.ellipse(headX, headY - 6, 13, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(headX - 8, headY - 6);
      ctx.lineTo(headX + 8, headY - 6);
      ctx.lineTo(headX + 2, headY - 24);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(headX + 1, headY - 25, 3, 3);
    } else if (g.hat === 'crown') {
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.moveTo(headX - 6, headY - 6);
      ctx.lineTo(headX - 7, headY - 14);
      ctx.lineTo(headX - 2, headY - 9);
      ctx.lineTo(headX + 1, headY - 16);
      ctx.lineTo(headX + 4, headY - 9);
      ctx.lineTo(headX + 8, headY - 14);
      ctx.lineTo(headX + 6, headY - 6);
      ctx.closePath();
      ctx.fill();
    }

    if (g.glasses === 'sunglasses') {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(headX - 1, headY - 3, 11, 4.5);
      ctx.fillRect(headX + 3, headY - 4, 2, 2);
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
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + p.vx, p.y + p.vy);
        ctx.stroke();
      } else if (p.type === 'firefly') {
        const alpha = Math.sin((p.life / p.maxLife) * Math.PI);
        ctx.fillStyle = `rgba(167, 243, 208, ${alpha})`;
        ctx.shadowColor = '#34d399';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      } else if (p.type === 'feather') {
        ctx.fillStyle = p.color || '#ffffff';
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, 3, 6, 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }

  drawSpeechBubbles(ctx) {
    this.speechBubbles.forEach(b => {
      const alpha = Math.min(1, b.life / 20);
      ctx.font = 'bold 12px "Nunito", "Prompt", sans-serif';
      const textWidth = ctx.measureText(b.text).width;

      ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.92})`;
      ctx.beginPath();
      drawSafeRoundRect(ctx, b.x - textWidth / 2 - 8, b.y - 20, textWidth + 16, 22, 10);
      ctx.fill();

      ctx.fillStyle = `rgba(15, 23, 42, ${alpha})`;
      ctx.textAlign = 'center';
      ctx.fillText(b.text, b.x, b.y - 5);
    });
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
