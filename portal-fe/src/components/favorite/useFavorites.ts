import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addFavorite, fetchFavoriteKeys, removeFavorite, type FavoriteTargetType } from '../../api/wishlistApi';
import { isLoggedIn } from '../../auth/auth';

/** 쿼리 키 — FavoritesPage 의 목록 무효화와 공유한다 */
export const favoriteKeysQueryKey = (type: FavoriteTargetType) => ['favorites', 'keys', type] as const;

/**
 * 타입 하나의 내 찜 키 집합 + 낙관적 토글 (ADR-0074 §5).
 *
 * `/keys` 쿼리 하나로 그 타입의 목록 화면 전체(카드 수십 장)가 하이드레이션된다 —
 * 카드마다 exists 를 묻지 않는다. 토글은 캐시를 먼저 뒤집고 실패 시 되돌린다.
 */
export function useFavorites(type: FavoriteTargetType) {
  const queryClient = useQueryClient();
  const loggedIn = isLoggedIn();
  const queryKey = favoriteKeysQueryKey(type);

  const keysQuery = useQuery({
    queryKey,
    queryFn: () => fetchFavoriteKeys(type),
    enabled: loggedIn,
    staleTime: 60 * 1000,
  });

  const keys = new Set(keysQuery.data ?? []);

  const toggleMutation = useMutation({
    mutationFn: async (targetKey: string) => {
      if (keys.has(targetKey)) await removeFavorite(type, targetKey);
      else await addFavorite(type, targetKey);
    },
    onMutate: async (targetKey: string) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<string[]>(queryKey);
      queryClient.setQueryData<string[]>(queryKey, (old = []) =>
        old.includes(targetKey) ? old.filter((k) => k !== targetKey) : [...old, targetKey],
      );
      return { previous };
    },
    onError: (_err, _targetKey, context) => {
      // 롤백 — 실패한 찜이 찜된 것처럼 남으면 모아보기에서 배신당한다
      if (context?.previous !== undefined) queryClient.setQueryData(queryKey, context.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['favorites'] });
    },
  });

  return {
    loggedIn,
    isFavorite: (targetKey: string) => keys.has(targetKey),
    toggle: (targetKey: string) => toggleMutation.mutate(targetKey),
    isToggling: toggleMutation.isPending,
  };
}
