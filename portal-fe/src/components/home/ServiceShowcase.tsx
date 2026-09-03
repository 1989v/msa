import { useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { searchAttractions, type Attraction } from '../../api/placeApi';
import { displayTitle, genreLabel, listGames, type GameSummary } from '../../api/gameApi';
import { fetchPosts, type BlogPostSummary } from '../../api/blogApi';
import { fetchProducts, type ProductSummary } from '../../api/shopApi';
import type { DisplayService } from '../../api/displayApi';
import { escapeHtml } from '../../lib/card-dispenser';
import DispenserStage, { type DispenserSkin } from '../dispenser/DispenserStage';
import PickLine from '../dispenser/PickLine';
import TileGrid from './TileGrid';
import { useReveal } from '../../hooks/useReveal';
import { BLOG_ORIGIN, PLACE_ORIGIN, attractionPath, blogPostUrl, gameUrl } from '../../seo/copy.mjs';
import './Home.css';

/**
 * 만든 서비스 — 서비스마다 글 옆에 그 서비스의 실제 데이터가 꽂힌 카드 디스펜서가 선다.
 *
 * 링크가 말하듯 "코드가 아니라 시각 콘텐츠가 차이를 만든다". 영상 자리를 AI 생성물이 아니라
 * 제품 자체의 데이터로 채운다 — 관광지 80곳(서울), 게임 전부, 글 전부, 상품 전부. 카드 수가
 * 실제 개수를 따르므로 판의 밀도가 곧 "얼마나 있는가" 다.
 *
 * 모바일 순서는 소개 → 판 → 뽑힌 것·태그·링크 (DOM 순서 그대로). 데스크탑은 글 칸 | 판.
 */

const PLACE_CATEGORY: Record<string, string> = { history: '역사', nature: '자연', culture: '문화', leisure: '레포츠' };
const STALE = 10 * 60_000;
const pad = (i: number) => String(i + 1).padStart(2, '0');
const photo = (url: string | null) =>
  url
    ? `<div class="cd-photo" style="background-image:url('${escapeHtml(url).replace(/'/g, '%27')}')"></div>`
    : '<div class="cd-photo"></div>';
const won = (n: string | number) => `₩${Math.round(Number(n)).toLocaleString('ko-KR')}`;
const district = (address: string | null) => address?.split(' ')[1] ?? '';

interface Pick {
  title: string;
  meta: string;
  href: string;
}

interface BlockProps<T> {
  index: number;
  side: 'left' | 'right';
  title: string;
  desc: string;
  tags: string[];
  goHref: string;
  goLabel: string;
  items: T[] | undefined;
  failed: boolean;
  render: (item: T, i: number) => string;
  describe: (item: T) => Pick;
  pickLabel: string;
  spinLabel: string;
  caption: [string, string];
  skin?: DispenserSkin;
  minCards?: number;
  stageLabel: string;
}

function ServiceBlock<T>({
  index,
  side,
  title,
  desc,
  tags,
  goHref,
  goLabel,
  items,
  failed,
  render,
  describe,
  pickLabel,
  spinLabel,
  caption,
  skin,
  minCards,
  stageLabel,
}: BlockProps<T>) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [pick, setPick] = useState<Pick | null>(null);
  const navigate = useNavigate();
  const onChange = (item: T) => setPick(describe(item));
  // 일어난 카드를 누르면 그 링크로 — 다른 호스트면 통째로 이동, 같은 앱 경로면 라우터로
  const onActivate = (item: T) => {
    const { href } = describe(item);
    if (/^https?:/.test(href)) window.location.assign(href);
    else void navigate(href);
  };

  let stage: ReactNode;
  if (items && items.length > 0) {
    stage = (
      <DispenserStage
        items={items}
        render={render}
        onChange={onChange}
        onActivate={onActivate}
        minCards={minCards}
        skin={skin}
        label={stageLabel}
        caption={caption}
        pickLabel={spinLabel}
        scrubRef={sectionRef as RefObject<HTMLElement | null>}
      />
    );
  } else if (failed || (items && items.length === 0)) {
    stage = <div className="kh-slab svc-empty kh-mono">{failed ? '지금은 판이 비어 있습니다' : '아직 꽂을 것이 없습니다'}</div>;
  } else {
    stage = <div className="kh-skeleton svc-skeleton" aria-label="불러오는 중" />;
  }

  return (
    <div className="svc" data-side={side} ref={sectionRef}>
      <div className="svc-grid">
        <div className="svc-head">
          <div className="kh-mono svc-n">{pad(index)} / 04</div>
          <h3 className="svc-title">{title}</h3>
          <p className="svc-desc">{desc}</p>
        </div>
        <div className="svc-stage">{stage}</div>
        <div className="svc-foot">
          <PickLine label={pickLabel} title={pick?.title ?? null} meta={pick?.meta ?? null} href={pick?.href ?? null} />
          <div className="svc-tags">
            {tags.map((t) => (
              <span key={t} className="kh-mono svc-tag">{t}</span>
            ))}
          </div>
          <a className="home-more-link" href={goHref}>
            {goLabel} →
          </a>
        </div>
      </div>
    </div>
  );
}

