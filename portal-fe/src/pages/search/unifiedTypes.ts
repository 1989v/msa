import type { UnifiedType } from '../../api/searchApi';
import type { EntityType } from '../../analytics/events';

/** 칩·묶음 제목의 표기. 순서는 사용자가 찾는 빈도 순 — 관광지가 코퍼스의 99% 다 */
export const TYPE_ORDER: UnifiedType[] = ['attraction', 'blog_post', 'game', 'concept', 'deal_offer', 'product', 'service'];

/** 검색 타입 → 노출·클릭 원장의 대상 (ADR-0095). 둘은 이름이 달라 매핑을 데이터로 둔다 */
export const TYPE_ENTITY: Record<UnifiedType, EntityType> = {
  attraction: 'ATTRACTION',
  blog_post: 'POST',
  game: 'GAME',
  concept: 'CONCEPT',
  deal_offer: 'DEAL_OFFER',
  product: 'PRODUCT',
  service: 'SERVICE',
};

export const TYPE_LABELS: Record<UnifiedType, string> = {
  attraction: '관광지',
  blog_post: '블로그 글',
  game: '게임',
  concept: '개념',
  deal_offer: '혜택',
  product: '상품',
  service: '서비스',
};
