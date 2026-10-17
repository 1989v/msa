import type { MarketStore } from '../../api/marketApi';

export const MARKET_STORE_TYPES = [
  { key: 'food', ko: '음식점', en: 'Restaurants' },
  { key: 'snack', ko: '분식·간식', en: 'Snacks' },
  { key: 'cafe', ko: '카페·주점', en: 'Cafés & bars' },
  { key: 'grocery', ko: '식료품', en: 'Groceries' },
  { key: 'fashion', ko: '의류·신발', en: 'Clothing & shoes' },
  { key: 'goods', ko: '잡화·귀금속·안경', en: 'Accessories & jewelry' },
  { key: 'living', ko: '생활용품·가전', en: 'Household & electronics' },
  { key: 'health', ko: '건강·미용', en: 'Health & beauty' },
  { key: 'etc', ko: '기타·서비스', en: 'Services & other' },
] as const;
export type MarketStoreTypeKey = typeof MARKET_STORE_TYPES[number]['key'];
type Category = Pick<MarketStore, 'categoryMajor' | 'categoryMid'>;
const categories: Record<string, Partial<Record<MarketStoreTypeKey, readonly string[]>>> = {
  음식: { food: ['한식', '중식', '일식', '서양식', '동남아시아', '기타 외국', '구내식당·뷔페', ''], snack: ['기타 간이'], cafe: ['비알코올', '주점'] },
  소매: {
    grocery: ['식료품 소매', '음료 소매', '담배 소매'], fashion: ['섬유·의복·신발 소매'],
    goods: ['시계·귀금속 소매', '안경·정밀기기 소매', '장식품 소매', '오락용품 소매', '기타 상품 소매', '중고 상품 소매', '애완동물·용품 소매', '식물 소매'],
    living: ['종합 소매', '기타 생활용품 소매', '가구 소매', '철물·건설자재 소매', '가전·통신 소매', '자동차 부품 소매', '모터사이클 소매', '연료 소매', ''], health: ['의약·화장품 소매'],
  },
  '수리·개인': { health: ['이용·미용', '욕탕·신체관리'] },
};
export function marketStoreType(store: Category): MarketStoreTypeKey {
  const major = store.categoryMajor?.trim() ?? '';
  if (major === '보건의료' && store.categoryMid?.trim()) return 'health';
  const table = categories[major];
  return MARKET_STORE_TYPES.find(type => table?.[type.key]?.includes(store.categoryMid?.trim() ?? ''))?.key ?? 'etc';
}
export function marketStoreTypeColor(key: MarketStoreTypeKey): string {
  return `var(--market-type-${MARKET_STORE_TYPES.findIndex(type => type.key === key) + 1})`;
}
export function marketStoreTypeCounts(stores: readonly Category[]) {
  const counts = new Map<MarketStoreTypeKey, number>();
  for (const store of stores) { const key = marketStoreType(store); counts.set(key, (counts.get(key) ?? 0) + 1); }
  return MARKET_STORE_TYPES.map(type => ({ ...type, count: counts.get(type.key) ?? 0 }))
    .filter(type => type.count > 0)
    .sort((a, b) => Number(a.key === 'etc') - Number(b.key === 'etc') || b.count - a.count);
}
/** Majority ties follow the fixed type order, including Services & other. */
export function majorityMarketStoreType(stores: readonly Category[]): MarketStoreTypeKey {
  const counts = new Map(marketStoreTypeCounts(stores).map(type => [type.key, type.count]));
  return MARKET_STORE_TYPES.reduce((best, type) => (counts.get(type.key) ?? 0) > (counts.get(best) ?? 0) ? type.key : best, 'food' as MarketStoreTypeKey);
}
