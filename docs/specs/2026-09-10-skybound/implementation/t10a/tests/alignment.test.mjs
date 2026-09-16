import test from 'node:test';
import assert from 'node:assert/strict';
import {createAlignmentPuzzle} from '../src/alignment.mjs';
const stations=[{x:0,y:0,z:0},{x:3,y:0,z:0},{x:6,y:0,z:0}];
test('all three original stations must align; completion is idempotent and reset restores committed outcome',()=>{
 const puzzle=createAlignmentPuzzle(stations);
 for(let i=0;i<3;i++)for(let count=0;count<=i;count++)assert.equal(puzzle.rotate(i,{position:stations[i],grounded:true,unlocked:true}).ok,true);
 assert.deepEqual(puzzle.snapshot(),{turns:[1,2,3],aligned:3,complete:true});
 assert.equal(puzzle.rotate(0,{position:stations[0],grounded:true,unlocked:true}).reason,'complete');
 puzzle.reset();assert.equal(puzzle.snapshot().complete,false);puzzle.reset(true);assert.equal(puzzle.snapshot().aligned,3);
});
test('distance, altitude, menus, airborne and busy actions cannot turn an observation station',()=>{
 const puzzle=createAlignmentPuzzle(stations),normal={position:stations[0],grounded:true,unlocked:true};
 for(const context of [{paused:true},{blocked:true},{grounded:false},{unlocked:false},{position:{x:0,y:2,z:0}},{position:stations[2]}])assert.equal(puzzle.rotate(0,{...normal,...context}).ok,false);
 assert.deepEqual(puzzle.snapshot().turns,[0,0,0]);
 const copy=puzzle.snapshot();copy.turns[0]=1;assert.equal(puzzle.snapshot().turns[0],0);
});
