// 효과음 — 외부 에셋 없이 WebAudio 로 합성한다. 첫 사용자 입력 뒤에 켜진다.
type Sfx = 'hit' | 'heavy' | 'guard' | 'guardBreak' | 'jump' | 'land' | 'ko' | 'explode' | 'pickup' | 'heal' | 'tick' | 'go' | 'shot' | 'whoosh' | 'throw' | 'end';

export class Audio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  muted = false;
  private lastAt = new Map<Sfx, number>();

  constructor() {
    try { this.muted = localStorage.getItem('amp.mute') === '1'; } catch { /* 저장소 없음 */ }
  }

  /** 사용자 제스처 안에서 부른다 */
  unlock(): void {
    if (this.ctx) { if (this.ctx.state === 'suspended') void this.ctx.resume(); return; }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    try { localStorage.setItem('amp.mute', this.muted ? '1' : '0'); } catch { /* 무시 */ }
    return this.muted;
  }

  private tone(freq: number, to: number, dur: number, type: OscillatorType, vol: number, delay = 0): void {
    const c = this.ctx!, t0 = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (to !== freq) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g).connect(this.master!);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  private burst(dur: number, vol: number, filterHz: number, q = 1, type: BiquadFilterType = 'bandpass', delay = 0, sweepTo = 0): void {
    const c = this.ctx!, t0 = c.currentTime + delay;
    const s = c.createBufferSource();
    s.buffer = this.noise!;
    const f = c.createBiquadFilter();
    f.type = type; f.frequency.setValueAtTime(filterHz, t0); f.Q.value = q;
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t0 + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    s.connect(f).connect(g).connect(this.master!);
    s.start(t0); s.stop(t0 + dur + 0.02);
  }

  play(name: Sfx): void {
    if (!this.ctx || !this.master || this.muted) return;
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    const now = performance.now();
    const last = this.lastAt.get(name) ?? 0;
    if (now - last < 35) return; // 같은 소리 겹침 방지
    this.lastAt.set(name, now);
    switch (name) {
      case 'hit': this.burst(0.08, 0.5, 900, 1.2); this.tone(140, 60, 0.09, 'sine', 0.5); break;
      case 'heavy': this.burst(0.16, 0.6, 500, 0.8); this.tone(90, 40, 0.18, 'sine', 0.8); this.tone(400, 120, 0.1, 'square', 0.12); break;
      case 'guard': this.tone(1100, 900, 0.05, 'square', 0.18); this.tone(2200, 1800, 0.04, 'triangle', 0.12); break;
      case 'guardBreak': this.tone(1400, 200, 0.35, 'sawtooth', 0.25); this.burst(0.3, 0.3, 1200, 1, 'bandpass', 0, 300); break;
      case 'jump': this.tone(280, 620, 0.12, 'triangle', 0.15); break;
      case 'land': this.burst(0.06, 0.2, 300, 0.7, 'lowpass'); break;
      case 'ko': this.tone(120, 30, 0.45, 'sine', 0.9); this.burst(0.35, 0.6, 700, 0.6, 'bandpass', 0, 150); this.tone(880, 220, 0.4, 'sawtooth', 0.15, 0.05); break;
      case 'explode': this.burst(0.5, 0.9, 600, 0.5, 'lowpass', 0, 80); this.tone(60, 25, 0.5, 'sine', 0.9); break;
      case 'pickup': this.tone(660, 660, 0.06, 'square', 0.12); this.tone(990, 990, 0.08, 'square', 0.12, 0.06); break;
      case 'heal': this.tone(520, 520, 0.08, 'triangle', 0.18); this.tone(780, 780, 0.1, 'triangle', 0.18, 0.08); this.tone(1040, 1040, 0.16, 'triangle', 0.18, 0.16); break;
      case 'tick': this.tone(880, 880, 0.08, 'square', 0.14); break;
      case 'go': this.tone(1320, 1320, 0.25, 'square', 0.18); this.tone(1760, 1760, 0.25, 'triangle', 0.12, 0.02); break;
      case 'shot': this.burst(0.05, 0.4, 2500, 1.5); this.tone(220, 80, 0.05, 'square', 0.2); break;
      case 'whoosh': this.burst(0.18, 0.25, 400, 0.8, 'bandpass', 0, 1600); break;
      case 'throw': this.burst(0.2, 0.3, 300, 0.8, 'bandpass', 0, 1200); this.tone(200, 400, 0.15, 'triangle', 0.1); break;
      case 'end': this.tone(660, 660, 0.18, 'square', 0.16); this.tone(880, 880, 0.18, 'square', 0.16, 0.18); this.tone(1320, 1320, 0.4, 'square', 0.18, 0.36); break;
    }
  }
}

export const audio = new Audio();
