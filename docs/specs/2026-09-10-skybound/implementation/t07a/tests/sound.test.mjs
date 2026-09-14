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
