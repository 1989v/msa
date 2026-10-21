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
