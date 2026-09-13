import type { UnifiedType } from '../../api/searchApi';

/** 칩·묶음 제목의 표기. 순서는 사용자가 찾는 빈도 순 — 관광지가 코퍼스의 99% 다 */
export const TYPE_ORDER: UnifiedType[] = ['attraction', 'blog_post', 'game', 'concept', 'deal_offer', 'product', 'service'];

export const TYPE_LABELS: Record<UnifiedType, string> = {
  attraction: '관광지',
  blog_post: '블로그 글',
  game: '게임',
  concept: '개념',
  deal_offer: '혜택',
  product: '상품',
  service: '서비스',
};
