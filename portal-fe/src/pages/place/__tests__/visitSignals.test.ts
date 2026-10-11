import { describe, expect, it } from 'vitest';
import type { PlaceLang } from '../../../api/placeApi';
import { FREQUENTLY_CLICKED_MIN as REEXPORTED_CLICKED_MIN } from '../placeAttributes';
import {
  FREQUENTLY_CLICKED_MIN,
  KTO_RANKING_COPY,
  SAVED_MIN,
  SIGNAL_COPY,
  SIGNAL_KINDS,
  SITE_CLICKS_BASIS,
  type SignalKind,
  formatSignalLine,
  ktoRankingSignalLine,
  siteSectionSignalLine,
  siteSignalSentence,
  siteSignalSentences,
  visitorTrendLinkLabel,
} from '../visitSignals';

/**
 * 방문 근거 문구·하한 — 근거마다 이름이 근거를 말하고, 적은 수는 줄을 내지 않는다.
 * 경계값은 상수 이름이 아니라 **리터럴**로 쓴다 — 상수로 경계를 만들면 상수를 낮춰도 초록이다.
 */

const LANGS: PlaceLang[] = ['ko', 'en'];
const FORBIDDEN = ['많이 본', '인기', '핫플', 'popular', 'most viewed', 'hot spot', 'hotspot', 'trending'];

/** 이 모듈이 내는 모든 문구 — 문구 객체를 순회하고, 함수 출력은 하한 이상 값으로 한 번씩 뽑는다. */
function everyText(): { kind: SignalKind | 'LINK'; text: string }[] {
  const out: { kind: SignalKind | 'LINK'; text: string }[] = [];
  for (const kind of SIGNAL_KINDS) {
    for (const lang of LANGS) {
      for (const text of Object.values(SIGNAL_COPY[kind][lang])) out.push({ kind, text });
      const line = formatSignalLine(kind, { target: 'T', period: 'P' }, lang);
      if (line) out.push({ kind, text: line });
    }
  }
  for (const lang of LANGS) {
    out.push({ kind: 'SITE_SAVES', text: siteSignalSentence('SITE_SAVES', 100, lang, '2026-10-10') ?? '' });
    out.push({ kind: 'SITE_CLICKS', text: siteSignalSentence('SITE_CLICKS', 100, lang, '2026-10-10') ?? '' });
    out.push({ kind: 'KTO_REGION_VISITORS', text: visitorTrendLinkLabel('해운대구', lang) });
    const C = KTO_RANKING_COPY[lang];
    for (const text of [C.target('부산'), C.note, C.value(12.5), C.basisToggle, ...C.basis, C.sourceLine]) {
      out.push({ kind: 'KTO_REGION_VISITORS', text });
    }
    out.push({ kind: 'KTO_REGION_VISITORS', text: ktoRankingSignalLine('부산', '2026-08', lang) ?? '' });
    out.push({ kind: 'SITE_SAVES', text: siteSectionSignalLine('SITE_SAVES', '해운대구', lang) ?? '' });
    out.push({ kind: 'SITE_CLICKS', text: siteSectionSignalLine('SITE_CLICKS', '해운대구', lang) ?? '' });
    for (const text of [SITE_CLICKS_BASIS[lang].toggle, ...SITE_CLICKS_BASIS[lang].lines]) out.push({ kind: 'SITE_CLICKS', text });
    const [saves, clicks] = siteSignalSentences({ savedCount: 100, uniqueClickers14d: 100, signalsAsOf: '2026-10-10' }, lang);
    out.push({ kind: 'SITE_SAVES', text: saves }, { kind: 'SITE_CLICKS', text: clicks });
  }
  return out;
}

describe('visitSignals — 이름', () => {
  it('금지어(「많이 본」「인기」「핫플」, 영문 popular 류)가 국·영 문구 어디에도 없다', () => {
    const texts = everyText();
    expect(texts.length).toBeGreaterThan(20);
    for (const { text } of texts) {
      for (const word of FORBIDDEN) expect(text.toLowerCase(), text).not.toContain(word.toLowerCase());
    }
  });

  it('「방문자 · visitor」는 관광공사 근거에만 있고 이 사이트 근거(찜·클릭)에는 없다', () => {
    const texts = everyText();
    for (const { kind, text } of texts) {
      if (kind === 'SITE_SAVES' || kind === 'SITE_CLICKS') {
        expect(text, text).not.toContain('방문자');
        expect(text.toLowerCase(), text).not.toContain('visitor');
      }
    }
    expect(SIGNAL_COPY.KTO_REGION_VISITORS.ko.sectionTitle).toContain('방문자');
    expect(SIGNAL_COPY.KTO_REGION_VISITORS.en.sectionTitle.toLowerCase()).toContain('visitor');
  });

  it('이 사이트 클릭 근거는 사람을 「이용자 · people on this site」로 부른다', () => {
    expect(SIGNAL_COPY.SITE_CLICKS.ko.source).toBe('이 사이트 이용자 클릭(같은 사람은 한 번)');
    expect(SIGNAL_COPY.SITE_CLICKS.en.source).toContain('people on this site');
  });
});

