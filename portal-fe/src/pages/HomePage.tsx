import { useEffect, useState } from 'react';
import GNB from '../components/GNB';
import Footer from '../components/Footer';
import AboutSection from '../components/AboutSection';
import TileGrid from '../components/home/TileGrid';
import PortfolioTimeline from '../components/home/PortfolioTimeline';
import {
  fetchDisplayServices,
  fetchPortfolioTimeline,
  type DisplayService,
  type PortfolioTimeline as Timeline,
} from '../api/displayApi';
import { portalTitle, portalUrl, websiteJsonLd } from '../seo/copy.mjs';
import { useSeo } from '../seo/useSeo';
import { useHeritageSurface } from '../hooks/useHeritageSurface';
import { useReveal } from '../hooks/useReveal';
import InkWash from '../components/brand/InkWash';
import '../components/home/Home.css';

/** About 은 데이터가 없어도 항상 렌더된다 */
const ABOUT_ITEM = { label: 'About', anchor: 'about' };

/**
 * 1989v.com 메인 — 브랜드 + 서비스 런처 (ADR-0066).
 *
 * 시각화·개념 사전은 여기 없다. IT 타일이 받는 `/tech` 로 옮겼다.
 */
export default function HomePage() {
  useHeritageSurface();
  const reveal = useReveal();
  useSeo({
    title: portalTitle(''),
    description:
      '직접 설계하고 운영 중인 서비스들 — 한국 관광 검색, 웹 게임 플랫폼, 코드 개념 사전, 커머스 데모. 백엔드 엔지니어 권기덕이 만들고 운영합니다.',
    canonical: portalUrl('/'),
    jsonLd: [websiteJsonLd()],
  });

  const [services, setServices] = useState<DisplayService[] | null>(null);
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetchDisplayServices()
      .then((data) => {
        if (!cancelled) setServices(data);
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

  // 실제로 렌더된 섹션만 메뉴에 올린다 — 데이터가 비면 섹션이 통째로 빠지므로,
  // 고정 메뉴를 두면 눌러도 아무 일이 없는 항목이 남는다.
  const hasTimeline = Boolean(
    timeline && (timeline.companies.length > 0 || timeline.projects.length > 0),
  );
  const gnbItems = [
    ...(services && services.length > 0 ? [{ label: '서비스', anchor: 'services' }] : []),
    ...(hasTimeline ? [{ label: '지나온 것', anchor: 'portfolio' }] : []),
    ABOUT_ITEM,
  ];

  return (
    <div className="home-page">
      <GNB items={gnbItems} />

      <header className="home-hero" ref={reveal}>
        <InkWash />
        <div className="home-inner home-hero-grid">
          <div className="home-hero-copy kh-stagger">
            <span className="kh-seal kh-seal-ink kh-stamp home-hero-eyebrow">
              <span className="kh-seal-dot" aria-hidden="true" />
              Systems Architect
            </span>
            <h1 className="kh-display kh-seep home-hero-statement">
              서비스를 처음부터
              <br />
              <span className="kh-display-accent">끝까지</span> 만듭니다.
            </h1>
            <p className="kh-seep home-hero-lead">
              도메인을 쪼개고, 검색과 데이터를 붙이고, 무료 티어 한 대 위에서
              굴러가게 하는 데까지.
            </p>
            <div className="kh-seep home-hero-actions">
              <a className="kh-button" href="#portfolio">
                지나온 것 보기
                <span aria-hidden="true">→</span>
              </a>
              {timeline && (
                <span className="kh-mono home-hero-meta">
                  {timeline.career.yearsInField}년차 · 백엔드
                </span>
              )}
            </div>
          </div>

          {/* 어긋난 판 — 흐린 그림자 대신 물리적 깊이. 장식이라 스크린리더에서 뺀다. */}
          <div className="home-hero-slab kh-slab-offset kh-settle" aria-hidden="true">
            <div className="kh-slab kh-grain home-hero-slab-face">
              <span className="kh-mono home-hero-slab-mark">&lt; / system_core &gt;</span>
            </div>
          </div>
        </div>
      </header>

      {services && <TileGrid services={services} />}

      {!services && (
        <div className="home-inner">
          <p className="kh-status home-status">
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
