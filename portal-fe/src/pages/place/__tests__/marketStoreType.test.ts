import { describe, expect, it } from 'vitest';
import { MARKET_STORE_TYPES, majorityMarketStoreType, marketStoreType, marketStoreTypeColor, marketStoreTypeCounts, type MarketStoreTypeKey } from '../marketStoreType';

// Every (major, mid) pair the production store table holds, with the type it must land in.
const TABLE: Record<MarketStoreTypeKey, [string, string[]][]> = {
  food: [['음식', ['한식', '중식', '일식', '서양식', '동남아시아', '기타 외국', '구내식당·뷔페', '']]],
  snack: [['음식', ['기타 간이']]],
  cafe: [['음식', ['비알코올', '주점']]],
  grocery: [['소매', ['식료품 소매', '음료 소매', '담배 소매']]],
  fashion: [['소매', ['섬유·의복·신발 소매']]],
  goods: [['소매', ['시계·귀금속 소매', '안경·정밀기기 소매', '장식품 소매', '오락용품 소매', '기타 상품 소매', '중고 상품 소매', '애완동물·용품 소매', '식물 소매']]],
  living: [['소매', ['종합 소매', '기타 생활용품 소매', '가구 소매', '철물·건설자재 소매', '가전·통신 소매', '자동차 부품 소매', '모터사이클 소매', '연료 소매', '']]],
  health: [['소매', ['의약·화장품 소매']], ['보건의료', ['의원', '병원', '기타 보건']], ['수리·개인', ['이용·미용', '욕탕·신체관리']]],
  etc: [
    ['수리·개인', ['기타 가정용품 수리', '세탁', '자동차 수리·세차', '가전제품 수리', '컴퓨터 수리', '모터사이클 수리', '장례식장', '기타 개인', '통신장비 수리']],
    ['부동산', ['부동산 서비스']], ['예술·스포츠', ['유원지·오락', '스포츠 서비스', '도서관·사적지']],
    ['교육', ['기타 교육', '일반 교육', '교육 지원', '']], ['숙박', ['일반 숙박', '기타 숙박']],
    ['과학·기술', ['전문 디자인', '광고', '본사·경영 컨설팅', '기술 서비스', '사진 촬영', '인쇄·제품제작', '법무관련', '회계·세무', '수의', '기타 전문 과학', '시장 조사', '']],
    ['시설관리·임대', ['청소·방제', '고용 알선', '여행사·보조', '기타 사업 서비스', '가정용품 대여', '시설관리', '산업용품 대여', '운송장비 대여', '사무 지원', '조경·유지']],
    ['', ['']],
  ],
};
const store = (categoryMajor: string | null, categoryMid: string | null) => ({ categoryMajor, categoryMid });

describe('marketStoreType', () => {
  it('keeps nine types in colour-token order', () => {
    expect(MARKET_STORE_TYPES.map((type) => type.key)).toEqual(['food', 'snack', 'cafe', 'grocery', 'fashion', 'goods', 'living', 'health', 'etc']);
    expect(marketStoreTypeColor('food')).toBe('var(--market-type-1)');
    expect(marketStoreTypeColor('etc')).toBe('var(--market-type-9)');
  });

  it('maps every production (major, mid) pair to its type', () => {
    const rows = (Object.keys(TABLE) as MarketStoreTypeKey[]).flatMap((key) => TABLE[key].flatMap(([major, mids]) => mids.map((mid) => ({ key, major, mid }))));
    expect(rows.length).toBe(80);
    for (const { key, major, mid } of rows) expect({ major, mid, type: marketStoreType(store(major, mid)) }).toEqual({ major, mid, type: key });
  });

  it('trims source whitespace and sends unknown or missing categories to etc', () => {
    expect(marketStoreType(store('음식', '비알코올 '))).toBe('cafe');
    expect(marketStoreType(store('수리·개인', '장례식장 '))).toBe('etc');
    expect(marketStoreType(store('과학·기술 ', '법무관련 '))).toBe('etc');
    expect(marketStoreType(store(null, null))).toBe('etc');
    expect(marketStoreType(store(' ', '한식'))).toBe('etc');
    expect(marketStoreType(store('음식', null))).toBe('food');
    expect(marketStoreType(store('소매', null))).toBe('living');
    expect(marketStoreType(store('보건의료', ' '))).toBe('etc');
    expect(marketStoreType(store('수리·개인', ' '))).toBe('etc');
    expect(marketStoreType(store('소매', '한식'))).toBe('etc');
    expect(marketStoreType(store(' 음식 ', ' 비알코올 '))).toBe('cafe');
    expect(marketStoreType(store('음식', '새로 생긴 중분류'))).toBe('etc');
    expect(marketStoreType(store('보건의료', '새 중분류'))).toBe('health');
  });

  it('counts only present types, most first, with etc always last', () => {
    const stores = [
      ...Array(3).fill(store('소매', '섬유·의복·신발 소매')), ...Array(2).fill(store('음식', '한식')),
      ...Array(5).fill(store(null, null)), store('소매', '식료품 소매'),
    ];
    expect(marketStoreTypeCounts(stores).map((type) => [type.key, type.count])).toEqual([['fashion', 3], ['food', 2], ['grocery', 1], ['etc', 5]]);
    expect(marketStoreTypeCounts([])).toEqual([]);
    const ties = [store('소매', '식료품 소매'), store('음식', '한식'), store('음식', '주점')];
    const before = JSON.stringify(ties);
    expect(marketStoreTypeCounts(ties).map(type => type.key)).toEqual(['food', 'cafe', 'grocery']);
    expect(JSON.stringify(ties)).toBe(before);
  });

  it('picks the majority type and breaks ties by type order', () => {
    expect(majorityMarketStoreType([store('음식', '한식'), store('음식', '주점'), store('음식', '주점')])).toBe('cafe');
    expect(majorityMarketStoreType([store('음식', '주점'), store('음식', '한식')])).toBe('food');
    expect(majorityMarketStoreType([store(null, null), store('', '')])).toBe('etc');
  });
});
