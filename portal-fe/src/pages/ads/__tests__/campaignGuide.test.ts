import { describe, expect, it } from 'vitest';
import { estimateSpend } from '../campaignGuide';

describe('estimateSpend — 입찰가·예산이 허락하는 상한', () => {
  it('CPM 은 1회 과금이 입찰가 ÷ 1,000 이라 하루 최대 노출은 일예산 ÷ 1회 과금', () => {
    expect(estimateSpend('CPM', 500_000, 5_000_000, 50_000_000, 25)).toEqual({
      maxPerDay: 10_000,
      hourlyCapMicros: 1_250_000,
      minDays: 10,
    });
  });

  it('CPC 는 1회 과금이 입찰가 그대로', () => {
    expect(estimateSpend('CPC', 200_000, 5_000_000, null, 25)).toEqual({
      maxPerDay: 25,
      hourlyCapMicros: 1_250_000,
      minDays: null,
    });
  });

  it('시간당 상한은 1회 과금액보다 작아지지 않는다 — 서버와 같은 max 식', () => {
    // 일예산 1 · CPC 입찰가 0.5 → 25% 는 0.25 지만 한 번은 낼 수 있어야 한다
    expect(estimateSpend('CPC', 500_000, 1_000_000, null, 25)?.hourlyCapMicros).toBe(500_000);
  });

  it('입찰가나 일예산이 없으면 계산하지 않는다', () => {
    expect(estimateSpend('CPM', null, 5_000_000, null, 25)).toBeNull();
    expect(estimateSpend('CPM', 500_000, null, null, 25)).toBeNull();
  });
});
