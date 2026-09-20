import { describe, expect, it } from 'vitest';
import { TYPE_ENTITY, TYPE_LABELS, TYPE_ORDER } from '../unifiedTypes';

/**
 * 검색 타입과 원장 대상은 이름이 다르고(`blog_post` ↔ `POST`) 서버 enum 이 모르는 값을 받으면
 * 400 이라 조용히 안 쌓인다. 타입을 하나 더 붙일 때 매핑·칩·라벨을 같이 채우게 묶어 둔다.
 */
describe('통합 검색 타입 표', () => {
  it('모든 타입이 칩 순서·라벨·원장 대상을 갖는다', () => {
    const types = Object.keys(TYPE_LABELS) as (keyof typeof TYPE_LABELS)[];
    expect(new Set(TYPE_ORDER)).toEqual(new Set(types));
    for (const t of types) {
      expect(TYPE_ENTITY[t], `${t} 의 원장 대상`).toBeTruthy();
    }
  });

  it('서버 EntityType 이름과 같은 문자열을 쓴다', () => {
    expect(TYPE_ENTITY).toEqual({
      attraction: 'ATTRACTION',
      blog_post: 'POST',
      game: 'GAME',
      concept: 'CONCEPT',
      deal_offer: 'DEAL_OFFER',
      product: 'PRODUCT',
      service: 'SERVICE',
    });
  });
});
