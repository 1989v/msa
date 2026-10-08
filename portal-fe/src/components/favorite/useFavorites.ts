import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addFavorite, fetchFavoriteKeys, removeFavorite, type FavoriteTargetType } from '../../api/wishlistApi';
import type { ScreenType } from '../../analytics/events';
import { track } from '../../analytics/tracker';
import { isLoggedIn } from '../../auth/auth';

/** 쿼리 키 — FavoritesPage 의 목록 무효화와 공유한다 */
export const favoriteKeysQueryKey = (type: FavoriteTargetType) => ['favorites', 'keys', type] as const;

/** 찜 완료를 원장에 남길 화면 — 호출처가 주지 않으면 계측하지 않는다. */
export type FavoriteTracking = { screenType: ScreenType; screenRef?: string; viewId: string };

/**
 * 타입 하나의 내 찜 키 집합 + 낙관적 토글 (ADR-0074 §5).
 *
 * `/keys` 쿼리 하나로 그 타입의 목록 화면 전체(카드 수십 장)가 하이드레이션된다 —
 * 카드마다 exists 를 묻지 않는다. 토글은 캐시를 먼저 뒤집고 실패 시 되돌린다.
 *
 * 계측(CLICK/FAVORITE)은 서버 성공 뒤에만 — 낙관 반전·롤백은 보내지 않는다. 훅 안의 `onSuccess` 에
 * 두는 이유: 호출별 콜백은 언마운트 뒤 불리지 않는다. 관광지(`ATTRACTION`)만 남긴다.
 */
export function useFavorites(type: FavoriteTargetType, tracking?: FavoriteTracking) {
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
    // 요청 종류가 `saved` 를 정한다 — 낙관 반전 뒤의 캐시를 다시 읽지 않는다
    mutationFn: async (targetKey: string): Promise<{ saved: boolean }> => {
      if (keys.has(targetKey)) {
        await removeFavorite(type, targetKey);
        return { saved: false };
      }
      await addFavorite(type, targetKey);
      return { saved: true };
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
    onSuccess: (result, targetKey) => {
      if (!tracking || type !== 'ATTRACTION') return;
      track(
        'CLICK',
        {
          entityType: 'ATTRACTION',
          entityId: targetKey,
          screenType: tracking.screenType,
          screenRef: tracking.screenRef,
          sectionId: 'FAVORITE',
          payload: { saved: result.saved },
        },
        tracking.viewId,
      );
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
