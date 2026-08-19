import { useQuery } from '@tanstack/react-query';
import {
  fetchAttractionLinks,
  type AttractionDeepLink,
  type PlaceLang,
} from '../../api/placeApi';

/**
 * 관광지 상세의 "더 찾아보기" (ADR-0070). 검색 패널과 상세 페이지가 같은 컴포넌트를 쓴다.
 *
 * 지금은 조립되는 딥링크만이다 — 인스타그램은 장소 기반 공개 검색 API 가 없어 태그 페이지로
 * 보내는 것이 공식 경로로 할 수 있는 전부고, 투어 상품은 제휴 승인 전이라 검색 딥링크만 건다.
 * 수집형(유튜브·네이버 블로그) 카드는 커넥터가 붙을 때 이 자리에 더해진다.
 */
const UI = {
  ko: {
    heading: '더 찾아보기',
    social: 'SNS',
    tour: '여행 상품',
    affiliateBadge: '제휴',
    disclosure: '제휴 표시가 붙은 링크는 이용 시 수수료를 받을 수 있습니다.',
  },
  en: {
    heading: 'Explore more',
    social: 'Social',
    tour: 'Tours & tickets',
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

function LinkGroup({
  title,
  links,
  lang,
  affiliateBadge,
}: {
  title: string;
  links: AttractionDeepLink[];
  lang: PlaceLang;
  affiliateBadge: string;
}) {
  if (links.length === 0) return null;
  return (
    <div className="place-links-group">
      <span className="place-links-group-title">{title}</span>
      <div className="place-links-row">
        {links.map((link) => (
          <a
            key={link.provider}
            className="place-btn place-links-btn"
            href={link.url}
            target="_blank"
            // 제휴 링크에만 sponsored 를 붙인다. 수수료를 받지 않는 링크까지 광고로 표시하면
            // 고지의 목적(신뢰)과 반대로 간다.
            rel={link.revenueType === 'AFFILIATE' ? 'sponsored nofollow noopener' : 'nofollow noopener'}
          >
            {providerLabel(link.provider, lang)}
            {link.revenueType === 'AFFILIATE' && (
              <span className="place-links-badge">{affiliateBadge}</span>
            )}
          </a>
        ))}
      </div>
    </div>
  );
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
  if (links.length === 0) return null;   // 실패는 조용히 — 링크는 부수 정보다

  const social = links.filter((l) => l.kind === 'SOCIAL');
  const tour = links.filter((l) => l.kind === 'TOUR_PRODUCT');
  const hasAffiliate = links.some((l) => l.revenueType === 'AFFILIATE');

  return (
    <section className="place-links" aria-label={L.heading}>
      <h3 className="place-links-heading">{L.heading}</h3>
      <LinkGroup title={L.social} links={social} lang={lang} affiliateBadge={L.affiliateBadge} />
      <LinkGroup title={L.tour} links={tour} lang={lang} affiliateBadge={L.affiliateBadge} />
      {hasAffiliate && <p className="place-links-disclosure">{L.disclosure}</p>}
    </section>
  );
}
