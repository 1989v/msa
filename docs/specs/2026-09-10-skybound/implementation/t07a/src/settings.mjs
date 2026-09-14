export const DEFAULT_SETTINGS = Object.freeze({ sensitivity: 1, quality: 'standard' });
const key = 'skybound.settings.v1';
export function validSettings(value) {
  return value && typeof value === 'object' && !Array.isArray(value) && Number.isFinite(value.sensitivity)
    && [.5, 1, 1.5, 2].includes(value.sensitivity) && ['standard', 'light'].includes(value.quality);
}
export function createSettingsStore(getStorage) {
  return {
    load() {
      try {
        const raw = getStorage().getItem(key);
        if (raw === null) return { ...DEFAULT_SETTINGS };
        if (raw.length > 1024) return { ...DEFAULT_SETTINGS };
        const saved = JSON.parse(raw);
        return saved.version === 1 && validSettings(saved) ? { sensitivity: saved.sensitivity, quality: saved.quality } : { ...DEFAULT_SETTINGS };
      } catch { return { ...DEFAULT_SETTINGS }; }
    },
    save(value) {
      if (!validSettings(value)) return false;
      try { getStorage().setItem(key, JSON.stringify({ version: 1, sensitivity: value.sensitivity, quality: value.quality })); return true; }
      catch { return false; }
    },
  };
}

export function renderingSettings(settings, deviceRatio) {
  if (!validSettings(settings) || !Number.isFinite(deviceRatio) || deviceRatio <= 0) throw new TypeError('Valid settings and pixel ratio required');
  return { pixelRatio: Math.min(deviceRatio, settings.quality === 'light' ? 1 : 1.5), shadows: settings.quality !== 'light' };
}
