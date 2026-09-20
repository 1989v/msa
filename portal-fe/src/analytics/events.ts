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
export type EventAction = 'IMPRESSION' | 'CLICK' | 'SEARCH';

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
  /** 통합 검색의 타입 묶음. 어느 타입인지는 `entityType`, 묶음 순서는 `sectionIndex` 가 갖는다 */
  | 'SEARCH_GROUP';

export interface TrackedItem {
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

export interface TrackedEvent extends TrackedItem {
  action: EventAction;
  viewId: string;
  occurredAt: number;
}
