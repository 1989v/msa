import type { CafeFilters } from '../../api/rankingApi';

// Browse categories combine exact source groups; decaf describes caffeine, not a recipe.
export const cafeCategories: { slug: string; label: string; filters: CafeFilters }[] = [
  { slug: 'all', label: '전체', filters: {} },
  { slug: 'coffee', label: '커피', filters: { group: ['아메리카노', '에스프레소', '콜드브루'] } },
  { slug: 'coffee-latte', label: '커피 라떼', filters: { group: ['라떼', '바닐라라떼', '카라멜마끼아또', '카페모카', '카푸치노'] } },
  { slug: 'non-coffee', label: '논커피 라떼', filters: { group: ['말차·녹차라떼', '고구마라떼', '초코', '밀크티', '우유·요거트'] } },
  { slug: 'tea', label: '티', filters: { group: ['티'] } },
  { slug: 'ade', label: '에이드·탄산', filters: { group: ['에이드', '탄산음료'] } },
  { slug: 'blended', label: '스무디·프라페', filters: { group: ['스무디·프라페'] } },
  { slug: 'juice', label: '주스', filters: { group: ['주스'] } },
  { slug: 'decaf', label: '디카페인', filters: { caffeine: 'decaf' } },
  { slug: 'etc', label: '기타', filters: { group: ['기타'] } },
];

export const cafeCategory = (slug?: string | null) => cafeCategories.find(category => category.slug === slug);

export function activeCafeCategory(filters: CafeFilters): string | undefined {
  const groups = [filters.group ?? []].flat();
  if (groups.length) return cafeCategories.find(category => {
    const expected = [category.filters.group ?? []].flat();
    return expected.length === groups.length && expected.every(group => groups.includes(group));
  })?.slug;
  return filters.caffeine === 'decaf' ? 'decaf' : 'all';
}

export function selectCafeCategory(filters: CafeFilters, slug: string): CafeFilters {
  const category = cafeCategory(slug)!;
  // Category changes leave text, brands, nutrition caps and other list controls intact.
  return { ...filters, category: slug, group: undefined, caffeine: undefined, ...category.filters, page: 0 };
}
