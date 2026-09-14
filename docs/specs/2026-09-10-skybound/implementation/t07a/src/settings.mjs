export const DEFAULT_SETTINGS = Object.freeze({ sensitivity: 1, quality: 'standard', reducedMotion: false, volume: 0 });
const key = 'skybound.settings.v1';
export function validSettings(value) {
  return value && typeof value === 'object' && !Array.isArray(value) && Number.isFinite(value.sensitivity)
    && [.5, 1, 1.5, 2].includes(value.sensitivity) && ['standard', 'light'].includes(value.quality)
    && (value.reducedMotion === undefined || typeof value.reducedMotion === 'boolean')
    && (value.volume === undefined || [0, .25, .5, 1].includes(value.volume));
}
export function createSettingsStore(getStorage) {
  return {
    load(reducedMotionDefault = false) {
      const fallback = { ...DEFAULT_SETTINGS, reducedMotion: reducedMotionDefault === true };
      try {
        const raw = getStorage().getItem(key);
        if (raw === null) return { ...fallback };
        if (raw.length > 1024) return { ...fallback };
        const saved = JSON.parse(raw);
        return saved.version === 1 && validSettings(saved) ? { sensitivity: saved.sensitivity, quality: saved.quality, reducedMotion: saved.reducedMotion ?? fallback.reducedMotion, volume: saved.volume ?? 0 } : { ...fallback };
      } catch { return { ...fallback }; }
    },
    save(value) {
      if (!validSettings(value)) return false;
      try { getStorage().setItem(key, JSON.stringify({ version: 1, sensitivity: value.sensitivity, quality: value.quality, reducedMotion: value.reducedMotion ?? false, volume: value.volume ?? 0 })); return true; }
      catch { return false; }
    },
  };
}

export function renderingSettings(settings, deviceRatio) {
  if (!validSettings(settings) || !Number.isFinite(deviceRatio) || deviceRatio <= 0) throw new TypeError('Valid settings and pixel ratio required');
  return { pixelRatio: Math.min(deviceRatio, settings.quality === 'light' ? 1 : 1.5), shadows: settings.quality !== 'light' };
}
