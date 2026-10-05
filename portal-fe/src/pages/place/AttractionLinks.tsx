import {
  type AttractionDeepLink,
  type CollectedLink,
  type PlaceLang,
} from '../../api/placeApi';
import { useState } from 'react';
import { parseLinks } from './placeView';

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
    long: '롱폼',
    shorts: '쇼츠',
    blogs: '방문 후기',
    social: 'SNS',
    tour: '여행 상품',
    affiliateBadge: '제휴',
    disclosure: '제휴 표시가 붙은 링크는 이용 시 수수료를 받을 수 있습니다.',
  },
  en: {
    heading: 'Explore more',
    videos: 'Videos',
    long: 'Videos',
    shorts: 'Shorts',
    blogs: 'Blog posts',
    social: 'Social',
    tour: 'Tours & tickets',
    affiliateBadge: 'Affiliate',
    disclosure: 'Links marked as affiliate may earn us a commission.',
  },
} as const;

/** 수집기가 롱폼 · 쇼츠를 각각 10개까지 채운다(place-ingest youtube.TARGET) — 다 보인다. 캐로셀이라 옆으로 민다 */
const VISIBLE_VIDEOS = 10;
/** 쇼츠는 세로 카드라 폭이 좁다 — 같은 줄 길이에 더 들어간다 */
const VISIBLE_SHORTS = 10;

/** 쇼츠 표시 — 썸네일 왼쪽 위에 얹는다. 모양으로 알아보게 하고 이름은 접근성 문구가 말한다 */
function ShortsMark() {
  return (
    <svg className="place-links-short-mark" viewBox="0 0 24 24" aria-hidden="true">
      <path
        className="place-links-short-mark-body"
        d="M15.6 2.4a4.3 4.3 0 0 1 4.1 7.5l-1.5.8 1 .5a4.3 4.3 0 0 1 .2 7.6l-8.3 4.4a4.3 4.3 0 0 1-4.1-7.5l1.5-.8-1-.5a4.3 4.3 0 0 1-.2-7.6z"
      />
      <path className="place-links-short-mark-play" d="M10 9.2v5.6l4.8-2.8z" />
    </svg>
  );
}

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

function VideoCard({ link, lang, short = false }: { link: CollectedLink; lang: PlaceLang; short?: boolean }) {
  // 쇼츠는 쇼츠 주소로 연다 — 일반 주소로 열면 가로 플레이어에 세로 영상이 작게 뜬다
  const href = short && link.externalId ? `https://www.youtube.com/shorts/${link.externalId}` : link.url;
  return (
    <li className={`place-links-slide${short ? ' is-short' : ''}`}>
      <a className="place-links-card" href={href} target="_blank" rel="nofollow noopener">
        {link.thumbnailUrl && (
          <span className="place-links-thumb-wrap">
            <img className="place-links-thumb" src={link.thumbnailUrl} alt="" loading="lazy" />
            {short && <ShortsMark />}
          </span>
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

export default function AttractionLinks({ links, lang }: { links: string | null | undefined; lang: PlaceLang }) {
  const L = UI[lang];
  // 영상 절의 롱폼/쇼츠 전환 — 고르기 전에는 롱폼(없으면 쇼츠)
  const [picked, setPicked] = useState<'long' | 'short' | null>(null);
  /*
   * 링크는 색인이 들고 온다 (ADR-0095). 예전에는 상세마다 place DB 를 쳤고, 그 호출에는
   * 수집 큐에 행을 올리는 **쓰기 부수효과**까지 있었다.
   */
  const data = parseLinks(links);
  const isLoading = false;

  if (isLoading) {
    return (
      <section className="place-links" aria-label={L.heading} aria-busy="true">
        <h3 className="place-links-heading">{L.heading}</h3>
        <ul className="place-links-carousel">
          {[0, 1, 2].map((i) => (
            <li key={i} className="place-links-slide">
              <div className="place-links-card place-links-card-skeleton" aria-hidden="true">
                <div className="place-links-thumb kh-skeleton" />
              </div>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  if (!data) return null; // 실패는 조용히 — 링크는 부수 정보다

  // 일반 영상 위주로 보이고 쇼츠는 따로 모은다. 형태를 아직 모르는 영상(null)은 일반 영상 쪽에 둔다
  const youtube = data.collected.filter((l) => l.source === 'YOUTUBE');
  const videos = youtube.filter((l) => l.format !== 'SHORT').slice(0, VISIBLE_VIDEOS);
  const shorts = youtube.filter((l) => l.format === 'SHORT').slice(0, VISIBLE_SHORTS);
  const blogs = data.collected.filter((l) => l.source === 'NAVER_BLOG');
  const social = data.deepLinks.filter((l) => l.kind === 'SOCIAL');
  const tour = data.deepLinks.filter((l) => l.kind === 'TOUR_PRODUCT');
  const hasAffiliate = data.deepLinks.some((l) => l.revenueType === 'AFFILIATE');

  // 딥링크는 서버가 항상 조립하지만 타입은 빈 응답을 허용한다 — 전부 비면 섹션 자체를 접는다
  if (videos.length === 0 && shorts.length === 0 && blogs.length === 0 && social.length === 0 && tour.length === 0) {
    return null;
  }

  // 한 절 안에서 롱폼·쇼츠를 전환한다. 한 종류만 있으면 전환 없이 그것만
  const kind = picked === 'short' && shorts.length > 0 ? 'short' : videos.length > 0 ? 'long' : 'short';
  const shown = kind === 'short' ? shorts : videos;

  return (
    <section className="place-links" aria-label={L.heading}>
      <h3 className="place-links-heading">{L.heading}</h3>

      {/* 영상이 실제로 있을 때만 그룹을 그린다 — 수집 대기(pending) 는 빈 그룹의 근거가 아니다 */}
      {shown.length > 0 && (
        <div className="place-links-group">
          <div className="place-links-group-head">
            <span className="place-links-group-title">{L.videos}</span>
            {videos.length > 0 && shorts.length > 0 && (
              <div className="place-links-switch" role="group" aria-label={L.videos}>
                <button type="button" aria-pressed={kind === 'long'} onClick={() => setPicked('long')}>
                  {L.long} {videos.length}
                </button>
                <button type="button" aria-pressed={kind === 'short'} onClick={() => setPicked('short')}>
                  {L.shorts} {shorts.length}
                </button>
              </div>
            )}
          </div>
          {/* 좁은 패널에서 넘치면 가로로 민다 */}
          <ul className="place-links-carousel" data-kind={kind}>
            {shown.map((video) => (
              <VideoCard key={video.url} link={video} lang={lang} short={kind === 'short'} />
            ))}
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
