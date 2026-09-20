import test from 'node:test';
import assert from 'node:assert/strict';
import { WORLD, VILLAGE, BIOMES, WAYPOINTS, BOSS_SITES, RESOURCE_NODES, LANDMARKS,
  TOWNS, DUNGEON_ENTRANCES, TRAILS, SOLIDS, TRAIL_ROUTES, heightAt, terrainColor, supportAt, getChunk, querySolids,
  spawnsNear, worldStats } from '../world.mjs';
import { Renderer, daylightAt } from '../render.mjs';
import { DUNGEONS, dungeonGeometry, dungeonFloor } from '../dungeons.mjs';

test('64× world keeps original puzzle IDs and finite authored destinations', () => {
  assert.equal((WORLD.size / 120) ** 2, 64);
  assert.equal(BIOMES.length, 8);
  assert.equal(WAYPOINTS.filter(w => w.id !== 'home').length, 8);
  assert.equal(BOSS_SITES.filter(b => !b.final).length, 8);
  assert.equal(new Set(BOSS_SITES.map(b => b.family)).size, 4);
  assert.equal(RESOURCE_NODES.length, 11);
  assert.equal(LANDMARKS.filter(l => l.biomeId && ['resource', 'trial', 'chest'].includes(l.kind)).length, 24);
  for (const id of ['camp', 'quarry', 'forest', 'ruins', 'wind', 'chest-lake']) assert.ok(LANDMARKS.some(l => l.id === id));
  assert.equal(new Set(LANDMARKS.map(l => l.id)).size, LANDMARKS.length);
  for (const l of LANDMARKS) for (const axis of ['x', 'y', 'z']) assert.ok(Number.isFinite(l[axis]), `${l.id}.${axis}`);
});

test('chunk seeds reproduce after reversed access order and eviction', () => {
  const first = structuredClone(getChunk(-11, 4));
  for (let z = 15; z >= -16; z--) for (let x = 15; x >= -16; x--) getChunk(x, z);
  assert.deepEqual(getChunk(-11, 4), first);
  assert.ok(worldStats().cachedChunks <= 96);
  assert.ok(worldStats().evictedChunks > 0);
  const ids = first.spawns.map(e => e.id);
  assert.deepEqual(getChunk(-11, 4).spawns.map(e => e.id), ids);
});

test('atlas sampling cannot materialize geometry or collision chunks', () => {
  const before = worldStats();
  for (let x = -960; x < 960; x += 24) for (let z = -960; z < 960; z += 24) {
    assert.ok(Number.isFinite(heightAt(x, z)));
    assert.equal(terrainColor(x, z).length, 3);
  }
  assert.equal(worldStats().generatedChunks, before.generatedChunks);
  assert.equal(worldStats().cachedChunks, before.cachedChunks);
});

test('local queries return crossing AABBs once and preserve elevated support', () => {
  const sky = SOLIDS.find(b => b.id === 'sky-island');
  for (const x of [-.01, .01, sky.x + sky.w / 2 - .01]) {
    const matches = querySolids(x, 31, .1).filter(b => b.id === sky.id);
    assert.equal(matches.length, 1);
    assert.equal(supportAt(x, 31, 28), 28);
  }
  let crossing;
  for (let cx = 3; cx < 12 && !crossing; cx++) for (let cz = 3; cz < 12 && !crossing; cz++) {
    crossing = getChunk(cx, cz).solids.find(b => Math.floor((b.x - b.w / 2) / 60) !== Math.floor((b.x + b.w / 2) / 60));
  }
  assert.ok(crossing, 'seed contains a procedural solid across a chunk boundary');
  const boundary = Math.ceil((crossing.x - crossing.w / 2) / 60) * 60;
  for (const x of [boundary - .01, boundary + .01]) assert.equal(querySolids(x, crossing.z, .02).filter(b => b.id === crossing.id).length, 1);
  querySolids(660, 0, 6);
  assert.ok(worldStats().lastQueryCells <= 4, JSON.stringify(worldStats()));
  querySolids(0, 0, 999999);
  assert.ok(worldStats().cachedChunks <= 96);
  assert.ok(worldStats().lastQueryCells <= 64);
  assert.deepEqual(querySolids(NaN, 0), []);
});

