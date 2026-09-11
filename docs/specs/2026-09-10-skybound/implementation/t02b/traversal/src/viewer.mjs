import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createWorld } from '../../../t01b/src/world.mjs';
import { createTerrain } from '../../../t02a/src/terrain.mjs';
import { createSimulation, MOVEMENT } from '../../../t02a/src/simulation.mjs';
import { createAnimationBridge } from './animation.mjs';
import '../style.css';

const state = window.__SKYBOUND_TRAVERSAL__ = { ready: false, error: null, paused: true, snapshot: null, animation: 'idle', characterPosition: null, terrainHeight: null, frames: 0 };
const canvas = document.querySelector('#viewer'), status = document.querySelector('#status');
const start = document.querySelector('#start'), reset = document.querySelector('#reset');
async function main() {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.12;
  const scene = new THREE.Scene(), world = createWorld(THREE);
  scene.add(world.root); scene.background = world.col('sky'); scene.fog = new THREE.FogExp2(world.col('horizon'), .003);
  scene.add(new THREE.HemisphereLight(world.col('cloud'), world.col('chalkShade'), 1.5));
  const sun = new THREE.DirectionalLight(world.col('cloud'), 3.3);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18, near: 1, far: 180 });
  sun.shadow.normalBias = .025;
  scene.add(sun, sun.target);
  const waterHeight = -18;
  const water = new THREE.Mesh(new THREE.PlaneGeometry(1800, 1800), new THREE.MeshStandardMaterial({ color: world.col('sea'), roughness: .7 }));
  water.rotation.x = -Math.PI / 2; water.position.y = waterHeight; scene.add(water);
  // Only the original main meadow and path belong to this collision adapter.
  const surfaces = [world.root.getObjectByName('continuous meadow'), world.root.children.find(object => object.name.startsWith('walkable-looking'))];
  if (surfaces.some(mesh => !mesh?.geometry?.index)) throw new Error('Expected main meadow and indexed path');
  world.root.updateMatrixWorld(true);
  const terrain = createTerrain(surfaces.map(mesh => {
    const positions = [];
    for (let i = 0; i < mesh.geometry.attributes.position.count; i++) positions.push(...new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position, i).applyMatrix4(mesh.matrixWorld).toArray());
    return { positions, indices: mesh.geometry.index.array };
  }));
  const loaded = await new GLTFLoader().loadAsync(new URL('../character/assets/naru-lod0.glb', location.href).href);
  const character = loaded.scene;
  character.traverse(object => { if (object.isMesh) { object.castShadow = true; object.receiveShadow = true; } });
  scene.add(character);
  const clips = Object.fromEntries(loaded.animations.map(clip => [clip.name, clip]));
  const names = ['idle', 'walk', 'run', 'jump', 'fall', 'land'];
  if (names.some(name => !clips[name])) throw new Error('Saved Naru GLB needs idle/walk/run/jump/fall/land clips');
  const durations = Object.fromEntries(names.map(name => [name, clips[name].duration]));
  const mixer = new THREE.AnimationMixer(character);
  const camera = new THREE.PerspectiveCamera(48, 1, .1, 1800);
  const keys = new Set();
  let simulation, bridge, request = null, lastTime = null, jumpPending = false;
  function result() {
    return { snapshot: state.snapshot, animation: state.animation, animationTime: state.animationTime,
      characterPosition: state.characterPosition, characterYaw: state.characterYaw, terrainHeight: state.terrainHeight,
      paused: state.paused, frames: state.frames };
  }
  function draw() {
    scene.updateMatrixWorld(true);
    renderer.render(scene, camera); state.frames++;
    state.characterPosition = { x: character.position.x, y: character.position.y, z: character.position.z };
    state.characterYaw = character.rotation.y;
    state.terrainHeight = terrain.heightAt(character.position.x, character.position.z);
    state.drawCalls = renderer.info.render.calls;
    status.textContent = `${state.paused ? '일시정지' : '이동 중'} · ${state.animation} · 기력 ${Math.round(state.snapshot.stamina)}`;
  }
  function publish(snapshot, elapsed) {
    const motion = bridge.update(snapshot, elapsed);
    state.snapshot = snapshot; state.animation = motion.name; state.animationTime = motion.time;
    character.position.set(snapshot.position.x, snapshot.position.y, snapshot.position.z);
    if (motion.respawned) character.rotation.y = Math.PI;
    if (Math.hypot(snapshot.velocity.x, snapshot.velocity.z) > .01) character.rotation.y = Math.atan2(snapshot.velocity.x, snapshot.velocity.z);
    if (motion.changed) {
      mixer.stopAllAction();
      const action = mixer.clipAction(clips[motion.name]).reset().setLoop(motion.once ? THREE.LoopOnce : THREE.LoopRepeat, motion.once ? 1 : Infinity);
      action.clampWhenFinished = motion.once; action.play();
    }
    mixer.setTime(motion.time);
    const p = character.position;
    camera.position.set(p.x, p.y + 2.6, p.z + 5.2);
    camera.lookAt(p.x, p.y + 1.05, p.z);
    sun.position.set(p.x - 35, p.y + 65, p.z + 35); sun.target.position.copy(p);
    draw(); return result();
  }
  function advance(dt, input) {
    const snapshot = simulation.advance(dt, input);
    return publish(snapshot, snapshot.steps * MOVEMENT.step);
  }
  function pause() {
    state.paused = true;
    if (request !== null) cancelAnimationFrame(request);
    request = null; lastTime = null; keys.clear(); jumpPending = false;
    simulation?.clearInput(); start.textContent = '시작';
    if (state.snapshot) draw();
    return result();
  }
  function frame(time) {
    request = null;
    if (state.paused) return;
    try {
      const dt = lastTime === null ? 0 : (time - lastTime) / 1000; lastTime = time;
      advance(dt, { x: Number(keys.has('KeyD')) - Number(keys.has('KeyA')), z: Number(keys.has('KeyS')) - Number(keys.has('KeyW')),
        yaw: 0, sprint: keys.has('ShiftLeft') || keys.has('ShiftRight'), jumpPressed: jumpPending });
      jumpPending = false;
      request = requestAnimationFrame(frame);
    } catch (error) { pause(); state.error = error.stack || String(error); status.textContent = `이동을 멈췄습니다: ${error.message}`; }
  }
  function resume() {
    if (!state.paused) return result();
    if (state.error || document.hidden) return result();
    state.paused = false; lastTime = null; start.textContent = '일시정지';
    canvas.focus(); request = requestAnimationFrame(frame); return result();
  }
  function resetForTest() {
    pause(); mixer.stopAllAction();
    simulation = createSimulation({ terrain, checkpoint: { x: 0, z: 35 }, waterHeight });
    bridge = createAnimationBridge(durations); character.rotation.y = Math.PI;
    return publish(simulation.snapshot(), 0);
  }
  function advanceForTest(dt, input = {}) {
    if (!state.paused) throw new Error('Pause traversal before deterministic stepping');
    return advance(dt, input);
  }
  start.addEventListener('click', () => state.paused ? resume() : pause());
  reset.addEventListener('click', resetForTest);
  addEventListener('keydown', event => {
    if (state.paused || event.target !== canvas) return;
    if (!['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight', 'Space'].includes(event.code)) return;
    event.preventDefault(); keys.add(event.code);
    if (event.code === 'Space' && !event.repeat) jumpPending = true;
  });
  addEventListener('keyup', event => keys.delete(event.code));
  addEventListener('blur', pause);
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); pause(); state.error = 'WebGL context lost'; status.textContent = '그래픽 연결이 끊겼습니다. 새로고침해 주세요.'; });
  function resize() {
    const rect = canvas.getBoundingClientRect(); renderer.setSize(rect.width, rect.height, false);
    camera.aspect = rect.width / rect.height; camera.updateProjectionMatrix();
    if (state.snapshot) draw();
  }
  resetForTest(); resize(); new ResizeObserver(resize).observe(canvas);
  Object.assign(state, { ready: true, loadedFromGLB: true, clips: Object.keys(clips), worldStats: world.stats, advanceForTest, resetForTest, pause, resume });
  start.disabled = false; reset.disabled = false;
}
main().catch(error => { state.error = error.stack || String(error); state.ready = true; status.textContent = `화면을 열지 못했습니다: ${error.message}`; console.error(error); });
