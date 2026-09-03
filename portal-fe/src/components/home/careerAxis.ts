import type { TimelineCompany } from '../../api/displayApi';

const monthIndex = (ym: string): number => {
  const [y, m] = ym.split('-').map(Number);
  return y * 12 + (m - 1);
};

/**
 * 재직 기간 막대의 자리 (0~1). 축은 첫 입사 연도 1월부터 올해 다음 해 1월까지 — 연 단위로
 * 끊어야 눈금이 연도와 맞는다. 진행 중은 이번 달까지.
 */
export function careerAxis(companies: TimelineCompany[], now = new Date()) {
  const nowIdx = now.getFullYear() * 12 + now.getMonth();
  const starts = companies.map((c) => monthIndex(c.startMonth));
  const startYear = Math.floor(Math.min(...starts) / 12);
  const endYear = Math.floor(nowIdx / 12) + 1;
  const axisStart = startYear * 12;
  const span = endYear * 12 - axisStart;
  const years = Array.from({ length: endYear - startYear }, (_, i) => startYear + i);
  const bars = companies.map((c) => {
    const s = (monthIndex(c.startMonth) - axisStart) / span;
    const endIdx = c.ongoing || !c.endMonth ? nowIdx + 1 : monthIndex(c.endMonth) + 1;
    const e = Math.min(1, (endIdx - axisStart) / span);
    return { company: c, s, e };
  });
  return { years, bars };
}