test('authored route geometry is connected, above water and clear at one metre samples', () => {
  for (const route of TRAIL_ROUTES) {
    const waypoint = WAYPOINTS.find(w => w.id === route.waypointId);
    assert.deepEqual(route.points[0], WORLD.spawn);
    assert.equal(route.points.at(-1).x, waypoint.x);
    assert.equal(route.points.at(-1).z, waypoint.z);
    for (const points of [route.points, route.bossPoints]) for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i], length = Math.hypot(b.x - a.x, b.z - a.z), steps = Math.ceil(length);
      const dx = (b.x - a.x) / steps, dz = (b.z - a.z) / steps;
      for (let j = 1; j <= steps; j++) {
        const x = a.x + dx * j, z = a.z + dz * j, h = heightAt(x, z);
        const grade = Math.abs(h - heightAt(x - dx, z - dz)) / Math.hypot(dx, dz);
        assert.ok(grade <= .8, `${route.id}: slope ${grade} at ${x},${z}`);
        assert.ok(h > WORLD.waterLevel + 1, `${route.id}: drowned path`);
        assert.equal(querySolids(x, z, 3).filter(box => box.y + box.h > h + .48).length, 0, `${route.id}: blocked at ${x},${z}`);
      }
    }
  }
});

test('home is flat and physical arrival/arena pads contain no collision obstacles', () => {
  const y = heightAt(VILLAGE.x, VILLAGE.z);
  for (let x = -24; x <= 24; x += 4) for (let z = -24; z <= 24; z += 4) if (Math.hypot(x, z) < 28) {
    assert.ok(Math.abs(heightAt(VILLAGE.x + x, VILLAGE.z + z) - y) < 1e-9);
    assert.equal(querySolids(VILLAGE.x + x, VILLAGE.z + z, 1).length, 0);
  }
  for (const site of [...WAYPOINTS, ...BOSS_SITES]) {
    assert.ok(site.y > WORLD.waterLevel + 1);
    assert.equal(querySolids(site.x, site.z, site.kind === 'boss' ? 13 : 5).length, 0, site.id);
  }
  const spawns = spawnsNear(650, 0);
  assert.ok(spawns.some(e => e.id === 'boss-coast'));
  assert.equal(new Set(spawns.map(e => e.id)).size, spawns.length);
});

// The fake GL records real Renderer allocation/deletion paths. Actual shader
// compilation and frame appearance remain Chrome verification responsibilities.
function canvasFixture() {
  let id = 0;
  const buffers = new Set(), deleted = [], attributes = new Map();
  const base = {
    createBuffer() { const b = { id: ++id }; buffers.add(b); return b; },
    deleteBuffer(b) { assert.ok(buffers.delete(b), 'buffer is deleted exactly once'); deleted.push(b); },
    createShader() { return {}; }, createProgram() { return {}; },
    getShaderParameter() { return true; }, getProgramParameter() { return true; },
    getAttribLocation(p, name) { if (!attributes.has(name)) attributes.set(name, attributes.size); return attributes.get(name); },
    getUniformLocation() { return {}; },
  };
  const gl = new Proxy(base, { get(target, key) { return target[key] ?? (/^[A-Z_0-9]+$/.test(key) ? 1 : () => {}); } });
  const canvas = { clientWidth: 800, clientHeight: 600, width: 800, height: 600,
    getContext: () => gl, getBoundingClientRect: () => ({ width: 800, height: 600 }),
    addEventListener() {}, removeEventListener() {} };
  return { canvas, buffers, deleted };
}

