import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { addFavorite, fetchFavoriteKeys } from '../../api/wishlistApi';
import { track } from '../../analytics/tracker';
import { isLoggedIn } from '../../auth/auth';
import { clearFavoriteIntent, readFavoriteIntent } from './favoriteIntent';
import { favoriteKeysQueryKey, type FavoriteTracking } from './useFavorites';
import type { FavoriteLang } from './FavoriteButton';

const NOTICE: Record<FavoriteLang, string> = { ko: '찜했습니다', en: 'Saved' };
const NOTICE_MS = 3000;

/**
 * 로그인 복귀의 찜 완료 — 화면(페이지)마다 한 번 둔다. 별마다 두면 별 수만큼 PUT 이 나간다.
 *
 * 의도를 읽고 지우는 것은 첫 await 전에 동기로 한다 — StrictMode 이중 마운트의 둘째 effect 는 빈 저장소를
 * 보므로 PUT 은 한 번이다. 비로그인 마운트는 의도를 건드리지 않는다(10분 무효가 정리한다).
 * `/keys` 가 성공한 뒤에만 판단하고, 이미 찜이면 아무것도 하지 않는다. 없으면 토글이 아니라 추가를 직접 부른다 —
 * 토글은 캐시를 보고 방향을 정해서, 하이드레이션 전이면 해제로 뒤집힐 수 있다.
 *
 * @returns 화면이 띄울 알림 문구(성공 뒤 잠깐). 실패는 알리지 않는다.
 */
export function useResumeFavoriteIntent(tracking?: FavoriteTracking, lang: FavoriteLang = 'ko'): string | null {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);
  // 계측은 성공 시점의 화면 한 벌을 쓴다 — 허브는 질의가 바뀔 때마다 viewId 가 바뀐다
  const trackingRef = useRef(tracking);
  const langRef = useRef(lang);
  useEffect(() => {
    trackingRef.current = tracking;
    langRef.current = lang;
  });

  useEffect(() => {
    if (!isLoggedIn()) return;
    const intent = readFavoriteIntent();
    clearFavoriteIntent();
    if (!intent) return;
    const { targetKey } = intent;
    const queryKey = favoriteKeysQueryKey('ATTRACTION');
    // 언마운트로 끊지 않는다 — StrictMode 의 가짜 언마운트에서 끊으면 둘째 마운트는 의도가 없어 아무도 PUT 하지 않는다
    void (async () => {
      try {
        const keys = await queryClient.fetchQuery({
          queryKey,
          queryFn: () => fetchFavoriteKeys('ATTRACTION'),
          staleTime: 60 * 1000,
        });
        if (keys.includes(targetKey)) return;
        await addFavorite('ATTRACTION', targetKey);
      } catch (err) {
        console.warn('찜 이어 하기 실패', err);
        return;
      }
      queryClient.setQueryData<string[]>(queryKey, (old = []) => (old.includes(targetKey) ? old : [...old, targetKey]));
      void queryClient.invalidateQueries({ queryKey: ['favorites'] });
      setNotice(NOTICE[langRef.current]);
      const t = trackingRef.current;
      if (t) {
        track(
          'CLICK',
          {
            entityType: 'ATTRACTION',
            entityId: targetKey,
            screenType: t.screenType,
            screenRef: t.screenRef,
            sectionId: 'FAVORITE',
            payload: { saved: true, resumed: true },
          },
          t.viewId,
        );
      }
    })();
  }, [queryClient]);

  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(null), NOTICE_MS);
    return () => window.clearTimeout(id);
  }, [notice]);

  return notice;
}
