import { useQuery } from '@tanstack/react-query';
import {
  fetchAttractionLinks,
  type AttractionDeepLink,
  type PlaceLang,
} from '../../api/placeApi';

/**
 * 관광지 상세의 "더 찾아보기" (ADR-0070). 검색 패널과 상세 페이지가 같은 컴포넌트를 쓴다.
 *
 * 여행 상품은 하단 캐로셀, SNS 는 그 위 버튼 줄이다. **지금 카드에 담을 수 있는 것은
 * 제공자까지다** — 사진·가격·평점이 있는 상품 카드는 제휴 API 승인이 있어야 나온다.
 * 승인되면 이 캐로셀의 아이템만 상품으로 바뀐다 (자리와 스크롤 동작은 그대로).
 *
 * 인스타그램은 장소 기반 공개 검색 API 가 없어 태그 페이지로 보내는 것이 공식 경로로
 * 할 수 있는 전부다 (수집하지 않는다).
 */
const UI = {
  ko: {
    heading: '더 찾아보기',
    social: 'SNS',
    tour: '여행 상품',
    tourSub: '투어·티켓 검색',
    affiliateBadge: '제휴',
    disclosure: '제휴 표시가 붙은 링크는 이용 시 수수료를 받을 수 있습니다.',
  },
  en: {
    heading: 'Explore more',
    social: 'Social',
    tour: 'Tours & tickets',
    tourSub: 'Search tours',
    affiliateBadge: 'Affiliate',
    disclosure: 'Links marked as affiliate may earn us a commission.',
  },
} as const;

const PROVIDER_LABEL: Record<string, { ko: string; en: string }> = {
  INSTAGRAM: { ko: '인스타그램', en: 'Instagram' },
  MYREALTRIP: { ko: '마이리얼트립', en: 'MyRealTrip' },
  KLOOK: { ko: 'Klook', en: 'Klook' },
};

function providerLabel(provider: string, lang: PlaceLang): string {
  return PROVIDER_LABEL[provider]?.[lang] ?? provider;
}

/** 제휴 링크에만 sponsored. 수수료를 받지 않는 링크까지 광고로 표시하면 고지의 목적과 반대로 간다. */
function relFor(link: AttractionDeepLink): string {
  return link.revenueType === 'AFFILIATE' ? 'sponsored nofollow noopener' : 'nofollow noopener';
}

export default function AttractionLinks({ id, lang }: { id: string; lang: PlaceLang }) {
  const L = UI[lang];
  const { data } = useQuery({
    queryKey: ['attraction-links', id],
    queryFn: () => fetchAttractionLinks(id),
    enabled: id !== '',
    staleTime: 10 * 60_000,
  });

  const links = data?.deepLinks ?? [];
  if (links.length === 0) return null; // 실패는 조용히 — 링크는 부수 정보다

  const social = links.filter((l) => l.kind === 'SOCIAL');
  const tour = links.filter((l) => l.kind === 'TOUR_PRODUCT');
  const hasAffiliate = links.some((l) => l.revenueType === 'AFFILIATE');

  return (
    <section className="place-links" aria-label={L.heading}>
      <h3 className="place-links-heading">{L.heading}</h3>

      {social.length > 0 && (
        <div className="place-links-group">
          <span className="place-links-group-title">{L.social}</span>
          <div className="place-links-row">
            {social.map((link) => (
              <a
                key={link.provider}
                className="place-btn place-links-btn"
                href={link.url}
                target="_blank"
                rel={relFor(link)}
              >
                {providerLabel(link.provider, lang)}
              </a>
            ))}
          </div>
        </div>
      )}

      {tour.length > 0 && (
        <div className="place-links-group">
          <span className="place-links-group-title">{L.tour}</span>
          {/* 좁은 패널에서 넘치면 가로로 민다 — 아이템이 늘어나도(제휴 API) 레이아웃이 그대로다 */}
          <ul className="place-links-carousel">
            {tour.map((link) => (
              <li key={link.provider} className="place-links-slide">
                <a className="place-links-card" href={link.url} target="_blank" rel={relFor(link)}>
                  <span className="place-links-card-provider">
                    {providerLabel(link.provider, lang)}
                    {link.revenueType === 'AFFILIATE' && (
                      <span className="place-links-badge">{L.affiliateBadge}</span>
                    )}
                  </span>
                  <span className="place-links-card-sub">{L.tourSub}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {hasAffiliate && <p className="place-links-disclosure">{L.disclosure}</p>}
    </section>
  );
}