export default function ServiceShowcase({ services }: { services: DisplayService[] | null }) {
  const reveal = useReveal();

  const place = useQuery({
    queryKey: ['home', 'place'],
    // 서울 · 관광 분류만 — 음식·쇼핑은 목록에 올리지 않는다 (place 화면과 같은 기준)
    queryFn: () => searchAttractions({ lang: 'ko', areaCode: '1', category: 'nature,history,culture,leisure', size: 80 }),
    staleTime: STALE,
  });
  const games = useQuery({ queryKey: ['home', 'games'], queryFn: () => listGames({ sort: 'top', size: 100 }), staleTime: STALE });
  const posts = useQuery({ queryKey: ['home', 'posts'], queryFn: () => fetchPosts({ size: 30 }), staleTime: STALE });
  const products = useQuery({ queryKey: ['home', 'products'], queryFn: () => fetchProducts(0, 100), staleTime: STALE });

  const attractions = place.data?.attractions;
  const gameItems = games.data?.content;
  const postItems = posts.data?.items;
  const productItems = products.data?.products;
  const placeTotal = place.data?.totalElements ?? 0;

  const renderPlace = useMemo(
    () => (a: Attraction, i: number) =>
      `${photo(a.imageUrl)}<div class="cd-body"><span class="cd-seal">${escapeHtml(PLACE_CATEGORY[a.category ?? ''] ?? a.category ?? '')}</span>` +
      `<b class="cd-title">${escapeHtml(a.title)}</b><span class="cd-meta">${escapeHtml(district(a.address))} · ${pad(i)}</span></div>`,
    [],
  );
  const renderGame = useMemo(
    () => (g: GameSummary, i: number) =>
      `${photo(g.thumbnailUrl)}<div class="cd-body"><span class="cd-seal">${escapeHtml(genreLabel(g.genre, 'ko'))}</span>` +
      `<b class="cd-title">${escapeHtml(g.title)}</b><span class="cd-meta">${escapeHtml(g.titleEn ?? '')} · ${pad(i)}</span></div>`,
    [],
  );
  const renderPost = useMemo(
    () => (p: BlogPostSummary, i: number) =>
      `<div class="cd-body cd-body--text"><span class="cd-seal">${escapeHtml(p.categoryName)}</span>` +
      `<b class="cd-title cd-title--wrap">${escapeHtml(p.title)}</b><span class="cd-meta">${escapeHtml(p.author.displayName)} · ${escapeHtml((p.publishedAt ?? '').slice(0, 10))}</span>` +
      `<span class="cd-num">${pad(i)}</span></div>`,
    [],
  );
  const renderProduct = useMemo(
    () => (p: ProductSummary, i: number) =>
      `<div class="cd-body cd-body--text"><span class="cd-seal">상품</span><b class="cd-title cd-title--wrap">${escapeHtml(p.name)}</b>` +
      `<span class="cd-meta">${escapeHtml(won(p.price))}</span><span class="cd-num">${pad(i)}</span></div>`,
    [],
  );

  return (
    <section id="services" className="home-section" ref={reveal}>
      <div className="home-inner">
        <div className="kh-section-head kh-rule-draw">
          <span className="kh-mono kh-index">01_</span>
          <h2 className="home-section-title">만든 서비스</h2>
        </div>
        <p className="kh-seep home-section-desc">
          직접 설계하고 운영 중인 서비스입니다. 각 서비스의 실제 데이터가 판에 꽂혀 있고, 지나가는 동안 돕니다.
        </p>

        <ServiceBlock<Attraction>
          index={0}
          side="right"
          title="한국 관광 검색"
          desc={`TourAPI 관광지를 지역·분류로 거르고 지도에서 근처를 찾습니다.${placeTotal ? ` 서울만 ${placeTotal.toLocaleString('ko-KR')}곳.` : ''} 지나가는 동안 판이 돌고, 끌거나 뽑기로 더 돌립니다.`}
          tags={['TourAPI', 'OpenSearch geo_distance', 'ko · en']}
          goHref={`${PLACE_ORIGIN}/`}
          goLabel="place.1989v.com"
          items={attractions}
          failed={place.isError}
          render={renderPlace}
          describe={(a) => ({
            title: a.title,
            meta: `${district(a.address)} · ${PLACE_CATEGORY[a.category ?? ''] ?? a.category ?? ''}`,
            href: `${PLACE_ORIGIN}${attractionPath('ko', a.id)}`,
          })}
          pickLabel="지금 뽑힌 곳"
          spinLabel="다른 곳 뽑기"
          caption={['place.1989v.com', `서울 ${placeTotal.toLocaleString('ko-KR')}곳 중 ${attractions?.length ?? 0}곳 · 끌어서 돌리기 · ← →`]}
          stageLabel="서울 관광지"
        />
        <ServiceBlock<GameSummary>
          index={1}
          side="left"
          title="게임"
          desc={`설치 없이 브라우저에서 바로.${gameItems ? ` ${gameItems.length}종 전부가 꽂혀 있습니다.` : ''} 리더보드, 모바일 세로·가로 지원. 같은 장치에 아케이드 표피를 끼우면 "뭐 하지" 가 됩니다.`}
          tags={['Canvas', 'Unity WebGL', 'Leaderboard']}
          goHref={gameUrl('ko', '/games')}
          goLabel="game.1989v.com"
          items={gameItems}
          failed={games.isError}
          render={renderGame}
          describe={(g) => ({
            title: displayTitle(g, 'ko'),
            meta: `${g.titleEn ?? ''} · ${genreLabel(g.genre, 'ko')}`,
            href: gameUrl('ko', `/games/${g.slug}`),
          })}
          pickLabel="지금 뽑힌 게임"
          spinLabel="뭐 하지"
          caption={['game.1989v.com', `${gameItems?.length ?? 0}종 전부 · 같은 장치, 아케이드 표피`]}
          skin="arcade"
          stageLabel="웹게임 전부"
        />
        <ServiceBlock<BlogPostSummary>
          index={2}
          side="right"
          title="블로그"
          desc="서버·검색·데이터부터 AI 하네스까지, 직접 겪은 것을 씁니다. 글 상세는 서버가 meta 를 주입해 발행 즉시 공유 카드가 맞습니다. 글이 적을 때는 판을 돌려 가며 채우고, 뽑히는 건 실제 글뿐입니다."
          tags={['계층 카테고리', 'SSR meta', 'fencesvg']}
          goHref={`${BLOG_ORIGIN}/`}
          goLabel="blog.1989v.com"
          items={postItems}
          failed={posts.isError}
          render={renderPost}
          describe={(p) => ({
            title: p.title,
            meta: `${p.categoryName} · ${(p.publishedAt ?? '').slice(0, 10)} · ${p.readingMinutes}분`,
            href: blogPostUrl(p.slug),
          })}
          pickLabel="지금 뽑힌 글"
          spinLabel="아무 글이나"
          caption={['blog.1989v.com', `글 ${postItems?.length ?? 0}편 · 24칸 판에 돌려 채움 · 뽑히는 건 실제 글뿐`]}
          skin="paper"
          minCards={24}
          stageLabel="블로그 글"
        />
        <ServiceBlock<ProductSummary>
          index={3}
          side="left"
          title="커머스"
          desc="상품 검색에서 주문, 재고 예약, 출고까지. 19개 마이크로서비스가 클라우드 무료 티어 한 대 위에서 돕니다. 데모지만 배관은 진짜고, 상품 카탈로그도 실제 API 응답입니다."
          tags={['Kotlin · Spring', 'Kafka', 'Kubernetes']}
          goHref="/shop"
          goLabel="1989v.com/shop"
          items={productItems}
          failed={products.isError}
          render={renderProduct}
          describe={(p) => ({ title: p.name, meta: won(p.price), href: `/shop/products/${p.id}` })}
          pickLabel="지금 뽑힌 상품"
          spinLabel="아무거나 담기"
          caption={['1989v.com/shop', `상품 ${productItems?.length ?? 0}개 전부 · 사진 없는 카드도 카드다`]}
          skin="paper"
          minCards={24}
          stageLabel="상품 전부"
        />

        {services && services.length > 0 && <TileGrid services={services} />}
      </div>
    </section>
  );
}
