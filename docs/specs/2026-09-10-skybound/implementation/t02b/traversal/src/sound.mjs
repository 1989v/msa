// Original synthesized cues. No audio assets, network requests, or autoplay.
export function createSoundEffects(createContext) {
  let context = null, volume = 0;
  const voices = new Set();
  const stop = () => {
    for (const voice of [...voices]) { try { voice.stop(); } catch {} voice.disconnect(); }
    voices.clear();
  };
  return {
    async enable(value) {
      volume = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
      if (!volume) { stop(); return true; }
      try { context ??= createContext(); await context.resume(); return context.state === 'running'; }
      catch { return false; }
    },
    stop,
    play(kind) {
      if (!volume || !context || context.state !== 'running') return false;
      const cues = { swing: [170, 65, .12], hit: [260, 95, .16], hurt: [100, 48, .24], complete: [420, 670, .3], ending: [510, 820, .55] };
      const cue = cues[kind]; if (!cue || voices.size >= 6) return false;
      try {
        const [from, to, duration] = cue, now = context.currentTime;
        const oscillator = context.createOscillator(), gain = context.createGain();
        oscillator.type = kind === 'hit' || kind === 'hurt' ? 'triangle' : 'sine';
        oscillator.frequency.setValueAtTime(from, now); oscillator.frequency.exponentialRampToValueAtTime(to, now + duration);
        gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(volume * .12, now + .012); gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
        oscillator.connect(gain); gain.connect(context.destination); voices.add(oscillator);
        oscillator.onended = () => { voices.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
        oscillator.start(now); oscillator.stop(now + duration + .02); return true;
      } catch { return false; }
    },
  };
}
