import { useQuery } from '@tanstack/react-query';
import {
  fetchAttractionLinks,
  type AttractionDeepLink,
  type CollectedLink,
  type PlaceLang,
} from '../../api/placeApi';

/**
 * 관광지 상세의 "더 찾아보기" (ADR-0070). 검색 패널과 상세 페이지가 같은 컴포넌트를 쓴다.
 *
 * 캐로셀은 수집된 영상이고, SNS·여행 상품은 조립된 딥링크라 항상 즉시 나간다.
 * 인스타그램은 장소 기반 공개 검색 API 가 없어 태그 페이지로 보내는 것이 공식 경로로 할 수
 * 있는 전부고, 투어 상품은 제휴 승인 전이라 검색 딥링크만 건다 (상품 카드는 승인 후).
 */
const UI = {
  ko: {
    heading: '더 찾아보기',
    videos: '영상',
    blogs: '방문 후기',
    social: 'SNS',
    tour: '여행 상품',
    affiliateBadge: '제휴',
    pending: '영상을 찾는 중입니다',
    disclosure: '제휴 표시가 붙은 링크는 이용 시 수수료를 받을 수 있습니다.',
  },
  en: {
    heading: 'Explore more',
    videos: 'Videos',
    blogs: 'Blog posts',
    social: 'Social',
    tour: 'Tours & tickets',
    affiliateBadge: 'Affiliate',
    pending: 'Looking for videos',
    disclosure: 'Links marked as affiliate may earn us a commission.',
  },
} as const;

const PROVIDER_LABEL: Record<string, { ko: string; en: string }> = {
  INSTAGRAM: { ko: '인스타그램', en: 'Instagram' },
  YOUTUBE: { ko: '유튜브에서 찾기', en: 'Search on YouTube' },
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

function DeepLinkRow({
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
            rel={relFor(link)}
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

/** 조회수는 자릿수가 커서 그대로 쓰면 카드가 밀린다 — 만/억(en: K/M) 단위로 줄인다. */
function views(count: number, lang: PlaceLang): string {
  if (lang === 'en') {
    if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M views`;
    if (count >= 1_000) return `${Math.round(count / 1_000)}K views`;
    return `${count} views`;
  }
  if (count >= 100_000_000) return `조회수 ${(count / 100_000_000).toFixed(1)}억회`;
  if (count >= 10_000) return `조회수 ${Math.round(count / 10_000).toLocaleString()}만회`;
  return `조회수 ${count.toLocaleString()}회`;
}

function VideoCard({ link, lang }: { link: CollectedLink; lang: PlaceLang }) {
  return (
    <li className="place-links-slide">
      <a className="place-links-card" href={link.url} target="_blank" rel="nofollow noopener">
        {link.thumbnailUrl && (
          <img className="place-links-thumb" src={link.thumbnailUrl} alt="" loading="lazy" />
        )}
        <span className="place-links-card-title">{link.title}</span>
        {(link.author || link.viewCount != null) && (
          <span className="place-links-card-sub">
            {[link.author, link.viewCount != null ? views(link.viewCount, lang) : null]
              .filter(Boolean)
              .join(' · ')}
          </span>
        )}
      </a>
    </li>
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

  if (!data) return null; // 실패는 조용히 — 링크는 부수 정보다

  const videos = data.collected.filter((l) => l.source === 'YOUTUBE');
  const blogs = data.collected.filter((l) => l.source === 'NAVER_BLOG');
  const social = data.deepLinks.filter((l) => l.kind === 'SOCIAL');
  const tour = data.deepLinks.filter((l) => l.kind === 'TOUR_PRODUCT');
  const hasAffiliate = data.deepLinks.some((l) => l.revenueType === 'AFFILIATE');
  // 수집 대기는 오류가 아니다. 이미 받은 영상이 있으면 굳이 자리표시를 띄우지 않는다.
  const showSkeleton = data.pending && videos.length === 0;

  if (videos.length === 0 && blogs.length === 0 && social.length === 0 && tour.length === 0 && !showSkeleton) {
    return null;
  }

  return (
    <section className="place-links" aria-label={L.heading}>
      <h3 className="place-links-heading">{L.heading}</h3>

      {(videos.length > 0 || showSkeleton) && (
        <div className="place-links-group">
          <span className="place-links-group-title">{showSkeleton ? L.pending : L.videos}</span>
          {/* 좁은 패널에서 넘치면 가로로 민다 */}
          <ul className="place-links-carousel" aria-busy={showSkeleton}>
            {showSkeleton
              ? [0, 1, 2].map((i) => (
                  <li key={i} className="place-links-slide">
                    <div className="place-links-card place-links-card-skeleton" aria-hidden="true">
                      <div className="place-links-thumb" />
                    </div>
                  </li>
                ))
              : videos.map((video) => <VideoCard key={video.url} link={video} lang={lang} />)}
          </ul>
        </div>
      )}

      {blogs.length > 0 && (
        <div className="place-links-group">
          <span className="place-links-group-title">{L.blogs}</span>
          {/* 블로그 검색 응답에는 이미지가 없다 — 카드로 만들면 빈 썸네일 자리만 남는다 */}
          <ul className="place-links-list">
            {blogs.map((blog) => (
              <li key={blog.url}>
                <a
                  className="place-links-list-item"
                  href={blog.url}
                  target="_blank"
                  rel="nofollow noopener"
                >
                  <span className="place-links-list-title">{blog.title}</span>
                  {blog.author && <span className="place-links-card-sub">{blog.author}</span>}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <DeepLinkRow title={L.social} links={social} lang={lang} affiliateBadge={L.affiliateBadge} />
      <DeepLinkRow title={L.tour} links={tour} lang={lang} affiliateBadge={L.affiliateBadge} />

      {hasAffiliate && <p className="place-links-disclosure">{L.disclosure}</p>}
    </section>
  );
}
