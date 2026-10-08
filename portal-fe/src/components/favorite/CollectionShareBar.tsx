import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createCollectionShare,
  fetchCollectionShare,
  revokeCollectionShare,
  type CollectionShareState,
  type FavoriteCollection,
} from '../../api/wishlistApi';
import SharePanel, { type ShareChannel } from '../share/SharePanel';
import './FavoriteCollections.css';

/** 비공개 묶음은 1:1 채널만 — X·LinkedIn 은 토큰과 묶음 이름을 공개 게시물로 만든다 (ADR-0107 §7) */
const COLLECTION_CHANNELS: ReadonlyArray<ShareChannel> = ['copy', 'share'];

const LABELS = {
  ko: { create: '공유 링크 만들기', revoke: '공유 중단', until: (d: string) => `${d}까지 열림`, forever: '기한 없음' },
  en: { create: 'Create share link', revoke: 'Stop sharing', until: (d: string) => `Open until ${d}`, forever: 'No expiry' },
} as const;

function formatDate(iso: string, lang: 'ko' | 'en'): string {
  return new Date(iso).toLocaleDateString(lang === 'en' ? 'en-US' : 'ko-KR', { timeZone: 'Asia/Seoul' });
}

/**
 * 선택한 여행 묶음의 공유 막대 (ADR-0107). 묶음 칩을 골랐을 때만 그려지고, 그때만 공유 상태를 묻는다.
 *
 * FE 에는 기능 플래그가 없다 — 서버가 404 를 주면(설정 꺼짐) 막대를 숨긴다. 5xx·네트워크 오류도 숨긴다.
 */
export default function CollectionShareBar({
  collection,
  lang,
  onShare,
}: {
  collection: FavoriteCollection;
  lang: 'ko' | 'en';
  /** 복사·Web Share 를 누를 때 — 링크 만들기는 부르지 않는다 */
  onShare?: (channel: ShareChannel) => void;
}) {
  const L = LABELS[lang];
  const qc = useQueryClient();
  const queryKey = ['favorites', 'share', collection.id];
  const state = useQuery({ queryKey, queryFn: () => fetchCollectionShare(collection.id) });

  const setLink = (link: CollectionShareState & { available: true }) => qc.setQueryData(queryKey, link);

  const create = useMutation({
    mutationFn: () => createCollectionShare(collection.id),
    onSuccess: (link) => setLink({ available: true, link }),
  });
  const revoke = useMutation({
    mutationFn: () => revokeCollectionShare(collection.id),
    onSuccess: () => setLink({ available: true, link: null }),
  });

  if (!state.data || !state.data.available) return null;
  const { link } = state.data;

  return (
    <div className="collection-share">
      {link ? (
        <>
          <SharePanel shortUrl={link.url} title={collection.name} lang={lang} channels={COLLECTION_CHANNELS} onShare={onShare} />
          <span className="collection-share__expiry kh-mono">
            {link.expiresAt ? L.until(formatDate(link.expiresAt, lang)) : L.forever}
          </span>
          <button
            type="button"
            className="collection-action collection-action--danger"
            disabled={revoke.isPending}
            onClick={() => revoke.mutate()}
          >
            {L.revoke}
          </button>
        </>
      ) : (
        <button
          type="button"
          className="collection-action"
          disabled={create.isPending}
          onClick={() => create.mutate()}
        >
          {L.create}
        </button>
      )}
    </div>
  );
}
