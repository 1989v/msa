import type { CafeDrink, CaffeineStatus } from '../../api/rankingApi';

export const isCaffeineNone = (status: CaffeineStatus): boolean => status === 'ZERO' || status === 'DECAF';
export const caffeineLabel = (drink: Pick<CafeDrink, 'caffeineMg' | 'caffeineStatus'>): string => {
  if (drink.caffeineStatus === 'UNDISCLOSED') return '미공개';
  const amount = drink.caffeineMg === null ? '수치 미확정' : `${drink.caffeineMg} mg`;
  return drink.caffeineStatus === 'DECAF' ? `디카페인 · ${amount}` : amount;
};
