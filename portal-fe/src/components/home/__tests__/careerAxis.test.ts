import { describe, expect, it } from 'vitest';
import { careerAxis } from '../careerAxis';
import type { TimelineCompany } from '../../../api/displayApi';

const company = (name: string, startMonth: string, endMonth: string | null, ongoing = false): TimelineCompany => ({
  name, startMonth, endMonth, ongoing, position: null, team: null,
});

describe('careerAxis — 재직 기간 막대의 자리', () => {
  const now = new Date(2026, 8, 3); // 2026-09
  const companies = [
    company('C', '2022-08', null, true),
    company('B', '2018-03', '2022-07'),
    company('A', '2015-10', '2017-12'),
  ];

  it('축은 첫 입사 연도 1월부터 올해 다음 해 1월까지 — 눈금이 연도와 맞는다', () => {
    const { years } = careerAxis(companies, now);
    expect(years[0]).toBe(2015);
    expect(years[years.length - 1]).toBe(2026);
    expect(years).toHaveLength(12);
  });

  it('막대 시작·끝이 개월 비율로 놓이고 진행 중은 이번 달까지', () => {
    const { bars } = careerAxis(companies, now);
    const a = bars.find((b) => b.company.name === 'A')!;
    expect(a.s).toBeCloseTo(9 / 144, 5); // 2015-10 은 축 시작(2015-01)에서 9개월
    expect(a.e).toBeCloseTo(36 / 144, 5); // 2017-12 끝 = 36개월째
    const c = bars.find((b) => b.company.name === 'C')!;
    expect(c.e).toBeCloseTo((11 * 12 + 9) / 144, 5); // 2026-09 까지
    expect(c.e).toBeLessThanOrEqual(1);
  });
});
