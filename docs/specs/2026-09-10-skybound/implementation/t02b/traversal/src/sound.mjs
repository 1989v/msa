// Original synthesized cues. No audio assets, network requests, or autoplay.
export function createSoundEffects(createContext) {
  let context = null, volume = 0, wind = null, windUnavailable = false;
  const voices = new Set();
  const stop = () => {
    if (wind) { try { wind.source.stop(); } catch {} wind.source.disconnect(); wind.filter.disconnect(); wind.gain.disconnect(); wind = null; }
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
    setGliding(active) {
      if (!volume || !context || context.state !== 'running' || windUnavailable) return;
      if (!active && !wind) return;
      try {
        if (!wind) {
          const source = context.createBufferSource(), filter = context.createBiquadFilter(), gain = context.createGain();
          // Repeating two-second, deterministic noise bed; no borrowed recording.
          const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
          const samples = buffer.getChannelData(0);
          let seed = 7103;
          for (let i = 0; i < samples.length; i++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; samples[i] = seed / 2147483648 - 1; }
          source.buffer = buffer; source.loop = true; filter.type = 'lowpass'; filter.frequency.value = 650;
          gain.gain.setValueAtTime(0, context.currentTime);
          source.connect(filter); filter.connect(gain); gain.connect(context.destination);
          wind = { source, filter, gain, active: null, volume: null }; source.start();
        }
        if (wind.active !== active || wind.volume !== volume) {
          wind.gain.gain.setTargetAtTime(active ? volume * .09 : 0, context.currentTime, .18);
          wind.active = active; wind.volume = volume;
        }
      } catch { windUnavailable = true; stop(); }
    },
    play(kind) {
      if (!volume || !context || context.state !== 'running') return false;
      const cues = { step: [95, 42, .065], swing: [170, 65, .12], hit: [260, 95, .16], hurt: [100, 48, .24], complete: [420, 670, .3], ending: [510, 820, .55] };
      const cue = cues[kind]; if (!cue || voices.size >= 6) return false;
      try {
        const [from, to, duration] = cue, now = context.currentTime;
        const oscillator = context.createOscillator(), gain = context.createGain();
        oscillator.type = kind === 'hit' || kind === 'hurt' ? 'triangle' : 'sine';
        oscillator.frequency.setValueAtTime(from, now); oscillator.frequency.exponentialRampToValueAtTime(to, now + duration);
        gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(volume * (kind === 'step' ? .045 : .12), now + .012); gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
        oscillator.connect(gain); gain.connect(context.destination); voices.add(oscillator);
        oscillator.onended = () => { voices.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
        oscillator.start(now); oscillator.stop(now + duration + .02); return true;
      } catch { return false; }
    },
  };
}
