/** 이벤트 모델 — 서버의 `EntityType`/`EventAction` 과 문자열이 같아야 한다 (ADR-0095). */

export type EntityType =
  | 'ATTRACTION'
  | 'PRODUCT'
  | 'POST'
  | 'GAME'
  | 'PAGE'
  | 'SEARCH'
  | 'CONCEPT'
  | 'DEAL_OFFER'
  | 'SERVICE';
export type EventAction = 'IMPRESSION' | 'CLICK' | 'SEARCH' | 'SESSION_START';

/** 화면 종류 — 화면마다 고유한 상수. 새 화면을 붙이면 여기에 추가한다. */
export type ScreenType =
  | 'PLACE_HUB'
  | 'PLACE_REGION'
  | 'ATTRACTION_DETAIL'
  | 'UNIFIED_SEARCH';

/** 섹션 고유 id — 같은 화면 안에서 유일해야 한다. */
export type SectionId =
  | 'ATTRACTION_LIST'
  | 'NEARBY_ATTRACTIONS'
  | 'AMENITY_CAROUSEL'
  /** 관광지 상세 — 같은 시군구·유형·분류의 가까운 곳 (색인이 미리 계산해 둔 목록) */
  | 'SAME_CATEGORY_NEARBY'
  /** 관광지 상세 — 다른 시도의 비슷한 곳 (오프라인 임베딩 유사도, 색인이 싣는 목록) */
  | 'SIMILAR_ELSEWHERE'
  /** 관광지 상세 — 여기 온 사람들이 함께 간 곳 (관광공사 연관 관광지 중 우리 관광지로 이어진 것, 색인이 싣는 목록) */
  | 'RELATED_PLACES'
  /** 관광지 상세 — 반경 안 끝나지 않은 행사 (화면이 검색 API 로 그린다) */
  | 'NEARBY_EVENTS'
  /** 관광지 상세 — 반경 안 숙박. 편의시설 캐로셀에서 옮겨 온 몫이다 */
  | 'NEARBY_STAYS'
  /** 지역 허브 — 그 지역의 이번 달 행사 */
  | 'REGION_EVENTS_THIS_MONTH'
  /** 통합 검색의 타입 묶음. 어느 타입인지는 `entityType`, 묶음 순서는 `sectionIndex` 가 갖는다 */
  | 'SEARCH_GROUP'
  /**
   * 선택 뒤 후속 행동 — 관심 신호가 아니라 인기 집계에서 뺀다. 노출을 보내지 않는다.
   * 서버 `AggregateAttractionPopularityUseCase.POST_SELECTION_SECTIONS` 와 한 몸
   */
  | 'MAP_LINK'
  | 'FAVORITE'
  /** 지도 레이어 핀 — 노출 없는 클릭, 인기 집계 포함 */
  | 'MAP_OVERLAY';

/** 화면 안 어느 섹션에 놓인 대상 — 섹션을 빠뜨리면 컴파일이 막는다. */
export interface PlacedItem {
  entityType: EntityType;
  entityId: string;
  screenType: ScreenType;
  /** 그 화면의 주체. 상세면 그 관광지 id. */
  screenRef?: string;
  sectionId: SectionId;
  /** 화면 안 섹션 순서 — 배치가 바뀌어도 그때 값이 남아야 비교가 된다. */
  sectionIndex?: number;
  /** 섹션 안 순서. 캐로셀 내 위치를 포함한다. */
  itemIndex?: number;
  /**
   * 행마다 다른 부속 값. 컬럼으로 펴지 않는 것만 넣는다 — 통합 검색의 「이해된 타입」·묶음별 건수처럼
   * 대상마다 모양이 달라 정규 컬럼으로는 nullable 만 늘어나는 값 (ADR-0095 · ranking `payload` 와 같은 선택).
   */
  payload?: Record<string, unknown>;
}

/** 화면 그 자체가 대상 — 세션 시작처럼 섹션이 없다. 섹션 키를 주면 컴파일이 막는다. */
export interface PageItem {
  entityType: 'PAGE';
  entityId: string;
  screenType: ScreenType;
  screenRef?: string;
  sectionId?: never;
  sectionIndex?: never;
  itemIndex?: never;
  payload?: Record<string, unknown>;
}

export type TrackedItem = PlacedItem | PageItem;

export type TrackedEvent = TrackedItem & {
  action: EventAction;
  viewId: string;
  occurredAt: number;
};
