/**
 * GooseFocus - Web Audio API Soundscape & Synthesizer
 * Generates all sound effects and continuous ambient soundscapes directly in the browser.
 */

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.ambientNodes = {
      rain: null,
      pond: null,
      crickets: null,
      whitenoise: null
    };
    this.gainNodes = {
      rain: null,
      pond: null,
      crickets: null,
      whitenoise: null
    };
    this.cricketInterval = null;
  }

  initContext() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  /**
   * Synthesize a signature Goose HONK!
   */
  playHonk(pitchMultiplier = 1, volume = 0.6) {
    try {
      this.initContext();
      const now = this.ctx.currentTime;

      // Dual oscillators for organic resonance
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc1.type = 'sawtooth';
      osc2.type = 'triangle';

      const baseFreq = 420 * pitchMultiplier;
      osc1.frequency.setValueAtTime(baseFreq * 0.8, now);
      osc1.frequency.exponentialRampToValueAtTime(baseFreq * 1.3, now + 0.06);
      osc1.frequency.exponentialRampToValueAtTime(baseFreq * 0.7, now + 0.22);

      osc2.frequency.setValueAtTime(baseFreq * 1.6, now);
      osc2.frequency.exponentialRampToValueAtTime(baseFreq * 2.1, now + 0.06);
      osc2.frequency.exponentialRampToValueAtTime(baseFreq * 1.4, now + 0.22);

      // Formant-like bandpass filter for bird quack/honk
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1100 * pitchMultiplier, now);
      filter.Q.setValueAtTime(3.5, now);

      // Volume envelope
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(volume, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.25);
      osc2.stop(now + 0.25);
    } catch (e) {
      console.warn('Audio honk error:', e);
    }
  }

  /**
   * Victory Fanfare Arpeggio on Session Complete or Level Up
   */
  playFanfare() {
    try {
      this.initContext();
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      const now = this.ctx.currentTime;

      notes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.12);

        gain.gain.setValueAtTime(0.001, now + idx * 0.12);
        gain.gain.linearRampToValueAtTime(0.3, now + idx * 0.12 + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.4);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now + idx * 0.12);
        osc.stop(now + idx * 0.12 + 0.45);
      });
    } catch (e) {
      console.warn('Fanfare error:', e);
    }
  }

  /**
   * UI Click Sound
   */
  playClick() {
    try {
      this.initContext();
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.04);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.05);
    } catch (e) {}
  }

  /**
   * Ambient Soundscape Synthesizers
   */
  setAmbienceVolume(type, volumePercent) {
    this.initContext();
    const vol = Math.max(0, Math.min(1, volumePercent / 100));

    if (vol > 0 && !this.ambientNodes[type]) {
      this.startAmbienceGenerator(type);
    }

    if (this.gainNodes[type]) {
      const now = this.ctx.currentTime;
      this.gainNodes[type].gain.linearRampToValueAtTime(vol * 0.35, now + 0.1);
    }

    if (vol === 0 && this.ambientNodes[type]) {
      this.stopAmbienceGenerator(type);
    }
  }

  startAmbienceGenerator(type) {
    if (this.ambientNodes[type]) return;
    this.initContext();

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, this.ctx.currentTime);
    gain.connect(this.ctx.destination);
    this.gainNodes[type] = gain;

    const bufferSize = 2 * this.ctx.sampleRate;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    if (type === 'rain') {
      // Pink/White noise through dual filters for rain sound
      for (let i = 0; i < bufferSize; i++) {
        output[i] = (Math.random() * 2 - 1) * 0.5;
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = noiseBuffer;
      noise.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 850;

      noise.connect(filter);
      filter.connect(gain);
      noise.start();
      this.ambientNodes[type] = noise;

    } else if (type === 'pond') {
      // Brownian gentle stream
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        output[i] = (lastOut + (0.02 * white)) / 1.02;
        lastOut = output[i];
        output[i] *= 3.5;
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = noiseBuffer;
      noise.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 650;
      filter.Q.value = 1.2;

      noise.connect(filter);
      filter.connect(gain);
      noise.start();
      this.ambientNodes[type] = noise;

    } else if (type === 'whitenoise') {
      // Smooth Pink Noise for deep concentration
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = noiseBuffer;
      noise.loop = true;

      noise.connect(gain);
      noise.start();
      this.ambientNodes[type] = noise;

    } else if (type === 'crickets') {
      // Night breeze noise base + periodic chirp oscillators
      for (let i = 0; i < bufferSize; i++) {
        output[i] = (Math.random() * 2 - 1) * 0.08;
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = noiseBuffer;
      noise.loop = true;
      const breezeFilter = this.ctx.createBiquadFilter();
      breezeFilter.type = 'lowpass';
      breezeFilter.frequency.value = 350;

      noise.connect(breezeFilter);
      breezeFilter.connect(gain);
      noise.start();
      this.ambientNodes[type] = noise;

      // Cricket chirp interval
      this.cricketInterval = setInterval(() => {
        if (!this.gainNodes['crickets']) return;
        const now = this.ctx.currentTime;
        const chirpOsc = this.ctx.createOscillator();
        const chirpGain = this.ctx.createGain();

        chirpOsc.type = 'sine';
        chirpOsc.frequency.setValueAtTime(4500, now);
        chirpOsc.frequency.linearRampToValueAtTime(4800, now + 0.03);

        chirpGain.gain.setValueAtTime(0.001, now);
        chirpGain.gain.linearRampToValueAtTime(0.12, now + 0.01);
        chirpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

        chirpOsc.connect(chirpGain);
        chirpGain.connect(gain);

        chirpOsc.start(now);
        chirpOsc.stop(now + 0.07);
      }, 1800);
    }
  }

  stopAmbienceGenerator(type) {
    if (this.ambientNodes[type]) {
      try {
        this.ambientNodes[type].stop();
        this.ambientNodes[type].disconnect();
      } catch (e) {}
      this.ambientNodes[type] = null;
    }
    if (this.gainNodes[type]) {
      this.gainNodes[type].disconnect();
      this.gainNodes[type] = null;
    }
    if (type === 'crickets' && this.cricketInterval) {
      clearInterval(this.cricketInterval);
      this.cricketInterval = null;
    }
  }

  muteAll() {
    ['rain', 'pond', 'crickets', 'whitenoise'].forEach(type => {
      this.setAmbienceVolume(type, 0);
    });
  }
}

export const soundEngine = new SoundEngine();
