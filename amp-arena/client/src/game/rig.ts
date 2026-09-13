// 프리미티브 13본 치비 리그 — 시안 캐릭터 시트의 비율을 3D 로 옮긴다. 외곽선은 뒤집은 껍질(inverted hull).
import * as THREE from 'three';
import type { AccessoryId, StyleLook, HairKind } from '@amp/shared';
import { type Pose, POSES } from './poses.ts';
import { EMBLEM_PALETTE } from '../platform/progress.ts';
import { EMBLEM_SIZE } from '@amp/shared';

export const SLOT_COLORS = ['#ff6a2a', '#4488ff', '#4ade80', '#ffb020', '#a78bfa', '#33d1ff', '#f472b6', '#f5f2ea'];
const SKIN = 0xf6cfa6, OUTLINE = 0x1a1f3a, PANTS = 0x2f3a6e, SHOE = 0xf5f2ea, HAIR = 0x2b2f4a, BAND = 0xffb020;
const STEEL = 0xd9dde8, WOOD = 0xb07a3c, RED = 0xee4444, BLUE = 0x4488ff, AMP = 0xffb020;

const deg = (d: number) => (d * Math.PI) / 180;
const outlineMat = new THREE.MeshBasicMaterial({ color: OUTLINE, side: THREE.BackSide });

function lambert(color: number | string): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ color });
}

/** 메시 + 외곽선 껍질 */
function part(geo: THREE.BufferGeometry, mat: THREE.Material, outline = 1.08): THREE.Group {
  const g = new THREE.Group();
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  g.add(m);
  const o = new THREE.Mesh(geo, outlineMat);
  o.scale.setScalar(outline);
  g.add(o);
  return g;
}

/** 아래로 뻗은 팔·다리 마디: 회전축은 위쪽 끝 */
function limb(len: number, r: number, mat: THREE.Material): THREE.Group {
  const geo = new THREE.CapsuleGeometry(r, Math.max(0.01, len - r * 2), 4, 8);
  geo.translate(0, -len / 2, 0);
  return part(geo, mat, 1 + 0.35 * (0.06 / r) * 0.5);
}

export class CharacterRig {
  readonly root = new THREE.Group();
  private body = new THREE.Group();
  private torsoPivot = new THREE.Group();
  private headPivot = new THREE.Group();
  private rShoulder = new THREE.Group(); private rElbow = new THREE.Group(); private rHand = new THREE.Group();
  private lShoulder = new THREE.Group(); private lElbow = new THREE.Group(); private lHand = new THREE.Group();
  private rHip = new THREE.Group(); private rKnee = new THREE.Group();
  private lHip = new THREE.Group(); private lKnee = new THREE.Group();
  private shirtMat: THREE.MeshLambertMaterial;
  private mats: THREE.MeshLambertMaterial[] = [];
  private pose: Pose = { ...POSES.idle };
  private accGroup = new THREE.Group();
  private shieldGroup = new THREE.Group();
  private shadowBlob: THREE.Mesh;
  private hairGroup = new THREE.Group();
  private bandMat = lambert(BAND);
  private headG!: THREE.Group;
  private lookKey = '';
  private emblem = '';
  private emblemGroup: THREE.Group | null = null;
  private emblemCanvas: HTMLCanvasElement | null = null;
  private emblemTex: THREE.CanvasTexture | null = null;
  acc: AccessoryId = 'none';

