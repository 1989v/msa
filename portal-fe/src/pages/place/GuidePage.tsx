import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { fetchAttraction } from '../../api/placeApi';
import Footer from '../../components/Footer';
import { useHeritageSurface } from '../../hooks/useHeritageSurface';
import {
  GUIDE_DRAFT_BAND,
  GUIDE_INDEX_META,
  attractionPath,
  guideCard,
  guideCardAsOf,
  guideMeta,
  guidePath,
  guideUrl,
  kstDate,
  placePath,
} from '../../seo/copy.mjs';
import { useSeo } from '../../seo/useSeo';
import NotFoundPage from '../NotFoundPage';
import { GUIDES, type Guide } from './guides';
import './PlacePage.css';
import './GuidePage.css';

/**
 * 편집 페이지 `/guides/{slug}` — 레포 원본(src/content/guides)을 빌드 때 구운 JSON 의 `parts` 를 그린다.
 * 나누기는 render-content 가 했다. html 조각만 innerHTML 로 넣고, 카드는 상세 API 응답을 React 텍스트로 그린다 —
 * API 문자열을 HTML 문자열에 잇지 않는다. draft 는 주소로 열리되 noindex·「검수 전 초안」 띠.
 */
export default function GuidePage() {
  const { slug = '' } = useParams();
  const guide = GUIDES[slug];
  if (!guide) return <NotFoundPage />;
  return <GuideView key={slug} guide={guide} />;
}

function GuideView({ guide }: { guide: Guide }) {
  useHeritageSurface();
  const published = guide.status === 'published';
  const meta = guideMeta(guide);
  useSeo({ title: meta.title, description: meta.description, canonical: guideUrl(guide.slug), lang: 'ko', noindex: !published });

  return (
    <div className="place-page">
      <header className="place-header">
        <nav aria-label="탐색 경로" className="place-region-crumbs">
          <Link className="place-btn" to={placePath('ko')}>
            한국 관광지 탐색
          </Link>
          {published && (
            <Link className="place-btn" to={guidePath()}>
              {GUIDE_INDEX_META.heading}
            </Link>
          )}
        </nav>
      </header>
      <main className="guide-main">
        {!published && (
          <p className="guide-draft" role="note">
            <strong>{GUIDE_DRAFT_BAND}</strong>
          </p>
        )}
        <h1 className="place-detail-title">{meta.heading}</h1>
        <p className="guide-asof">{guideCardAsOf(kstDate())}</p>
        <article className="guide-doc">
          {guide.parts.map((part, i) =>
            'html' in part ? (
              // 레포에 커밋된 md 에서만 나오고 render-content 의 출력 계약 검사를 통과한 빌드 산출물이다
              <div key={i} dangerouslySetInnerHTML={{ __html: part.html }} />
            ) : (
              <GuideCard key={i} id={part.cardId} />
            ),
          )}
        </article>
      </main>
      <Footer lang="ko" />
    </div>
  );
}

/** 관광지 카드 — 조회 실패·404 면 그리지 않는다(빌드는 published 404 를 이미 세운다) */
function GuideCard({ id }: { id: string }) {
  const { data } = useQuery({ queryKey: ['attraction', id], queryFn: () => fetchAttraction(id) });
  if (!data) return null;
  const card = guideCard(data);
  return (
    <section className="guide-card" data-guide-card-id={card.id}>
      <h3>
        <Link to={attractionPath('ko', card.id)}>{card.name}</Link>
      </h3>
      {card.address && <p className="guide-card-address">{card.address}</p>}
      <dl>
        {card.rows.map((r) => (
          <div key={r.label}>
            <dt>{r.label}</dt>
            <dd>{r.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
