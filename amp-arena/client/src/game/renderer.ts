// Three.js 장면: 맵 · 캐릭터 리그 · 투사체 · 이펙트 · 추적 카메라.
import * as THREE from 'three';
import { type MapDef, type Projectile, type Item, type AccessoryId } from '@amp/shared';
import { CharacterRig } from './rig.ts';

function heartTexture(): THREE.CanvasTexture {
  return makeTexture((ctx, s) => {
    ctx.translate(s / 2, s / 2);
    ctx.beginPath();
    ctx.moveTo(0, s * 0.32);
    ctx.bezierCurveTo(-s * 0.5, -s * 0.05, -s * 0.25, -s * 0.42, 0, -s * 0.18);
    ctx.bezierCurveTo(s * 0.25, -s * 0.42, s * 0.5, -s * 0.05, 0, s * 0.32);
    ctx.closePath();
    ctx.fillStyle = '#ee4444'; ctx.fill();
    ctx.lineWidth = s * 0.05; ctx.strokeStyle = '#1a1f3a'; ctx.stroke();
    ctx.beginPath(); ctx.arc(-s * 0.14, -s * 0.16, s * 0.05, 0, Math.PI * 2); ctx.fillStyle = '#ffffff'; ctx.fill();
  });
}

function crateTexture(): THREE.CanvasTexture {
  return makeTexture((ctx, s) => {
    ctx.fillStyle = '#7a4f22'; ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = '#b07a3c';
    for (let i = 0; i < 4; i++) ctx.fillRect(0, i * (s / 4) + 3, s, s / 4 - 6);
    ctx.strokeStyle = '#3d2711'; ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, s - 6, s - 6);
    ctx.beginPath(); ctx.moveTo(6, 6); ctx.lineTo(s - 6, s - 6); ctx.moveTo(s - 6, 6); ctx.lineTo(6, s - 6); ctx.stroke();
  });
}

interface Effect { obj: THREE.Sprite; life: number; max: number; from: number; to: number; rise: number }

