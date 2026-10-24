import type { CafeDrink, CaffeineStatus } from '../../api/rankingApi';

export const isCaffeineNone = (status: CaffeineStatus): boolean => status === 'ZERO' || status === 'DECAF';
export const caffeineLabel = (drink: Pick<CafeDrink, 'caffeineMg' | 'caffeineStatus'>): string => {
  if (drink.caffeineStatus === 'UNDISCLOSED') return '미공개';
  const amount = drink.caffeineMg == null || !Number.isFinite(drink.caffeineMg) ? '수치 미확정' : `${drink.caffeineMg} mg`;
  return drink.caffeineStatus === 'DECAF' ? `디카페인 · ${amount}` : amount;
};

export const volumeExplanation = '공식 브랜드 사이즈표 기준 컵 용량입니다. 실제 음료량은 다를 수 있습니다.';
export const weightEstimateNote = '중량(g)만 공개된 음료는 1g≈1ml로 추정해 100ml당 값 앞에 ≈를 붙입니다.';
export const volumeLabel = (drink: Pick<CafeDrink, 'sizeLabel' | 'cupVolumeMl' | 'servingBasis'> & Partial<Pick<CafeDrink, 'volumeSource'>>): string => {
  const weight = drink.servingBasis?.match(/제공량\s*\(g\)\s*(\d+(?:\.\d+)?)/i)?.[1] ?? drink.servingBasis?.match(/(?:^|[^\d.])(\d+(?:\.\d+)?)\s*g(?:$|[^a-z])/i)?.[1];
  const amount = drink.volumeSource === 'WEIGHT_ESTIMATE' && weight ? `${weight}g(≈${drink.cupVolumeMl}ml 추정)`
    : drink.cupVolumeMl != null && Number.isFinite(drink.cupVolumeMl) && drink.cupVolumeMl > 0 ? `${drink.cupVolumeMl}ml` : weight ? `${weight}g` : '용량 미표시';
  return drink.sizeLabel ? `${drink.sizeLabel} · ${amount}` : amount;
};


export type CafeMetric = 'sugar' | 'caffeine' | 'kcal';
export const metricNames = { sugar: '당류', caffeine: '카페인', kcal: '칼로리' };
export const metricUnits = { sugar: 'g', caffeine: 'mg', kcal: 'kcal' };
export const formatCafeNumber = (value: number): string => value > 0 && value < 0.05 ? '<0.1' : Number(value.toFixed(1)).toString();
export function cafeMetric(drink: CafeDrink, metric: CafeMetric, basis: 'serving' | '100ml'): { amount: string; unit?: string; status?: string } {
  if (metric === 'caffeine' && drink.caffeineStatus === 'UNDISCLOSED') return { amount: '미공개' };
  if (basis === '100ml' && !(drink.cupVolumeMl != null && Number.isFinite(drink.cupVolumeMl) && drink.cupVolumeMl > 0)) return { amount: '산출 불가', status: metric === 'caffeine' && drink.caffeineStatus === 'DECAF' ? '디카페인' : undefined };
  const value = basis === '100ml'
    ? { sugar: drink.sugarPer100ml, caffeine: drink.caffeinePer100ml, kcal: drink.kcalPer100ml }[metric]
    : { sugar: drink.sugarG, caffeine: drink.caffeineMg, kcal: drink.kcal }[metric];
  const estimated = basis === '100ml' && drink.volumeSource === 'WEIGHT_ESTIMATE';
  return {
    amount: value == null || !Number.isFinite(value) ? (metric === 'caffeine' ? '미확정' : '미공개') : `${estimated ? '≈' : ''}${formatCafeNumber(value)}`,
    unit: value == null || !Number.isFinite(value) ? undefined : metricUnits[metric],
    status: metric === 'caffeine' ? (drink.caffeineStatus === 'DECAF' ? '디카페인' : undefined) : undefined,
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
