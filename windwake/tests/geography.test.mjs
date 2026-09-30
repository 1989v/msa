import test from 'node:test';
import assert from 'node:assert/strict';
import {EXPEDITIONS,CAVE_APPROACHES,TOWNS,DUNGEON_ENTRANCES,LANDMARKS,WAYPOINTS,heightAt,querySolids,WORLD} from '../world.mjs';
import {triangleHeight} from '../terrain.mjs';
import {createGame,stepGame,exportSave,loadSave} from '../sim.mjs';
import {runExpedition} from './geography-routes.mjs';

test('named optional expeditions have meaningful vertical travel and alternate returns',()=>{
  assert.equal(EXPEDITIONS.length,2);
  for(const e of EXPEDITIONS){
    const start=e.points[0],end=e.points.at(-1),gain=heightAt(end.x,end.z)-heightAt(start.x,start.z);
    assert.ok(e.biomeId==='alpine'?gain>=55:gain<=-25,`${e.id}: ${gain}`);
    assert.deepEqual(e.returnPoints[0],end);assert.deepEqual(e.returnPoints.at(-1),start);
    assert.ok(e.returnPoints.slice(1,-1).every(p=>!e.points.some(q=>q.x===p.x&&q.z===p.z)));
    const w=WAYPOINTS.find(w=>w.id===e.waypointId);assert.equal(e.approachPoints[0].x,w.x);assert.equal(e.approachPoints[0].z,w.z);
    for(const id of [e.clueId,e.discoveryId,e.rewardId])assert.ok(LANDMARKS.some(l=>l.id===id));
  }
});
test('all expedition and natural cave approaches share the mesh and clear one-metre walking grades',()=>{
  for(const e of [...EXPEDITIONS,...CAVE_APPROACHES])for(const points of [e.approachPoints||[],e.points,e.returnPoints||[]])for(let j=1;j<points.length;j++){
    const a=points[j-1],b=points[j],d=Math.hypot(b.x-a.x,b.z-a.z),n=Math.ceil(d);let previous=heightAt(a.x,a.z);
    for(let i=1;i<=n;i++){
      const x=a.x+(b.x-a.x)*i/n,z=a.z+(b.z-a.z)*i/n,y=heightAt(x,z);
      assert.ok(Math.abs(y-previous)/(d/n)<=.8,`${e.id} grade at ${x},${z}`);
      assert.ok(y>WORLD.waterLevel+1,`${e.id} water`);
      assert.ok(Math.abs(y-triangleHeight(x,z,heightAt))<.02);
      assert.equal(querySolids(x,z,1).filter(s=>s.y+s.h>y+.48).length,0,`${e.id} blocker ${x},${z}`);previous=y;
    }
  }
});
test('six cave entrances preserve old identities and new entrances connect to towns or a valley',()=>{
  assert.deepEqual(DUNGEON_ENTRANCES.filter(e=>!e.natural&&!e.ruin).map(e=>e.id),['dungeon-sunfields','dungeon-alpine','dungeon-mistwood','dungeon-canyon']);
  for(const approach of CAVE_APPROACHES){const e=DUNGEON_ENTRANCES.find(e=>e.id===approach.entranceId),p=approach.points.at(-1);assert.ok(e.natural);assert.equal(e.x,p.x);assert.equal(e.z,p.z);assert.equal(e.y,heightAt(e.x,e.z));}
});
test('eight town layouts have regional nonblocking decoration and clear NPC access',()=>{
  assert.equal(new Set(TOWNS.map(t=>t.layout)).size,8);
  assert.equal(new Set(TOWNS.map(t=>JSON.stringify(t.buildings.map(b=>[+(b.x-t.x).toFixed(2),+(b.z-t.z).toFixed(2)])))).size,8);
  for(const t of TOWNS){assert.equal(t.decorations.length,3);for(const p of t.decorations){assert.equal(p.blocking,false);assert.ok(p.type);}
    for(const npc of t.npcs)for(let i=0;i<=20;i++){const x=t.x+(npc.x-t.x)*i/20,z=t.z+(npc.z-t.z)*i/20;assert.equal(querySolids(x,z,.5).length,0,npc.id);}
  }
});
for(const e of EXPEDITIONS)test(`ordinary input round trip earns and preserves ${e.rewardId}`,()=>{
  const s=createGame(),w=WAYPOINTS.find(w=>w.id===e.waypointId);
  // Explicit fixture start at existing waypoint; no progress, equipment, HP or reward grants.
  Object.assign(s.player,{x:w.x,z:w.z,y:w.y,grounded:true});
  const result=runExpedition({state:()=>s,step(n,input){for(let i=0;i<n;i++)stepGame(s,input);return s;}},e.id);
  assert.equal(result.falls,0);assert.ok(result.distance>500);assert.notEqual(s.mode,'dead');
  assert.ok(s.progress.chests.includes(e.rewardId));
  assert.ok(loadSave(exportSave(s)).progress.chests.includes(e.rewardId));
});
