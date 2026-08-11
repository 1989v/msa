import { useEffect, useState } from 'react';
import GNB from '../components/GNB';
import Footer from '../components/Footer';
import AboutSection from '../components/AboutSection';
import TileGrid from '../components/home/TileGrid';
import PortfolioTimeline from '../components/home/PortfolioTimeline';
import {
  fetchPortalTiles,
  fetchPortfolioTimeline,
  type PortalTile,
  type PortfolioTimeline as Timeline,
} from '../api/portalApi';
import { portalTitle, portalUrl, websiteJsonLd } from '../seo/copy.mjs';
import { useSeo } from '../seo/useSeo';
import '../components/home/Home.css';

const GNB_ITEMS = [
  { label: '서비스', anchor: 'services' },
  { label: '지나온 것', anchor: 'portfolio' },
  { label: 'About', anchor: 'about' },
];

/**
 * 1989v.com 메인 — 브랜드 + 서비스 런처 (ADR-0066).
 *
 * 시각화·개념 사전은 여기 없다. IT 타일이 받는 `/tech` 로 옮겼다.
 */
export default function HomePage() {
  useSeo({
    title: portalTitle(''),
    description:
      '직접 설계하고 운영 중인 서비스들 — 한국 관광 검색, 웹 게임 플랫폼, 코드 개념 사전, 커머스 데모. 백엔드 엔지니어 권기덕이 만들고 운영합니다.',
    canonical: portalUrl('/'),
    jsonLd: [websiteJsonLd()],
  });

  const [tiles, setTiles] = useState<PortalTile[] | null>(null);
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetchPortalTiles()
      .then((data) => {
        if (!cancelled) setTiles(data);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    // 타임라인은 보조 정보다 — 실패해도 서비스 진입은 막지 않는다.
    fetchPortfolioTimeline()
      .then((data) => {
        if (!cancelled) setTimeline(data);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="home-page">
      <GNB items={GNB_ITEMS} />

      <header className="home-hero">
        <div className="home-inner">
          <h1 className="home-hero-brand">1989v</h1>
          <p className="home-hero-lead">
            서비스를 처음부터 끝까지 만듭니다. 도메인을 쪼개고, 검색과 데이터를 붙이고,
            무료 티어 한 대 위에서 굴러가게 하는 데까지.
          </p>
          {timeline && (
            <p className="home-hero-meta">
              백엔드 엔지니어 · {timeline.career.yearsInField}년차
            </p>
          )}
        </div>
      </header>

      {tiles && <TileGrid tiles={tiles} />}

      {!tiles && (
        <div className="home-inner">
          <p className="home-status">
            {failed
              ? '서비스 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'
              : '불러오는 중…'}
          </p>
        </div>
      )}

      {timeline && <PortfolioTimeline timeline={timeline} />}

      <AboutSection />

      <Footer />
    </div>
  );
}
