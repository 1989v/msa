// 스테이지 구성 데이터. 구간(section)마다 배경 변형 · 웨이브 · 오브젝트 · 숨김 요소가 다르다.

export const STAGES = [
  {
    id: 'harbor', no: 1, name: '안개 항만', sub: '제1구역 · 부두',
    theme: 'harbor', bgm: 'harbor', bake: ['thug', 'punk', 'thrower', 'bossHarbor'],
    sections: [
      {
        variant: 0, len: 1460, hint: '부두 진입로',
        props: [
          { kind: 'crate', x: 300, y: 236, drop: 'drink' },
          { kind: 'crate', x: 340, y: 200, drop: null },
          { kind: 'crate', x: 760, y: 246, drop: 'meat' },
          { kind: 'barrel', x: 1080, y: 208, drop: 'gold' },
          { kind: 'crate', x: 1120, y: 240, drop: null },
        ],
        items: [{ kind: 'pipe', x: 700, y: 214 }],
        waves: [
          { at: 240, list: ['thug', 'thug'], max: 3 },
          { at: 760, list: ['thug', 'punk', 'thug'], max: 3 },
          { at: 1240, list: ['punk', 'punk', 'thug', 'thrower'], max: 4 },
        ],
      },
      {
        variant: 1, len: 1520, hint: '컨테이너 야적장',
        props: [
          { kind: 'crate', x: 420, y: 244, drop: 'drink' },
          { kind: 'barrel', x: 900, y: 202, drop: 'meat' },
          { kind: 'crate', x: 940, y: 250, drop: null },
          { kind: 'crate', x: 1300, y: 226, drop: 'gold' },
        ],
        secret: { x: 1010, y: 250, label: '수상한 맨홀', room: 'harborVault' },
        waves: [
          { at: 300, list: ['punk', 'thug', 'thrower'], max: 3 },
          { at: 820, list: ['thug', 'punk', 'punk', 'thug'], max: 4 },
          { at: 1300, list: ['punk', 'thrower', 'thug', 'punk'], max: 4 },
        ],
      },
      {
        variant: 2, len: 940, hint: '등대 광장', boss: 'bossHarbor',
        props: [{ kind: 'barrel', x: 200, y: 246, drop: 'meat' }, { kind: 'crate', x: 820, y: 210, drop: 'drink' }],
        waves: [{ at: 300, list: ['thug', 'punk'], max: 2 }, { at: 420, boss: true, list: ['bossHarbor'], adds: ['thug', 'thug'], max: 3 }],
      },
    ],
  },
  {
    id: 'foundry', no: 2, name: '적열 제련소', sub: '제2구역 · 용광로',
    theme: 'foundry', bgm: 'foundry', bake: ['knifer', 'thug', 'brute', 'punk', 'bossFoundry'],
    sections: [
      {
        variant: 0, len: 1480, hint: '주조 통로',
        props: [
          { kind: 'drum', x: 330, y: 206, drop: 'drink' },
          { kind: 'barrel', x: 640, y: 244, drop: 'meat' },
          { kind: 'drum', x: 1020, y: 216, drop: 'ki' },
          { kind: 'barrel', x: 1240, y: 248, drop: null },
        ],
        items: [{ kind: 'wrench', x: 880, y: 206 }],
        waves: [
          { at: 250, list: ['knifer', 'thug'], max: 3 },
          { at: 780, list: ['knifer', 'knifer', 'punk'], max: 3 },
          { at: 1260, list: ['thug', 'knifer', 'punk', 'knifer'], max: 4 },
        ],
      },
      {
        variant: 1, len: 1560, hint: '용탕 도랑',
        props: [
          { kind: 'drum', x: 380, y: 240, drop: 'meat' },
          { kind: 'barrel', x: 760, y: 210, drop: 'gold' },
          { kind: 'drum', x: 1180, y: 246, drop: 'ki' },
        ],
        secret: { x: 620, y: 246, label: '벌어진 배관', room: 'foundryVault' },
        hazard: 'flame',
        waves: [
          { at: 300, list: ['brute', 'knifer'], max: 3 },
          { at: 860, list: ['knifer', 'punk', 'knifer', 'thug'], max: 4 },
          { at: 1340, list: ['brute', 'knifer', 'punk', 'knifer'], max: 4 },
        ],
      },
      {
        variant: 2, len: 960, hint: '도가니 앞', boss: 'bossFoundry',
        props: [{ kind: 'drum', x: 180, y: 244, drop: 'meat' }, { kind: 'barrel', x: 840, y: 214, drop: 'ki' }],
        waves: [{ at: 300, list: ['knifer', 'brute'], max: 2 }, { at: 430, boss: true, list: ['bossFoundry'], adds: ['knifer', 'knifer'], max: 3 }],
      },
    ],
  },
  {
    id: 'shrine', no: 3, name: '설풍 사원', sub: '제3구역 · 설산',
    theme: 'shrine', bgm: 'shrine', bake: ['ninja', 'knifer', 'brute', 'thrower', 'bossShrine'],
    sections: [
      {
        variant: 0, len: 1500, hint: '참배길',
        props: [
          { kind: 'lantern', x: 340, y: 210, drop: 'drink' },
          { kind: 'lantern', x: 780, y: 246, drop: 'meat' },
          { kind: 'crate', x: 1140, y: 218, drop: 'gold' },
        ],
        waves: [
          { at: 250, list: ['ninja', 'knifer'], max: 3 },
          { at: 800, list: ['ninja', 'ninja', 'thrower'], max: 3 },
          { at: 1280, list: ['ninja', 'knifer', 'ninja', 'brute'], max: 4 },
        ],
      },
      {
        variant: 1, len: 1540, hint: '설산 계단',
        props: [
          { kind: 'lantern', x: 420, y: 240, drop: 'ki' },
          { kind: 'crate', x: 880, y: 208, drop: 'meat' },
          { kind: 'lantern', x: 1280, y: 244, drop: 'gold' },
        ],
        items: [{ kind: 'katana', x: 700, y: 212 }],
        secret: { x: 1040, y: 248, label: '눈 덮인 석문', room: 'shrineVault' },
        hazard: 'ice',
        waves: [
          { at: 320, list: ['ninja', 'brute', 'thrower'], max: 3 },
          { at: 900, list: ['ninja', 'ninja', 'knifer', 'ninja'], max: 4 },
          { at: 1320, list: ['brute', 'ninja', 'ninja', 'knifer'], max: 4 },
        ],
      },
      {
        variant: 2, len: 980, hint: '범종 마당', boss: 'bossShrine',
        props: [{ kind: 'lantern', x: 200, y: 246, drop: 'meat' }, { kind: 'crate', x: 860, y: 212, drop: 'ki' }],
        waves: [{ at: 300, list: ['ninja', 'ninja'], max: 2 }, { at: 430, boss: true, list: ['bossShrine'], adds: ['ninja', 'ninja'], max: 3 }],
      },
    ],
  },
  {
    id: 'abyss', no: 4, name: '심연의 옥좌', sub: '히든 구역 · 그림자', hidden: true,
    theme: 'abyss', bgm: 'abyss', bake: ['ninja', 'bossHidden'],
    sections: [
      {
        variant: 0, len: 980, hint: '무(無)의 회랑', boss: 'bossHidden',
        props: [{ kind: 'crate', x: 220, y: 244, drop: 'meat' }, { kind: 'crate', x: 800, y: 214, drop: 'ki' }],
        waves: [
          { at: 280, list: ['ninja', 'ninja', 'ninja'], max: 3 },
          { at: 440, boss: true, list: ['bossHidden'], adds: [], max: 1 },
        ],
      },
    ],
  },
];