  constructor(shirtColor: string) {
    this.shirtMat = lambert(shirtColor);
    const skinMat = lambert(SKIN), pantsMat = lambert(PANTS), shoeMat = lambert(SHOE);
    this.mats.push(this.shirtMat, skinMat, pantsMat, shoeMat);

    // 뿌리: 발바닥. body 는 들어올림·눕힘·회전을 받는다
    this.root.add(this.body);
    // 다리 (엉덩이 높이 0.36 = 허벅지 0.2 + 정강이 0.16)
    const hipY = 0.38;
    for (const [hip, knee, sx] of [[this.rHip, this.rKnee, 0.09], [this.lHip, this.lKnee, -0.09]] as const) {
      hip.position.set(sx, hipY, 0);
      hip.add(limb(0.2, 0.075, pantsMat));
      knee.position.set(0, -0.2, 0);
      knee.add(limb(0.16, 0.065, skinMat));
      const footGeo = new THREE.BoxGeometry(0.16, 0.09, 0.26);
      footGeo.translate(0, -0.16 - 0.045, 0.05);
      knee.add(part(footGeo, shoeMat, 1.06));
      hip.add(knee);
      this.body.add(hip);
    }
    // 몸통 (엉덩이 위 0.42)
    this.torsoPivot.position.set(0, hipY, 0);
    const torsoGeo = new THREE.BoxGeometry(0.44, 0.42, 0.28, 1, 1, 1);
    torsoGeo.translate(0, 0.21, 0);
    this.torsoPivot.add(part(torsoGeo, this.shirtMat, 1.06));
    this.body.add(this.torsoPivot);
    // 팔 (어깨 = 몸통 위 0.38)
    for (const [sh, el, hand, sx] of [[this.rShoulder, this.rElbow, this.rHand, 0.27], [this.lShoulder, this.lElbow, this.lHand, -0.27]] as const) {
      sh.position.set(sx, 0.38, 0);
      sh.add(limb(0.2, 0.06, skinMat));
      el.position.set(0, -0.2, 0);
      el.add(limb(0.17, 0.055, skinMat));
      hand.position.set(0, -0.17, 0);
      hand.add(part(new THREE.SphereGeometry(0.085, 10, 8), skinMat, 1.1));
      el.add(hand);
      sh.add(el);
      this.torsoPivot.add(sh);
    }
    // 머리 (몸통 위 0.42 + 반지름 0.33 - 겹침)
    this.headPivot.position.set(0, 0.42, 0);
    const headG = new THREE.Group();
    headG.position.set(0, 0.28, 0);
    headG.add(part(new THREE.SphereGeometry(0.33, 18, 14), skinMat, 1.05));
    // 눈
    const eyeMat = new THREE.MeshBasicMaterial({ color: OUTLINE });
    for (const sx of [-0.11, 0.11]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), eyeMat);
      e.position.set(sx, 0.02, 0.29);
      headG.add(e);
      const hl = new THREE.Mesh(new THREE.SphereGeometry(0.016, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      hl.position.set(sx + 0.018, 0.04, 0.33);
      headG.add(hl);
    }
    // 머리띠
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.325, 0.035, 8, 24), this.bandMat);
    band.rotation.x = Math.PI / 2;
    band.position.y = 0.12;
    headG.add(band);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.22), this.bandMat);
    tail.position.set(-0.08, 0.1, -0.38);
    tail.rotation.y = 0.5;
    headG.add(tail);
    // 뒤로 뻗친 머리 3가닥
    // 머리 모양은 스타일이 정한다 (setLook). 기본은 뒤로 뻗친 3가닥.
    headG.add(this.hairGroup);
    this.headG = headG;
    this.buildHair('spiky', '#2b2f4a');
    this.headPivot.add(headG);
    this.torsoPivot.add(this.headPivot);
    // 악세서리 부착점: 오른손
    this.rHand.add(this.accGroup);
    this.lElbow.add(this.shieldGroup);
    // 그림자 원판 (그림자 맵과 별개로 항상 보이는 발밑 점)
    this.shadowBlob = new THREE.Mesh(new THREE.CircleGeometry(0.42, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }));
    this.shadowBlob.rotation.x = -Math.PI / 2;
    this.shadowBlob.position.y = 0.01;
    this.root.add(this.shadowBlob);
    this.setPose(POSES.idle, 1);
  }

  setShirt(color: string): void { this.shirtMat.color.set(color); }
  setBand(color: string): void { this.bandMat.color.set(color); }

  /** 지금 그려지는(보간된) 포즈 — 디버그·E2E 가 「팔이 뻗었는가」를 수치로 읽는다 */
  get currentPose(): Readonly<Pose> { return this.pose; }

  /** 가슴 엠블럼 — 12×12 격자(0=투명·1~9=팔레트). 토르소 앞뒤 평면에 그린다(위에서 비스듬히 보는 카메라라 뒷면이 잘 보인다). */
  setEmblem(grid: string): void {
    if (grid === this.emblem) return;
    this.emblem = grid;
    const has = /[1-9]/.test(grid);
    if (!has) { if (this.emblemGroup) this.emblemGroup.visible = false; return; }
    if (!this.emblemGroup) {
      const cv = document.createElement('canvas'); cv.width = cv.height = EMBLEM_SIZE;
      const tex = new THREE.CanvasTexture(cv); tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.5 });
      const g = new THREE.Group();
      // 앞(+z)·뒤(−z) 두 평면. 토르소 앞면 z ≈ 0.14, 외곽선 껍질(×1.06) 표면 ≈ 0.148 — 그 바깥 0.155 에 둬야 가려지지 않는다. 중심 y ≈ 0.21
      for (const [z, ry] of [[0.155, 0], [-0.155, Math.PI]] as const) {
        const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.4), mat);
        pl.position.set(0, 0.21, z); pl.rotation.y = ry;
        g.add(pl);
      }
      this.torsoPivot.add(g);
      this.emblemGroup = g; this.emblemCanvas = cv; this.emblemTex = tex;
    }
    const ctx = this.emblemCanvas!.getContext('2d')!;
    ctx.clearRect(0, 0, EMBLEM_SIZE, EMBLEM_SIZE);
    for (let i = 0; i < grid.length; i++) {
      const v = grid.charCodeAt(i) - 48;
      if (v <= 0) continue;
      ctx.fillStyle = EMBLEM_PALETTE[v - 1] ?? '#000';
      ctx.fillRect(i % EMBLEM_SIZE, Math.floor(i / EMBLEM_SIZE), 1, 1);
    }
    this.emblemTex!.needsUpdate = true;
    this.emblemGroup.visible = true;
  }

  /** 스타일 외형: 머리 모양·색, 몸통·머리 크기 */
  setLook(look: StyleLook): void {
    const key = `${look.hair}:${look.hairColor}:${look.torso}:${look.head}`;
    if (key === this.lookKey) return;
    this.lookKey = key;
    this.buildHair(look.hair, look.hairColor);
    this.torsoPivot.scale.set(look.torso, 1, look.torso);
    // 몸통을 키우면 어깨·머리 위치는 몸통 좌표계라 같이 커진다 — 머리는 자기 배율로 되돌려 별도 값을 준다
    this.headG.scale.setScalar(look.head / look.torso);
    for (const sh of [this.rShoulder, this.lShoulder]) sh.scale.setScalar(1 / look.torso);
  }

  private buildHair(kind: HairKind, color: string): void {
    this.hairGroup.clear();
    const mat = lambert(color);
    const add = (geo: THREE.BufferGeometry, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, outline = 1.1) => {
      const m = part(geo, mat, outline);
      m.position.set(x, y, z);
      m.rotation.set(rx, ry, rz);
      this.hairGroup.add(m);
      return m;
    };
    switch (kind) {
      case 'spiky':
        // 뒤로 뻗친 3가닥 — 밑동을 머리 표면에 두고 뒤·위로 (추적 카메라가 뒤에서 보므로 실루엣의 핵심)
        for (const [ry, dy, len] of [[0.5, 0.0, 0.34], [0, 0.08, 0.42], [-0.5, 0.0, 0.34]] as const) {
          const geo = new THREE.ConeGeometry(0.09, len, 6);
          geo.translate(0, len / 2, 0);
          add(geo, Math.sin(ry) * 0.2, 0.16 + dy, -0.26, -1.25, ry * 0.6, 0, 1.12);
        }
        break;
      case 'buzz':
        // 짧게 민 머리: 윗면을 덮는 반구
        add(new THREE.SphereGeometry(0.345, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.42), 0, 0, 0, 0, 0, 0, 1.03);
        break;
      case 'pony': {
        for (const [ry, dy, len] of [[0.4, 0.0, 0.26], [-0.4, 0.0, 0.26]] as const) {
          const geo = new THREE.ConeGeometry(0.08, len, 6);
          geo.translate(0, len / 2, 0);
          add(geo, Math.sin(ry) * 0.18, 0.18 + dy, -0.24, -1.1, ry * 0.6, 0, 1.12);
        }
        add(new THREE.SphereGeometry(0.34, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.4), 0, 0.01, 0, 0, 0, 0, 1.03);
        const tail = new THREE.CylinderGeometry(0.05, 0.11, 0.62, 8);
        tail.translate(0, -0.31, 0);
        add(tail, 0, 0.12, -0.3, 0.55, 0, 0, 1.1);
        const knot = new THREE.TorusGeometry(0.1, 0.035, 6, 12);
        add(knot, 0, 0.12, -0.3, 0.55, 0, 0, 1.1);
        break;
      }
      case 'flat': {
        // 납작한 헬멧형 — 위를 덮는 낮은 반구 + 앞챙
        add(new THREE.SphereGeometry(0.36, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.36), 0, 0.02, 0, 0, 0, 0, 1.03);
        const brim = new THREE.BoxGeometry(0.34, 0.04, 0.18);
        add(brim, 0, 0.13, 0.32, -0.15, 0, 0, 1.08);
        break;
      }
      case 'mohawk': {
        for (let i = 0; i < 5; i++) {
          const fin = new THREE.BoxGeometry(0.07, 0.2 + (i === 2 ? 0.08 : 0), 0.13);
          fin.translate(0, 0.1, 0);
          add(fin, 0, 0.24 - Math.abs(i - 2) * 0.03, 0.2 - i * 0.11, -(i - 2) * 0.2, 0, 0, 1.1);
        }
        break;
      }
    }
  }

  setAccessory(acc: AccessoryId): void {
    if (acc === this.acc && this.accGroup.children.length) return;
    this.acc = acc;
    this.accGroup.clear();
    this.shieldGroup.clear();
    switch (acc) {
      // 무기는 전완 축(손 아래 -Y)을 따라 붙는다 — 팔을 앞으로 뻗으면 무기가 같은 선으로 쭉 나간다 (팔에 직각으로 붙이면 뻗을 때 위를 향한다)
      case 'greatsword': {
        const blade = new THREE.BoxGeometry(0.1, 0.95, 0.035); blade.translate(0, -0.62, 0);
        this.accGroup.add(part(blade, lambert(STEEL), 1.08));
        const guard = new THREE.BoxGeometry(0.3, 0.05, 0.07); guard.translate(0, -0.13, 0);
        this.accGroup.add(part(guard, lambert(AMP), 1.1));
        const grip = new THREE.CylinderGeometry(0.03, 0.03, 0.2, 8); grip.translate(0, -0.02, 0);
        this.accGroup.add(part(grip, lambert(0x7a4f22), 1.15));
        break;
      }
      case 'spear': {
        const shaft = new THREE.CylinderGeometry(0.025, 0.025, 1.9, 8); shaft.translate(0, -0.55, 0);
        this.accGroup.add(part(shaft, lambert(WOOD), 1.2));
        const tip = new THREE.ConeGeometry(0.065, 0.32, 8); tip.rotateX(Math.PI); tip.translate(0, -1.62, 0);
        this.accGroup.add(part(tip, lambert(STEEL), 1.1));
        break;
      }
      case 'pistols': {
        const gun = () => { const body = new THREE.BoxGeometry(0.07, 0.3, 0.09); body.translate(0, -0.14, 0.02); return part(body, lambert(0x3b4260), 1.1); };
        this.accGroup.add(gun());
        const left = new THREE.Group();
        left.add(gun());
        left.position.set(0, -0.17, 0);
        this.shieldGroup.add(left);
        break;
      }
      case 'shield': {
        const shield = new THREE.BoxGeometry(0.4, 0.5, 0.06); shield.translate(-0.1, -0.05, 0.02);
        const g = part(shield, lambert(BLUE), 1.06);
        const emblem = new THREE.BoxGeometry(0.18, 0.22, 0.02); emblem.translate(-0.1, -0.05, 0.06);
        g.add(new THREE.Mesh(emblem, lambert(AMP)));
        g.position.set(-0.04, -0.06, 0);
        this.shieldGroup.add(g);
        break;
      }
      // ── 직업당 3종 (2026-09-13). 무기는 전완 축(-Y)을 따라 붙는다 — 위 브레이커 주석과 같은 규칙.
      case 'knuckle': {
        for (const hand of [this.rHand, this.lHand]) {
          const bar = new THREE.BoxGeometry(0.2, 0.09, 0.11); bar.translate(0, -0.11, 0);
          const g = part(bar, lambert(STEEL), 1.1);
          const stud = new THREE.BoxGeometry(0.03, 0.05, 0.03);
          for (const dx of [-0.06, 0, 0.06]) { const m = new THREE.Mesh(stud, lambert(AMP)); m.position.set(dx, -0.16, 0); g.add(m); }
          (hand === this.rHand ? this.accGroup : this.shieldGroup).add(g);
          if (hand === this.lHand) g.position.set(0, -0.17, 0);
        }
        break;
      }
      case 'chain': {
        // 손잡이 → 사슬 마디 넷 → 추. 늘어뜨려 붙여 두면 휘두르는 포즈에서 원심력처럼 보인다.
        const grip = new THREE.CylinderGeometry(0.028, 0.028, 0.16, 8); grip.translate(0, -0.08, 0);
        this.accGroup.add(part(grip, lambert(0x7a4f22), 1.15));
        for (let i = 0; i < 4; i++) {
          const link = new THREE.TorusGeometry(0.045, 0.014, 6, 12);
          const m = part(link, lambert(STEEL), 1.1);
          m.rotation.x = Math.PI / 2; m.rotation.z = i % 2 ? Math.PI / 2 : 0;
          m.position.y = -0.24 - i * 0.09;
          this.accGroup.add(m);
        }
        const ball = part(new THREE.SphereGeometry(0.12, 12, 10), lambert(0x3b4260), 1.06);
        ball.position.y = -0.72;
        this.accGroup.add(ball);
        break;
      }
      case 'claw': {
        for (const hand of [this.rHand, this.lHand]) {
          const g = new THREE.Group();
          for (const dx of [-0.07, 0, 0.07]) {
            const talon = new THREE.ConeGeometry(0.022, 0.34, 6); talon.rotateX(Math.PI); talon.translate(dx, -0.3, 0.02);
            g.add(part(talon, lambert(STEEL), 1.1));
          }
          (hand === this.rHand ? this.accGroup : this.shieldGroup).add(g);
          if (hand === this.lHand) g.position.set(0, -0.17, 0);
        }
        break;
      }
      case 'anchor': {
        const shaft = new THREE.CylinderGeometry(0.035, 0.035, 0.8, 8); shaft.translate(0, -0.42, 0);
        this.accGroup.add(part(shaft, lambert(STEEL), 1.1));
        const cross = new THREE.BoxGeometry(0.42, 0.06, 0.08); cross.translate(0, -0.58, 0);
        this.accGroup.add(part(cross, lambert(STEEL), 1.1));
        for (const sx of [-1, 1]) {
          const fluke = new THREE.ConeGeometry(0.09, 0.26, 6); fluke.rotateZ(sx * 0.9); fluke.translate(sx * 0.22, -0.74, 0);
          this.accGroup.add(part(fluke, lambert(0x3b4260), 1.08));
        }
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.02, 6, 14), lambert(AMP));
        ring.rotation.y = Math.PI / 2; ring.position.y = -0.04;
        this.accGroup.add(ring);
        break;
      }
      case 'dagger': {
        for (const hand of [this.rHand, this.lHand]) {
          const g = new THREE.Group();
          const blade = new THREE.BoxGeometry(0.05, 0.36, 0.02); blade.translate(0, -0.3, 0);
          g.add(part(blade, lambert(STEEL), 1.1));
          const guard = new THREE.BoxGeometry(0.16, 0.035, 0.05); guard.translate(0, -0.11, 0);
          g.add(part(guard, lambert(AMP), 1.1));
          (hand === this.rHand ? this.accGroup : this.shieldGroup).add(g);
          if (hand === this.lHand) g.position.set(0, -0.17, 0);
        }
        break;
      }
      case 'chakram': {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.028, 8, 22), lambert(STEEL));
        ring.rotation.x = Math.PI / 2; ring.position.y = -0.24;
        this.accGroup.add(ring);
        const spare = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.028, 8, 22), lambert(0x3b4260));
        spare.rotation.x = Math.PI / 2; spare.position.set(0, -0.4, 0);
        this.shieldGroup.add(spare);
        break;
      }
      case 'hammer': {
        const haft = new THREE.CylinderGeometry(0.032, 0.032, 0.85, 8); haft.translate(0, -0.5, 0);
        this.accGroup.add(part(haft, lambert(WOOD), 1.15));
        const head = new THREE.BoxGeometry(0.36, 0.24, 0.24); head.translate(0, -0.94, 0);
        this.accGroup.add(part(head, lambert(STEEL), 1.06));
        const band = new THREE.BoxGeometry(0.38, 0.05, 0.26); band.translate(0, -0.94, 0);
        this.accGroup.add(part(band, lambert(AMP), 1.08));
        break;
      }
      case 'cannon': {
        // 어깨에 얹는 포신 — 오른팔 축을 따라 앞으로 길게
        const barrel = new THREE.CylinderGeometry(0.1, 0.13, 0.72, 10); barrel.translate(0, -0.44, 0);
        this.accGroup.add(part(barrel, lambert(0x3b4260), 1.06));
        const muzzle = new THREE.CylinderGeometry(0.14, 0.14, 0.1, 10); muzzle.translate(0, -0.82, 0);
        this.accGroup.add(part(muzzle, lambert(STEEL), 1.06));
        const drum = new THREE.CylinderGeometry(0.1, 0.1, 0.16, 8); drum.rotateZ(Math.PI / 2); drum.translate(0.12, -0.22, 0);
        this.accGroup.add(part(drum, lambert(AMP), 1.08));
        break;
      }
      case 'staff': {
        const pole = new THREE.CylinderGeometry(0.028, 0.028, 2.1, 8); pole.translate(0, -0.45, 0);
        this.accGroup.add(part(pole, lambert(WOOD), 1.2));
        for (const y of [0.55, -1.45]) {
          const cap = new THREE.CylinderGeometry(0.045, 0.045, 0.12, 8); cap.translate(0, y, 0);
          this.accGroup.add(part(cap, lambert(STEEL), 1.1));
        }
        break;
      }
      case 'nunchaku': {
        const stick = (y: number, tilt: number) => {
          const s2 = new THREE.CylinderGeometry(0.032, 0.032, 0.42, 8); s2.translate(0, y, 0);
          const m = part(s2, lambert(0x7a4f22), 1.12); m.rotation.z = tilt; return m;
        };
        this.accGroup.add(stick(-0.24, 0));
        this.accGroup.add(stick(-0.62, 0.7));
        const cord = new THREE.CylinderGeometry(0.01, 0.01, 0.12, 6); cord.translate(0, -0.46, 0);
        this.accGroup.add(part(cord, lambert(STEEL), 1.1));
        break;
      }
      case 'rocket': {
        for (const hand of [this.rHand, this.lHand]) {
          const glove = part(new THREE.SphereGeometry(0.13, 12, 10), lambert(RED), 1.08);
          const ring = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.03, 8, 20), lambert(STEEL));
          ring.rotation.x = Math.PI / 2; ring.position.y = 0.08;
          glove.add(ring);
          (hand === this.rHand ? this.accGroup : this.shieldGroup).add(glove);
          if (hand === this.lHand) glove.position.set(0, -0.17, 0);
        }
        break;
      }
      default:
        break;
    }
  }

  setOpacity(alpha: number): void {
    for (const m of this.mats) { m.transparent = alpha < 1; m.opacity = alpha; }
    outlineMat.transparent = alpha < 1;
  }

  /** 목표 포즈로 부드럽게 (k = 프레임당 보간 비율) */
  setPose(target: Pose, k: number): void {
    const p = this.pose;
    const L = (a: number, b: number) => a + (b - a) * k;
    p.lean = L(p.lean, target.lean); p.head = L(p.head, target.head);
    p.nearArm = [L(p.nearArm[0], target.nearArm[0]), L(p.nearArm[1], target.nearArm[1])];
    p.farArm = [L(p.farArm[0], target.farArm[0]), L(p.farArm[1], target.farArm[1])];
    p.nearLeg = [L(p.nearLeg[0], target.nearLeg[0]), L(p.nearLeg[1], target.nearLeg[1])];
    p.farLeg = [L(p.farLeg[0], target.farLeg[0]), L(p.farLeg[1], target.farLeg[1])];
    p.lift = L(p.lift, target.lift); p.lying = L(p.lying, target.lying); p.spin = target.spin;
    p.reach = L(p.reach, target.reach);
    this.apply();
  }

  private apply(): void {
    const p = this.pose;
    // 앞쪽이 양수 → x 축 음의 회전
    this.rShoulder.rotation.x = -deg(p.nearArm[0]); this.rElbow.rotation.x = -deg(p.nearArm[1]);
    this.lShoulder.rotation.x = -deg(p.farArm[0]); this.lElbow.rotation.x = -deg(p.farArm[1]);
    this.rHip.rotation.x = -deg(p.nearLeg[0]); this.rKnee.rotation.x = -deg(p.nearLeg[1]);
    this.lHip.rotation.x = -deg(p.farLeg[0]); this.lKnee.rotation.x = -deg(p.farLeg[1]);
    // 팔은 살짝 바깥으로 벌린다
    this.rShoulder.rotation.z = -0.12; this.lShoulder.rotation.z = 0.12;
    this.torsoPivot.rotation.x = -deg(p.lean);
    this.headPivot.rotation.x = -deg(p.head);
    this.body.position.y = p.lift;
    // 눕힘: 발목 기준으로 뒤로 넘어간다
    this.body.rotation.x = deg(p.lying) + deg(p.spin);
    this.body.position.z = p.lying > 45 ? -0.2 : p.reach; // 타격 포즈는 몸을 앞으로 내민다
    this.body.position.y += p.lying > 45 ? 0.05 : 0;
    this.shadowBlob.visible = true;
  }
}
