import test from 'node:test';
import assert from 'node:assert/strict';
import { createSoundEffects } from '../../t02b/traversal/src/sound.mjs';
test('muted game never acquires an audio context and denied audio stays nonfatal', async () => {
  let attempts = 0;
  const sound = createSoundEffects(() => { attempts++; throw new Error('denied'); });
  assert.equal(sound.play('hit'), false);
  assert.equal(await sound.enable(0), true); assert.equal(attempts, 0);
  assert.equal(await sound.enable(.5), false); assert.equal(attempts, 1);
  assert.equal(sound.play('hit'), false); sound.stop();
});
test('gliding wind reuses one loop, fades on landing, and releases it on pause', async () => {
  let created = 0, stopped = 0, disconnected = 0;
  const levels = [];
  const sound = createSoundEffects(() => ({ state: 'running', currentTime: 0, sampleRate: 8000, destination: {}, async resume() {},
    createBuffer: (_channels, size) => ({ getChannelData: () => new Float32Array(size) }),
    createBufferSource: () => { created++; return { connect() {}, disconnect() { disconnected++; }, start() {}, stop() { stopped++; } }; },
    createBiquadFilter: () => ({ frequency: {}, connect() {}, disconnect() { disconnected++; } }),
    createGain: () => ({ gain: { setValueAtTime() {}, setTargetAtTime(value) { levels.push(value); } }, connect() {}, disconnect() { disconnected++; } }),
  }));
  sound.setGliding(true); assert.equal(created, 0);
  await sound.enable(.5); sound.setGliding(false); assert.equal(created, 0);
  sound.setGliding(true); sound.setGliding(true); sound.setGliding(false);
  assert.equal(created, 1); assert.deepEqual(levels, [.045, 0]);
  sound.stop(); assert.equal(stopped, 1); assert.equal(disconnected, 3);
  sound.setGliding(true); assert.equal(created, 2);
  await sound.enable(0); assert.equal(stopped, 2);
  sound.setGliding(true); assert.equal(created, 2);
});
test('pause cancels active cues, mute prevents new cues, and voice count is bounded', async () => {
  let stopped = 0;
  const param = { setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} };
  const sound = createSoundEffects(() => ({ state: 'running', currentTime: 0, destination: {}, async resume() {},
    createOscillator: () => ({ frequency: param, connect() {}, disconnect() {}, start() {}, stop(at) { if (at === undefined) stopped++; } }),
    createGain: () => ({ gain: param, connect() {}, disconnect() {} }),
  }));
  assert.equal(await sound.enable(.5), true);
  for (let i = 0; i < 6; i++) assert.equal(sound.play('hit'), true);
  assert.equal(sound.play('hit'), false);
  sound.stop(); assert.equal(stopped, 6);
  assert.equal(sound.play('complete'), true);
  await sound.enable(0); assert.equal(stopped, 7); assert.equal(sound.play('ending'), false);
});
