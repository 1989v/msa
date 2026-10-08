import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { fetchSharedCollection } from '../../api/wishlistApi';
import { useHeritageSurface } from '../../hooks/useHeritageSurface';
import { useSeo } from '../../seo/useSeo';
import FavoriteButton from './FavoriteButton';
import FavoriteCardItem from './FavoriteCardItem';
import { hydrate, type HydratedCard } from './favoriteCards';
import { useResumeFavoriteIntent } from './useResumeFavoriteIntent';
import Footer from '../Footer';
import './FavoritesPage.css';

/** 서버 토큰 형식 — 아니면 묻지 않는다. 짧은 주소가 형식 밖 토큰을 `/shared/invalid` 로 보낸다 (ADR-0107 §5) */
const TOKEN_PATTERN = /^[A-Za-z0-9]{10}$/;

type Loaded =
  | { kind: 'gone' }
  | { kind: 'ok'; name: string; cards: HydratedCard[]; truncated: boolean };

async function loadShared(token: string): Promise<Loaded> {
  if (!TOKEN_PATTERN.test(token)) return { kind: 'gone' };
  const shared = await fetchSharedCollection(token);
  if (!shared) return { kind: 'gone' };
  const hydrated = await Promise.all(shared.items.map((item) => hydrate('ATTRACTION', item.targetKey)));
  return {
    kind: 'ok',
    name: shared.name,
    cards: hydrated.filter((card): card is HydratedCard => card !== null),
    truncated: shared.truncated,
  };
}

/**
 * 공유받은 여행 묶음 (ADR-0107) — 로그인 없이 토큰으로 연다.
 *
 * 각 카드의 별은 **보는 사람 자신의 찜**이다(로그인 전용 그대로). 게스트가 별을 누르고 로그인해 돌아오면
 * 의도 훅이 마저 찜한다. 계측은 하지 않는다 — 토큰 경로가 원장·외부 리포트에 남지 않게(GA 도 index.html 이
 * 이 경로에서 싣지 않는다). 묶음 이름은 남이 쓴 글자라 텍스트로만 그린다.
 */
export default function SharedCollectionPage() {
  useHeritageSurface();
  const { token = '' } = useParams<{ token: string }>();
  const resumeNotice = useResumeFavoriteIntent();
  const shared = useQuery({ queryKey: ['shared-collection', token], queryFn: () => loadShared(token) });

  useSeo({ title: '공유받은 여행 묶음', noindex: true });

  const data = shared.data;

  return (
    <div className="favorites-page">
      <header className="favorites-head kh-section-head">
        <h1 className="favorites-title">{data?.kind === 'ok' ? data.name : '공유받은 여행 묶음'}</h1>
      </header>

      {shared.isLoading && <p className="favorites-status">불러오는 중…</p>}

      {shared.isError && (
        <p className="favorites-status">묶음을 불러오지 못했습니다 — 잠시 후 다시 시도해 주세요.</p>
      )}

      {data?.kind === 'gone' && (
        <p className="favorites-status">찾을 수 없거나 만료된 링크입니다. 보낸 사람에게 새 링크를 받아 주세요.</p>
      )}

      {data?.kind === 'ok' && data.cards.length === 0 && (
        <p className="favorites-status">이 묶음에 담긴 관광지가 없습니다.</p>
      )}

      {data?.kind === 'ok' && data.cards.length > 0 && (
        <ul className="favorites-grid">
          {data.cards.map((card) => (
            <FavoriteCardItem key={card.targetKey} card={card}>
              <FavoriteButton type="ATTRACTION" targetKey={card.targetKey} compact />
            </FavoriteCardItem>
          ))}
        </ul>
      )}

      {data?.kind === 'ok' && data.truncated && (
        <p className="favorites-note kh-mono">관광지가 많아 100곳까지만 보입니다.</p>
      )}

      {resumeNotice && (
        <p className="favorite-resume-notice" role="status">
          {resumeNotice}
        </p>
      )}

      <Footer />
    </div>
  );
}
