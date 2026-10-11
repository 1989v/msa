import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { AttractionAccess as Access, AttractionAccessStop } from '../../../api/placeApi';
import AttractionAccess from '../AttractionAccess';
import { accessView } from '../accessLines';

const rail = (name: string, distanceM: number, extra: Partial<AttractionAccessStop> = {}): AttractionAccessStop => ({
  kind: 'RAIL', rank: 1, name, nameEn: null, lines: null, distanceM, baseDate: '2024-12-31', ...extra,
});
const bus = (name: string, distanceM: number, extra: Partial<AttractionAccessStop> = {}): AttractionAccessStop => ({
  kind: 'BUS', rank: 1, name, nameEn: null, lines: null, distanceM, baseDate: '2025-10-31', ...extra,
});

const HREF = 'https://www.google.com/maps/dir/?api=1&destination=37.5,127&travelmode=transit';

function items(access: Access | null, lang: 'ko' | 'en' = 'ko'): string[] {
  const { container } = render(<AttractionAccess access={access} lang={lang} directionsHref={HREF} />);
  return [...container.querySelectorAll('li')].map((li) => li.textContent ?? '');
}

describe('AttractionAccess — 가까운 역·정류장', () => {
  it('모든 거리 앞에 「직선거리」를 쓰고 1km 부터 km 로 적는다', () => {
    const lines = items({
      stops: [
        rail('서울역', 999, { lines: '1·4호선' }),
        rail('시청', 1000, { rank: 2, lines: '1·2호선' }),
        bus('세종문화회관', 1049),
        bus('광화문', 1050, { rank: 2 }),
      ],
      busCovered: true,
    });
    expect(lines).toEqual([
      '서울역 (1·4호선) · 직선거리 999m',
      '시청역 (1·2호선) · 직선거리 1.0km',
      '세종문화회관 버스정류장 · 직선거리 1.0km',
      '광화문 버스정류장 · 직선거리 1.1km',
    ]);
    for (const line of lines) expect(line).toMatch(/직선거리 \d+(\.\d)?k?m$/);
  });

  it('「역」으로 끝나는 원천 역명에는 「역」을 다시 붙이지 않는다', () => {
    const text = items({ stops: [rail('서울역', 300)], busCovered: true }).join('\n');
    expect(text).toContain('서울역 · 직선거리 300m');
    expect(text).not.toContain('서울역역');
  });

  it('도보 시간을 내지 않는다', () => {
    render(<AttractionAccess access={{ stops: [rail('서울역', 999), bus('광화문', 120)], busCovered: true }} lang="ko" directionsHref={HREF} />);
    const section = screen.getByRole('region', { name: '가까운 역·정류장' });
    expect(section.textContent).not.toMatch(/도보|\d+\s*분/);
  });

  it('첫 행동은 대중교통 길찾기 링크, 절 아래에 직선거리 안내·기준일·출처가 붙는다', () => {
    render(<AttractionAccess access={{ stops: [rail('서울역', 999), bus('광화문', 120)], busCovered: true }} lang="ko" directionsHref={HREF} />);
    const section = screen.getByRole('region', { name: '가까운 역·정류장' });
    const first = section.querySelector('a');
    expect(first?.getAttribute('href')).toBe(HREF);
    expect(first?.textContent).toBe('대중교통 길찾기');
    // 기준일은 가장 늦은 날(정류장 수집일 2025-10-31)
    expect(section.textContent).toContain('직선거리이며 실제 걷는 길은 더 깁니다 · 자료 기준일 2025-10-31');
    expect(section.textContent).toContain('출처: 국가철도공단 도시철도 역사정보 · 국토교통부 전국 버스정류장 위치정보');
  });

  it('항목이 없으면 절을 그리지 않는다', () => {
    for (const access of [null, { stops: [], busCovered: true }, { stops: [], busCovered: null }]) {
      const { container, unmount } = render(<AttractionAccess access={access} lang="ko" directionsHref={HREF} />);
      expect(container.innerHTML).toBe('');
      unmount();
    }
  });

  it('버스 원천 미연계 지역은 「자료 없음」을, 연계 지역의 범위 밖은 버스 줄을 내지 않는다', () => {
    expect(items({ stops: [rail('서울역', 999)], busCovered: false })).toEqual([
      '서울역 · 직선거리 999m',
      '이 지역은 버스정류장 위치 자료가 없습니다',
    ]);
    // 줄이 하나도 없어도 미연계 안내는 낸다
    expect(items({ stops: [], busCovered: false })).toEqual(['이 지역은 버스정류장 위치 자료가 없습니다']);
    // 연계 지역인데 500m 안 정류장이 없으면 버스 줄이 없다
    const covered = items({ stops: [rail('서울역', 999)], busCovered: true });
    expect(covered).toEqual(['서울역 · 직선거리 999m']);
    expect(accessView({ stops: [], busCovered: false }, 'ko')?.note).toBeNull();
  });

  it('영문은 역은 영문 역명, 정류장은 원천 국문 이름에 「Bus stop」을 붙인다', () => {
    const lines = items(
      {
        stops: [
          rail('서울역', 999, { nameEn: 'Seoul Station', lines: '1·4호선' }),
          rail('시청', 1000, { rank: 2, nameEn: null, lines: '경의중앙선' }),
          bus('광화문', 120),
        ],
        busCovered: true,
      },
      'en',
    );
    expect(lines).toEqual([
      'Seoul Station (Line 1·4) · straight-line 999m',
      '시청역 (경의중앙선) · straight-line 1.0km',
      'Bus stop 광화문 · straight-line 120m',
    ]);
    expect(items({ stops: [], busCovered: false }, 'en')).toEqual(['No bus stop data for this area']);
  });
});
