// SoundEngine for Signal Loss with dual-track crossfading & explicit gesture AudioContext resume
export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.isInitialized = false;

    // Buffers for Web Audio API
    this.buffers = {
      normal: null,
      danger: null,
      hit: null,
      miss: null
    };

    // Web Audio Gain Nodes for Crossfading
    this.gainNormalNode = null;
    this.gainDangerNode = null;
    this.sourceNormal = null;
    this.sourceDanger = null;

    // Current Gain Levels (0.0 to 0.35)
    this.normalVolume = 0.35;
    this.dangerVolume = 0.0;
    this.targetNormalVolume = 0.35;
    this.targetDangerVolume = 0.0;

    this.isAmbientPlaying = false;
    this.isPaused = false;

    // HTML5 Audio Elements (Fallback)
    this.fallbackNormal = new Audio('./assets/audio/ambient_normal.mp3');
    this.fallbackNormal.loop = true;
    this.fallbackNormal.volume = 0.35;

    this.fallbackDanger = new Audio('./assets/audio/ambient_danger.mp3');
    this.fallbackDanger.loop = true;
    this.fallbackDanger.volume = 0.0;

    this.fallbackHit = new Audio('./assets/audio/hit.mp3');
    this.fallbackHit.volume = 0.6;

    this.fallbackMiss = new Audio('./assets/audio/miss.mp3');
    this.fallbackMiss.volume = 0.6;

    // Telemetry state
    this.stats = {
      contextState: 'uninitialized',
      ambientStarted: 0,
      ambientPaused: 0,
      ambientResumed: 0,
      normalGain: 0.35,
      dangerGain: 0.0,
      isDangerMode: false,
      hitsPlayed: 0,
      missesPlayed: 0
    };

    window.__AUDIO_STATE__ = this.stats;

    this.preloadBuffers();
  }

  async preloadBuffers() {
    const files = {
      normal: './assets/audio/ambient_normal.mp3',
      danger: './assets/audio/ambient_danger.mp3',
      hit: './assets/audio/hit.mp3',
      miss: './assets/audio/miss.mp3'
    };

    this._pendingBuffers = {};
    for (const [key, url] of Object.entries(files)) {
      try {
        const resp = await fetch(url);
        const arrayBuf = await resp.arrayBuffer();
        this._pendingBuffers[key] = arrayBuf;
      } catch (e) {
        console.warn(`Failed to preload audio buffer for ${key}:`, e);
      }
    }
  }

  // EXPLICIT RESUME INSIDE USER GESTURE (window.START / #startb tap)
  initOnGesture() {
    if (!this.ctx) {
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
          this.ctx.onerror = () => { this.ctx = null; };
          this.ctx.onstatechange = () => {
            if (this.stats && this.ctx) this.stats.contextState = this.ctx.state;
          };
        }
      } catch (e) {
        this.ctx = null;
      }
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      try {
        this.ctx.resume().then(() => {
          if (this.stats && this.ctx) this.stats.contextState = this.ctx.state;
        }).catch(() => {
          this.ctx = null;
        });
      } catch (e) {
        this.ctx = null;
      }
    }

    if (this.ctx) {
      this.stats.contextState = this.ctx.state;

      // Decode pending buffers if not already decoded
      if (this._pendingBuffers) {
        for (const [key, arrayBuf] of Object.entries(this._pendingBuffers)) {
          if (!this.buffers[key]) {
            try {
              this.ctx.decodeAudioData(arrayBuf.slice(0), (buf) => {
                this.buffers[key] = buf;
              }, () => {}).catch(() => {});
            } catch (err) {}
          }
        }
      }
    }
    this.isInitialized = true;
  }

  startAmbient() {
    this.initOnGesture();
    this.stats.ambientStarted++;
    this.isAmbientPlaying = true;
    this.isPaused = false;

    this.normalVolume = 0.35;
    this.dangerVolume = 0.0;
    this.targetNormalVolume = 0.35;
    this.targetDangerVolume = 0.0;

    if (this.ctx && this.buffers.normal && this.buffers.danger) {
      this._startWebAudioAmbient();
    } else {
      // Fallback HTML5 Audio
      try {
        this.fallbackNormal.currentTime = 0;
        this.fallbackNormal.volume = 0.35;
        this.fallbackNormal.play().catch(() => {});

        this.fallbackDanger.currentTime = 0;
        this.fallbackDanger.volume = 0.0;
        this.fallbackDanger.play().catch(() => {});
      } catch (e) {}
    }
  }

  _startWebAudioAmbient() {
    this._stopWebAudioAmbient();
    if (!this.ctx || !this.buffers.normal || !this.buffers.danger) return;

    try {
      const now = this.ctx.currentTime;

      // Create Normal track node
      this.sourceNormal = this.ctx.createBufferSource();
      this.sourceNormal.buffer = this.buffers.normal;
      this.sourceNormal.loop = true;

      this.gainNormalNode = this.ctx.createGain();
      this.gainNormalNode.gain.setValueAtTime(this.normalVolume, now);

      this.sourceNormal.connect(this.gainNormalNode);
      this.gainNormalNode.connect(this.ctx.destination);

      // Create Danger track node
      this.sourceDanger = this.ctx.createBufferSource();
      this.sourceDanger.buffer = this.buffers.danger;
      this.sourceDanger.loop = true;

      this.gainDangerNode = this.ctx.createGain();
      this.gainDangerNode.gain.setValueAtTime(this.dangerVolume, now);

      this.sourceDanger.connect(this.gainDangerNode);
      this.gainDangerNode.connect(this.ctx.destination);

      this.sourceNormal.start(0);
      this.sourceDanger.start(0);
    } catch (e) {
      console.warn('Error starting Web Audio ambient:', e);
    }
  }

  _stopWebAudioAmbient() {
    if (this.sourceNormal) {
      try { this.sourceNormal.stop(); this.sourceNormal.disconnect(); } catch (e) {}
      this.sourceNormal = null;
    }
    if (this.sourceDanger) {
      try { this.sourceDanger.stop(); this.sourceDanger.disconnect(); } catch (e) {}
      this.sourceDanger = null;
    }
  }

  // Dynamic Volume Crossfading driven by visibility radius (< 20m = Danger piano)
  updateVisibility(visRadius, dt) {
    if (!this.isAmbientPlaying || this.isPaused) return;

    const isDanger = visRadius < 20.0;
    this.stats.isDangerMode = isDanger;

    if (isDanger) {
      this.targetNormalVolume = 0.0;
      this.targetDangerVolume = 0.35;
    } else {
      this.targetNormalVolume = 0.35;
      this.targetDangerVolume = 0.0;
    }

    // Smooth exponential crossfade (~1.5s transition time)
    const fadeRate = 2.0;
    this.normalVolume += (this.targetNormalVolume - this.normalVolume) * fadeRate * dt;
    this.dangerVolume += (this.targetDangerVolume - this.dangerVolume) * fadeRate * dt;

    this.stats.normalGain = Math.round(this.normalVolume * 1000) / 1000;
    this.stats.dangerGain = Math.round(this.dangerVolume * 1000) / 1000;

    // Apply gains to Web Audio nodes
    if (this.ctx && this.gainNormalNode && this.gainDangerNode) {
      const now = this.ctx.currentTime;
      this.gainNormalNode.gain.setTargetAtTime(this.normalVolume, now, 0.1);
      this.gainDangerNode.gain.setTargetAtTime(this.dangerVolume, now, 0.1);
    } else {
      // Apply to HTML5 Audio Fallback
      try {
        this.fallbackNormal.volume = Math.max(0, Math.min(1, this.normalVolume));
        this.fallbackDanger.volume = Math.max(0, Math.min(1, this.dangerVolume));
      } catch (e) {}
    }
  }

  pauseAmbient() {
    this.stats.ambientPaused++;
    if (!this.isAmbientPlaying || this.isPaused) return;
    this.isPaused = true;

    if (this.ctx && this.ctx.state === 'running') {
      this.ctx.suspend().catch(() => {});
    }
    try {
      this.fallbackNormal.pause();
      this.fallbackDanger.pause();
    } catch (e) {}
  }

  resumeAmbient() {
    this.stats.ambientResumed++;
    if (!this.isAmbientPlaying || !this.isPaused) return;
    this.isPaused = false;

    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    } else {
      try {
        if (this.fallbackNormal.paused) this.fallbackNormal.play().catch(() => {});
        if (this.fallbackDanger.paused) this.fallbackDanger.play().catch(() => {});
      } catch (e) {}
    }
  }

  stopAmbient() {
    this.isAmbientPlaying = false;
    this.isPaused = false;
    this._stopWebAudioAmbient();

    try {
      this.fallbackNormal.pause();
      this.fallbackNormal.currentTime = 0;
      this.fallbackDanger.pause();
      this.fallbackDanger.currentTime = 0;
    } catch (e) {}
  }

  playHit() {
    this.initOnGesture();
    this.stats.hitsPlayed++;

    if (this.ctx && this.buffers.hit && this.ctx.state === 'running') {
      try {
        const src = this.ctx.createBufferSource();
        src.buffer = this.buffers.hit;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.6, this.ctx.currentTime);
        src.connect(gain);
        gain.connect(this.ctx.destination);
        src.start(0);
        return;
      } catch (e) {}
    }

    try {
      const sfx = this.fallbackHit.cloneNode();
      sfx.volume = 0.6;
      sfx.play().catch(() => {});
    } catch (e) {}
  }

  playMiss() {
    this.initOnGesture();
    this.stats.missesPlayed++;

    if (this.ctx && this.buffers.miss && this.ctx.state === 'running') {
      try {
        const src = this.ctx.createBufferSource();
        src.buffer = this.buffers.miss;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.6, this.ctx.currentTime);
        src.connect(gain);
        gain.connect(this.ctx.destination);
        src.start(0);
        return;
      } catch (e) {}
    }

    try {
      const sfx = this.fallbackMiss.cloneNode();
      sfx.volume = 0.6;
      sfx.play().catch(() => {});
    } catch (e) {}
  }
}

export const soundEngine = new SoundEngine();
