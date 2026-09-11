// 포즈 갤러리 (개발용, /poses.html): 타격 포즈를 악세서리별로 한 줄에 세워 놓고 게임 카메라 각도·옆에서 찍어 본다.
// 수치만 보고는 「팔이 쭉 뻗었는가」를 알 수 없어서 — 스크린샷으로 확인한다. ?view=game|side|front
import * as THREE from 'three';
import type { AccessoryId, MoveId } from '@amp/shared';
import { CharacterRig, SLOT_COLORS } from './game/rig.ts';
import { POSES, MOVE_POSES } from './game/poses.ts';

const items: { acc: AccessoryId; move: MoveId; label: string }[] = [
  { acc: 'none', move: 'jab', label: '잽' }, { acc: 'none', move: 'straight', label: '스트레이트' }, { acc: 'none', move: 'roundhouse', label: '돌려차기' },
  { acc: 'none', move: 'uppercut', label: '어퍼컷' }, { acc: 'none', move: 'grab', label: '잡기' }, { acc: 'none', move: 'hook', label: '훅' },
  { acc: 'none', move: 'kick2', label: '하이킥' }, { acc: 'none', move: 'flyingKick', label: '날아차기' },
  { acc: 'greatsword', move: 'gs1', label: '대검 내려베기' }, { acc: 'greatsword', move: 'gs2', label: '대검 가로베기' },
  { acc: 'spear', move: 'sp1', label: '창 찌르기' }, { acc: 'pistols', move: 'gunShot', label: '사격' },
  { acc: 'shield', move: 'shieldBash', label: '방패 밀치기' }, { acc: 'rocket', move: 'rk2', label: '로켓 스트레이트' },
];

const view = new URLSearchParams(location.search).get('view') ?? 'game';
const gl = new THREE.WebGLRenderer({ antialias: true });
gl.setSize(1400, 520);
gl.setPixelRatio(1);
gl.outputColorSpace = THREE.SRGBColorSpace;
document.body.style.margin = '0';
document.body.style.background = '#c8b48a';
document.body.appendChild(gl.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#d9c8a0');
scene.add(new THREE.AmbientLight(0xffffff, 1.4));
const sun = new THREE.DirectionalLight(0xffffff, 1.6);
sun.position.set(3, 8, 4);
scene.add(sun);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 10), new THREE.MeshLambertMaterial({ color: 0xc9b483 }));
ground.rotation.x = -Math.PI / 2;
scene.add(ground);
const grid = new THREE.GridHelper(40, 40, 0x8a7a55, 0xb5a27a);
grid.position.y = 0.005;
scene.add(grid);

const gap = 1.35;
items.forEach((it, i) => {
  const rig = new CharacterRig(SLOT_COLORS[i % 8]);
  rig.setAccessory(it.acc);
  const [, strike] = MOVE_POSES[it.move];
  rig.setPose(POSES[strike], 1);
  rig.root.position.set((i - (items.length - 1) / 2) * gap, 0, 0);
  rig.root.rotation.y = view === 'side' ? Math.PI / 2 : view === 'front' ? Math.PI : 0; // 기본: 게임처럼 +Z(앞)를 향한다
  scene.add(rig.root);
  // 발밑 앞 방향 화살 — 어느 쪽이 「앞」인지
  const arrow = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), rig.root.rotation.y), rig.root.position.clone().setY(0.02), 1.1, 0xee4444, 0.25, 0.14);
  scene.add(arrow);
  const label = document.createElement('div');
  label.textContent = it.label;
  label.style.cssText = `position:absolute;top:8px;left:${Math.round(((i + 0.5) / items.length) * 1400) - 40}px;width:80px;text-align:center;font:700 12px sans-serif;color:#1a1f3a`;
  document.body.appendChild(label);
});

const camera = new THREE.PerspectiveCamera(34, 1400 / 520, 0.1, 100);
if (view === 'game') camera.position.set(0, 8.2 * 2.2, -6.6 * 2.2); // 게임 카메라와 같은 각도(피치 약 49°), 뒤에서
else if (view === 'front') camera.position.set(0, 8.2 * 2.2, 6.6 * 2.2);
else camera.position.set(0, 3.2, 16);
camera.lookAt(0, 0.7, 0);
gl.render(scene, camera);
(window as unknown as { __posesReady: boolean }).__posesReady = true;
