// All timbres are synthesized locally. Nothing is loaded or started until unlock().
const MAX_VOICES = 28;
const ALIASES = Object.freeze({
  build:'interact',plant:'interact',water:'glide',harvest:'reward',gather:'reward',trade:'interact',repair:'solve',travel:'glide',
  attack: 'attack', slash: 'attack', sword: 'attack', combo: 'attack',
  attack1: 'attack1', attack2: 'attack2', attack3: 'attack3',
  hit: 'hit', 'enemy-hit': 'hit', enemyHit: 'hit', impact: 'hit',
  hurt: 'hurt', damage: 'hurt', 'player-hit': 'hurt', playerHit: 'hurt',
  jump: 'jump', land: 'land', landing: 'land', 'air-strike': 'slam', slam: 'slam',
  pulse: 'pulse', resonance: 'pulse', dodge: 'dodge', parry: 'parry',
  'enemy-death': 'enemy-death', enemyDeath: 'enemy-death', kill: 'enemy-death',
  reward: 'reward', chest: 'reward', collect: 'reward', pickup: 'reward',
  interact: 'interact', camp: 'camp', rest: 'camp', heal: 'heal', upgrade: 'solve',
  solve: 'solve', sigil: 'solve', shrine: 'solve', 'puzzle-solved': 'solve',
  glide: 'glide', glider: 'glide', 'glide-start': 'glide',
  win: 'win', victory: 'win', 'boss-defeated': 'win',
  death: 'death', respawn: 'camp', error: 'error', fail: 'error',
  'enemy-attack':'enemy-attack',block:'block',guard:'guard',rune:'interact',wrong:'error',discovery:'reward',
});

export class AudioSystem {
  constructor() {
    this.context = null;
    this.master = null;
    this.compressor = null;
    this.wind = null;
    this.noise = null;
    this.voices = new Set();
    this.muted = false;
    this.unlocked = false;
    this.disposed = false;
    this.lastPlayed = new Map();
    this.listener = { x: 0, z: 0 };
    this.nextNote = 0;
    this.noteIndex = 0;
    this.battle = 0;
  }

