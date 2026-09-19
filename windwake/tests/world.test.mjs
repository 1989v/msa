import test from 'node:test';
import assert from 'node:assert/strict';
import { WORLD, VILLAGE, BIOMES, WAYPOINTS, BOSS_SITES, RESOURCE_NODES, LANDMARKS,
  SOLIDS, TRAIL_ROUTES, heightAt, terrainColor, supportAt, getChunk, querySolids,
  spawnsNear, worldStats } from '../world.mjs';
import { Renderer, daylightAt } from '../render.mjs';

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
