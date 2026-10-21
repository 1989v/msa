import type { CafeFilters, CaffeineStatus } from '../../api/rankingApi';

export function readCafeFilters(params: URLSearchParams): CafeFilters {
  const number = (key: string, max: number) => {
    const value = params.get(key);
    return value !== null && value.trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= 0 ? Math.min(max, Number(value)) : undefined;
  };
  const sort = params.get('sort');
  return {
    q: params.get('q')?.slice(0, 120) || undefined,
    brand: params.getAll('brand').filter(value => /^[a-z0-9-]+$/.test(value)),
    group: params.get('group') || undefined,
    temperature: ['HOT', 'ICE'].includes(params.get('temperature') ?? '') ? params.get('temperature')! : undefined,
    maxSugar: number('maxSugar', 1000), maxCaffeine: number('maxCaffeine', 10000),
    caffeine: ['none', 'zero', 'decaf'].includes(params.get('caffeine') ?? '') ? params.get('caffeine') as CafeFilters['caffeine'] : undefined,
    caffeineStatus: params.getAll('caffeineStatus').filter((value): value is CaffeineStatus => ['ZERO', 'DECAF', 'DISCLOSED', 'UNDISCLOSED'].includes(value)),
    basis: params.get('basis') === '100ml' || sort === 'sugarPer100ml' ? '100ml' : 'serving',
    sort: ['sugar', 'caffeine', 'kcal', 'sugarPer100ml'].includes(sort ?? '') ? sort as CafeFilters['sort'] : 'sugar',
    page: Math.floor(number('page', 10000) ?? 0), size: Math.max(1, Math.floor(number('size', 200) ?? 20)),
  };
}
export function writeCafeFilters(filters: CafeFilters): URLSearchParams {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (Array.isArray(value)) value.forEach(item => params.append(key, item));
    else if (value !== undefined && value !== '') params.set(key, String(value));
  });
  return params;
}