function makeTexture(draw: (ctx: CanvasRenderingContext2D, s: number) => void, size = 128): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  draw(ctx, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function starTexture(fill: string, stroke: string): THREE.CanvasTexture {
  return makeTexture((ctx, s) => {
    const cx = s / 2, cy = s / 2;
    ctx.beginPath();
    for (let i = 0; i < 16; i++) {
      const a = (i * Math.PI) / 8 - Math.PI / 2;
      const r = i % 2 ? s * 0.2 : s * 0.48;
      ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
    ctx.lineWidth = s * 0.05; ctx.strokeStyle = stroke; ctx.stroke();
  });
}

function ringTexture(color: string): THREE.CanvasTexture {
  return makeTexture((ctx, s) => {
    ctx.beginPath(); ctx.arc(s / 2, s / 2, s * 0.4, 0, Math.PI * 2);
    ctx.lineWidth = s * 0.12; ctx.strokeStyle = color; ctx.stroke();
  });
}

function groundTexture(): THREE.CanvasTexture {
  return makeTexture((ctx, s) => {
    ctx.fillStyle = '#d2b98b'; ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = 'rgba(60,40,20,0.22)'; ctx.lineWidth = 3;
    const c = s / 2;
    for (const r of [5, 10, 15]) { ctx.beginPath(); ctx.arc(c, c, (r / 20) * c, 0, Math.PI * 2); ctx.stroke(); }
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(60,40,20,0.16)';
    for (let a = 0; a < Math.PI; a += Math.PI / 8) { ctx.beginPath(); ctx.moveTo(c + Math.cos(a) * c, c + Math.sin(a) * c); ctx.lineTo(c - Math.cos(a) * c, c - Math.sin(a) * c); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(255,106,42,0.7)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(c, c, (2 / 20) * c, 0, Math.PI * 2); ctx.stroke();
    // 잔모래 점
    ctx.fillStyle = 'rgba(90,60,30,0.10)';
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 900; i++) ctx.fillRect(rnd() * s, rnd() * s, 2, 2);
  }, 1024);
}

function iceTexture(): THREE.CanvasTexture {
  return makeTexture((ctx, s) => {
    const grad = ctx.createRadialGradient(s / 2, s / 2, s * 0.1, s / 2, s / 2, s * 0.5);
    grad.addColorStop(0, '#dff2ff'); grad.addColorStop(1, '#a9d4ea');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, s, s);
    let seed = 5;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 2;
    for (let i = 0; i < 26; i++) {
      let x = rnd() * s, y = rnd() * s;
      ctx.beginPath(); ctx.moveTo(x, y);
      for (let k = 0; k < 5; k++) { x += (rnd() - 0.5) * s * 0.18; y += (rnd() - 0.5) * s * 0.18; ctx.lineTo(x, y); }
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(60,110,150,0.25)'; ctx.lineWidth = 3;
    const c = s / 2;
    for (const r of [5, 10, 15]) { ctx.beginPath(); ctx.arc(c, c, (r / 18) * c, 0, Math.PI * 2); ctx.stroke(); }
  }, 1024);
}

function concreteTexture(): THREE.CanvasTexture {
  return makeTexture((ctx, s) => {
    ctx.fillStyle = '#6f7484'; ctx.fillRect(0, 0, s, s);
    let seed = 3;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    for (let i = 0; i < 1400; i++) ctx.fillRect(rnd() * s, rnd() * s, 3, 3);
    ctx.strokeStyle = 'rgba(20,24,40,0.35)'; ctx.lineWidth = 3;
    for (let i = 0; i <= 6; i++) { const p = (i / 6) * s; ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, s); ctx.moveTo(0, p); ctx.lineTo(s, p); ctx.stroke(); }
    // 헬리패드 H
    ctx.strokeStyle = 'rgba(255,214,110,0.8)'; ctx.lineWidth = 10;
    ctx.beginPath(); ctx.arc(s / 2, s / 2, s * 0.17, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 14; ctx.beginPath();
    ctx.moveTo(s * 0.44, s * 0.4); ctx.lineTo(s * 0.44, s * 0.6); ctx.moveTo(s * 0.56, s * 0.4); ctx.lineTo(s * 0.56, s * 0.6); ctx.moveTo(s * 0.44, s * 0.5); ctx.lineTo(s * 0.56, s * 0.5);
    ctx.stroke();
  }, 1024);
}

function windowsTexture(): THREE.CanvasTexture {
  return makeTexture((ctx, s) => {
    ctx.fillStyle = '#1a2242'; ctx.fillRect(0, 0, s, s);
    let seed = 17;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let y = 6; y < s; y += 14) for (let x = 6; x < s; x += 12) {
      ctx.fillStyle = rnd() < 0.35 ? 'rgba(255,214,110,0.9)' : 'rgba(40,52,96,0.9)';
      ctx.fillRect(x, y, 7, 9);
    }
  }, 256);
}

function platformTexture(): THREE.CanvasTexture {
  return makeTexture((ctx, s) => {
    ctx.fillStyle = '#a7b8c9'; ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = 'rgba(20,30,60,0.25)'; ctx.lineWidth = 2;
    for (let i = 0; i <= 8; i++) { const p = (i / 8) * s; ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, s); ctx.moveTo(0, p); ctx.lineTo(s, p); ctx.stroke(); }
  }, 256);
}

// 카메라: 캐릭터 뒤 5.6m · 위 7m (피치 약 49°, 2차 소감으로 조금 더 가깝게) — 내 주변을 내려다보는 시야. 시선은 앞 1.4m 지점.
const CAM_DIST = 5.6, CAM_HEIGHT = 7.0, CAM_LOOK_AHEAD = 1.1;

