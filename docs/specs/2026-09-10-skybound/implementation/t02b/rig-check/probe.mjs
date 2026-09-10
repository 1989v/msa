import * as THREE from '../../../../../../portal-fe/node_modules/three/build/three.module.js';
import { GLTFExporter } from '../../../../../../portal-fe/node_modules/three/examples/jsm/exporters/GLTFExporter.js';
import { GLTFLoader } from '../../../../../../portal-fe/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

// Binary export only: Node's native Blob plus the one FileReader method used here.
if (typeof globalThis.FileReader === 'undefined') {
  globalThis.FileReader = class {
    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then((result) => {
        this.result = result;
        this.onloadend?.();
      });
    }
  };
}

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

export async function exportFixture() {
  const fixture = createFixture();
  const buffer = await new GLTFExporter().parseAsync(fixture.scene, {
    binary: true, animations: [fixture.clip],
  });
  return { ...fixture, buffer };
}

export async function loadFixture(buffer) {
  return new GLTFLoader().parseAsync(buffer, '');
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

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { buffer } = await exportFixture();
  await writeFile(new URL('./diagnostic-rig.glb', import.meta.url), Buffer.from(buffer));
  console.log(`Exported diagnostic-rig.glb: ${buffer.byteLength} bytes; Three.js r${THREE.REVISION}`);
}