describe('formatSignalLine — 원천 · 대상 · 기간', () => {
  it('세 칸을 「 · 」로 잇는다 (국문 예시 그대로)', () => {
    expect(formatSignalLine('KTO_REGION_VISITORS', { target: '해운대구 전체', period: '2026년 8월' }, 'ko'))
      .toBe('한국관광공사 빅데이터(이동통신 추정) · 해운대구 전체 · 2026년 8월');
    expect(formatSignalLine('SITE_SAVES', { target: '이 관광지', period: '누적' }, 'ko'))
      .toBe('이 사이트 회원 찜 · 이 관광지 · 누적');
    expect(formatSignalLine('SITE_CLICKS', { target: '이 관광지', period: '최근 14일' }, 'ko'))
      .toBe('이 사이트 이용자 클릭(같은 사람은 한 번) · 이 관광지 · 최근 14일');
  });

  it('덧붙임은 넷째 칸으로 붙는다', () => {
    expect(formatSignalLine('KTO_REGION_VISITORS', { target: '서울특별시 시군구', period: '2026년 8월', note: '외지인+외국인' }, 'ko'))
      .toBe('한국관광공사 빅데이터(이동통신 추정) · 서울특별시 시군구 · 2026년 8월 · 외지인+외국인');
  });

  it('영문도 같은 세 칸이다', () => {
    const line = formatSignalLine('SITE_SAVES', { target: 'this place', period: 'all time' }, 'en');
    expect(line?.split(' · ')).toHaveLength(3);
    expect(line).toBe('Saves by members of this site · this place · all time');
  });

  it('대상이나 기간이 비면 줄을 내지 않는다', () => {
    expect(formatSignalLine('SITE_SAVES', { target: '', period: '누적' }, 'ko')).toBeNull();
    expect(formatSignalLine('SITE_SAVES', { target: '이 관광지', period: '  ' }, 'ko')).toBeNull();
    expect(formatSignalLine('KTO_REGION_VISITORS', { target: '해운대구', period: null }, 'ko')).toBeNull();
  });
});

describe('하한 — 리터럴 경계', () => {
  it('하한 값', () => {
    expect(SAVED_MIN).toBe(3);
    expect(FREQUENTLY_CLICKED_MIN).toBe(5);
  });

  it('placeAttributes 는 같은 값을 다시 내보낸다(사본 아님)', () => {
    expect(REEXPORTED_CLICKED_MIN).toBe(5);
  });

  it('찜 2 → 줄 없음, 3 → 줄 있음', () => {
    expect(siteSignalSentence('SITE_SAVES', 2, 'ko')).toBeNull();
    expect(siteSignalSentence('SITE_SAVES', 3, 'ko')).toBe('이 사이트 회원 3명이 찜했습니다');
    expect(siteSignalSentence('SITE_SAVES', null, 'ko')).toBeNull();
    expect(siteSignalSentence('SITE_SAVES', undefined, 'ko')).toBeNull();
  });

  it('클릭 4 → 줄 없음, 5 → 줄 있음', () => {
    expect(siteSignalSentence('SITE_CLICKS', 4, 'ko')).toBeNull();
    expect(siteSignalSentence('SITE_CLICKS', 5, 'ko')).toBe('최근 14일 이 사이트에서 5명이 눌렀습니다(같은 사람은 한 번)');
  });

  it('기준일이 있으면 「{YYYY-MM-DD} 기준」을 붙인다', () => {
    expect(siteSignalSentence('SITE_SAVES', 3, 'ko', '2026-10-10')).toBe('이 사이트 회원 3명이 찜했습니다 · 2026-10-10 기준');
    expect(siteSignalSentence('SITE_CLICKS', 5, 'en', '2026-10-10'))
      .toBe('5 people on this site clicked this in the last 14 days (each person counted once) · as of 2026-10-10');
  });
});

describe('관광지 상세의 시군구 방문 추이 링크', () => {
  it('수치 없이 링크 문구만', () => {
    expect(visitorTrendLinkLabel('해운대구', 'ko')).toBe('해운대구 방문 추이 보기');
    expect(visitorTrendLinkLabel('Haeundae-gu', 'en')).toBe('Visitor trend in Haeundae-gu');
  });
});

describe('visitSignals — 시도 순위 근거 줄', () => {
  it('원천·대상·기간 세 칸 + 외지인+외국인, 달이 없으면 줄을 내지 않는다', () => {
    expect(ktoRankingSignalLine('부산광역시', '2026-08')).toBe(
      '한국관광공사 빅데이터(이동통신 추정) · 부산광역시 시군구 · 2026년 8월 · 외지인+외국인',
    );
    expect(ktoRankingSignalLine('부산광역시', null)).toBeNull();
    expect(KTO_RANKING_COPY.ko.value(1234.99)).toBe('약 1,234명');
  });
});
