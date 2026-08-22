import { useQuery } from '@tanstack/react-query';
import { fetchCollections } from '../../api/wishlistApi';

/** `전체` / `미분류` / 특정 묶음 — 셋을 한 값으로 다루면 '지정 안 함'과 '미분류'가 섞인다 */
export type CollectionFilter = { kind: 'all' } | { kind: 'unclassified' } | { kind: 'one'; id: number };

/**
 * 내 여행 묶음 (ADR-0080).
 *
 * 컴포넌트 파일에서 뺀 이유는 lint 규칙(react-refresh/only-export-components)이다 —
 * 한 파일이 컴포넌트와 훅·타입을 함께 내보내면 fast refresh 가 깨진다.
 */
export function useCollections(enabled: boolean) {
  return useQuery({
    queryKey: ['favorites', 'collections'],
    queryFn: fetchCollections,
    enabled,
  });
}