test('three world circuits bound residency/build work and delete every GPU buffer', () => {
  const fixture = canvasFixture(), renderer = new Renderer(fixture.canvas);
  assert.equal(renderer.stats.residentChunks, 9);
  for (let circuit = 0; circuit < 3; circuit++) for (const site of [...WAYPOINTS.slice(1), WAYPOINTS[0]]) {
    for (let frame = 0; frame < 25; frame++) {
      renderer.streamWorld(site.x, site.z);
      assert.ok(renderer.stats.chunkBuildsThisFrame <= 2);
      assert.ok(renderer.stats.residentChunks <= 64);
      assert.ok(worldStats().cachedChunks <= 96);
      assert.equal(fixture.buffers.size, renderer.stats.residentChunks + 5);
    }
    assert.ok(renderer.stats.residentBytes > 0);
    assert.ok(renderer.stats.staticTriangles < 120000);
  }
  assert.ok(renderer.stats.disposedChunks > 900);
  renderer.dispose();
  assert.equal(renderer.stats.residentChunks, 0);
  assert.equal(renderer.stats.residentBytes, 0);
  assert.equal(fixture.buffers.size, 0);
});

test('new creature and village schemas produce finite dynamic geometry with legacy fallback', () => {
  const fixture = canvasFixture(), renderer = new Renderer(fixture.canvas);
  const player = { x: -34, y: heightAt(-34, -86), z: -86, yaw: 0, grounded: true, vx: 0, vz: 0 };
  const state = { frame: 1, time: 1, player, progress: {}, enemies: [], effects: [], blocks: [], items: [] };
  renderer.render(state);
  const types = ['stalker', 'ranger', 'charger', 'slime', 'wolf', 'boar', 'shaman', 'wisp', 'bomber', 'sentinel', 'burrower', 'frostling'];
  state.enemies = types.map((type, i) => ({ type, x: player.x + (i % 4) * 4, y: player.y, z: player.z + 8 + Math.floor(i / 4) * 4, hp: 30, maxHp: 50, state: 'telegraph', pattern: ['slow', 'eruption', 'sweep', 'burst'][i % 4], targetX: player.x, targetY: player.y, targetZ: player.z, telegraphRadius: 3, yaw: 0 }));
  state.village = { clock: 490, structures: ['plot', 'cottage', 'well', 'granary', 'tower', 'fence', 'flowers', 'lantern'].map((type, i) => ({ id: `s${i}`, type, x: -46 + i * 4, y: player.y, z: -98, hp: 100, maxHp: 100, facing: 0 })), plots: ['turnip', 'wheat', 'pumpkin', 'moonflower'].map((crop, i) => ({ crop, x: -46 + i * 4, y: player.y, z: -102, stage: 'ripe', watered: true })), gathered: {}, elapsed: 1 };
  renderer.render(state);
  assert.ok([...renderer.dynamic.data.subarray(0, renderer.dynamic.length)].every(Number.isFinite));
  assert.ok([...renderer.transparent.data.subarray(0, renderer.transparent.length)].every(Number.isFinite));
  assert.equal(daylightAt(undefined), 1);
  assert.equal(daylightAt(90), 1);
  assert.equal(daylightAt(500), .55);
  renderer.dispose();
});

test('eight populated towns have physical services, clear residents and no ambient spawns', () => {
  assert.equal(TOWNS.length, 8);
  assert.equal(DUNGEON_ENTRANCES.length, 4);
  assert.equal(new Set(TOWNS.map(t => t.name)).size, 8);
  assert.equal(new Set(TOWNS.map(t => t.style)).size, 8);
  for (const town of TOWNS) {
    assert.equal(town.npcs.length, 3);
    assert.ok(town.buildings.length >= 6);
    assert.deepEqual(town.npcs.map(n => n.role).sort(), ['guide', 'keeper', 'merchant']);
    assert.ok(town.service);
    assert.equal(spawnsNear(town.x, town.z, town.radius).length, 0);
    for (const npc of town.npcs) {
      assert.equal(npc.townId, town.id);
      assert.equal(querySolids(npc.x, npc.z, .45).length, 0, npc.id);
      assert.equal(npc.y, heightAt(npc.x, npc.z));
    }
    for (const building of town.buildings) assert.ok(querySolids(building.x, building.z, .1).some(s => s.id === `solid-${building.id}`));
  }
});

