import type { CafeDrink, CaffeineStatus } from '../../api/rankingApi';

export const isCaffeineNone = (status: CaffeineStatus): boolean => status === 'ZERO' || status === 'DECAF';
export const caffeineLabel = (drink: Pick<CafeDrink, 'caffeineMg' | 'caffeineStatus'>): string => {
  if (drink.caffeineStatus === 'UNDISCLOSED') return '미공개';
  const amount = drink.caffeineMg === null ? '수치 미확정' : `${drink.caffeineMg} mg`;
  return drink.caffeineStatus === 'DECAF' ? `디카페인 · ${amount}` : amount;
};

export const volumeExplanation = '공식 브랜드 사이즈표 기준 컵 용량입니다. 실제 음료량은 다를 수 있습니다.';
export const volumeLabel = (drink: Pick<CafeDrink, 'sizeLabel' | 'cupVolumeMl' | 'servingBasis'>): string => {
  const weight = drink.servingBasis?.match(/제공량\s*\(g\)\s*(\d+(?:\.\d+)?)/i)?.[1] ?? drink.servingBasis?.match(/(?:^|[^\d.])(\d+(?:\.\d+)?)\s*g(?:$|[^a-z])/i)?.[1];
  const amount = drink.cupVolumeMl != null ? `${drink.cupVolumeMl}ml` : weight ? `${weight}g` : '용량 미표시';
  return drink.sizeLabel ? `${drink.sizeLabel} · ${amount}` : amount;
};


export type CafeMetric = 'sugar' | 'caffeine' | 'kcal';
export const metricNames = { sugar: '당류', caffeine: '카페인', kcal: '열량' };
export const metricUnits = { sugar: 'g', caffeine: 'mg', kcal: 'kcal' };
export const formatCafeNumber = (value: number): string => value > 0 && value < 0.05 ? '<0.1' : Number(value.toFixed(1)).toString();
export function cafeMetric(drink: CafeDrink, metric: CafeMetric, basis: 'serving' | '100ml'): { amount: string; unit?: string; status?: string } {
  if (metric === 'caffeine' && drink.caffeineStatus === 'UNDISCLOSED') return { amount: '미공개' };
  if (basis === '100ml' && !(drink.cupVolumeMl != null && drink.cupVolumeMl > 0)) return { amount: '산출 불가', status: metric === 'caffeine' && drink.caffeineStatus === 'DECAF' ? '디카페인' : undefined };
  const value = basis === '100ml'
    ? { sugar: drink.sugarPer100ml, caffeine: drink.caffeinePer100ml, kcal: drink.kcalPer100ml }[metric]
    : { sugar: drink.sugarG, caffeine: drink.caffeineMg, kcal: drink.kcal }[metric];
  return {
    amount: value == null || !Number.isFinite(value) ? (metric === 'caffeine' ? '수치 미확정' : '미공개') : formatCafeNumber(value),
    unit: value == null || !Number.isFinite(value) ? undefined : metricUnits[metric],
    status: metric === 'caffeine' ? (drink.caffeineStatus === 'DECAF' ? '디카페인' : drink.caffeineStatus === 'ZERO' ? '공식 0' : undefined) : undefined,
  };
}

/** Unformatted numeric value for visual scales; tiny positive amounts must retain their bar. */
export function cafeMetricValue(drink: CafeDrink, metric: CafeMetric, basis: 'serving' | '100ml'): number | null {
  if (metric === 'caffeine' && drink.caffeineStatus === 'UNDISCLOSED') return null;
  const value = { sugar: drink.sugarG, caffeine: drink.caffeineMg, kcal: drink.kcal }[metric];
  if (value == null || !Number.isFinite(value)) return null;
  if (basis === 'serving') return value;
  return drink.cupVolumeMl != null && Number.isFinite(drink.cupVolumeMl) && drink.cupVolumeMl > 0
    ? value * 100 / drink.cupVolumeMl : null;
}
