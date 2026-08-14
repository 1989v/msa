// 캐릭터 외형(팔레트/의상/체격) 및 전투 스탯 정의.

import { BASE_METRICS } from './rig.js';
import { HERO_CLIPS, GRUNT_CLIPS, BOSS_CLIPS } from './anim.js';

const M = (o) => ({ ...BASE_METRICS, ...o });

export const CHARS = {
  // ── 주인공: 진 ──
  hero: {
    name: '진', clips: HERO_CLIPS, metrics: M({ scale: 1.0, girth: 1.0 }),
    style: {
      skin: '#e6b183', hairCol: '#241d28', top: '#eef1f6', pants: '#2f3a63',
      boots: '#8a4530', accent: '#e04434', glove: '#e0aa7c', belt: '#c2352c',
      headband: '#e04434', hair: 'spike', outfit: 'vest', sleeve: 'none',
      wraps: '#eef2f6', eye: '#2a1a2c',
    },
    hp: 200, speed: 1.42, depthSpeed: 0.92,
  },

  // ── 잡졸 ──
  thug: {
    name: '부두 건달', clips: GRUNT_CLIPS, metrics: M({ scale: 0.97, girth: 1.02 }),
    style: {
      skin: '#c98f63', hairCol: '#2b2320', top: '#3f7a52', pants: '#3a3f4a',
      boots: '#2e2a2c', accent: '#c9a24a', glove: '#8a6a48', belt: '#241f22',
      hair: 'bald', outfit: 'vest', sleeve: 'none', eye: '#2a1a1a', beard: true,
    },
    hp: 46, speed: 0.82, depthSpeed: 0.62, score: 200,
  },
  punk: {
    name: '펑크', clips: GRUNT_CLIPS, metrics: M({ scale: 0.95, girth: 0.94 }),
    style: {
      skin: '#dda878', hairCol: '#e0554a', top: '#4e4459', pants: '#5c5470',
      boots: '#2c2936', accent: '#a468e0', glove: '#3a3442', belt: '#7d6a8e',
      hair: 'mohawk', outfit: 'jacket', sleeve: 'short', shades: true, shoulderPad: true,
    },
    hp: 42, speed: 0.95, depthSpeed: 0.7, score: 220,
  },
  knifer: {
    name: '나이프', clips: GRUNT_CLIPS, metrics: M({ scale: 0.94, girth: 0.9 }),
    style: {
      skin: '#c98f63', hairCol: '#1f2430', top: '#242b3a', pants: '#1b2029',
      boots: '#14171d', accent: '#5f6d86', glove: '#3a4356', belt: '#0f1218',
      hair: 'cap', outfit: 'jacket', sleeve: 'long', mask: 'lower', eye: '#c6d4e8',
    },
    hp: 38, speed: 1.22, depthSpeed: 0.9, score: 260,
  },
  brute: {
    name: '거한', clips: GRUNT_CLIPS, metrics: M({ scale: 1.16, girth: 1.24, limbW: 8.4, armW: 7.2 }),
    style: {
      skin: '#d09a6e', hairCol: '#3a2f2a', top: '#8c6f4a', pants: '#54463a',
      boots: '#39302b', accent: '#b8503a', glove: '#6f5a44', belt: '#2c241f',
      hair: 'bald', outfit: 'bare', sleeve: 'none', beard: true, eye: '#3a2018',
    },
    hp: 108, speed: 0.6, depthSpeed: 0.46, score: 420, armor: true,
  },
  thrower: {
    name: '투척꾼', clips: GRUNT_CLIPS, metrics: M({ scale: 0.93, girth: 0.95 }),
    style: {
      skin: '#e0b184', hairCol: '#4a3a2a', top: '#b6763a', pants: '#5a5348',
      boots: '#3a332c', accent: '#e0c35a', glove: '#7a5a34', belt: '#3d332a',
      hair: 'cap', outfit: 'jacket', sleeve: 'short',
    },
    hp: 36, speed: 0.78, depthSpeed: 0.66, score: 280,
  },
  ninja: {
    name: '사원 그림자', clips: GRUNT_CLIPS, metrics: M({ scale: 0.96, girth: 0.92 }),
    style: {
      skin: '#d7a273', hairCol: '#1a1c2c', top: '#2b3350', pants: '#232840',
      boots: '#171a28', accent: '#3f4a70', glove: '#4a5578', belt: '#8a2f3a',
      hair: 'topknot', outfit: 'jacket', sleeve: 'long', mask: 'lower', scarf: '#8a2f3a',
    },
    hp: 52, speed: 1.12, depthSpeed: 0.88, score: 320,
  },

  // ── 보스 ──
  bossHarbor: {
    name: '철갑 마스트', clips: BOSS_CLIPS, metrics: M({ scale: 1.27, girth: 1.22, limbW: 8.2, armW: 7 }),
    style: {
      skin: '#c78f60', hairCol: '#c9b06a', top: '#4a5468', pants: '#333b49',
      boots: '#242a35', accent: '#8e99ad', glove: '#5c6678', belt: '#1e232c',
      hair: 'helm', outfit: 'armor', sleeve: 'long', shoulderPad: true, shades: true,
    },
    hp: 460, speed: 0.72, depthSpeed: 0.56, score: 3000, boss: true, armor: true,
  },
  bossFoundry: {
    name: '용광로 그롤', clips: BOSS_CLIPS, metrics: M({ scale: 1.3, girth: 1.32, limbW: 9, armW: 7.8 }),
    style: {
      skin: '#c56a4a', hairCol: '#2a1a18', top: '#7a3428', pants: '#4a2620',
      boots: '#33201c', accent: '#e2762c', glove: '#5c2f24', belt: '#241512',
      hair: 'bald', outfit: 'bare', sleeve: 'none', beard: true, eye: '#ffbe4a', shoulderPad: true,
    },
    hp: 640, speed: 0.64, depthSpeed: 0.5, score: 4500, boss: true, armor: true,
  },
  bossShrine: {
    name: '설풍 검성', clips: BOSS_CLIPS, metrics: M({ scale: 1.12, girth: 1.0 }),
    style: {
      skin: '#e3c0a0', hairCol: '#d9dde8', top: '#31405e', pants: '#232b40',
      boots: '#1a2030', accent: '#8fb6e0', glove: '#46557a', belt: '#a03a44',
      hair: 'long', outfit: 'coat', sleeve: 'long', scarf: '#a03a44', eye: '#6fa8d8',
    },
    hp: 560, speed: 1.06, depthSpeed: 0.86, score: 5200, boss: true,
  },
  bossHidden: {
    name: '심연의 진', clips: BOSS_CLIPS, metrics: M({ scale: 1.04, girth: 1.02 }),
    style: {
      skin: '#6a5a86', hairCol: '#120f1c', top: '#231d33', pants: '#191428',
      boots: '#2a1c3a', accent: '#a24ae0', glove: '#3a2a52', belt: '#6a2ab0',
      headband: '#a24ae0', hair: 'spike', outfit: 'vest', sleeve: 'none',
      wraps: '#3a2a52', eye: '#e05aff',
    },
    hp: 780, speed: 1.36, depthSpeed: 0.94, score: 9000, boss: true,
  },
};

export const ENEMY_IDS = ['thug', 'punk', 'knifer', 'brute', 'thrower', 'ninja'];