export class Renderer {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly gl: THREE.WebGLRenderer;
  readonly rigs = new Map<number, CharacterRig>();
  private projMeshes = new Map<number, THREE.Mesh>();
  private itemMeshes = new Map<number, { obj: THREE.Object3D; kind: string; light?: THREE.Mesh }>();
  private texHeart: THREE.CanvasTexture | null = null;
  private crateMat: THREE.MeshLambertMaterial | null = null;
  private pads: { mesh: THREE.Mesh; baseY: number; kick: number }[] = [];
  private roomParts: { mesh: THREE.Mesh; mats: THREE.MeshLambertMaterial[]; room: number }[] = [];
  private roomAlpha: number[] = [];
  private effects: Effect[] = [];
  private mapGroup = new THREE.Group();
  private texStar = starTexture('#ffffff', '#ff6a2a');
  private texStarBig = starTexture('#ffb020', '#ee4444');
  private texGuard = ringTexture('#33d1ff');
  private texDust = ringTexture('rgba(210,185,139,0.9)');
  private container: HTMLElement;
  private map: MapDef | null = null;
  camYaw = 0;
  private camPos = new THREE.Vector3(0, 6, -10);
  private tmp = new THREE.Vector3();

  constructor(container: HTMLElement) {
    this.container = container;
    this.gl = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.gl.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.gl.shadowMap.enabled = true;
    this.gl.shadowMap.type = THREE.PCFSoftShadowMap;
    this.gl.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.gl.domElement);
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 220);
    this.scene.background = new THREE.Color(0x0f1631);
    this.scene.fog = new THREE.Fog(0x0f1631, 45, 110);
    const hemi = new THREE.HemisphereLight(0x9fb4ff, 0x5a4630, 0.95);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff2d0, 1.7);
    sun.position.set(14, 26, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -26; sun.shadow.camera.right = 26; sun.shadow.camera.top = 26; sun.shadow.camera.bottom = -26;
    sun.shadow.camera.near = 1; sun.shadow.camera.far = 80;
    sun.shadow.bias = -0.0008;
    this.scene.add(sun);
    this.scene.add(this.mapGroup);
    window.addEventListener('resize', this.resize);
    this.resize();
  }

  private resize = (): void => {
    const w = this.container.clientWidth || window.innerWidth, h = this.container.clientHeight || window.innerHeight;
    this.gl.setSize(w, h, false);
    this.gl.domElement.style.width = '100%';
    this.gl.domElement.style.height = '100%';
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };

  buildMap(map: MapDef): void {
    this.pads = [];
    this.roomParts = [];
    this.roomAlpha = map.rooms.map(() => 1);
    this.map = map;
    this.mapGroup.clear();
    const g = this.mapGroup;
    const theme = map.theme;
    // 하늘·안개는 테마별
    const sky = theme === 'ice' ? 0x223a66 : theme === 'rooftop' ? 0x0b1026 : 0x0f1631;
    this.scene.background = new THREE.Color(sky);
    this.scene.fog = new THREE.Fog(sky, theme === 'ice' ? 30 : 45, theme === 'ice' ? 90 : 110);

    if (map.groundRadius > 0) {
      const tex = theme === 'ice' ? iceTexture() : groundTexture();
      const ground = new THREE.Mesh(new THREE.CircleGeometry(map.groundRadius, 72), new THREE.MeshLambertMaterial({ map: tex }));
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = true;
      g.add(ground);
      if (theme === 'ice') {
        // 물: 얼음판 밖은 어두운 호수, 가장자리에 얇은 얼음 테두리
        const water = new THREE.Mesh(new THREE.CircleGeometry(90, 64), new THREE.MeshLambertMaterial({ color: 0x14305a }));
        water.rotation.x = -Math.PI / 2; water.position.y = -1.4;
        g.add(water);
        const rim = new THREE.Mesh(new THREE.CylinderGeometry(map.groundRadius + 0.1, map.groundRadius - 0.3, 1.4, 72, 1, true), new THREE.MeshLambertMaterial({ color: 0xa9d4ea, side: THREE.DoubleSide }));
        rim.position.y = -0.7;
        g.add(rim);
        for (let i = 0; i < 24; i++) {
          const a = (i / 24) * Math.PI * 2, r = 30 + (i % 3) * 12;
          const pine = new THREE.Mesh(new THREE.ConeGeometry(1.4 + (i % 2), 5 + (i % 4), 6), new THREE.MeshLambertMaterial({ color: 0x1e3d4a }));
          pine.position.set(Math.cos(a) * r, 1.2, Math.sin(a) * r);
          g.add(pine);
        }
      }
    } else if (theme === 'rooftop') {
      // 도시: 아래는 어둠, 멀리 건물 실루엣
      const abyss = new THREE.Mesh(new THREE.CircleGeometry(120, 48), new THREE.MeshBasicMaterial({ color: 0x070a18 }));
      abyss.rotation.x = -Math.PI / 2; abyss.position.y = -22;
      g.add(abyss);
      const winTex = windowsTexture();
      let seed = 11;
      const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      for (let i = 0; i < 26; i++) {
        const a = rnd() * Math.PI * 2, r = 42 + rnd() * 50;
        const w = 8 + rnd() * 10, h = 12 + rnd() * 30, d = 8 + rnd() * 10;
        const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ map: winTex, color: 0x9aa4c8 }));
        b.position.set(Math.cos(a) * r, h / 2 - 22, Math.sin(a) * r);
        b.rotation.y = rnd() * Math.PI;
        g.add(b);
      }
    } else {
      // 발판 맵: 아래에 어두운 바닥판으로 깊이감
      const abyss = new THREE.Mesh(new THREE.CircleGeometry(80, 48), new THREE.MeshBasicMaterial({ color: 0x0a0e20 }));
      abyss.rotation.x = -Math.PI / 2; abyss.position.y = -14;
      g.add(abyss);
      for (let i = 0; i < 3; i++) {
        const ring = new THREE.Mesh(new THREE.RingGeometry(20 + i * 12, 20.4 + i * 12, 64), new THREE.MeshBasicMaterial({ color: 0x1f2b66, side: THREE.DoubleSide }));
        ring.rotation.x = -Math.PI / 2; ring.position.y = -13.9;
        g.add(ring);
      }
    }
    if (map.wallRadius > 0) {
      const wall = new THREE.Mesh(new THREE.CylinderGeometry(map.wallRadius + 0.15, map.wallRadius + 0.15, map.wallHeight, 72, 1, true), new THREE.MeshLambertMaterial({ color: 0x8f8778, side: THREE.DoubleSide }));
      wall.position.y = map.wallHeight / 2;
      wall.receiveShadow = true;
      g.add(wall);
      const band = new THREE.Mesh(new THREE.TorusGeometry(map.wallRadius + 0.15, 0.08, 6, 72), new THREE.MeshLambertMaterial({ color: 0xa89f8f }));
      band.rotation.x = Math.PI / 2; band.position.y = map.wallHeight * 0.8;
      g.add(band);
      const crenMat = new THREE.MeshLambertMaterial({ color: 0xa29a8a });
      for (let i = 0; i < 40; i++) {
        const a = (i / 40) * Math.PI * 2;
        const c = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.7, 0.5), crenMat);
        c.position.set(Math.cos(a) * (map.wallRadius + 0.15), map.wallHeight + 0.35, Math.sin(a) * (map.wallRadius + 0.15));
        c.rotation.y = -a + Math.PI / 2;
        g.add(c);
      }
      const stands = new THREE.Mesh(new THREE.CylinderGeometry(map.wallRadius + 4.5, map.wallRadius + 0.6, 5, 72, 1, true), new THREE.MeshLambertMaterial({ color: 0x2b2f52, side: THREE.DoubleSide }));
      stands.position.y = map.wallHeight + 2.5;
      g.add(stands);
      for (const [r, y] of [[map.wallRadius + 1.6, map.wallHeight + 1.6], [map.wallRadius + 3.0, map.wallHeight + 3.4]]) {
        const row = new THREE.Mesh(new THREE.TorusGeometry(r, 0.06, 6, 72), new THREE.MeshBasicMaterial({ color: 0x3a3f6b }));
        row.rotation.x = Math.PI / 2; row.position.y = y;
        g.add(row);
      }
    }
    if (theme === 'ice') {
      // 바위: 눈 덮인 다면체
      for (const c of map.cylinders) {
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(c.r * 1.15, 0), new THREE.MeshLambertMaterial({ color: 0x6b7280, flatShading: true }));
        rock.position.set(c.x, c.h * 0.45, c.z); rock.scale.set(1, c.h / (c.r * 1.15) * 0.55, 1); rock.castShadow = true; rock.receiveShadow = true;
        g.add(rock);
        const snow = new THREE.Mesh(new THREE.SphereGeometry(c.r * 0.95, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.45), new THREE.MeshLambertMaterial({ color: 0xeef5ff }));
        snow.position.set(c.x, c.h - 0.15, c.z);
        g.add(snow);
      }
    } else {
      const pillarMat = new THREE.MeshLambertMaterial({ color: 0xb3aa9c }), capMat = new THREE.MeshLambertMaterial({ color: 0xcfc6b6 });
      for (const c of map.cylinders) {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(c.r, c.r, c.h, 20), pillarMat);
        m.position.set(c.x, c.h / 2, c.z); m.castShadow = true; m.receiveShadow = true;
        g.add(m);
        for (const y of [0.25, c.h - 0.25]) {
          const cap = new THREE.Mesh(new THREE.CylinderGeometry(c.r * 1.3, c.r * 1.3, 0.5, 20), capMat);
          cap.position.set(c.x, y, c.z); cap.castShadow = true;
          g.add(cap);
        }
      }
    }
    // 점프대: 노란 원판 + 테두리 링 (시뮬의 pads 와 같은 자리·반지름)
    for (const pad of map.pads) {
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(pad.r, pad.r * 1.08, 0.14, 24), new THREE.MeshLambertMaterial({ color: 0xffb020 }));
      disc.position.set(pad.x, pad.y + 0.07, pad.z);
      disc.castShadow = true; disc.receiveShadow = true;
      g.add(disc);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(pad.r * 0.72, 0.05, 8, 28), new THREE.MeshBasicMaterial({ color: 0x1a1f3a }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(pad.x, pad.y + 0.15, pad.z);
      g.add(ring);
      const arrow = new THREE.Mesh(new THREE.ConeGeometry(pad.r * 0.28, pad.r * 0.5, 3), new THREE.MeshBasicMaterial({ color: 0x1a1f3a }));
      arrow.rotation.x = -Math.PI / 2; arrow.rotation.z = Math.PI;
      arrow.position.set(pad.x, pad.y + 0.15, pad.z);
      g.add(arrow);
      this.pads.push({ mesh: disc, baseY: pad.y + 0.07, kick: 0 });
    }
    const platTex = theme === 'rooftop' ? concreteTexture() : platformTexture();
    for (const b of map.boxes) {
      const w = b.maxX - b.minX, h = b.maxY - b.minY, d = b.maxZ - b.minZ;
      const big = w * d > 100;
      const topMat = new THREE.MeshLambertMaterial({ map: platTex });
      const sideColor = theme === 'rooftop' ? (big ? 0x4a4f63 : 0x8a919f) : map.groundRadius > 0 ? 0x9c9384 : 0x5a6a8a;
      const sideMat = new THREE.MeshLambertMaterial({ color: sideColor });
      const top = theme === 'rooftop' ? (big ? topMat : new THREE.MeshLambertMaterial({ color: 0xa4abb8 })) : map.groundRadius > 0 ? new THREE.MeshLambertMaterial({ color: 0xc9bfae }) : topMat;
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [sideMat, sideMat, top, sideMat, sideMat, sideMat]);
      m.position.set((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2, (b.minZ + b.maxZ) / 2);
      m.castShadow = true; m.receiveShadow = true;
      g.add(m);
      if (b.room !== undefined) {
        // 방의 벽·지붕: 내 캐릭터가 안에 있으면 비쳐서 위에서도 보인다
        const mats = [sideMat, top as THREE.MeshLambertMaterial].filter((x, i, arr) => arr.indexOf(x) === i);
        for (const mat of mats) mat.transparent = true;
        this.roomParts.push({ mesh: m, mats, room: b.room });
      }
      if (theme === 'rooftop' && big) {
        // 지붕 가장자리 표시선 (시뮬에는 없음 — 낙사 경계를 눈으로 알리는 용도)
        const edge = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 0.12, d + 0.3), new THREE.MeshLambertMaterial({ color: 0xffb020 }));
        edge.position.set((b.minX + b.maxX) / 2, b.maxY + 0.02, (b.minZ + b.maxZ) / 2);
        const inner = new THREE.Mesh(new THREE.BoxGeometry(w - 0.5, 0.16, d - 0.5), new THREE.MeshLambertMaterial({ color: 0x5b6070 }));
        inner.position.copy(edge.position); inner.position.y += 0.01;
        g.add(edge); g.add(inner);
      }
    }
  }

  ensureRig(id: number, color: string, acc: AccessoryId): CharacterRig {
    let r = this.rigs.get(id);
    if (!r) {
      r = new CharacterRig(color);
      this.rigs.set(id, r);
      this.scene.add(r.root);
    }
    r.setAccessory(acc);
    return r;
  }

  removeRig(id: number): void {
    const r = this.rigs.get(id);
    if (r) { this.scene.remove(r.root); this.rigs.delete(id); }
  }

  updateProjectiles(list: Projectile[]): void {
    const seen = new Set<number>();
    for (const p of list) {
      seen.add(p.id);
      let m = this.projMeshes.get(p.id);
      if (!m) {
        const rocket = p.move === 'rocketPunch';
        m = new THREE.Mesh(new THREE.SphereGeometry(rocket ? 0.28 : 0.12, 10, 8), new THREE.MeshBasicMaterial({ color: rocket ? 0xee4444 : 0xfff3a0 }));
        const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.texStar, color: rocket ? 0xff6a2a : 0xffffff, transparent: true, opacity: 0.8, depthWrite: false }));
        glow.scale.setScalar(rocket ? 1.1 : 0.5);
        m.add(glow);
        this.projMeshes.set(p.id, m);
        this.scene.add(m);
      }
      m.position.set(p.x, p.y, p.z);
    }
    for (const [id, m] of this.projMeshes) if (!seen.has(id)) { this.scene.remove(m); this.projMeshes.delete(id); }
  }

  updateItems(items: Item[], holders: Map<number, { x: number; y: number; z: number }>, now: number): void {
    const seen = new Set<number>();
    for (const it of items) {
      seen.add(it.id);
      let m = this.itemMeshes.get(it.id);
      if (!m) {
        let obj: THREE.Object3D;
        let light: THREE.Mesh | undefined;
        if (it.kind === 'crate') {
          if (!this.crateMat) this.crateMat = new THREE.MeshLambertMaterial({ map: crateTexture() });
          const g = new THREE.Group();
          const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), this.crateMat);
          box.castShadow = true; box.receiveShadow = true;
          g.add(box);
          const outline = new THREE.Mesh(new THREE.BoxGeometry(1.04, 1.04, 1.04), new THREE.MeshBasicMaterial({ color: 0x1a1f3a, side: THREE.BackSide }));
          g.add(outline);
          obj = g;
        } else if (it.kind === 'heart') {
          if (!this.texHeart) this.texHeart = heartTexture();
          const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.texHeart, transparent: true }));
          s.scale.setScalar(0.9);
          obj = s;
        } else {
          const g = new THREE.Group();
          const body = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 10), new THREE.MeshLambertMaterial({ color: 0x222633 }));
          body.castShadow = true;
          g.add(body);
          const outline = new THREE.Mesh(new THREE.SphereGeometry(0.34, 14, 10), new THREE.MeshBasicMaterial({ color: 0x1a1f3a, side: THREE.BackSide }));
          g.add(outline);
          const fuse = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.25, 6), new THREE.MeshBasicMaterial({ color: 0xd9dde8 }));
          fuse.position.set(0.1, 0.4, 0); fuse.rotation.z = -0.4;
          g.add(fuse);
          light = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffb020 }));
          light.position.set(0.16, 0.52, 0);
          g.add(light);
          obj = g;
        }
        this.scene.add(obj);
        m = { obj, kind: it.kind, light };
        this.itemMeshes.set(it.id, m);
      }
      const h = it.heldBy >= 0 ? holders.get(it.heldBy) : null;
      if (h) {
        m.obj.position.set(h.x, h.y + (it.kind === 'crate' ? 2.35 : 2.2), h.z);
      } else {
        const bob = it.kind === 'heart' ? Math.sin(now / 250) * 0.08 + 0.6 : it.kind === 'crate' ? 0.5 : 0.32;
        m.obj.position.set(it.x, it.y + bob, it.z);
      }
      if (it.kind === 'crate') m.obj.rotation.y = it.airborne ? now / 200 : 0;
      if (m.light) { const on = it.fuse >= 0 && Math.floor(now / (it.fuse < 60 ? 60 : 160)) % 2 === 0; (m.light.material as THREE.MeshBasicMaterial).color.set(on ? 0xff3b3b : 0xffb020); m.light.scale.setScalar(on ? 1.6 : 1); }
    }
    for (const [id, m] of this.itemMeshes) if (!seen.has(id)) { this.scene.remove(m.obj); this.itemMeshes.delete(id); }
  }

  spawnHit(x: number, y: number, z: number, kind: 'hit' | 'launch' | 'guard' | 'ko' | 'blast'): void {
    const tex = kind === 'guard' ? this.texGuard : kind === 'hit' ? this.texStar : this.texStarBig;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    s.position.set(x, y, z);
    s.material.rotation = Math.random() * Math.PI;
    const size = kind === 'blast' ? 7.5 : kind === 'ko' ? 3.2 : kind === 'launch' ? 2.0 : kind === 'guard' ? 1.4 : 1.3; // blast ≈ 폭탄 반지름 3.2 의 지름
    this.scene.add(s);
    this.effects.push({ obj: s, life: 0, max: kind === 'blast' ? 0.6 : kind === 'ko' ? 0.45 : 0.28, from: size * 0.35, to: size, rise: kind === 'blast' ? 1.2 : 0.6 });
  }

  spawnDust(x: number, y: number, z: number): void {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.texDust, transparent: true, depthWrite: false, opacity: 0.8 }));
    s.position.set(x, y + 0.15, z);
    this.scene.add(s);
    this.effects.push({ obj: s, life: 0, max: 0.35, from: 0.5, to: 1.6, rise: 0.2 });
  }

  /** 내 캐릭터 위치 — 방 안이면 그 방의 벽·지붕을 비친다 (밖에서는 불투명) */
  setViewer(x: number, y: number, z: number, dt: number): void {
    const map = this.map;
    if (!map || !this.roomParts.length) return;
    map.rooms.forEach((r, i) => {
      const inside = x > r.minX - 0.6 && x < r.maxX + 0.6 && z > r.minZ - 0.6 && z < r.maxZ + 0.6 && y < r.floor + r.height - 0.2;
      const target = inside ? 0.22 : 1;
      this.roomAlpha[i] += (target - this.roomAlpha[i]) * Math.min(1, dt * 8);
    });
    for (const p of this.roomParts) {
      const a = this.roomAlpha[p.room] ?? 1;
      for (const mat of p.mats) mat.opacity = a;
      p.mesh.castShadow = a > 0.9;
    }
  }

  /** 점프대가 눌렸다 — 원판이 잠깐 내려앉았다 올라온다 */
  kickPad(x: number, z: number): void {
    for (const p of this.pads) if (Math.hypot(p.mesh.position.x - x, p.mesh.position.z - z) < 0.5) p.kick = 1;
  }

  updateEffects(dt: number): void {
    for (const p of this.pads) {
      if (p.kick <= 0) continue;
      p.kick = Math.max(0, p.kick - dt * 4);
      p.mesh.position.y = p.baseY - 0.1 * Math.sin(p.kick * Math.PI);
    }
    const keep: Effect[] = [];
    for (const e of this.effects) {
      e.life += dt;
      const k = e.life / e.max;
      if (k >= 1) { this.scene.remove(e.obj); e.obj.material.dispose(); continue; }
      const ease = 1 - (1 - k) * (1 - k);
      e.obj.scale.setScalar(e.from + (e.to - e.from) * ease);
      e.obj.position.y += e.rise * dt;
      (e.obj.material as THREE.SpriteMaterial).opacity = 1 - k * k;
      keep.push(e);
    }
    this.effects = keep;
  }

  /** 내려다보는 추적 카메라. 요는 고정 — Q/E·우클릭 드래그·오른스틱으로만 돈다. 캐릭터가 도는 방향을 따라가지 않는다(따라가면 어지럽다). */
  updateCamera(tx: number, ty: number, tz: number, turn: { keys: number; dragPx: number; stick: number }, dt: number, snap = false): void {
    const manual = turn.keys * 1.7 * dt + turn.stick * 2.2 * dt + turn.dragPx * 0.006;
    if (manual !== 0) this.camYaw -= manual;
    const fx = Math.sin(this.camYaw), fz = Math.cos(this.camYaw); // 카메라가 보는 앞 방향
    let px = tx - fx * CAM_DIST, pz = tz - fz * CAM_DIST, py = ty + CAM_HEIGHT;
    const map = this.map;
    if (map && map.wallRadius > 0) {
      const r = Math.hypot(px, pz), max = map.wallRadius - 0.6;
      if (r > max) { px *= max / r; pz *= max / r; }
    }
    if (map && map.groundRadius > 0 && py < 1.2) py = 1.2;
    const k = snap ? 1 : 1 - Math.exp(-9 * dt);
    this.camPos.x += (px - this.camPos.x) * k;
    this.camPos.y += (py - this.camPos.y) * k;
    this.camPos.z += (pz - this.camPos.z) * k;
    this.camera.position.copy(this.camPos);
    // 내 캐릭터를 화면 중앙보다 조금 아래에 두어 앞쪽(카메라 기준 위쪽)이 더 보이게 한다
    this.camera.lookAt(tx + fx * CAM_LOOK_AHEAD, ty + 0.6, tz + fz * CAM_LOOK_AHEAD);
  }

  resetCamera(yaw: number): void {
    this.camYaw = yaw;
  }

  /** 월드 좌표 → 화면 px */
  project(x: number, y: number, z: number): { x: number; y: number; visible: boolean } {
    this.tmp.set(x, y, z).project(this.camera);
    const w = this.container.clientWidth, h = this.container.clientHeight;
    return { x: (this.tmp.x + 1) / 2 * w, y: (1 - this.tmp.y) / 2 * h, visible: this.tmp.z < 1 && this.tmp.z > -1 };
  }

  render(): void { this.gl.render(this.scene, this.camera); }

  dispose(): void {
    window.removeEventListener('resize', this.resize);
    this.gl.dispose();
    this.gl.domElement.remove();
  }
}
