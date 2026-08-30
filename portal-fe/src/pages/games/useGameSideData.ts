import { useEffect, useState } from 'react';
import { fetchFavoriteCount, fetchMyGameRecord, fetchReleaseNotes,
         type MyGameRecord, type ReleaseNote } from '../../api/gameApi';
import { isLoggedIn } from '../../auth/auth';

/** 내 기록·찜 수를 한 번만 읽어 페이지가 나눠 쓴다 */
export function useGameSideData(slug: string, boardToken: number) {
  const [me, setMe] = useState<MyGameRecord | null>(null);
  const [favorites, setFavorites] = useState<number | null>(null);
  const [notes, setNotes] = useState<ReleaseNote[]>([]);
  const loggedIn = isLoggedIn();

  useEffect(() => {
    let alive = true;
    fetchFavoriteCount(slug).then((n) => alive && setFavorites(n));
    // 게임을 옮기면 먼저 비운다 — 안 그러면 새 게임 화면에 앞 게임의 노트가 잠깐 남는다
    setNotes([]);
    fetchReleaseNotes(slug).then((n) => alive && setNotes(n));
    // 내 기록은 로그인 상태에서만 부른다 — 게스트에게는 401 이 정상이라 요청 자체를 안 한다
    if (loggedIn) fetchMyGameRecord(slug).then((r) => alive && setMe(r)).catch(() => undefined);
    return () => {
      alive = false;
    };
    // 플레이가 끝나면 boardToken 이 바뀐다 — 그때 내 기록도 다시 읽는다
  }, [slug, loggedIn, boardToken]);

  return { me, favorites, notes, loggedIn };
}
