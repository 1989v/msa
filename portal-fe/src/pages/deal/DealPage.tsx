import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchDealSections, type DealOffer, type DealSection } from '../../api/dealApi';
import Footer from '../../components/Footer';
import ThemeToggle from '../../components/ThemeToggle';
import { useHeritageSurface } from '../../hooks/useHeritageSurface';
import { DEAL_AFFILIATE_BADGE, DEAL_DISCLOSURE, dealHubMeta } from '../../seo/copy.mjs';
import { useSeo } from '../../seo/useSeo';
import './DealPage.css';

// ADR-0069 혜택 링크 허브 — deal.<domain> 이 정규 주소 (place/game 과 같은 host 인식 루트 라우팅).
//
// 카드의 링크는 반드시 `/go/{slug}` 를 거친다. 원본 URL 을 화면에 걸면 클릭 계측이 비고
// 링크를 교체해도 이미 공유된 주소가 옛 대상으로 계속 나간다.

const ALL = '__all__';

/** 만료까지 남은 날. 오늘 끝나는 것과 다음 주에 끝나는 것은 다르게 읽혀야 한다. */
function daysLeft(validUntil: string | null): number | null {
  if (!validUntil) return null;
  const diff = new Date(validUntil).getTime() - Date.now();
  return diff <= 0 ? 0 : Math.ceil(diff / 86_400_000);
}

function expiryLabel(validUntil: string | null): string | null {
  const days = daysLeft(validUntil);
  if (days === null) return null;
  if (days === 0) return '오늘 마감';
  if (days <= 7) return `${days}일 남음`;
  return `~ ${new Date(validUntil!).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}`;
}

function OfferCard({ offer }: { offer: DealOffer }) {
  const expiry = expiryLabel(offer.validUntil);
  const urgent = (daysLeft(offer.validUntil) ?? 99) <= 7;

  return (
    <a
      className="deal-card kh-slab kh-slab-offset"
      href={`/go/${offer.slug}`}
      target="_blank"
      // 제휴 링크에만 sponsored 를 붙인다. 수수료를 받지 않는 링크까지 광고로 표시하면
      // 검색엔진에도 사용자에게도 사실과 다른 신호가 된다.
      rel={offer.disclosureRequired ? 'sponsored nofollow noopener' : 'nofollow noopener'}
    >
      <div className="deal-card__head">
        <span className="deal-card__merchant kh-caps">{offer.merchant}</span>
        {offer.disclosureRequired && (
          <span className="deal-card__badge kh-mono" title={DEAL_DISCLOSURE}>
            {DEAL_AFFILIATE_BADGE}
          </span>
        )}
      </div>
      <p className="deal-card__benefit">{offer.benefit}</p>
      <h3 className="deal-card__title">{offer.title}</h3>
      {offer.summary && <p className="deal-card__summary">{offer.summary}</p>}
      {expiry && (
        <span className={`deal-card__expiry kh-mono${urgent ? ' is-urgent' : ''}`}>{expiry}</span>
      )}
    </a>
  );
}

export default function DealPage() {
  useHeritageSurface();
  useSeo(dealHubMeta());

  const [active, setActive] = useState<string>(ALL);
  const { data, isLoading, isError } = useQuery({
    queryKey: ['deal', 'sections'],
    queryFn: fetchDealSections,
    staleTime: 5 * 60 * 1000,
  });

  const sections: DealSection[] = useMemo(
    () => (data ?? []).filter((s) => s.offers.length > 0),
    [data],
  );
  const shown = active === ALL ? sections : sections.filter((s) => s.category.code === active);
  const total = sections.reduce((sum, s) => sum + s.offers.length, 0);

  return (
    <div className="deal-page">
      <header className="deal-header">
        <div className="deal-header__bar">
          <a className="deal-header__brand kh-display" href="https://1989v.com">
            1989v
          </a>
          <ThemeToggle />
        </div>
        <h1 className="deal-header__title kh-display">
          <span className="kh-display-accent">혜택</span> 링크
        </h1>
        <p className="deal-header__subtitle">
          여행 · 커머스 · 구독 · 교육 · 생활 혜택을 분류별로 모았습니다.
        </p>
        {/* 공정위 고지는 접히거나 스크롤 아래로 숨지 않는다 — 링크를 보기 전에 읽혀야 한다 */}
        <p className="deal-disclosure kh-mono">{DEAL_DISCLOSURE}</p>
      </header>

      {sections.length > 0 && (
        <nav className="deal-filters" aria-label="카테고리">
          <button
            type="button"
            className={`deal-chip kh-button-ghost${active === ALL ? ' is-active' : ''}`}
            onClick={() => setActive(ALL)}
          >
            전체 <span className="deal-chip__count kh-mono">{total}</span>
          </button>
          {sections.map((s) => (
            <button
              key={s.category.code}
              type="button"
              className={`deal-chip kh-button-ghost${active === s.category.code ? ' is-active' : ''}`}
              onClick={() => setActive(s.category.code)}
            >
              {s.category.label} <span className="deal-chip__count kh-mono">{s.offers.length}</span>
            </button>
          ))}
        </nav>
      )}

      <main className="deal-main">
        {isLoading && <p className="deal-state">불러오는 중…</p>}
        {isError && <p className="deal-state kh-status-error">혜택을 불러오지 못했습니다.</p>}
        {!isLoading && !isError && sections.length === 0 && (
          <p className="deal-state">아직 등록된 혜택이 없습니다.</p>
        )}

        {shown.map((section) => (
          <section key={section.category.code} className="deal-section">
            <div className="kh-section-head">
              <h2>{section.category.label}</h2>
              {section.category.tagline && (
                <span className="kh-section-label">{section.category.tagline}</span>
              )}
            </div>
            <div className="deal-grid">
              {section.offers.map((offer) => (
                <OfferCard key={offer.slug} offer={offer} />
              ))}
            </div>
          </section>
        ))}
      </main>

      {/* 조건 변동 고지는 공통 푸터의 슬롯으로 — 헤더의 공정위 고지(DEAL_DISCLOSURE)는
          링크를 보기 전에 읽혀야 해서 그대로 위에 남는다 (ADR-0069). */}
      <Footer>
        <p>
          혜택 내용과 조건은 각 제공처의 정책에 따라 예고 없이 바뀔 수 있습니다. 최종 조건은
          이동한 페이지에서 확인하세요.
        </p>
      </Footer>
    </div>
  );
}