test('town streets and dungeon approaches preserve a clear three-metre base-character route', () => {
  const approaches = TRAILS.filter(t => t.id.startsWith('town-approach') || t.id.startsWith('dungeon-approach'));
  assert.equal(approaches.length, 12);
  for (const trail of approaches) for (let i = 1; i < trail.points.length; i++) {
    const a = trail.points[i - 1], b = trail.points[i], steps = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z));
    const dx = (b.x - a.x) / steps, dz = (b.z - a.z) / steps;
    for (let j = 1; j <= steps; j++) {
      const x = a.x + dx * j, z = a.z + dz * j, y = heightAt(x, z);
      assert.ok(Math.abs(y - heightAt(x - dx, z - dz)) / Math.hypot(dx, dz) <= .8, trail.id);
      assert.equal(querySolids(x, z, 3).filter(b => b.y + b.h > y + .48).length, 0, trail.id);
    }
  }
});

test('settlement residents and styles generate finite geometry within an independent NPC budget', () => {
  const fixture = canvasFixture(), renderer = new Renderer(fixture.canvas);
  for (const town of TOWNS) {
    const player = { x: town.x, y: town.y, z: town.z, yaw: town.yaw, grounded: true, vx: 0, vz: 0 };
    renderer.render({ frame: 1, time: 1, player, progress: {}, enemies: [], effects: [], blocks: [], items: [] });
    assert.equal(renderer.stats.visibleNPCs, 3);
    assert.ok(renderer.stats.visibleNPCs <= 12);
    assert.ok([...renderer.dynamic.data.subarray(0, renderer.dynamic.length)].every(Number.isFinite));
  }
  renderer.dispose();
  assert.equal(fixture.buffers.size, 0);
});

test('repeated instance transitions isolate geometry, camera floor and every static buffer', () => {
  const fixture = canvasFixture(), renderer = new Renderer(fixture.canvas);
  const state = { frame: 1, time: 1, player: { x: WORLD.spawn.x, y: heightAt(WORLD.spawn.x, WORLD.spawn.z), z: WORLD.spawn.z, grounded: true, vx: 0, vz: 0, yaw: 0 }, enemies: [], effects: [], items: [], blocks: [], progress: {}, expedition: { active: null, progress: {} } };
  for (let cycle = 0; cycle < 3; cycle++) for (const dungeon of DUNGEONS) {
    // Controlled render fixture only: real entry, encounters and puzzle actions
    // are verified by dungeon domain and natural-route tests separately.
    state.expedition.active = { id: dungeon.id, blocks: [], sequenceSteps: {} };
    state.expedition.progress[dungeon.id] = { killed: [], solved: [], opened: [], claimed: false };
    Object.assign(state.player, dungeon.entry);
    const before = worldStats().generatedChunks;
    for (let frame = 0; frame < 4; frame++) {
      state.frame++;
      renderer.render(state);
      assert.equal(worldStats().generatedChunks, before, 'indoor render must not allocate world geometry');
      assert.equal(renderer.stats.residentChunks, 0);
      assert.equal(renderer.stats.chunkBuildsThisFrame, 0);
      assert.equal(renderer.stats.dungeonBuffers, 1);
      assert.equal(renderer.stats.residentBytes, renderer.stats.dungeonBytes);
      assert.equal(renderer.stats.visibleNPCs, 0);
      assert.equal(fixture.buffers.size, 4, 'three reusable renderer buffers and one active dungeon batch');
      assert.equal(renderer.water, null);
      assert.equal(renderer.backdrop, null);
      assert.equal(renderer.floorAt(state.player.x, state.player.z), dungeonFloor(state, state.player.x, state.player.z));
      assert.equal(renderer.stats.closedDungeonDoors, dungeonGeometry(state).doors.filter(d => !d.open).length);
      assert.ok([...renderer.dynamic.data.subarray(0, renderer.dynamic.length)].every(Number.isFinite));
    }
    state.expedition.active = null;
    Object.assign(state.player, { x: WORLD.spawn.x, y: heightAt(WORLD.spawn.x, WORLD.spawn.z), z: WORLD.spawn.z });
    renderer.render(state);
    assert.equal(renderer.stats.dungeonBuffers, 0);
    assert.equal(renderer.stats.activeScene, 'world');
    assert.ok(renderer.stats.residentChunks <= 64);
    assert.ok(renderer.stats.chunkBuildsThisFrame <= 2);
    assert.equal(fixture.buffers.size, renderer.stats.residentChunks + 5);
  }
  assert.equal(renderer.stats.sceneTransitions, DUNGEONS.length * 6);
  renderer.dispose();
  assert.equal(fixture.buffers.size, 0);
});