// 보너스룸: 비밀 통로로만 들어갈 수 있는 구간
export const ROOMS = {
  harborVault: {
    theme: 'harbor', variant: 1, len: 560, name: '밀수품 창고',
    props: [
      { kind: 'crate', x: 160, y: 212, drop: 'gold' },
      { kind: 'crate', x: 220, y: 244, drop: 'gold' },
      { kind: 'crate', x: 300, y: 224, drop: 'meat' },
      { kind: 'barrel', x: 380, y: 240, drop: 'gold' },
      { kind: 'crate', x: 440, y: 210, drop: 'life' },
    ],
    items: [{ kind: 'scroll', x: 500, y: 228 }],
  },
  foundryVault: {
    theme: 'foundry', variant: 0, len: 560, name: '폐기 주형실',
    props: [
      { kind: 'drum', x: 150, y: 216, drop: 'gold' },
      { kind: 'barrel', x: 230, y: 244, drop: 'ki' },
      { kind: 'drum', x: 320, y: 210, drop: 'gold' },
      { kind: 'barrel', x: 400, y: 242, drop: 'meat' },
    ],
    items: [{ kind: 'scroll', x: 500, y: 226 }],
  },
  shrineVault: {
    theme: 'shrine', variant: 2, len: 560, name: '봉인 석실',
    props: [
      { kind: 'lantern', x: 160, y: 218, drop: 'ki' },
      { kind: 'crate', x: 250, y: 244, drop: 'gold' },
      { kind: 'lantern', x: 340, y: 212, drop: 'gold' },
      { kind: 'crate', x: 420, y: 240, drop: 'life' },
    ],
    items: [{ kind: 'scroll', x: 500, y: 226 }],
  },
};
