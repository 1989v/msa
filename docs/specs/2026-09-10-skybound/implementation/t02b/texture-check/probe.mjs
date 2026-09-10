import * as THREE from '../../../../../../portal-fe/node_modules/three/build/three.module.js';
import { GLTFExporter } from '../../../../../../portal-fe/node_modules/three/examples/jsm/exporters/GLTFExporter.js';
import { GLTFLoader } from '../../../../../../portal-fe/node_modules/three/examples/jsm/loaders/GLTFLoader.js';

// The directly authored T02B-1 diagnostic rig, copied here to avoid Node shims.
export function createFixture() {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    -0.2, 0, 0, 0.2, 0, 0,
    -0.2, 1, 0, 0.2, 1, 0,
    -0.2, 2, 0, 0.2, 2, 0,
  ], 3));
  geometry.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4, 3, 5, 4]);
  geometry.computeVertexNormals();
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute([
    0, 1, 0, 0, 0, 1, 0, 0,
    0, 1, 0, 0, 0, 1, 0, 0,
    0, 1, 0, 0, 0, 1, 0, 0,
  ], 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute([
    1, 0, 0, 0, 1, 0, 0, 0,
    0.5, 0.5, 0, 0, 0.5, 0.5, 0, 0,
    0, 1, 0, 0, 0, 1, 0, 0,
  ], 4));
  const root = new THREE.Bone();
  root.name = 'ProbeRoot';
  const hinge = new THREE.Bone();
  hinge.name = 'ProbeHinge';
  hinge.position.y = 1;
  root.add(hinge);
  const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshStandardMaterial());
  mesh.name = 'DiagnosticStrip';
  mesh.add(root);
  mesh.bind(new THREE.Skeleton([root, hinge]));
  const scene = new THREE.Scene();
  scene.add(mesh);
  const turn = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
  const clip = new THREE.AnimationClip('HingeBend', 1, [
    new THREE.QuaternionKeyframeTrack('ProbeHinge.quaternion', [0, 1], [0, 0, 0, 1, ...turn.toArray()]),
  ]);
  return { scene, mesh, clip };
}

export function sampleVertices(scene, mesh, clip, time) {
  const mixer = new THREE.AnimationMixer(scene);
  mixer.clipAction(clip).setLoop(THREE.LoopOnce, 1).play();
  mixer.setTime(time);
  scene.updateMatrixWorld(true);
  mesh.skeleton.update();
  const points = Array.from({ length: mesh.geometry.attributes.position.count }, (_, i) =>
    mesh.getVertexPosition(i, new THREE.Vector3()).toArray());
  mixer.stopAllAction();
  mixer.uncacheRoot(scene);
  return points;
}

