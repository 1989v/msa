import * as THREE from 'three';
import '../style.css';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createCharacter } from './model.mjs';
import { createAtlas } from './atlas.mjs';
import { createLocomotionClips } from './motion.mjs';

const state = window.__SKYBOUND_CHARACTER__ = {
  ready: false, error: null, stats: [], lod: 0, view: 'threequarter', frame: 0,
  glbBase64: [], atlasBase64: null, loadedFromGLB: false, pose: false,
  animated: false, motion: 'idle', motionTime: 0, rotating: false, renderedBounds: null, threeRevision: THREE.REVISION,
};
const $ = selector => document.querySelector(selector);
function base64(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let result = '';
  for (let i = 0; i < bytes.length; i += 8192) result += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(result);
}
// CSS canvas converts the shared OKLCH tokens to sRGB before Three receives them.
function tokenColor(token) {
  const ctx = document.createElement('canvas').getContext('2d');
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return new THREE.Color().setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace);
}
function inspect(scene) {
  let triangles = 0, vertices = 0, meshes = 0, bones = 0;
  const materials = new Set();
  scene.traverse(object => {
    if (!object.isMesh) return;
    meshes++;
    vertices += object.geometry.attributes.position.count;
    triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3;
    bones = Math.max(bones, object.skeleton?.bones.length ?? 0);
    for (const material of [].concat(object.material)) materials.add(material.uuid);
  });
  return { triangles, vertices, meshes, bones, materials: materials.size };
}
async function main() {
  const atlas = createAtlas();
  state.atlasBase64 = atlas.toDataURL('image/png').split(',')[1];
  const texture = new THREE.CanvasTexture(atlas);
  texture.name = 'NaruSelfAuthoredAtlas';
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false;
  const loadedModels = [];
  for (let lod = 0; lod < 2; lod++) {
    const authored = createCharacter(THREE, { lod, texture });
    authored.root.updateMatrixWorld(true);
    const buffer = await new GLTFExporter().parseAsync(authored.root, {
      binary: true, animations: [...(authored.clips ?? []), ...createLocomotionClips(THREE)], onlyVisible: true,
    });
    state.glbBase64[lod] = base64(buffer);
    const loaded = await new GLTFLoader().parseAsync(buffer, '');
    loaded.scene.traverse(object => {
      if (object.isMesh) { object.castShadow = true; object.receiveShadow = true; }
    });
    loadedModels.push(loaded);
    state.stats[lod] = {
      ...authored.stats, ...inspect(loaded.scene), lod, glbBytes: buffer.byteLength,
      clips: loaded.animations.map(clip => clip.name), atlas: [atlas.width, atlas.height],
    };
  }
  const canvas = $('#viewer');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  const scene = new THREE.Scene();
  scene.background = tokenColor('--ko-surface-1');
  const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 40);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = false;
  controls.enablePan = false;
  controls.minDistance = 2.2;
  controls.maxDistance = 7;
  controls.minPolarAngle = 0.3;
  controls.maxPolarAngle = Math.PI * 0.49;
  const white = tokenColor('--ko-surface-0');
  scene.add(new THREE.HemisphereLight(white, tokenColor('--ko-surface-3'), 2));
  const key = new THREE.DirectionalLight(white, 3.1);
  key.position.set(-3, 5, 4); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -2; key.shadow.camera.right = 2;
  key.shadow.camera.top = 3; key.shadow.camera.bottom = -2;
  key.shadow.normalBias = 0.014; key.shadow.bias = -0.0001; key.shadow.radius = 4;
  scene.add(key);
  const fill = new THREE.DirectionalLight(white, 1.4);
  fill.position.set(3, 2, -3); scene.add(fill);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200),
    new THREE.MeshStandardMaterial({ color: tokenColor('--ko-surface-1'), roughness: 1 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -0.015; floor.receiveShadow = true;
  scene.add(floor);
  let model = null, mixer = null, activeClip = null, poseClip = null, scheduled = false;
  let lastTime = performance.now();
  const restBounds = new THREE.Box3().setFromObject(loadedModels[0].scene);
  const center = restBounds.getCenter(new THREE.Vector3());
  const size = restBounds.getSize(new THREE.Vector3());
  state.modelBounds = { min: restBounds.min.toArray(), max: restBounds.max.toArray(), size: size.toArray() };
  function updateBounds() {
    const box = new THREE.Box3().setFromObject(model, true);
    const points = [];
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
      points.push(new THREE.Vector3(x, y, z).project(camera));
    }
    const bounds = canvas.getBoundingClientRect();
    const xs = points.map(p => (p.x + 1) * bounds.width / 2);
    const ys = points.map(p => (1 - p.y) * bounds.height / 2);
    state.renderedBounds = {
      left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys),
      canvasWidth: bounds.width, canvasHeight: bounds.height,
    };
  }
  function draw(now = performance.now()) {
    scheduled = false;
    const delta = Math.min((now - lastTime) / 1000, 0.05); lastTime = now;
    if (state.animated) {
      mixer?.update(delta);
      state.motionTime = mixer.time % activeClip.duration;
    }
    if (state.rotating) {
      const offset = camera.position.clone().sub(controls.target);
      offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), delta * 0.3);
      camera.position.copy(controls.target).add(offset); controls.update();
    }
    scene.updateMatrixWorld(true);
    model?.traverse(object => { if (object.isSkinnedMesh) object.skeleton.update(); });
    renderer.render(scene, camera);
    state.frame++;
    state.render = { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, dpr: renderer.getPixelRatio() };
    if (model) updateBounds();
    if (state.animated || state.rotating) requestDraw();
  }
  function requestDraw() { if (!scheduled) { scheduled = true; requestAnimationFrame(draw); } }
  function setView(view = 'threequarter') {
    const vectors = { front: [0, 0.11, 1], back: [0, 0.11, -1], side: [1, 0.11, 0], threequarter: [0.58, 0.16, 1], detail: [0.58, 0.10, 1] };
    if (!vectors[view]) throw new Error(`Unknown view: ${view}`);
    state.view = view;
    const vfov = THREE.MathUtils.degToRad(camera.fov);
    const detail = view === 'detail';
    // Naru's authored face/upper torso occupies Y=1.25–1.70m. Leave a
    // little headroom and fit shoulder width on portrait canvases too.
    const frameHeight = detail ? 0.55 : size.y;
    const frameWidth = detail ? 0.62 : size.x;
    const distance = Math.max(frameHeight / (2 * Math.tan(vfov / 2)), frameWidth / (2 * Math.tan(vfov / 2) * camera.aspect)) * 1.24;
    controls.minDistance = detail ? 0.55 : 2.2;
    controls.target.copy(detail ? new THREE.Vector3(0, 1.475, 0.01) : center);
    camera.position.copy(controls.target).add(new THREE.Vector3(...vectors[view]).normalize().multiplyScalar(distance));
    controls.update();
    document.querySelectorAll('[data-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === view)));
    requestDraw();
  }
  function setPose(enabled) {
    state.pose = Boolean(enabled && poseClip);
    state.animated = false;
    mixer?.stopAllAction();
    const clip = state.pose ? poseClip : null;
    if (clip) {
      mixer.clipAction(clip).play();
      mixer.setTime(state.pose ? clip.duration * 0.5 : 0);
    }
    $('#pose').setAttribute('aria-pressed', String(state.pose));
    $('#animate').setAttribute('aria-pressed', 'false');
    $('#animate').textContent = '동작 재생';
    state.motionTime = 0;
    requestDraw();
  }
  function setMotion(name, { play = false, time = 0 } = {}) {
    if (!['idle', 'walk', 'run'].includes(name)) throw new Error(`Unknown motion: ${name}`);
    if (!Number.isFinite(time) || time < 0) throw new Error('Motion time must be a nonnegative number');
    activeClip = loadedModels[state.lod].animations.find(clip => clip.name === name);
    if (!activeClip) throw new Error(`Missing loaded GLB motion: ${name}`);
    mixer.stopAllAction();
    mixer.clipAction(activeClip).reset().play();
    mixer.setTime(time);
    state.motion = name; state.motionTime = time % activeClip.duration;
    state.pose = false; state.animated = play;
    $('#motion').value = name;
    $('#pose').setAttribute('aria-pressed', 'false');
    $('#animate').setAttribute('aria-pressed', String(play));
    $('#animate').textContent = play ? '동작 정지' : '동작 재생';
    lastTime = performance.now(); requestDraw();
  }
  function getMotionSnapshot() {
    model.updateMatrixWorld(true);
    let mesh;
    model.traverse(object => { if (object.isSkinnedMesh) mesh = object; });
    mesh.skeleton.update();
    const joints = Object.fromEntries(mesh.skeleton.bones.map(bone => [bone.name, {
      position: bone.getWorldPosition(new THREE.Vector3()).toArray(), quaternion: bone.quaternion.toArray(),
    }]));
    const soles = ['L', 'R'].map(side => {
      const part = state.stats[state.lod].parts.find(part => part.name === `boot-sole-${side}`);
      const box = new THREE.Box3();
      for (let i = part.start; i < part.start + part.count; i++) box.expandByPoint(mesh.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld));
      return { min: box.min.toArray(), max: box.max.toArray() };
    });
    return { motion: state.motion, time: state.motionTime, duration: activeClip?.duration, joints, soles, rootPosition: model.position.toArray() };
  }
  function setLOD(lod) {
    lod = Number(lod);
    if (![0, 1].includes(lod)) throw new Error(`Unknown LOD: ${lod}`);
    if (model) { mixer?.stopAllAction(); mixer?.uncacheRoot(model); scene.remove(model); }
    state.lod = lod;
    model = loadedModels[lod].scene;
    scene.add(model);
    mixer = new THREE.AnimationMixer(model);
    activeClip = loadedModels[lod].animations.find(clip => clip.name === state.motion) ?? null;
    poseClip = loadedModels[lod].animations.find(clip => clip.name === 'rig-inspection') ?? activeClip;
    $('#pose').disabled = !poseClip; $('#animate').disabled = !activeClip;
    $('#lod').value = String(lod);
    const stats = state.stats[lod];
    $('#metrics').textContent = `${stats.triangles.toLocaleString()} triangles · ${stats.bones} bones · GLB 재로딩`;
    setPose(false);
    requestDraw();
  }
  function resize() {
    const { width, height } = canvas.getBoundingClientRect();
    renderer.setSize(width, height, false);
    camera.aspect = width / height; camera.updateProjectionMatrix();
    setView(state.view === 'custom' ? 'threequarter' : state.view);
  }
  document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => setView(button.dataset.view)));
  $('#lod').addEventListener('change', event => setLOD(event.target.value));
  $('#pose').addEventListener('click', () => setPose(!state.pose));
  $('#motion').addEventListener('change', event => setMotion(event.target.value, { play: state.animated }));
  $('#animate').addEventListener('click', () => {
    if (state.animated) setPose(false);
    else setMotion(state.motion, { play: true });
  });
  $('#rotate').addEventListener('click', () => {
    state.rotating = !state.rotating;
    $('#rotate').setAttribute('aria-pressed', String(state.rotating));
    lastTime = performance.now(); requestDraw();
  });
  $('#reset').addEventListener('click', () => {
    state.rotating = false; $('#rotate').setAttribute('aria-pressed', 'false');
    state.motion = 'idle'; $('#motion').value = 'idle';
    activeClip = loadedModels[state.lod].animations.find(clip => clip.name === 'idle');
    setPose(false); setView('threequarter');
  });
  controls.addEventListener('change', requestDraw);
  controls.addEventListener('start', () => {
    state.view = 'custom';
    document.querySelectorAll('[data-view]').forEach(button => button.setAttribute('aria-pressed', 'false'));
  });
  new ResizeObserver(resize).observe(canvas.parentElement);
  setLOD(0); resize(); draw();
  Object.assign(state, { ready: true, loadedFromGLB: true, setLOD, setView, setPose, setMotion, getMotionSnapshot, renderNow: draw });
  $('#status').dataset.ready = 'true';
}
main().catch(error => {
  state.error = error.stack || String(error);
  state.ready = true;
  $('#status').textContent = `캐릭터를 읽지 못했습니다. 다시 빌드한 뒤 새로고침해 주세요. ${error.message}`;
  console.error(error);
});
