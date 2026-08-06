import { describe, expect, it } from 'vitest';
import {
  clampDescription,
  detailMeta,
  gamePath,
  gameUrl,
  genreFromSlug,
  genreSlug,
  hreflangAlternates,
  hubMeta,
  socialImage,
} from '../copy.mjs';

const game = {
  slug: 'spud-arena',
  title: '감자 투기장',
  titleEn: 'Spud Arena',
  description: '감자 전사를 골라 파도처럼 몰려오는 적을 막아내는 아레나 액션. 라운드마다 상점에서 장비를 갈아끼운다.',
  descriptionEn: 'Pick a spud warrior and survive waves of enemies in this arena brawler. Re-equip between rounds.',
  genre: 'ACTION',
  thumbnailUrl: '/games/thumbs/shots/spud-arena.png',
  ratingAvg: 8.4,
  ratingCount: 12,
  developerName: 'kgd',
};

describe('게임 URL 규칙', () => {
  it('한국어는 루트, 영문은 /en 프리픽스', () => {
    expect(gamePath('ko', '/games/spud-arena')).toBe('/games/spud-arena');
    expect(gamePath('en', '/games/spud-arena')).toBe('/en/games/spud-arena');
  });

  it('허브는 빈 sub 로도 슬래시가 남는다 — canonical 에 호스트만 남으면 안 된다', () => {
    expect(gameUrl('ko')).toBe('https://game.1989v.com/');
    expect(gameUrl('en')).toBe('https://game.1989v.com/en');
  });

  it('hreflang 은 ko/en/x-default 세 쌍이고 x-default 는 영문을 가리킨다', () => {
    const alternates = hreflangAlternates('/games/spud-arena');
    expect(alternates.map((a) => a.hreflang)).toEqual(['ko', 'en', 'x-default']);
    expect(alternates[2].href).toBe(alternates[1].href);
  });

  it('장르 슬러그는 enum 과 왕복한다', () => {
    expect(genreSlug('ACTION')).toBe('action');
    expect(genreFromSlug('action')).toBe('ACTION');
    expect(genreFromSlug('없는장르')).toBeNull();
  });
});

describe('메타 카피', () => {
  it('상세 타이틀은 언어별 포맷을 따른다', () => {
    expect(detailMeta('ko', game).title).toBe('감자 투기장 — 무료 온라인 플레이 | kgd Games');
    expect(detailMeta('en', game).title).toBe('Spud Arena — Play Free Online | kgd Games');
  });

  it('설명이 짧으면 장르 문구를 덧붙여 빈약한 스니펫을 막는다', () => {
    const short = { ...game, description: '짧은 설명.' };
    expect(detailMeta('ko', short).description).toContain('무료 액션 게임');
  });

  it('description 은 스니펫 상한에서 잘린다', () => {
    expect(clampDescription('가'.repeat(300)).length).toBeLessThanOrEqual(155);
    expect(clampDescription('짧다')).toBe('짧다');
  });

  it('허브 설명에 게임 수가 들어간다', () => {
    expect(hubMeta('ko', 28).description).toContain('28종');
    expect(hubMeta('en', 28).description).toContain('28 free browser games');
  });
});

describe('소셜 카드 이미지', () => {
  it('래스터 썸네일만 절대 URL 로 노출한다', () => {
    expect(socialImage(game)).toBe('https://game.1989v.com/games/thumbs/shots/spud-arena.png');
  });

  it('SVG 는 언퍼러가 렌더하지 못하므로 제외한다', () => {
    expect(socialImage({ ...game, thumbnailUrl: '/games/thumbs/art/spud-arena.svg' })).toBeNull();
  });
});