// These deliberately asymmetric diagnostic colors are image test data, not UI tokens.
const colors = [[192, 32, 48, 255], [32, 160, 64, 255], [48, 64, 208, 255], [224, 176, 32, 255]];
const checks = [];
function check(name, passed, details = {}) {
  checks.push({ name, passed, ...details });
  if (!passed) throw new Error(name);
}
function same(a, b, epsilon = 0) {
  return a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) <= epsilon);
}
function base64(bytes) {
  let result = '';
  for (let i = 0; i < bytes.length; i += 8192) result += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(result);
}
function pixels(image) {
  const canvas = document.createElement('canvas');
  canvas.width = image.width; canvas.height = image.height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(image, 0, 0);
  return context.getImageData(0, 0, canvas.width, canvas.height).data;
}
function makeAtlas() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1024;
  const context = canvas.getContext('2d');
  colors.forEach(([r, g, b], i) => {
    context.fillStyle = `rgb(${r},${g},${b})`;
    context.fillRect((i % 2) * 512, Math.floor(i / 2) * 512, 512, 512);
  });
  return canvas;
}
async function run() {
  const atlas = makeAtlas();
  const originalPixels = pixels(atlas);
  const { scene, mesh, clip } = createFixture();
  // glTF convention: V=0 is image top; exporter receives flipY=false explicitly.
  const uvs = [0, 1, 1, 1, 0, 0.5, 1, 0.5, 0, 0, 1, 0];
  mesh.geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  const texture = new THREE.CanvasTexture(atlas);
  texture.name = 'SelfAuthoredDiagnosticAtlas';
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false;
  mesh.material.map = texture;
  const buffer = await new GLTFExporter().parseAsync(scene, { binary: true, animations: [clip] });
  const view = new DataView(buffer);
  check('GLB v2 header and JSON/BIN chunks', view.getUint32(0, true) === 0x46546c67 &&
    view.getUint32(4, true) === 2 && view.getUint32(8, true) === buffer.byteLength &&
    view.getUint32(16, true) === 0x4e4f534a);
  const jsonLength = view.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, jsonLength)));
  const binHeader = 20 + jsonLength;
  check('Single embedded PNG; no external image/buffer URI',
    view.getUint32(binHeader + 4, true) === 0x004e4942 && json.images.length === 1 &&
    json.images[0].mimeType === 'image/png' && Number.isInteger(json.images[0].bufferView) &&
    json.images.every(image => !('uri' in image)) && json.buffers.every(buffer => !('uri' in buffer)));
  const imageView = json.bufferViews[json.images[0].bufferView];
  const png = new Uint8Array(buffer, binHeader + 8 + (imageView.byteOffset || 0), imageView.byteLength);
  const pngView = new DataView(png.buffer, png.byteOffset, png.byteLength);
  check('PNG signature and 1024×1024 IHDR', same([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]) &&
    pngView.getUint32(16) === 1024 && pngView.getUint32(20) === 1024, { pngBytes: png.length });
  const decoded = await createImageBitmap(new Blob([png], { type: 'image/png' }));
  check('Embedded PNG full pixel and orientation preservation', same(originalPixels, pixels(decoded)), { pixels: 1024 * 1024 });
  decoded.close();
  const requested = [];
  const manager = new THREE.LoadingManager();
  manager.setURLModifier(url => { requested.push(url); return url; });
  const loaded = await new GLTFLoader(manager).parseAsync(buffer, '');
  let restored;
  loaded.scene.traverse(object => { if (object.isSkinnedMesh) restored = object; });
  const map = restored?.material.map;
  check('Loader image requests remain embedded blob URLs', requested.length > 0 && requested.every(url => url.startsWith('blob:')), { requestCount: requested.length });
  check('Basecolor texture is sRGB with flipY=false', map?.colorSpace === THREE.SRGBColorSpace && map.flipY === false,
    { colorSpace: map?.colorSpace, flipY: map?.flipY });
  check('Loaded image remains 1K and every decoded RGBA pixel matches', map.image.width === 1024 && map.image.height === 1024 && same(originalPixels, pixels(map.image)));
  check('UV coordinates preserved', same([...restored.geometry.attributes.uv.array], uvs), { uvs });
  const loadedPixels = pixels(map.image);
  check('UV orientation: four interior samples address expected quadrants',
    [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]].every(([u, v], i) => {
      const uv = map.transformUv(new THREE.Vector2(u, v));
      const offset = (Math.floor(uv.y * 1024) * 1024 + Math.floor(uv.x * 1024)) * 4;
      return same([...loadedPixels.subarray(offset, offset + 4)], colors[i]);
    }));
  check('Two bones, skin indices and weights preserved', restored.skeleton.bones.length === 2 &&
    same([...restored.geometry.attributes.skinIndex.array], [...mesh.geometry.attributes.skinIndex.array]) &&
    same([...restored.geometry.attributes.skinWeight.array], [...mesh.geometry.attributes.skinWeight.array]));
  check('Animation clip/keyframes preserved', loaded.animations.length === 1 && loaded.animations[0].name === clip.name &&
    same([...loaded.animations[0].tracks[0].times], [...clip.tracks[0].times]) &&
    same([...loaded.animations[0].tracks[0].values], [...clip.tracks[0].values]));
  const before = sampleVertices(loaded.scene, restored, loaded.animations[0], 0);
  const after = sampleVertices(loaded.scene, restored, loaded.animations[0], 0.5);
  const expected = sampleVertices(scene, mesh, clip, 0.5);
  check('Textured rig animated deformation preserved', same(after.flat(), expected.flat(), 1e-6) &&
    !same(before[4], after[4], 0.1) && same(before[0], after[0], 1e-6));
  return { ready: true, passed: true, threeRevision: THREE.REVISION, browser: navigator.userAgent,
    checks, glbBytes: buffer.byteLength, glbBase64: base64(new Uint8Array(buffer)), pngBase64: base64(png) };
}

window.__SKYBOUND_TEXTURE_CHECK__ = { ready: false };
run().then(result => {
  window.__SKYBOUND_TEXTURE_CHECK__ = result;
  const { glbBase64, pngBase64, ...summary } = result;
  document.querySelector('#result').textContent = JSON.stringify(summary, null, 2);
}).catch(error => {
  window.__SKYBOUND_TEXTURE_CHECK__ = { ready: true, passed: false, checks, error: error.stack || String(error) };
  document.querySelector('#result').textContent = JSON.stringify(window.__SKYBOUND_TEXTURE_CHECK__, null, 2);
});
