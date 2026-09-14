import test from 'node:test';
import assert from 'node:assert/strict';
import { createProgressSave } from '../src/save.mjs';

const key = 'skybound.progress.v1';
const flags = { watchRuinActive: true, firstAerialLanding: true, secondAerialLanding: true, stoneRuinActive: true, windRuinActive: true, journeyComplete: true };
const envelope = progress => ({ version: 1, worldVersion: 1, progress });
function storage(initial = null) {
  const data = new Map(initial === null ? [] : [[key, initial]]);
  return {
    getItem: name => data.get(name) ?? null,
    setItem: (name, value) => data.set(name, value),
    removeItem: name => data.delete(name),
  };
}

test('round trip keeps completed flags and excludes transient objects and coordinates', () => {
  const target = storage();
  const save = createProgressSave(() => target);
  assert.deepEqual(save.load(), { ok: true, progress: {} });
  const progress = Object.freeze({ ...flags, position: { y: Infinity }, carriedObject: { id: 'prism' } });
  assert.deepEqual(save.save(progress), { ok: true });
  assert.deepEqual(JSON.parse(target.getItem(key)), envelope(flags));
  assert.deepEqual(save.load(), { ok: true, progress: flags });
  assert.deepEqual(save.save({ watchRuinActive: true }), { ok: true });
  assert.deepEqual(save.load().progress, { watchRuinActive: true, firstAerialLanding: false, secondAerialLanding: false, stoneRuinActive: false, windRuinActive: false, journeyComplete: false });
});

test('old v1 saves preserve original flags and default missing stone and wind ruin flags', () => {
  const { stoneRuinActive, windRuinActive, journeyComplete, ...originalFlags } = flags;
  const target = storage(JSON.stringify(envelope(originalFlags)));
  assert.deepEqual(createProgressSave(() => target).load(), {
    ok: true, progress: { ...originalFlags, stoneRuinActive: false, windRuinActive: false, journeyComplete: false },
  });
  const stoneSave = { ...originalFlags, stoneRuinActive: true };
  assert.deepEqual(createProgressSave(() => storage(JSON.stringify(envelope(stoneSave)))).load(), {
    ok: true, progress: { ...stoneSave, windRuinActive: false, journeyComplete: false },
  });
  for (const missing of Object.keys(originalFlags)) {
    const incomplete = { ...flags };
    delete incomplete[missing];
    assert.deepEqual(createProgressSave(() => storage(JSON.stringify(envelope(incomplete)))).load(), {
      ok: false, reason: 'invalid', progress: {},
    });
  }
});

test('present malformed optional ruin flags are rejected on load and save', () => {
  for (const key of ['stoneRuinActive', 'windRuinActive', 'journeyComplete']) {
    for (const value of [null, 0, 1, 'true', [], {}]) {
      const progress = { ...flags, [key]: value };
      const save = createProgressSave(() => storage(JSON.stringify(envelope(progress))));
      assert.deepEqual(save.load(), { ok: false, reason: 'invalid', progress: {} });
      assert.deepEqual(save.save(progress), { ok: false, reason: 'invalid' });
    }
    assert.deepEqual(createProgressSave(() => storage()).save({ [key]: undefined }), {
      ok: false, reason: 'invalid',
    });
  }
});

test('wind completion requires both route flags on load and preserves storage on invalid writes', () => {
  const raw = JSON.stringify(envelope(flags));
  const target = storage(raw);
  const save = createProgressSave(() => target);
  for (const change of [{ firstAerialLanding: false }, { secondAerialLanding: false }, { firstAerialLanding: false, secondAerialLanding: false }]) {
    const progress = { ...flags, ...change };
    assert.deepEqual(createProgressSave(() => storage(JSON.stringify(envelope(progress)))).load(), { ok: false, reason: 'invalid', progress: {} });
    assert.deepEqual(save.save(progress), { ok: false, reason: 'invalid' });
    assert.equal(target.getItem(key), raw);
  }
});

test('unsupported, corrupt, oversized, and invalid progress saves are rejected without modifying storage', () => {
  const invalid = [
    '{', 'null', '[]', ' '.repeat(4097),
    ...[{ version: 2 }, { version: '1' }, { worldVersion: 2 }, { worldVersion: null }].map(change => JSON.stringify({ ...envelope(flags), ...change })),
    ...[null, [], {}, { ...flags, watchRuinActive: 1 }, { ...flags, firstAerialLanding: false }].map(progress => JSON.stringify(envelope(progress))),
  ];
  for (const raw of invalid) {
    const target = storage(raw);
    assert.deepEqual(createProgressSave(() => target).load(), { ok: false, reason: 'invalid', progress: {} });
    assert.equal(target.getItem(key), raw);
  }
});

test('invalid writes preserve prior progress and boolean types are never coerced', () => {
  const raw = JSON.stringify(envelope(flags));
  const target = storage(raw);
  const save = createProgressSave(() => target);
  for (const value of [null, [], undefined, { secondAerialLanding: true }, ...[undefined, null, 0, 1, 'true'].map(watchRuinActive => ({ watchRuinActive }))]) {
    assert.deepEqual(save.save(value), { ok: false, reason: 'invalid' });
    assert.equal(target.getItem(key), raw);
  }
});

test('quota failures and denied storage acquisition or reads return recoverable errors', () => {
  const denied = () => { throw new Error('Storage denied'); };
  const inaccessible = createProgressSave(denied);
  assert.deepEqual(inaccessible.save(flags), { ok: false, reason: 'unavailable' });
  assert.deepEqual(inaccessible.load(), { ok: false, reason: 'unavailable', progress: {} });
  assert.deepEqual(inaccessible.clear(), { ok: false, reason: 'unavailable' });
  const save = createProgressSave(() => ({ getItem: denied, setItem: denied, removeItem: denied }));
  assert.deepEqual(save.save(flags), { ok: false, reason: 'unavailable' });
  assert.deepEqual(save.load(), { ok: false, reason: 'unavailable', progress: {} });
  assert.deepEqual(save.clear(), { ok: false, reason: 'unavailable' });
});

test('clear removes only this game progress and subsequent load starts empty', () => {
  const target = storage(JSON.stringify(envelope(flags)));
  target.setItem('unrelated.setting', 'keep');
  const save = createProgressSave(() => target);
  assert.deepEqual(save.clear(), { ok: true });
  assert.deepEqual(save.load(), { ok: true, progress: {} });
  assert.equal(target.getItem('unrelated.setting'), 'keep');
});
