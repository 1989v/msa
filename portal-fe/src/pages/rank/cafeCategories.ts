import type { CafeFilters } from '../../api/rankingApi';

// Browse labels combine source recipe groups without changing their classification or implying zero caffeine.
export const cafeCategories: { label: string; filters: CafeFilters }[] = [
  { label: '전체', filters: {} },
  { label: '커피', filters: { group: ['아메리카노', '에스프레소', '콜드브루'] } },
  { label: '라떼', filters: { group: ['라떼', '바닐라라떼', '카라멜마끼아또', '카페모카', '카푸치노', '말차·녹차라떼', '고구마라떼', '밀크티'] } },
  { label: '에이드', filters: { group: ['에이드', '탄산음료'] } },
  { label: '스무디', filters: { group: '스무디·프라페', q: '스무디' } },
  { label: '티', filters: { group: ['티', '밀크티'] } },
  { label: '프라페', filters: { group: '스무디·프라페', q: '프라' } },
  { label: '주스', filters: { group: '주스' } },
  { label: '논커피', filters: { group: ['초코', '우유·요거트', '고구마라떼', '말차·녹차라떼', '밀크티'] } },
  { label: '디카페인', filters: { caffeine: 'decaf' } },
];