test('camera eye and near plane remain outside adjacent dungeon walls, closed doors and ceilings', () => {
  const fixture=canvasFixture(),renderer=new Renderer(fixture.canvas),dungeon=DUNGEONS[0];
  const state={frame:1,player:{...dungeon.entry,grounded:true},blocks:[],expedition:{active:{id:dungeon.id},progress:{[dungeon.id]:{killed:[],solved:[],opened:[],claimed:false}}}};
  renderer.syncScene(state);
  const geometry=dungeonGeometry(state),door=geometry.doors.find(d=>!d.open);
  const cases=[
    {x:8.9,y:0,z:0,yaw:-Math.PI/2,pitch:.35},
    {x:8.9,y:0,z:-8.9,yaw:-Math.PI/4,pitch:.35},
    {x:0,y:6.1,z:0,yaw:0,pitch:1.15},
    door.w<door.d?{x:door.x-door.w/2-.4,y:0,z:door.z,yaw:-Math.PI/2,pitch:.35}
      :{x:door.x,y:0,z:door.z-door.d/2-.4,yaw:Math.PI,pitch:.35},
  ];
  const solids=[...geometry.walls,...geometry.props,...geometry.doors.filter(d=>!d.open)];
  for(const at of cases){
    Object.assign(state.player,at);renderer.eyeInitialized=false;
    for(let frame=0;frame<12;frame++){
      state.frame++;renderer.time=frame*.09;
      renderer.updateCamera(state,{yaw:at.yaw,pitch:at.pitch,distance:8,shake:1},1/60);
      assert.ok([...renderer.eye,...renderer.viewProjection].every(Number.isFinite));
      assert.ok(Math.hypot(...renderer.eye.map((v,i)=>v-renderer.target[i]))>.05,`camera collapsed at ${JSON.stringify(at)}: ${renderer.eye}`);
      const points=[[...renderer.eye]],view=renderer.view,near=.12;
      // Actual four near-plane corners, using the view basis and projection.
      for(const u of [-1,1])for(const v of [-1,1])points.push([0,1,2].map(axis=>
        renderer.eye[axis]-view[axis*4+2]*near+view[axis*4]*u*near/renderer.projection[0]+view[axis*4+1]*v*near/renderer.projection[5]));
      for(const point of points)for(const b of solids)assert.equal(
        Math.abs(point[0]-b.x)<b.w/2&&Math.abs(point[2]-b.z)<b.d/2&&point[1]>b.y&&point[1]<b.y+b.h,
        false,`${JSON.stringify(at)} camera clips ${b.id} at ${point}`);
    }
  }
  renderer.dispose();assert.equal(fixture.buffers.size,0);
});
