import { Link, useLocation, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  fetchAdminRegions,
  searchAttractions,
  type AdminRegion,
  type PlaceLang,
} from '../../api/placeApi';
import {
  PLACE_ORIGIN,
  attractionPath,
  breadcrumbJsonLd,
  placeBrand,
  placeCategoryLabel,
  placeHreflangAlternates,
  placePath,
  placeUrl,
  regionDisplayName,
  regionMeta,
  regionPath,
  regionUrl,
  touristDestinationJsonLd,
} from '../../seo/copy.mjs';
import { useSeo } from '../../seo/useSeo';
import { useHeritageSurface } from '../../hooks/useHeritageSurface';
import Footer from '../../components/Footer';
import { titleParts } from './placeView';
import './PlacePage.css';

const UI = {
  ko: {
    back: '← 관광지 탐색',
    districts: '시·군·구별로 보기',
    top: '대표 관광지',
    all: '지도에서 전체 보기',
    notFound: '지역을 찾을 수 없습니다.',
    failed: '정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
    loading: '불러오는 중…',
  },
  en: {
    back: '← Explore Korea',
    districts: 'Browse by district',
    top: 'Top attractions',
    all: 'View all on the map',
    notFound: 'Region not found.',
    failed: 'Could not load this page. Please try again in a moment.',
    loading: 'Loading…',
  },
} as const;

/** 지역 페이지가 대표로 보여주는 관광지 수 — 목록 전체는 지도(허브)의 몫이다 */
const TOP_ATTRACTIONS = 12;

/**
 * 지역 페이지 (ADR-0071 §9). "제주 가볼 만한 곳" 류 질의의 착지점 — 지역 단위 URL 이 없으면
 * 그 질의에서 관광지 데이터 전체가 색인 밖이다 (`/attractions/:id` 를 만든 이유와 같다).
 *
 * 세그먼트는 법정동 코드 하나다 — 시도 2자리(41) / 시군구 5자리(41110). 코드 길이가 레벨을
 * 정하므로 라우트도 페이지도 하나면 된다. 상위는 앞 2자리에서 유도한다.
 */
