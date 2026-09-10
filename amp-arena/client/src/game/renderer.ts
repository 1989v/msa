// Three.js 장면: 맵 · 캐릭터 리그 · 투사체 · 이펙트 · 추적 카메라.
import * as THREE from 'three';
import { type MapDef, type Projectile, lerpAngle, type AccessoryId } from '@amp/shared';
import { CharacterRig } from './rig.ts';

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

function platformTexture(): THREE.CanvasTexture {
  return makeTexture((ctx, s) => {
    ctx.fillStyle = '#a7b8c9'; ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = 'rgba(20,30,60,0.25)'; ctx.lineWidth = 2;
    for (let i = 0; i <= 8; i++) { const p = (i / 8) * s; ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, s); ctx.moveTo(0, p); ctx.lineTo(s, p); ctx.stroke(); }
  }, 256);
}

export class Renderer {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly gl: THREE.WebGLRenderer;
  readonly rigs = new Map<number, CharacterRig>();
  private projMeshes = new Map<number, THREE.Mesh>();
  private effects: Effect[] = [];
  private mapGroup = new THREE.Group();
  private texStar = starTexture('#ffffff', '#ff6a2a');
  private texStarBig = starTexture('#ffb020', '#ee4444');
  private texGuard = ringTexture('#33d1ff');
  private texDust = ringTexture('rgba(210,185,139,0.9)');
  private container: HTMLElement;
  private map: MapDef | null = null;
  camYaw = 0;
  private followYaw = 0;
  private manualYaw = 0;
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
    this.map = map;
    this.mapGroup.clear();
    const g = this.mapGroup;
    if (map.groundRadius > 0) {
      const ground = new THREE.Mesh(new THREE.CircleGeometry(map.groundRadius, 72), new THREE.MeshLambertMaterial({ map: groundTexture() }));
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = true;
      g.add(ground);
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
    const platTex = platformTexture();
    for (const b of map.boxes) {
      const w = b.maxX - b.minX, h = b.maxY - b.minY, d = b.maxZ - b.minZ;
      const topMat = new THREE.MeshLambertMaterial({ map: platTex });
      const sideMat = new THREE.MeshLambertMaterial({ color: map.groundRadius > 0 ? 0x9c9384 : 0x5a6a8a });
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [sideMat, sideMat, map.groundRadius > 0 ? new THREE.MeshLambertMaterial({ color: 0xc9bfae }) : topMat, sideMat, sideMat, sideMat]);
      m.position.set((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2, (b.minZ + b.maxZ) / 2);
      m.castShadow = true; m.receiveShadow = true;
      g.add(m);
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

  spawnHit(x: number, y: number, z: number, kind: 'hit' | 'launch' | 'guard' | 'ko'): void {
    const tex = kind === 'guard' ? this.texGuard : kind === 'hit' ? this.texStar : this.texStarBig;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    s.position.set(x, y, z);
    s.material.rotation = Math.random() * Math.PI;
    const size = kind === 'ko' ? 3.2 : kind === 'launch' ? 2.0 : kind === 'guard' ? 1.4 : 1.3;
    this.scene.add(s);
    this.effects.push({ obj: s, life: 0, max: kind === 'ko' ? 0.45 : 0.28, from: size * 0.35, to: size, rise: 0.6 });
  }

  spawnDust(x: number, y: number, z: number): void {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.texDust, transparent: true, depthWrite: false, opacity: 0.8 }));
    s.position.set(x, y + 0.15, z);
    this.scene.add(s);
    this.effects.push({ obj: s, life: 0, max: 0.35, from: 0.5, to: 1.6, rise: 0.2 });
  }

  updateEffects(dt: number): void {
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

  /** 추적 카메라: 이동 방향 뒤를 따라가고, Q/E·우클릭·오른스틱은 수동 오프셋 */
  updateCamera(tx: number, ty: number, tz: number, yaw: number, moving: boolean, turn: { keys: number; dragPx: number; stick: number }, dt: number, snap = false): void {
    const manual = turn.keys * 1.7 * dt + turn.stick * 2.2 * dt + turn.dragPx * 0.006;
    if (manual !== 0) this.manualYaw -= manual;
    if (moving) {
      const k = 1 - Math.exp(-2.6 * dt);
      this.followYaw = lerpAngle(this.followYaw, yaw, k);
      if (manual === 0) this.manualYaw *= Math.exp(-0.9 * dt);
    }
    this.camYaw = this.followYaw + this.manualYaw;
    const dist = 7.2, height = 5.2;
    const dx = -Math.sin(this.camYaw) * dist, dz = -Math.cos(this.camYaw) * dist;
    let px = tx + dx, pz = tz + dz, py = ty + height;
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
    this.camera.lookAt(tx, ty + 1.1, tz);
  }

  resetCamera(yaw: number): void {
    this.followYaw = yaw; this.manualYaw = 0; this.camYaw = yaw;
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
