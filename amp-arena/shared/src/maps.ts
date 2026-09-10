// 맵 정의 — 기획서 §9. 단위 m, 아레나 중심 (0,0), y 는 높이.
export interface Box { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number }
export interface Cylinder { x: number; z: number; r: number; h: number }
export interface Spawn { x: number; z: number; y: number; team: number } // team 0 = 레드/무팀, 1 = 블루
export interface CrateSpot { x: number; z: number; y: number }

export type MapId = 'colosseum' | 'skydock' | 'rooftop' | 'icelake';
export type MapTheme = 'colosseum' | 'sky' | 'rooftop' | 'ice';

export interface MapDef {
  id: MapId;
  name: string;
  theme: MapTheme;
  desc: string;
  groundRadius: number;   // 0 이면 바닥 평면 없음 (발판만)
  wallRadius: number;     // 0 이면 원형 벽 없음
  wallHeight: number;
  ice: boolean;           // 미끄러운 바닥 — 가속·감속이 느리다
  boxes: Box[];           // 발판·단상 (위에 설 수 있고 옆은 막힌다)
  cylinders: Cylinder[];  // 기둥·바위
  spawns: Spawn[];
  crates: CrateSpot[];
  fallY: number;
}

const box = (cx: number, cz: number, w: number, d: number, bottom: number, top: number): Box => ({
  minX: cx - w / 2, maxX: cx + w / 2, minY: bottom, maxY: top, minZ: cz - d / 2, maxZ: cz + d / 2,
});

const ringSpawns = (r: number, count: number, y = 0): Spawn[] => {
  const out: Spawn[] = [];
  for (let i = 0; i < count; i++) {
    const a = (i * (360 / count) * Math.PI) / 180;
    const x = r * Math.cos(a), z = r * Math.sin(a);
    // 동쪽 절반 레드(0), 서쪽 절반 블루(1); 정남북은 번갈아
    const team = Math.cos(a) > 0.01 ? 0 : Math.cos(a) < -0.01 ? 1 : i % 4 === 2 ? 0 : 1;
    out.push({ x, z, y, team });
  }
  return out;
};

export const COLOSSEUM: MapDef = {
  id: 'colosseum', name: '콜로세움', theme: 'colosseum', desc: '벽 있음 · 낙사 없음 · 40m',
  groundRadius: 20, wallRadius: 20, wallHeight: 3, ice: false,
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
  id: 'skydock', name: '스카이독', theme: 'sky', desc: '발판 5 · 낙사 · 던지기로 링아웃',
  groundRadius: 0, wallRadius: 0, wallHeight: 0, ice: false,
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

/** 옥상: 30×20 지붕, 기계실(+2m)과 계단 턱(+1m), 실외기 3개. 난간 없음 — 가장자리가 곧 낙사. */
export const ROOFTOP: MapDef = {
  id: 'rooftop', name: '옥상', theme: 'rooftop', desc: '30×20 · 난간 없음 · 실외기 엄폐',
  groundRadius: 0, wallRadius: 0, wallHeight: 0, ice: false,
  boxes: [
    box(0, 0, 30, 20, -3, 0),       // 지붕
    box(-10, 5, 8, 6, 0, 2.0),      // 기계실 (점프로 못 오름, 턱을 밟고 오른다)
    box(-10, 0.5, 8, 3, 0, 1.0),    // 턱
    box(8, 6, 2, 2, 0, 1.2),        // 실외기
    box(8, -6, 2, 2, 0, 1.2),
    box(0, -8, 3, 1.5, 0, 1.0),
  ],
  cylinders: [],
  spawns: [
    { x: -13, z: -8, y: 0, team: 0 }, { x: -13, z: 8, y: 0, team: 0 }, { x: -5, z: -8.5, y: 0, team: 0 }, { x: -10, z: 5, y: 2, team: 0 },
    { x: 13, z: -8, y: 0, team: 1 }, { x: 13, z: 8, y: 0, team: 1 }, { x: 5, z: 8.5, y: 0, team: 1 }, { x: 12, z: 0, y: 0, team: 1 },
  ],
  crates: [{ x: -13.5, z: 0, y: 0 }, { x: 13.5, z: -8.5, y: 0 }, { x: 3, z: 8.5, y: 0 }, { x: -3, z: -8.5, y: 0 }],
  fallY: -8,
};

/** 얼음 호수: 반지름 18 얼음판, 가장자리 밖은 물(낙사). 미끄러워 멈추기 어렵고, 바위가 엄폐. */
export const ICELAKE: MapDef = {
  id: 'icelake', name: '얼음 호수', theme: 'ice', desc: '미끄러움 · 가장자리 낙사 · 바위 엄폐',
  groundRadius: 18, wallRadius: 0, wallHeight: 0, ice: true,
  boxes: [],
  cylinders: [
    { x: 0, z: 0, r: 1.6, h: 2.2 },
    { x: 9, z: 9, r: 0.9, h: 1.4 }, { x: -9, z: 9, r: 0.9, h: 1.4 }, { x: 9, z: -9, r: 0.9, h: 1.4 }, { x: -9, z: -9, r: 0.9, h: 1.4 },
  ],
  spawns: ringSpawns(12, 8),
  crates: [0, 1, 2, 3].map((i) => { const a = ((i * 90 + 45) * Math.PI) / 180; return { x: 6 * Math.cos(a), z: 6 * Math.sin(a), y: 0 }; }),
  fallY: -8,
};

export const MAPS: Record<MapId, MapDef> = { colosseum: COLOSSEUM, skydock: SKYDOCK, rooftop: ROOFTOP, icelake: ICELAKE };
export const MAP_IDS: MapId[] = ['colosseum', 'skydock', 'rooftop', 'icelake'];