  // Invoke directly from a pointer/key gesture; update/play never create a context.
  async unlock() {
    if (this.disposed) return false;
    const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Context) return false;
    try {
      if (!this.context) {
        const context = this.context = new Context();
        this.master = context.createGain();
        this.master.gain.value = this.muted ? 0 : 0.5;
        this.compressor = context.createDynamicsCompressor();
        this.compressor.threshold.value = -18;
        this.compressor.knee.value = 18;
        this.compressor.ratio.value = 4;
        this.compressor.attack.value = 0.005;
        this.compressor.release.value = 0.18;
        this.master.connect(this.compressor);
        this.compressor.connect(context.destination);
        this.noise = this.makeNoise();
        this.createWind();
        this.nextNote = context.currentTime + 2;
      }
      if (this.context.state === 'suspended') await this.context.resume();
      if (this.disposed) return false;
      this.unlocked = this.context.state === 'running';
      return this.unlocked;
    } catch {
      // Browsers without an available audio device remain fully playable.
      this.unlocked = false;
      return false;
    }
  }

  makeNoise() {
    const context = this.context;
    const buffer = context.createBuffer(1, context.sampleRate * 3, context.sampleRate);
    const data = buffer.getChannelData(0);
    let seed = 0x7a13cd;
    let smooth = 0;
    for (let i = 0; i < data.length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      smooth = (smooth + ((seed / 4294967296) * 2 - 1) * 0.12) / 1.12;
      // Fade the loop boundary to zero to avoid periodic clicks.
      const edge = Math.min(1, i / 1600, (data.length - 1 - i) / 1600);
      data[i] = smooth * 3 * edge;
    }
    return buffer;
  }

  createWind() {
    const context = this.context;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = this.noise;
    source.loop = true;
    filter.type = 'lowpass';
    filter.frequency.value = 580;
    filter.Q.value = 0.3;
    gain.gain.value = 0.018;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start();
    this.wind = { source, filter, gain };
  }

  setMuted(value) {
    this.muted = Boolean(value);
    if (!this.master || !this.context || this.disposed) return;
    const now = this.context.currentTime;
    this.master.gain.cancelScheduledValues(now);
    // Immediate zero also mutes already scheduled notes and the wind loop.
    this.master.gain.setValueAtTime(this.muted ? 0 : 0.5, now);
  }

  voice({ frequency = 440, end = frequency, duration = 0.2, volume = 0.1,
    type = 'sine', delay = 0, noise = false, cutoff = 1800, attack = 0.009 }) {
    if (this.disposed || !this.unlocked || this.muted || this.context?.state !== 'running') return;
    while (this.voices.size >= MAX_VOICES) this.voices.values().next().value.stop();
    const context = this.context;
    const start = context.currentTime + delay;
    const finish = start + duration;
    const source = noise ? context.createBufferSource() : context.createOscillator();
    const gain = context.createGain();
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    filter.Q.value = 0.5;
    if (noise) {
      source.buffer = this.noise;
      source.playbackRate.value = frequency / 440;
    } else {
      source.type = type;
      source.frequency.setValueAtTime(Math.max(20, frequency), start);
      source.frequency.exponentialRampToValueAtTime(Math.max(20, end), finish);
    }
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + Math.min(attack, duration / 3));
    gain.gain.exponentialRampToValueAtTime(0.0001, finish);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
      this.voices.delete(voice);
    };
    const voice = { stop: () => {
      try { source.stop(); } catch { /* Already ended. */ }
      cleanup();
    } };
    this.voices.add(voice);
    source.onended = cleanup;
    source.start(start);
    source.stop(finish + 0.02);
  }

  chime(notes, volume = 0.08, spacing = 0.12) {
    notes.forEach((frequency, i) => {
      this.voice({ frequency, duration: 0.65, volume, delay: i * spacing });
      this.voice({ frequency: frequency * 2, duration: 0.25, volume: volume * 0.18, delay: i * spacing });
    });
  }

  play(event) {
    if (!this.unlocked || this.muted || this.disposed || !event) return;
    const detail = typeof event === 'string' ? { type: event } : event;
    let type = Object.hasOwn(ALIASES, detail.type) ? ALIASES[detail.type] : null;
    if (!type) return;
    if (type === 'attack') type = `attack${Math.max(1, Math.min(3, Math.floor(Number(detail.combo || detail.stage || detail.power) || 1)))}`;
    const now = this.context.currentTime;
    const minimumGap = type === 'hit' ? 0.035 : type === 'reward' ? 0.07 : 0.025;
    if (now - (this.lastPlayed.get(type) ?? -Infinity) < minimumGap) return;
    this.lastPlayed.set(type, now);
    const distance = Number.isFinite(detail.x) && Number.isFinite(detail.z)
      ? Math.hypot(detail.x - this.listener.x, detail.z - this.listener.z) : 0;
    const amplitude = Math.max(0.08, 1 / (1 + distance * 0.07));
    const tone = options => this.voice({ ...options, volume: (options.volume ?? 0.1) * amplitude });
    const puff = (duration, volume, cutoff = 1500, frequency = 440) =>
      tone({ noise: true, duration, volume, cutoff, frequency });
    switch (type) {
      case 'attack1': case 'attack2': case 'attack3': {
        const stage = Number(type.at(-1));
        puff(0.13 + stage * 0.035, 0.12 + stage * 0.035, 1700 + stage * 700, 440 + stage * 120);
        tone({ frequency: 280 - stage * 28, end: 65, duration: 0.15, volume: 0.08, type: 'triangle' });
        break;
      }
      case 'hit':
        puff(0.12, 0.28, 2300);
        tone({ frequency: 135, end: 52, duration: 0.14, volume: 0.22, type: 'triangle' });
        break;
      case 'hurt':
        tone({ frequency: 175, end: 62, duration: 0.25, volume: 0.2, type: 'sawtooth', cutoff: 750 });
        puff(0.2, 0.17, 600);
        break;
      case 'jump': tone({ frequency: 210, end: 390, duration: 0.16, volume: 0.07, type: 'triangle' }); break;
      case 'land': puff(0.12, 0.13, 480); break;
      case 'slam':
        puff(0.35, 0.32, 1100);
        tone({ frequency: 95, end: 30, duration: 0.4, volume: 0.22 });
        break;
      case 'pulse':
        tone({ frequency: 110, end: 560, duration: 0.48, volume: 0.19, type: 'triangle' });
        tone({ frequency: 440, end: 220, duration: 0.65, volume: 0.08, delay: 0.07 });
        puff(0.42, 0.14, 1700);
        break;
      case 'dodge': puff(0.19, 0.11, 2100, 620); break;
      case 'parry': this.chime([880, 1320, 1760], 0.095 * amplitude, 0.035); break;
      case 'enemy-death':
        tone({ frequency: 195, end: 40, duration: 0.4, volume: 0.12, type: 'triangle' });
        puff(0.4, 0.15, 760);
        break;
      case 'reward': this.chime([659.25, 987.77], 0.065 * amplitude); break;
      case 'interact': this.chime([392, 523.25], 0.045 * amplitude, 0.08); break;
      case 'enemy-attack': puff(0.19,0.10,780);tone({frequency:95,end:48,duration:.19,volume:.09,type:'triangle'});break;
      case 'block': tone({frequency:690,end:320,duration:.12,volume:.10,type:'triangle'});break;
      case 'guard': tone({frequency:470,end:600,duration:.12,volume:.04,type:'sine'});break;
      case 'heal': case 'camp': this.chime([293.66, 392, 587.33], 0.055 * amplitude, 0.18); break;
      case 'solve': this.chime([392, 493.88, 587.33, 783.99], 0.085 * amplitude, 0.16); break;
      case 'glide':
        puff(0.7, 0.09, 1100);
        tone({ frequency: 330, end: 495, duration: 0.75, volume: 0.035, attack: 0.15 });
        break;
      case 'win': this.chime([293.66, 392, 493.88, 587.33, 783.99, 987.77], 0.095, 0.22); break;
      case 'death': tone({ frequency: 220, end: 55, duration: 1.1, volume: 0.12, type: 'triangle' }); break;
      case 'error': tone({ frequency: 145, end: 120, duration: 0.16, volume: 0.065, type: 'triangle' }); break;
    }
  }

  update(state, dt = 1 / 60) {
    if (!this.unlocked || this.disposed || this.context?.state !== 'running' || !state?.player) return;
    const player = state.player;
    this.listener.x = player.x;
    this.listener.z = player.z;
    const threat = (state.enemies || []).some(enemy => enemy.hp > 0 &&
      enemy.state !== 'idle' && enemy.state !== 'dead' &&
      Math.hypot(enemy.x - player.x, enemy.z - player.z) < 27);
    this.battle += ((threat ? 1 : 0) - this.battle) * Math.min(1, Math.max(0, dt) * 1.5);
    const now = this.context.currentTime;
    const windLevel = (state.mode === 'dead' ? 0.009 : 0.019) + (player.gliding ? 0.025 : 0);
    this.wind.gain.gain.setTargetAtTime(windLevel * (0.9 + Math.sin(now * 0.4) * 0.1), now, 0.4);
    this.wind.filter.frequency.setTargetAtTime(500 + this.battle * 170 + (player.gliding ? 600 : 0), now, 0.6);
    if (this.muted || now < this.nextNote || state.mode === 'dead' || state.mode === 'paused') return;
    // An original sparse six-note contour, with a lower, quicker pulse in combat.
    const phrase = [0, 7, 12, 4, 9, 7, 2, 12];
    const index = this.noteIndex++;
    const base = this.battle > 0.45 ? 146.832 : 293.665;
    const frequency = base * 2 ** (phrase[index % phrase.length] / 12);
    this.voice({ frequency, duration: this.battle > 0.45 ? 0.5 : 2.4,
      volume: this.battle > 0.45 ? 0.035 : 0.025, type: 'sine', attack: 0.045 });
    if (index % 4 === 0) this.voice({ frequency: base / 2, duration: 3.6, volume: 0.018, attack: 0.3 });
    this.nextNote = now + (this.battle > 0.45 ? 0.85 : [3.7, 4.9, 3.2, 5.3][index % 4]);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.unlocked = false;
    for (const voice of [...this.voices]) voice.stop();
    if (this.wind) {
      try { this.wind.source.stop(); } catch { /* Already stopped. */ }
      this.wind.source.disconnect();
      this.wind.filter.disconnect();
      this.wind.gain.disconnect();
    }
    this.master?.disconnect();
    this.compressor?.disconnect();
    if (this.context && this.context.state !== 'closed') this.context.close().catch(() => {});
    this.lastPlayed.clear();
    this.wind = this.noise = null;
  }
}
