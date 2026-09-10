// 프리미티브 13본 치비 리그 — 시안 캐릭터 시트의 비율을 3D 로 옮긴다. 외곽선은 뒤집은 껍질(inverted hull).
import * as THREE from 'three';
import type { AccessoryId } from '@amp/shared';
import { type Pose, POSES } from './poses.ts';

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
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.325, 0.035, 8, 24), lambert(BAND));
    band.rotation.x = Math.PI / 2;
    band.position.y = 0.12;
    headG.add(band);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.22), lambert(BAND));
    tail.position.set(-0.08, 0.1, -0.38);
    tail.rotation.y = 0.5;
    headG.add(tail);
    // 뒤로 뻗친 머리 3가닥
    // 뒤로 뻗친 머리 3가닥 — 밑동을 머리 표면에 두고 뒤·위로 뻗는다 (추적 카메라가 뒤에서 보므로 실루엣의 핵심)
    const hairMat = lambert(HAIR);
    for (const [ry, dy, len] of [[0.5, 0.0, 0.34], [0, 0.08, 0.42], [-0.5, 0.0, 0.34]] as const) {
      const geo = new THREE.ConeGeometry(0.09, len, 6);
      geo.translate(0, len / 2, 0);
      const spike = part(geo, hairMat, 1.12);
      spike.position.set(Math.sin(ry) * 0.2, 0.16 + dy, -0.26);
      spike.rotation.set(-1.25, ry * 0.6, 0);
      headG.add(spike);
    }
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

  setAccessory(acc: AccessoryId): void {
    if (acc === this.acc && this.accGroup.children.length) return;
    this.acc = acc;
    this.accGroup.clear();
    this.shieldGroup.clear();
    switch (acc) {
      case 'greatsword': {
        const blade = new THREE.BoxGeometry(0.09, 0.9, 0.03); blade.translate(0, -0.55, 0);
        this.accGroup.add(part(blade, lambert(STEEL), 1.08));
        const guard = new THREE.BoxGeometry(0.26, 0.05, 0.06); guard.translate(0, -0.1, 0);
        this.accGroup.add(part(guard, lambert(AMP), 1.1));
        const grip = new THREE.CylinderGeometry(0.03, 0.03, 0.22, 8); grip.translate(0, 0.06, 0);
        this.accGroup.add(part(grip, lambert(0x7a4f22), 1.15));
        this.accGroup.rotation.x = -Math.PI / 2; // 전완 방향으로 뻗는다
        break;
      }
      case 'spear': {
        const shaft = new THREE.CylinderGeometry(0.025, 0.025, 1.9, 8); shaft.translate(0, -0.4, 0);
        this.accGroup.add(part(shaft, lambert(WOOD), 1.2));
        const tip = new THREE.ConeGeometry(0.06, 0.3, 8); tip.translate(0, -1.5, 0);
        this.accGroup.add(part(tip, lambert(STEEL), 1.1));
        this.accGroup.rotation.x = -Math.PI / 2;
        break;
      }
      case 'pistols': {
        for (const g of [this.accGroup]) {
          const body = new THREE.BoxGeometry(0.07, 0.1, 0.24); body.translate(0, -0.02, 0.1);
          g.add(part(body, lambert(0x3b4260), 1.1));
        }
        const left = new THREE.Group();
        const body2 = new THREE.BoxGeometry(0.07, 0.1, 0.24); body2.translate(0, -0.02, 0.1);
        left.add(part(body2, lambert(0x3b4260), 1.1));
        left.position.set(0, -0.17, 0);
        this.lElbow.add(left);
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
    this.body.position.z = p.lying > 45 ? -0.2 : 0;
    this.body.position.y += p.lying > 45 ? 0.05 : 0;
    this.shadowBlob.visible = true;
  }
}
