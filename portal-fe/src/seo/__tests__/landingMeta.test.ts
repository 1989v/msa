import { describe, expect, it } from 'vitest';
import { PLACE_LANDING_ATTRS, landingMeta, landingPath, regionDisplayName } from '../copy.mjs';
import { ATTRIBUTE_CHIPS } from '../../pages/place/placeAttributes';

const seoul = { code: '11', level: 'SIDO', name: '서울특별시', nameEn: 'Seoul' };
const busan = { code: '26', level: 'SIDO', name: '부산광역시', nameEn: 'Busan' };
const seoulJung = { code: '11140', level: 'SIGUNGU', name: '중구', nameEn: 'Jung-gu' };
const busanJung = { code: '26110', level: 'SIGUNGU', name: '중구', nameEn: 'Jung-gu' };
const noEn = { code: '50', level: 'SIDO', name: '제주특별자치도', nameEn: '' };
const jejuSi = { code: '50110', level: 'SIGUNGU', name: '제주시', nameEn: 'Jeju-si' };

const attr = (slug: string) => PLACE_LANDING_ATTRS.find((a: { attr: string }) => a.attr === slug)!;

describe('슬러그 표 ↔ 허브 칩', () => {
  it('칩 id 가 전부 ATTRIBUTE_CHIPS 안에 있다 — 프리셋이 없는 칩을 켜지 않는다', () => {
    const chipIds = new Set(ATTRIBUTE_CHIPS.map((c) => c.id as string));
    for (const a of PLACE_LANDING_ATTRS) expect(chipIds, a.attr).toContain(a.chipId);
  });
});

describe('landingMeta', () => {
  it('같은 「중구」라도 시도가 다르면 title 이 다르다', () => {
    const a = landingMeta('ko', seoul, seoulJung, 'parking', { count: 12 });
    const b = landingMeta('ko', busan, busanJung, 'parking', { count: 12 });
    expect(a.title).not.toBe(b.title);
    expect(a.heading).toContain(regionDisplayName('ko', seoul));
    expect(b.heading).toContain(regionDisplayName('ko', busan));
  });

  it('국문 heading 은 시도 · 시군구 · 속성 국문 이름을 담는다', () => {
    const m = landingMeta('ko', busan, busanJung, 'barrier-free', { count: 12 });
    for (const part of [regionDisplayName('ko', busan), busanJung.name, attr('barrier-free').nameKo]) {
      expect(m.heading).toContain(part);
    }
  });

  it('N 이 없으면 sentence 가 없다', () => {
    expect(landingMeta('ko', busan, busanJung, 'parking', {}).sentence).toBeUndefined();
    expect(landingMeta('ko', busan, busanJung, 'parking', { count: null }).sentence).toBeUndefined();
    expect(landingMeta('en', busan, busanJung, 'parking', {}).sentence).toBeUndefined();
  });

  it('N 이 있으면 sentence 에 N 과 asOf 가 실린다', () => {
    const m = landingMeta('ko', busan, busanJung, 'parking', { count: 1234, asOf: '2026-10-01' });
    expect(m.sentence).toContain((1234).toLocaleString('ko'));
    expect(m.sentence).toContain('2026-10-01');
  });

  it('asOf 가 없으면 「— 원천 갱신 기준」 꼬리가 없다', () => {
    const withTail = landingMeta('ko', busan, busanJung, 'parking', { count: 12, asOf: '2026-10-01' }).sentence!;
    const noTail = landingMeta('ko', busan, busanJung, 'parking', { count: 12 }).sentence!;
    expect(withTail).toContain('원천 갱신 기준');
    expect(noTail).not.toContain('원천 갱신 기준');
    expect(noTail).not.toContain('—');
    expect(withTail.startsWith(noTail)).toBe(true);
  });

  it('영문 heading 은 「{Attr en} Attractions in {Sigungu en}, {Sido en}」', () => {
    const m = landingMeta('en', busan, busanJung, 'free', { count: 12 });
    const a = attr('free');
    expect(m.heading).toBe(`${a.nameEn} Attractions in ${regionDisplayName('en', busanJung)}, ${regionDisplayName('en', busan)}`);
    expect(m.title.startsWith(m.heading)).toBe(true);
  });

  it('영문명이 빈 시도는 국문명으로 쓴다', () => {
    const m = landingMeta('en', noEn, jejuSi, 'parking', { count: 12 });
    expect(m.heading).toContain(noEn.name);
    expect(m.heading).toContain(jejuSi.nameEn);
  });

  it('title · description 이 비지 않는다 (국·영)', () => {
    for (const lang of ['ko', 'en'] as const) {
      const m = landingMeta(lang, seoul, seoulJung, 'parking', { count: 12, asOf: '2026-10-01' });
      expect(m.title.length).toBeGreaterThan(0);
      expect(m.description.length).toBeGreaterThan(0);
    }
  });
});

describe('landingPath', () => {
  it('국문 /regions/{code}/{attr} · 영문 /en/regions/{code}/{attr}', () => {
    expect(landingPath('ko', '26110', 'parking')).toBe('/regions/26110/parking');
    expect(landingPath('en', '26110', 'free')).toBe('/en/regions/26110/free');
  });
});
