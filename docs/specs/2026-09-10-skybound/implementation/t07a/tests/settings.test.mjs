import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, createSettingsStore, renderingSettings } from '../src/settings.mjs';
test('settings persist separately; invalid writes and unsupported saves use safe defaults', () => {
  let raw = null;
  const store = createSettingsStore(() => ({ getItem: () => raw, setItem: (key, value) => { assert.equal(key, 'skybound.settings.v1'); raw = value; } }));
  assert.deepEqual(store.load(), DEFAULT_SETTINGS);
  assert.equal(store.save({ sensitivity: .5, quality: 'light' }), true);
  assert.deepEqual(store.load(), { sensitivity: .5, quality: 'light', reducedMotion: false });
  const before = raw;
  for (const value of [{ sensitivity: '1', quality: 'light' }, { sensitivity: Infinity, quality: 'standard' }, { sensitivity: 3, quality: 'standard' }, { sensitivity: 1.2, quality: 'standard' }, { sensitivity: 1, quality: 'ultra' }]) assert.equal(store.save(value), false);
  assert.equal(raw, before);
  raw = '{'; assert.deepEqual(store.load(), DEFAULT_SETTINGS);
  raw = JSON.stringify({ version: 9, sensitivity: 1, quality: 'light' }); assert.deepEqual(store.load(), DEFAULT_SETTINGS);
});
test('unavailable storage never prevents playing or changing session settings', () => {
  const store = createSettingsStore(() => { throw new Error('denied'); });
  assert.deepEqual(store.load(), DEFAULT_SETTINGS);
  assert.equal(store.save(DEFAULT_SETTINGS), false);
});
test('light rendering caps DPR and disables shadows without increasing low DPR', () => {
  assert.deepEqual(renderingSettings({ sensitivity: 1, quality: 'light' }, 3), { pixelRatio: 1, shadows: false });
  assert.deepEqual(renderingSettings(DEFAULT_SETTINGS, 3), { pixelRatio: 1.5, shadows: true });
  assert.equal(renderingSettings(DEFAULT_SETTINGS, .8).pixelRatio, .8);
});

test('motion preference follows OS default for old saves and preserves explicit override', () => {
  let raw = JSON.stringify({ version: 1, sensitivity: 1, quality: 'standard' });
  const store = createSettingsStore(() => ({ getItem: () => raw, setItem: (key, value) => { raw = value; } }));
  assert.equal(store.load(true).reducedMotion, true);
  assert.equal(store.save({ ...DEFAULT_SETTINGS, reducedMotion: false }), true);
  assert.equal(store.load(true).reducedMotion, false);
  assert.equal(store.save({ ...DEFAULT_SETTINGS, reducedMotion: 'false' }), false);
});
