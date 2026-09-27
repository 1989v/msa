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
test('held attack chains only at stage boundaries while held jump remains a single press',()=>{
  const input=new InputBuffer(),game=createGame(),attacks=[];input.press('attack');input.press('jump');
  for(let i=0;i<120;i++){stepGame(game,input.consume());attacks.push(...game.events.filter(e=>/^attack[123]$/.test(e.type)).map(e=>e.type));}
  assert.deepEqual(attacks,['attack1','attack2','attack3','attack1']);assert.equal(game.metrics.jumps,1);
  input.release('attack');for(let i=0;i<90;i++)stepGame(game,input.consume());assert.ok(game.player.attackTimer<=0);
  input.press('attack');stepGame(game,input.consume());assert.equal(game.player.combo,1);assert.ok(game.player.attackTimer>0);
});
test('clearing pause input discards held controls, axes and pending taps',()=>{
  const input=new InputBuffer();input.press('jump');input.press('attack');input.axes.x=1;input.clear();
  assert.deepEqual(input.consume(),{cameraYaw:0,moveX:0,moveZ:0});
});
