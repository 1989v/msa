// 맵 정의 — 기획서 §9. 단위 m, 아레나 중심 (0,0), y 는 높이.
export interface Box { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number }
export interface Cylinder { x: number; z: number; r: number; h: number }
export interface Spawn { x: number; z: number; y: number; team: number } // team 0 = 레드/무팀, 1 = 블루
export interface CrateSpot { x: number; z: number; y: number }

export type MapId = 'colosseum' | 'skydock';

export interface MapDef {
  id: MapId;
  name: string;
  groundRadius: number;   // 0 이면 바닥 평면 없음 (발판만)
  wallRadius: number;     // 0 이면 원형 벽 없음
  wallHeight: number;
  boxes: Box[];           // 발판·단상 (위에 설 수 있고 옆은 막힌다)
  cylinders: Cylinder[];  // 기둥
  spawns: Spawn[];
  crates: CrateSpot[];
  fallY: number;
}

const box = (cx: number, cz: number, w: number, d: number, bottom: number, top: number): Box => ({
  minX: cx - w / 2, maxX: cx + w / 2, minY: bottom, maxY: top, minZ: cz - d / 2, maxZ: cz + d / 2,
});

const ringSpawns = (r: number, count: number): Spawn[] => {
  const out: Spawn[] = [];
  for (let i = 0; i < count; i++) {
    const a = (i * (360 / count) * Math.PI) / 180;
    const x = r * Math.cos(a), z = r * Math.sin(a);
    // 동쪽 절반 레드(0), 서쪽 절반 블루(1); 정남북은 번갈아
    const team = Math.cos(a) > 0.01 ? 0 : Math.cos(a) < -0.01 ? 1 : i % 4 === 2 ? 0 : 1;
    out.push({ x, z, y: 0, team });
  }
  return out;
};

export const COLOSSEUM: MapDef = {
  id: 'colosseum',
  name: '콜로세움',
  groundRadius: 20,
  wallRadius: 20,
  wallHeight: 3,
  boxes: [box(0, 12, 4, 4, 0, 1.5), box(0, -12, 4, 4, 0, 1.5)],
  cylinders: [
    { x: -8.5, z: 8.5, r: 0.8, h: 6 }, { x: 8.5, z: 8.5, r: 0.8, h: 6 },
    { x: -8.5, z: -8.5, r: 0.8, h: 6 }, { x: 8.5, z: -8.5, r: 0.8, h: 6 },
  ],
  spawns: ringSpawns(15, 8),
  crates: [0, 1, 2, 3, 4, 5].map((i) => {
    const a = ((i * 60 + 30) * Math.PI) / 180;
    return { x: 9 * Math.cos(a), z: 9 * Math.sin(a), y: 0 };
  }),
  fallY: -8,
};

export const SKYDOCK: MapDef = {
  id: 'skydock',
  name: '스카이독',
  groundRadius: 0,
  wallRadius: 0,
  wallHeight: 0,
  boxes: [
    box(0, 0, 24, 16, -3, 0),      // 중앙
    box(-19, 0, 8, 8, -3, 2),      // 서
    box(19, 0, 8, 8, -3, 2),       // 동
    box(0, 16, 6, 10, -3, 0),      // 북
    box(0, -16, 6, 10, -3, 0),     // 남
  ],
  cylinders: [],
  spawns: [
    { x: -10, z: 6, y: 0, team: 0 }, { x: -10, z: -6, y: 0, team: 0 }, { x: 10, z: 6, y: 0, team: 1 }, { x: 10, z: -6, y: 0, team: 1 },
    { x: -17, z: 0, y: 2, team: 0 }, { x: 17, z: 0, y: 2, team: 1 }, { x: 0, z: 19, y: 0, team: 0 }, { x: 0, z: -19, y: 0, team: 1 },
  ],
  crates: [{ x: -21.5, z: 2.5, y: 2 }, { x: 21.5, z: 2.5, y: 2 }, { x: -21.5, z: -2.5, y: 2 }, { x: 21.5, z: -2.5, y: 2 }],
  fallY: -8,
};

export const MAPS: Record<MapId, MapDef> = { colosseum: COLOSSEUM, skydock: SKYDOCK };
