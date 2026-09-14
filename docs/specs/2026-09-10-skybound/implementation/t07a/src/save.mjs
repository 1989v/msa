import { DISCOVERY_IDS } from '../../t06a/src/exploration.mjs';
const SAVE_KEY = 'skybound.progress.v1';
const MAX_SAVE_LENGTH = 4096;
const FLAGS = ['watchRuinActive', 'firstAerialLanding', 'secondAerialLanding', 'stoneRuinActive', 'windRuinActive', 'journeyComplete'];
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function validateProgress(value, allowMissing = false) {
  if (!record(value)) return null;
  const progress = {};
  for (const key of FLAGS) {
    // Older v1 saves predate stone/wind ruins; original flags stay required on load.
    const flag = (allowMissing || key === 'stoneRuinActive' || key === 'windRuinActive' || key === 'journeyComplete') && !Object.hasOwn(value, key) ? false : value[key];
    if (typeof flag !== 'boolean') return null;
    progress[key] = flag;
  }
  if (progress.secondAerialLanding && !progress.firstAerialLanding) return null;
  if (progress.windRuinActive && (!progress.firstAerialLanding || !progress.secondAerialLanding)) return null;
  if (progress.journeyComplete && (!progress.stoneRuinActive || !progress.watchRuinActive || !progress.windRuinActive)) return null;
  if (Object.hasOwn(value, 'discoveries')) {
    const ids = value.discoveries;
    if (!Array.isArray(ids) || ids.length > DISCOVERY_IDS.length || ids.some(id => !DISCOVERY_IDS.includes(id)) || new Set(ids).size !== ids.length) return null;
    progress.discoveries = [...ids];
  }
  return progress;
}

// Acquire storage inside each operation: even the browser's storage getter can throw.
export function createProgressSave(getStorage) {
  return {
    save(value) {
      let serialized;
      try {
        const progress = validateProgress(value, true);
        if (!progress) return { ok: false, reason: 'invalid' };
        serialized = JSON.stringify({ version: 1, worldVersion: 1, progress });
      } catch {
        return { ok: false, reason: 'invalid' };
      }
      try {
        getStorage().setItem(SAVE_KEY, serialized);
        return { ok: true };
      } catch {
        return { ok: false, reason: 'unavailable' };
      }
    },

    load() {
      let serialized;
      try {
        serialized = getStorage().getItem(SAVE_KEY);
      } catch {
        return { ok: false, reason: 'unavailable', progress: {} };
      }
      if (serialized === null) return { ok: true, progress: {} };
      try {
        if (typeof serialized !== 'string' || serialized.length > MAX_SAVE_LENGTH) throw new Error('Invalid save size');
        const saved = JSON.parse(serialized);
        if (!record(saved) || saved.version !== 1 || saved.worldVersion !== 1) throw new Error('Unsupported save version');
        const progress = validateProgress(saved.progress);
        if (!progress) throw new Error('Invalid progress');
        return { ok: true, progress };
      } catch {
        return { ok: false, reason: 'invalid', progress: {} };
      }
    },

    clear() {
      try {
        getStorage().removeItem(SAVE_KEY);
        return { ok: true };
      } catch {
        return { ok: false, reason: 'unavailable' };
      }
    },
  };
}