export default function RegionPage() {
  useHeritageSurface();
  const { code = '' } = useParams();
  const { pathname } = useLocation();
  const lang: PlaceLang = pathname.startsWith('/en') ? 'en' : 'ko';
  const L = UI[lang];
  const isSido = code.length === 2;
  const parentCode = isSido ? null : code.slice(0, 2);

  // 지역 메타는 부모 목록에서 찾는다 — 단건 조회 API 를 만들 만큼 목록이 크지 않다(시도 16·시군구 최대 55)
  const { data: siblings, isLoading, isError } = useQuery({
    queryKey: ['admin-regions', isSido ? 'SIDO' : 'SIGUNGU', parentCode, lang],
    queryFn: () =>
      isSido
        ? fetchAdminRegions({ level: 'SIDO', lang })
        : fetchAdminRegions({ level: 'SIGUNGU', parent: parentCode!, lang }),
    staleTime: 30 * 60_000,
  });
  const region = siblings?.find((r) => r.code === code) ?? null;

  const { data: children } = useQuery({
    queryKey: ['admin-regions', 'SIGUNGU', code, lang],
    queryFn: () => fetchAdminRegions({ level: 'SIGUNGU', parent: code, lang }),
    enabled: isSido,
    staleTime: 30 * 60_000,
  });

  const { data: parentRegions } = useQuery({
    queryKey: ['admin-regions', 'SIDO', null, lang],
    queryFn: () => fetchAdminRegions({ level: 'SIDO', lang }),
    enabled: !isSido,
    staleTime: 30 * 60_000,
  });
  const parent = parentCode ? (parentRegions?.find((r) => r.code === parentCode) ?? null) : null;

  const { data: attractions } = useQuery({
    queryKey: ['region-attractions', code, lang],
    queryFn: () =>
      searchAttractions({
        lang,
        ...(isSido ? { sidoCode: code } : { sidoCode: parentCode!, sigunguCode: code.slice(2) }),
        size: TOP_ATTRACTIONS,
      }),
    enabled: region != null,
    staleTime: 10 * 60_000,
  });
  const top = attractions?.attractions ?? [];

  const meta = region ? regionMeta(lang, region, region.attractionCount) : null;
  useSeo(
    region && meta
      ? {
          title: meta.title,
          description: meta.description,
          canonical: regionUrl(lang, region.code),
          lang,
          // 지역 페이지는 관광지 상세와 달리 **진짜 번역쌍**이다 — 같은 코드가 두 언어에 있다
          alternates: placeHreflangAlternates(`/regions/${region.code}`),
          jsonLd: [
            touristDestinationJsonLd(lang, region, top),
            breadcrumbJsonLd(lang, [
              { name: lang === 'en' ? 'Explore Korea' : '한국 관광지 탐색', url: placeUrl(lang) },
              ...(parent
                ? [{ name: regionDisplayName(lang, parent), url: regionUrl(lang, parent.code) }]
                : []),
              { name: meta.heading, url: regionUrl(lang, region.code) },
            ]),
          ],
        }
      : // 조회 실패에 noindex 를 심지 않는다 (AttractionPage 와 같은 이유) — 프리렌더 메타 유지
        { title: '', lang },
  );

  const childRegions = (children ?? []).filter((c) => (c.attractionCount ?? 0) > 0);

  return (
    <div className="place-page">
      <header className="place-header">
        <nav aria-label={lang === 'en' ? 'Breadcrumb' : '탐색 경로'} className="place-region-crumbs">
          <Link className="place-btn" to={placePath(lang)}>
            {L.back}
          </Link>
          {parent && (
            <Link className="place-btn" to={regionPath(lang, parent.code)}>
              {regionDisplayName(lang, parent)}
            </Link>
          )}
        </nav>
      </header>

      {isLoading && <p className="place-empty">{L.loading}</p>}
      {/* 목록을 받았는데 그 코드가 없으면 진짜 '없음'. 조회 자체가 실패한 것은 일시 장애로
          말한다 — 200 응답에 '찾을 수 없음' 문구가 실리면 Soft 404 로 잡힌다 */}
      {!isLoading && siblings && !region && <p className="place-empty">{L.notFound}</p>}
      {isError && <p className="place-empty">{L.failed}</p>}

      {region && meta && (
        <div className="place-body">
          <article className="place-detail" aria-label={meta.heading}>
            <h1 className="place-detail-title">{meta.heading}</h1>
            <p className="place-detail-overview">{meta.description}</p>
            {region.attractionCount != null && region.attractionCount > 0 && (
              <span className="place-chip active">
                {lang === 'en'
                  ? `${region.attractionCount.toLocaleString('en')} attractions`
                  : `관광지 ${region.attractionCount.toLocaleString('ko')}곳`}
              </span>
            )}

            {childRegions.length > 0 && (
              <section aria-label={L.districts}>
                <h2 className="place-subtitle">{L.districts}</h2>
                <div className="place-region-list">
                  {childRegions.map((child: AdminRegion) => (
                    <Link key={child.code} className="place-chip" to={regionPath(lang, child.code)}>
                      {regionDisplayName(lang, child)}
                      <span className="place-region-count">
                        {(child.attractionCount ?? 0).toLocaleString(lang === 'en' ? 'en' : 'ko')}
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            <Link className="place-btn primary" to={placePath(lang)}>
              {L.all}
            </Link>
          </article>

          {top.length > 0 && (
            <section className="place-list" aria-label={L.top}>
              <h2 className="place-subtitle">{L.top}</h2>
              {top.map((a) => (
                <Link key={a.id} className="place-card" to={attractionPath(lang, a.id)}>
                  {a.imageUrl ? (
                    <img className="place-card-img" src={a.imageUrl} alt="" loading="lazy" />
                  ) : (
                    <div className="place-card-img place-card-img-empty" aria-hidden />
                  )}
                  <div className="place-card-body">
                    <h3 className="place-card-title">{a.title}</h3>
                    {titleParts(a).secondary && (
                      <p className="place-card-local">{titleParts(a).secondary}</p>
                    )}
                    {a.category && (
                      <span className="place-card-addr">{placeCategoryLabel(a.category, lang)}</span>
                    )}
                    {a.address && <p className="place-card-addr">{a.address}</p>}
                  </div>
                </Link>
              ))}
            </section>
          )}
        </div>
      )}

      {/* 통합 푸터 + 출처표시 의무 슬롯 — 허브(PlacePage)와 동일 구성 (data-sources.md §0) */}
      <Footer>
        <p>
          <a href={PLACE_ORIGIN}>{placeBrand(lang)}</a>
          {' · '}
          {lang === 'en' ? 'Source: Korea Tourism Organization TourAPI' : '출처: 한국관광공사 TourAPI'}
          {' · GeoNames (CC BY 4.0)'}
        </p>
      </Footer>
    </div>
  );
}
