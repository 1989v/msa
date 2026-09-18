import test from 'node:test';
import assert from 'node:assert/strict';
import {InputBuffer} from '../input.mjs';
import {createGame,stepGame} from '../sim.mjs';
test('a quick press/release survives render frames with zero simulation ticks',()=>{
  const input=new InputBuffer();input.press('jump');input.release('jump');
  assert.equal(input.pending.has('jump'),true);
  const game=createGame();stepGame(game,input.consume());
  assert.equal(game.metrics.jumps,1);stepGame(game,input.consume());assert.equal(game.metrics.jumps,1);
});
test('held buttons fire once across multiple RAF simulation substeps',()=>{
  const input=new InputBuffer(),game=createGame();input.press('attack');
  for(let i=0;i<60;i++)stepGame(game,input.consume());
  assert.equal(game.player.combo,1);
  input.release('attack');stepGame(game,input.consume());input.press('attack');stepGame(game,input.consume());assert.equal(game.player.attackTimer>0,true);
});
test('clearing pause input discards held controls, axes and pending taps',()=>{
  const input=new InputBuffer();input.press('jump');input.press('attack');input.axes.x=1;input.clear();
  assert.deepEqual(input.consume(),{cameraYaw:0,moveX:0,moveZ:0});
});
