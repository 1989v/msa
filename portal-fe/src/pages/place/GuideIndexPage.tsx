import { Link } from 'react-router-dom';
import Footer from '../../components/Footer';
import { useHeritageSurface } from '../../hooks/useHeritageSurface';
import { GUIDE_INDEX_META, guidePath, guideUrl, placePath } from '../../seo/copy.mjs';
import { useSeo } from '../../seo/useSeo';
import NotFoundPage from '../NotFoundPage';
import { GUIDES } from './guides';
import './PlacePage.css';
import './GuidePage.css';

/** 편집 페이지 목록 `/guides` — published 만. 0장이면 없는 주소다(nginx 도 파일이 없어 404) */
export default function GuideIndexPage() {
  const listed = Object.values(GUIDES)
    .filter((g) => g.status === 'published')
    .sort((a, b) => a.slug.localeCompare(b.slug));
  if (listed.length === 0) return <NotFoundPage />;
  return <GuideIndex listed={listed} />;
}

function GuideIndex({ listed }: { listed: ReadonlyArray<(typeof GUIDES)[string]> }) {
  useHeritageSurface();
  useSeo({ title: GUIDE_INDEX_META.title, description: GUIDE_INDEX_META.description, canonical: guideUrl(), lang: 'ko' });
  return (
    <div className="place-page">
      <header className="place-header">
        <nav aria-label="탐색 경로" className="place-region-crumbs">
          <Link className="place-btn" to={placePath('ko')}>
            한국 관광지 탐색
          </Link>
        </nav>
      </header>
      <main className="guide-main">
        <h1 className="place-detail-title">{GUIDE_INDEX_META.heading}</h1>
        <ul className="guide-list">
          {listed.map((g) => (
            <li key={g.slug}>
              <Link to={guidePath(g.slug)}>{g.title}</Link>
              <p>{g.description}</p>
            </li>
          ))}
        </ul>
      </main>
      <Footer lang="ko" />
    </div>
  );
}
