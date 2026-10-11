import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useParams, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  fetchAirQuality,
  fetchAttraction,
  fetchAttractionNearby,
  fetchWeather,
  type Attraction,
  type PlaceLang,
} from '../../api/placeApi';
import {
  PLACE_ORIGIN,
  attractionHreflangAlternates,
  attractionMeta,
  attractionPath,
  attractionBreadcrumbJsonLd,
  attractionPhone,
  attractionUrl,
  placeBrand,
  placeCategoryLabel,
  placeFeed,
  placePath,
  regionPath,
  attractionJsonLd,
} from '../../seo/copy.mjs';
import {
  attractionNoindex,
  effectivePeriod,
  eventPeriodLabel,
  eventStatusText,
  todayKst,
} from '../../seo/eventSchedule';
import { useSeo } from '../../seo/useSeo';
import { useHeritageSurface } from '../../hooks/useHeritageSurface';
import AttractionLinks from './AttractionLinks';
import AttractionConditions from './AttractionConditions';
import AttractionInfoTabs from './AttractionInfoTabs';
import { googleMapsDirectionsUrl, googleMapsSearchUrl, mapsApiKey } from './googleMaps';
import NearbyExplore from './NearbyExplore';
import PhotoViewer from './PhotoViewer';
import { exploreItems, type ExploreKind } from './exploreItems';
import Footer from '../../components/Footer';
import FavoriteButton from '../../components/favorite/FavoriteButton';
import { useResumeFavoriteIntent } from '../../components/favorite/useResumeFavoriteIntent';
import SharePanel from '../../components/share/SharePanel';
import {
  galleryImages,
  groupByCategory,
  introRows,
  isNotFoundError,
  isPlottable,
  overviewText,
  repeatInfoRows,
  secureImageUrl,
  sourceText,
  titleParts,
  type IntroRow,
} from './placeView';
import {
  barrierFreeIcons,
  barrierFreeRows,
  EVENT_PERIOD_LABEL,
  KIND_SECTION_TITLE,
  kindIntroRows,
  placeKind,
  regionHubCode,
  regionPhrase,
  placeSourceLine,
  campingRows,
  regionPlaceName,
  visitorBadges,
  visitSummary,
  wellnessLine,
  type PlaceKind,
} from './placeAttributes';
import { siteSignalSentences, visitorTrendLinkLabel } from './visitSignals';
import './PlacePage.css';
import './RegionSiteSignals.css';
import AdSlot from '../../components/ads/AdSlot';
import TrackedLink from '../../analytics/TrackedLink';
import { newViewId } from '../../analytics/identity';
import { installFlushOnLeave, track } from '../../analytics/tracker';

const UI = {
  ko: { summary: '방문 요약', region: '지역 안 위치', explore: (p: string) => `${p} 둘러보기`, similar: '다른 지역의 비슷한 곳', related: '여기 온 사람들이 함께 간 곳', back: '← 관광지 탐색', info: '이용 안내', photos: '사진', more: '본문 전체 보기', parkingFee: '주차요금', map: '구글 지도에서 보기', directions: '길찾기', notFound: '관광지를 찾을 수 없습니다.', failed: '정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.', loading: '불러오는 중…' },
  en: { summary: 'Visit summary', region: 'In the area', explore: (p: string) => `Explore ${p}`, similar: 'Similar places in other regions', related: 'Where visitors also went', back: '← Explore Korea', info: 'Visitor info', photos: 'Photos', more: 'Read the full description', parkingFee: 'Parking fee', map: 'Open in Google Maps', directions: 'Directions', notFound: 'Attraction not found.', failed: 'Could not load this page. Please try again in a moment.', loading: 'Loading…' },
} as const;

/** 주변 검색 반경 — 명소 목록과 편의시설 캐로셀이 같은 값을 쓴다. */
/*
 * 화면 안 섹션 순서 (ADR-0095). 배치를 바꾸면 여기도 같이 바꾼다 — 이 값이 원장에 남아
 * 나중에 「그때 몇 번째였나」를 복원하는 근거가 된다.
 */
const SAME_CATEGORY_SECTION_INDEX = 0;
const SIMILAR_SECTION_INDEX = 1;
const NEARBY_SECTION_INDEX = 2;
const AMENITY_SECTION_INDEX = 3;
const NEARBY_STAYS_SECTION_INDEX = 4;
const NEARBY_EVENTS_SECTION_INDEX = 5;
/** 화면에서는 비슷한 곳 바로 아래지만 번호는 붙인 순서다 — 이미 쌓인 원장의 번호를 바꾸지 않는다 */
const RELATED_SECTION_INDEX = 6;

/*
 * 주변 검색 조건(반경·분류·받는 수)은 서버(search NearbyAttractionsService)가 갖는다. 화면은 받은 목록을 자른다.
 * 편의시설은 유형마다 몫을 잘라 담는다 — 거리순 상위만 그대로 쓰면 상점가에서는 전부 쇼핑이 된다.
 */
/** 편의시설 유형당 최대 — 한 유형이 목록을 다 먹지 않게 한다. 적으면 있는 만큼만 나온다. */
const AMENITY_PER_KIND = 6;
/** 숙소·행사는 6건까지 */
const NEARBY_KIND_SHOWN = 6;
/** 사진 타일을 처음에 몇 장 두나 — 넓은 화면 2열 × 3줄, 좁은 화면 한 줄 6칸 */
const PHOTO_TILES = 6;


/**
 * 관광지 상세 (ADR-0065 / ADR-0062). 검색 UI 의 사이드 패널과 같은 정보를 고유 URL 로 연다 —
 * 고유명사 검색("경복궁", "Gyeongbokgung")의 착지점이 없으면 관광지 데이터 전체가 색인 밖이다.
 */
export default function AttractionPage() {
  useHeritageSurface();
  const { id = '' } = useParams();
  const { pathname, search, hash } = useLocation();
  const lang: PlaceLang = pathname.startsWith('/en') ? 'en' : 'ko';
  const L = UI[lang];

  const { data: attraction, isLoading, isError, error } = useQuery({
    queryKey: ['attraction', id],
    queryFn: () => fetchAttraction(id),
    enabled: id !== '',
  });

  // 주변 탐색 — 명소·숙소·행사·편의시설을 서버가 한 번에 찾는다(ADR-0105, 관광지 id 키라 엣지 캐시). 처음 받은 목록만 쓴다.
  const { data: nearby } = useQuery({
    queryKey: ['attraction-nearby', id],
    queryFn: () => fetchAttractionNearby(id),
    enabled: attraction?.latitude != null && attraction?.longitude != null,
    staleTime: 10 * 60_000,
  });

  // 시군구 날씨 — place 레디스 캐시 경로(ADR-0071 §10). 조회 시점에 그리고 서버 렌더 본문에는 넣지 않는다.
  // 실패하면 절만 빠진다 — 상세의 나머지를 막지 않는다.
  const weatherCode = attraction ? regionHubCode(attraction) : null;
  const { data: weather } = useQuery({
    queryKey: ['attraction-weather', weatherCode],
    queryFn: () => fetchWeather(weatherCode!),
    enabled: weatherCode != null && weatherCode.length === 5,
    staleTime: 30 * 60_000,
  });
  // 대기 — 같은 시군구의 최근접 측정소(에어코리아, 매시). 같은 캐시 경로 · 같은 실패 처리
  const { data: air } = useQuery({
    queryKey: ['attraction-air', weatherCode],
    queryFn: () => fetchAirQuality(weatherCode!),
    enabled: weatherCode != null && weatherCode.length === 5,
    staleTime: 10 * 60_000,
  });

  // 문서 자신의 언어를 SEO 기준으로 삼는다 — id 는 언어별로 다르므로 /en/attractions/{ko-id}
  // 같은 어긋난 주소가 들어올 수 있고, 그때 canonical 이 올바른 쪽을 가리켜야 한다.
  // 서버 렌더와 같이 en 외는 ko 로 본다 — 정규화 없이 비교하면 그 밖의 언어 문서는 어느 라우트에서도 어긋나 이동이 돈다.
  const docLang: PlaceLang = attraction ? (attraction.lang === 'en' ? 'en' : 'ko') : lang;

  const meta = attraction ? attractionMeta(docLang, attraction) : null;
  // 행사 상태·만료는 렌더 시점의 KST 오늘로 판정한다(서버 렌더와 같은 규칙)
  const today = todayKst();
  const kind = placeKind(attraction?.contentTypeId);
  const seoNoindex = attraction ? attractionNoindex(attraction, today) : false;
  useSeo(
    attraction && meta
      ? {
          title: meta.title,
          description: meta.description,
          canonical: attractionUrl(docLang, attraction.id),
          lang: docLang,
          image: secureImageUrl(attraction.imageUrl),
          // 개요가 없으면 제목·주소·좌표뿐이라 본문이 없는 문서다. 사이트맵도 이런 문서를
          // 싣지 않지만(prerender-seo.mjs) 이미 색인된 것은 사이트맵에서 빠져도 남는다 —
          // 빼는 일은 noindex 가 한다. 수집 배치가 개요를 채우면 저절로 풀린다.
          // 끝난 지 31일이 지난 행사도 뺀다 — 서버 렌더와 같은 판정이라 하이드레이션이 robots 를 뒤집지 않는다.
          noindex: seoNoindex,
          // 서버 렌더가 심은 피드 링크를 하이드레이션이 지우지 않게 같은 값을 넘긴다
          feeds: [placeFeed(docLang)],
          // 언어 대체 짝이고 짝 스위치(`search.alternate-pairs.enabled`, 기본 꺼짐)가 켜졌을 때만 hreflang
          // (ADR-0062 §8 개정). TourAPI 국·영은 id 가 다른 별개 문서라 짝은 재색인이 판정해 `alternateId` 로 싣는다.
          // 서버 렌더와 같은 조건 — 짝이 없거나 noindex 면 키를 넘기지 않는다.
          ...(attraction.alternateId && !seoNoindex
            ? { alternates: attractionHreflangAlternates(docLang, attraction.id, attraction.alternateId) }
            : {}),
          jsonLd: [
            // 유형별(행사 Event · 숙박 LodgingBusiness · 코스 TouristTrip) — 서버가 심은 것과 같은 함수다
            attractionJsonLd(docLang, attraction),
            // 세 칸(허브 › 시도 › 관광지)은 서버 렌더와 같은 함수가 만든다 — 하이드레이션이
            // 서버가 심은 breadcrumb 을 갈아끼우므로 어긋나면 렌더 전후로 지역 단계가 바뀐다.
            // 시도 이름은 색인이 들고 있다 (ADR-0095).
            attractionBreadcrumbJsonLd(docLang, attraction),
          ],
        }
      : // 조회 실패·로딩 중에는 메타를 건드리지 않는다. 실패에 noindex 를 심으면 게이트웨이가
        // 잠깐 흔들린 사이 크롤러가 들어왔을 때 멀쩡한 페이지가 색인에서 빠진다 —
        // 2026-08-22 실측: /attractions/1 이 'NOINDEX 태그에 의해 제외' 판정을 받았다.
        // 프리렌더 HTML 이 이미 정확한 메타를 갖고 있으므로 그대로 두는 쪽이 항상 옳다.
        { title: '', lang },
  );

  /*
   * 위치 지도. 허브(PlacePage)와 같은 로더·같은 폴백을 쓴다 — 키가 없으면 지도를 그리는 대신
   * 안내 문구를 두고 "구글 지도에서 보기" 링크가 그 역할을 이어받는다 (data-sources.md §7).
   *
   * 관광지 하나만 보여주므로 클러스터러가 필요 없다. 좌표는 상세 응답에 이미 있어
   * 지도 때문에 API 를 더 부르지 않는다.
   */
  /*
   * 갤러리. 대표사진 + 부가 사진(detailImage2). 고른 장을 **번호**로 들고 있어야
   * 관광지를 옮겨 다닐 때 남은 URL 이 새 관광지에 잘못 걸리지 않는다.
   */
  const gallery = useMemo(
    () => galleryImages(attraction?.imagesRaw, attraction?.imageUrl),
    [attraction?.imagesRaw, attraction?.imageUrl],
  );
  const [shownIndex, setShownIndex] = useState(0);
  // 다른 관광지로 넘어가면 첫 장으로 되돌린다 — 안 하면 3번째 장을 보던 상태가
  // 사진이 1장뿐인 관광지로 넘어가 아무것도 안 보이게 된다.
  useEffect(() => setShownIndex(0), [attraction?.contentId]);
  const shown = gallery[shownIndex] ?? gallery[0];
  // 타일 목록을 다 폈는지 — 다른 관광지로 넘어가면 다시 접는다
  const [tilesOpen, setTilesOpen] = useState(false);
  useEffect(() => setTilesOpen(false), [attraction?.contentId]);
  // 큰 사진 크게 보기
  const [viewerOpen, setViewerOpen] = useState(false);
  useEffect(() => setViewerOpen(false), [attraction?.contentId]);

  /*
   * 노출 기록용 화면 식별자 (ADR-0095). 관광지가 바뀌면 새 한 벌이다 —
   * 같은 값을 이어 쓰면 다른 관광지에서 본 카드가 같은 노출로 묶인다.
   */
  // eslint-disable-next-line react-hooks/exhaustive-deps -- contentId 가 바뀔 때만 새 한 벌이다
  const viewId = useMemo(() => newViewId(), [attraction?.contentId]);
  // 화면을 떠날 때 아직 안 보낸 노출을 흘린다 — 그 순간의 fetch 는 취소된다.
  useEffect(installFlushOnLeave, []);
  // 로그인 복귀의 찜 마저 하기 — 상세는 주소가 곧 상태라 의도만 이어 받는다
  const resumeNotice = useResumeFavoriteIntent({ screenType: 'ATTRACTION_DETAIL', screenRef: id, viewId }, lang);

  const hasMapKey = mapsApiKey() !== '';
  const lat = attraction?.latitude;
  const lng = attraction?.longitude;
  // 원천이 한반도 밖 좌표를 주는 레코드가 있다 — 그대로 찍으면 바다에 핀이 선다
  const plottable = isPlottable(lat, lng);

  /*
   * 개요 접기 — 좁은 화면에서만 높이를 자르고(CSS) 「본문 전체 보기」로 편다. 넓은 화면은
   * 자르지 않으니 넘침이 없고 버튼도 안 나온다. 글은 DOM 에 그대로 있어 색인에서 빠지지 않는다.
   */
  const overviewRef = useRef<HTMLParagraphElement | null>(null);
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [overviewClipped, setOverviewClipped] = useState(false);
  useEffect(() => setOverviewOpen(false), [attraction?.contentId]);
  useLayoutEffect(() => {
    const measure = () => {
      const el = overviewRef.current;
      setOverviewClipped(!!el && el.scrollHeight > el.clientHeight + 4);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [attraction?.overview, overviewOpen]);

  // 재색인 뒤 끝난 행사 항목은 오늘 기준으로 한 번 더 거른다(서버 렌더와 같은 규칙 — 오늘 끝나는 것은 남긴다)
  const notEnded = (n: { eventEndEffective?: string | null }) => !n.eventEndEffective || n.eventEndEffective >= today;
  const sameCategory = (attraction?.region?.sameCategoryNearby ?? []).filter(notEnded);
  const similar = (attraction?.similarElsewhere ?? []).filter(notEnded);
  // 함께 간 곳은 색인에 실린 목록 그대로 — 비슷한 곳과 겹쳐도 거르지 않는다(근거가 다른 두 목록, 서버 렌더와 같은 규칙)
  const related = attraction?.relatedPlaces ?? [];
  // 일반 유형은 방문 요약(칸 + 배지 줄)이 배지를 대신한다 — 정보 탭에 같은 값을 두 번 두지 않는다
  const summary = attraction && !kind ? visitSummary(attraction, lang) : null;
  const badges = attraction && kind ? visitorBadges(attraction, lang) : [];
  // 문의 원문이 있으면 그것을, 없으면 tel 을 행동 줄 전화로 — tel 을 쓸 때는 제목 아래 전화 줄을 빼서 한 번만 낸다
  const infoCenterPhone = attraction ? attractionPhone(attraction.infoCenter) : null;
  const phone = infoCenterPhone ?? (attraction ? attractionPhone(attraction.tel) : null);
  /*
   * 브레드크럼의 지역 단계(시도 · 시군구) — 구조화 데이터와 같은 함수에서 뽑는다. 단계 조건(시군구는 시도·두 코드·이름을
   * 다 알 때만)을 화면에 따로 두면 화면과 BreadcrumbList 가 갈린다. 첫 칸(허브)·끝 칸(이 관광지)은 뺀다.
   */
  const crumbs = attraction
    ? attractionBreadcrumbJsonLd(lang, attraction)
        .itemListElement.slice(1, -1)
        .map((c: { name: string; item: string }) => ({ name: c.name, to: new URL(c.item).pathname }))
    : [];
  const accessIcons = attraction ? barrierFreeIcons(attraction, lang) : [];
  const accessRows = attraction ? barrierFreeRows(attraction, lang) : [];
  const wellness = attraction ? wellnessLine(attraction, lang) : null;
  const phrase = attraction ? regionPhrase(attraction, lang) : null;
  const hubCode = attraction ? regionHubCode(attraction) : null;
  // 이 사이트 근거 줄(찜·클릭, 하한 이상만) + 시군구 방문 추이 링크. 시군구 방문자 수치는 상세에 내지 않는다 —
  // 같은 숫자가 시군구 안 관광지 전부에 붙는다. 링크는 시군구 코드와 이름을 다 알 때만.
  const siteSignals = attraction ? siteSignalSentences(attraction, lang) : [];
  const sigunguName = attraction?.region?.sigunguName?.trim();
  const trendLink = hubCode && sigunguName ? { to: regionPath(lang, hubCode), label: visitorTrendLinkLabel(sigunguName, lang) } : null;

  /*
   * 주변 목록 다섯을 「주변 탐색」 한 줄로. 처음 받은 목록만 쓴다 — 지도를 옮겨도 다시 부르지 않는다.
   * 배열을 고정해 둬야 지도가 렌더마다 다시 그려지지 않는다.
   */
  const explore = useMemo(
    () =>
      exploreItems({
        selfId: id,
        sights: nearby?.sights ?? [],
        sameCategory,
        sameCategoryKind: (kind === 'event' ? 'event' : kind === 'stay' ? 'stay' : 'sight') as ExploreKind,
        stays: (nearby?.stays ?? []).filter((a) => a.id !== id).slice(0, NEARBY_KIND_SHOWN),
        events: (nearby?.events ?? []).filter((a) => a.id !== id).slice(0, NEARBY_KIND_SHOWN),
        amenities: groupByCategory((nearby?.amenities ?? []).filter((a) => a.id !== id), AMENITY_PER_KIND),
        index: {
          NEARBY_ATTRACTIONS: NEARBY_SECTION_INDEX,
          SAME_CATEGORY_NEARBY: SAME_CATEGORY_SECTION_INDEX,
          NEARBY_STAYS: NEARBY_STAYS_SECTION_INDEX,
          NEARBY_EVENTS: NEARBY_EVENTS_SECTION_INDEX,
          AMENITY_CAROUSEL: AMENITY_SECTION_INDEX,
        },
      }),
    // sameCategory 는 attraction 에서 나온다 — 같은 문서면 같은 목록이다
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, kind, today, attraction?.region, nearby],
  );
  const center = useMemo(
    () => (plottable && lat != null && lng != null ? { lat, lng } : null),
    [plottable, lat, lng],
  );

  // 어긋난 언어 라우트는 문서 언어 주소로 옮긴다(서버는 같은 경우 301). 모든 훅 뒤에 둔다 — 앞에서 반환하면 훅 순서가 깨진다.
  // 쿼리 키가 id 뿐이라 옮긴 뒤 상세를 다시 받지 않는다.
  if (attraction && docLang !== lang) {
    return <Navigate replace to={`${attractionPath(docLang, attraction.id)}${search}${hash}`} />;
  }

  return (
    <div className="place-page">
      <header className="place-header">
        <nav className="place-crumbs" aria-label={lang === 'en' ? 'Breadcrumb' : '탐색 경로'}>
          <Link className="place-btn" to={placePath(lang)}>
            {L.back}
          </Link>
          {crumbs.map((c: { name: string; to: string }) => (
            <Fragment key={c.to}>
              <span className="place-crumb-sep" aria-hidden="true">›</span>
              <Link className="place-crumb" to={c.to}>
                {c.name}
              </Link>
            </Fragment>
          ))}
        </nav>
      </header>

      {/* 상세 페이지는 지도가 없어 좌우로 나눌 이유가 없다. 허브(PlacePage)의 `22rem | 1fr`
          그리드를 그대로 물려받으면 본문이 20% 칸에 갇혀 설명이 부실해 보인다 —
          위에 이 관광지, 아래에 주변으로 쌓는다 (1440px 실측: 본문 352 → 1344px). */}
      <main className="place-body place-body-stacked">
        {isLoading && <p className="place-empty">{L.loading}</p>}
        {/* 404 일 때만 '없음' 이라고 말한다 — 일시 장애까지 그렇게 쓰면 200 응답에 '찾을 수
            없음' 문구가 실려 Soft 404 로 잡힌다 (placeView.isNotFoundError 주석 참조) */}
        {isError && (
          <p className="place-empty">{isNotFoundError(error) ? L.notFound : L.failed}</p>
        )}

        {attraction && (
          <article className="place-detail" aria-label={attraction.title}>
            {/* 첫 화면 — 제목 · 방문 요약 · 행동 줄 → 개요 → 사진 → 유형별 절 · 이용 안내. 서버 렌더와 같은 순서다.
                넓은 화면은 위 줄이 「요약 | 사진」, 아래 줄이 「개요 | 이용 안내」인 격자다(PlacePage.css .place-detail-first). */}
            <div className="place-detail-first">
              <div className="place-detail-lead">
                {/* 찜 (ADR-0074) — 제목 바로 오른쪽 별. 로그인 전용, 게스트는 로그인으로 복귀 유도 */}
                <div className="favorite-title-row">
                  <h1 className="place-detail-title">{attraction.title}</h1>
                  <FavoriteButton
                    type="ATTRACTION"
                    targetKey={attraction.id}
                    lang={lang}
                    tracking={{ screenType: 'ATTRACTION_DETAIL', screenRef: id, viewId }}
                  />
                </div>
                {/* 원어 병기명은 별도 요소다 — 제목에 괄호로 다시 붙이지 않는다 (t2 백엔드 계약) */}
                {titleParts(attraction).secondary && (
                  <p className="place-detail-local">{titleParts(attraction).secondary}</p>
                )}
                <SharePanel
                  shortUrl={attraction.shortUrl}
                  url={attractionUrl(docLang, attraction.id)}
                  title={attraction.title}
                  lang={lang}
                  onShare={(channel) =>
                    track(
                      'CLICK',
                      {
                        entityType: 'ATTRACTION',
                        entityId: attraction.id,
                        screenType: 'ATTRACTION_DETAIL',
                        screenRef: id,
                        sectionId: 'SHARE',
                        payload: { kind: 'attraction', channel },
                      },
                      viewId,
                    )
                  }
                />
                {attraction.category && (
                  <span className="place-chip active">{placeCategoryLabel(attraction.category, lang)}</span>
                )}
                {attraction.tel && infoCenterPhone && <p className="place-detail-tel">{attraction.tel}</p>}
                {summary && (
                  <section className="place-visit" aria-label={L.summary} data-place-section="visit-summary">
                    <dl className="place-detail-info-list">
                      {summary.rows.map((row) => (
                        <div className="place-detail-info-row" key={row.label}>
                          <dt>{row.label}</dt>
                          <dd>{row.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                )}
                {summary?.badgeLine && (
                  <p className="place-visit-badges" data-place-section="visit-badges">
                    {summary.badgeLine}
                  </p>
                )}
                {(siteSignals.length > 0 || trendLink) && (
                  <div className="place-visit-signals" data-place-section="visit-signals">
                    {siteSignals.map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                    {trendLink && <Link to={trendLink.to}>{trendLink.label}</Link>}
                  </div>
                )}
                {/* 행동 줄 — 길찾기(화면 전용)와 문의 전화. 번호 모양이 없으면 원문만 글로 둔다 */}
                <div className="place-detail-actions" data-place-section="actions">
                  {/* 지도 열기 — 선택 뒤 후속 행동이라 노출은 보내지 않는다(TrackedLink 를 쓰지 않는다).
                      기본 동작(새 탭)은 그대로고, 계측이 이동을 막지 않는다 */}
                  <a
                    className="place-btn"
                    href={googleMapsSearchUrl(attraction)}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() =>
                      track(
                        'CLICK',
                        {
                          entityType: 'ATTRACTION',
                          entityId: attraction.id,
                          screenType: 'ATTRACTION_DETAIL',
                          screenRef: id,
                          sectionId: 'MAP_LINK',
                          payload: { kind: 'google_maps_search' },
                        },
                        viewId,
                      )
                    }
                  >
                    {L.map}
                  </a>
                  <a
                    className="place-btn"
                    href={googleMapsDirectionsUrl(attraction)}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() =>
                      track(
                        'CLICK',
                        {
                          entityType: 'ATTRACTION',
                          entityId: attraction.id,
                          screenType: 'ATTRACTION_DETAIL',
                          screenRef: id,
                          sectionId: 'DIRECTIONS',
                          payload: { kind: 'google_maps_directions' },
                        },
                        viewId,
                      )
                    }
                  >
                    {L.directions}
                  </a>
                  {phone &&
                    (phone.href ? (
                      <a className="place-btn place-detail-phone" href={phone.href}>
                        {phone.text}
                      </a>
                    ) : (
                      <span className="place-detail-phone">{phone.text}</span>
                    ))}
                </div>
              </div>
              {/* 원천 개요는 평문이 아니다 — <br>·HTML 엔티티가 섞여 오고 국문은 \n 이 온다.
                  overviewText 가 태그·엔티티를 풀고 줄바꿈만 남기며, CSS 가 그것을 살린다. */}
              {overviewText(attraction.overview) && (
                <div className="place-detail-overview-box">
                  <p
                    ref={overviewRef}
                    className="place-detail-overview"
                    data-clamped={!overviewOpen || undefined}
                    data-overflow={overviewClipped || undefined}
                  >
                    {overviewText(attraction.overview)}
                  </p>
                  {overviewClipped && !overviewOpen && (
                    <button type="button" className="place-detail-more" onClick={() => setOverviewOpen(true)}>
                      {L.more}
                    </button>
                  )}
                </div>
              )}
              {/* 원천 사진은 폭 940px · 대부분 3:2 다(표본 16장 중 15장이 1.4~1.8).
                  꽉 채워 자르면 위아래가 날아가고 1360px 로 늘리면 흐려진다. 비율 그대로
                  두고 높이만 고정하며, 남는 옆 공간은 같은 사진을 흐리게 깔아 메운다. */}
              {shown && (
                <>
                  {/* 큰 사진 + 다른 사진 타일 목록. 넓은 화면은 오른쪽(2열, 영역 안에서 스크롤), 좁은 화면은 아래 한 줄(6칸).
                      처음에는 [PHOTO_TILES] 장만 두고 마지막 칸에 남은 수를 얹는다 — 누르면 전부 편다. */}
                  <div className="place-detail-photos" data-single={gallery.length <= 1 || undefined}>
                    <div
                      className="place-detail-hero"
                      style={{ backgroundImage: `url(${JSON.stringify(shown.url).slice(1, -1)})` }}
                    >
                      <img
                        className="place-detail-img"
                        src={shown.url}
                        alt={shown.name || `${attraction.title}${lang === 'en' ? ' photo' : ' 사진'}`}
                      />
                      {gallery.length > 1 && (
                        <span className="place-detail-photo-count">
                          {shownIndex + 1} / {gallery.length}
                        </span>
                      )}
                      {/* 사진 전체를 덮는 단추 — 누르면 크게 보기를 연다 */}
                      <button
                        type="button"
                        className="place-detail-hero-open"
                        aria-label={lang === 'en' ? 'View photo larger' : '사진 크게 보기'}
                        onClick={() => setViewerOpen(true)}
                      />
                    </div>
                    {viewerOpen && (
                      <PhotoViewer
                        images={gallery}
                        index={shownIndex}
                        onIndex={setShownIndex}
                        onClose={() => setViewerOpen(false)}
                        title={attraction.title}
                        lang={lang}
                      />
                    )}
                    {gallery.length > 1 && (() => {
                      const others = gallery.map((img, i) => ({ img, i })).filter(({ i }) => i !== shownIndex);
                      const tiles = tilesOpen ? others : others.slice(0, PHOTO_TILES);
                      const rest = others.length - tiles.length;
                      return (
                        <div className="place-detail-tiles" role="group" aria-label={L.photos} data-open={tilesOpen || undefined}>
                          {tiles.map(({ img, i }, k) => {
                            const last = k === tiles.length - 1 && rest > 0;
                            return (
                              <button
                                type="button"
                                key={img.url}
                                className="place-detail-tile"
                                aria-label={last ? `${L.photos} +${rest}` : img.name || `${L.photos} ${i + 1}`}
                                onClick={() => (last ? setTilesOpen(true) : setShownIndex(i))}
                              >
                                <img src={img.url} alt="" loading="lazy" />
                                {last && <span className="place-detail-tile-more">+{rest}</span>}
                              </button>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                </>
              )}
              <div className="place-detail-side">
                {/* 행사 · 숙박 · 여행코스는 일반 이용 안내 대신 유형별 절이다 — 파생 값(이용시간·요금·주차)이
                    같은 원문 키에서 와서 두 번 나가기 때문이다. 서버 렌더와 같은 제목·라벨·순서. */}
                {kind && <KindSection attraction={attraction} kind={kind} lang={lang} today={today} />}

                {/* 이용 안내 (detailIntro2). 원천이 유형마다 다른 키로 주는 것을 서버가 모아 준다.
                    점진 보강이라 아직 안 받은 관광지가 있다 — 값이 없는 줄은 그리지 않고,
                    다 없으면 블록 자체를 내지 않는다(빈 표는 "정보 없음"보다 나쁘다). */}
                {!kind && (() => {
                  // 이용시간·쉬는날·이용요금·주차·문의는 방문 요약·행동 줄이 보여 주므로 뺀다 — 남는 파생 값은 주차요금뿐이다.
                  // 그 다음 원문에만 있는 나머지. 반복정보의 요금 행도 남긴다(어느 행이 요금인지 고르는 규칙 사본을 두지 않는다).
                  // 원천이 준 것을 다 보여준다 — 상세는 이 관광지에 대해 아는 전부를 내는 자리다.
                  const derived: IntroRow[] = [
                    { key: 'parkingFee', label: L.parkingFee, value: attraction.parkingFee ?? '' },
                  ];
                  // 이용정보에도 <br>·엔티티가 섞여 온다 — 개요와 같은 정리를 거친다
                  // 반복정보(detailInfo2)는 라벨을 원천이 준다 — 예약안내·코스안내 등
                  const rows = [
                    ...derived,
                    ...introRows(attraction.introRaw, lang),
                    ...repeatInfoRows(attraction.infoRaw),
                  ]
                    .map((r) => ({ ...r, value: sourceText(r.value) }))
                    .filter((r) => r.value.trim().length > 0);
                  if (rows.length === 0) return null;
                  return (
                    <section className="place-detail-info" aria-label={L.info}>
                      <h2 className="place-detail-info-title">{L.info}</h2>
                      <dl className="place-detail-info-list">
                        {rows.map((row) => (
                          <div className="place-detail-info-row" key={row.key}>
                            <dt>{row.label}</dt>
                            <dd>{row.value}</dd>
                          </div>
                        ))}
                      </dl>
                    </section>
                  );
                })()}
                {(() => {
                  // 캠핑장 정보 — 고캠핑 원문 중 place 가 고른 키(예약 URL 은 오지 않는다). 서버 렌더 「캠핑장 정보」 절과 같은 줄
                  const rows = campingRows(attraction.camping, lang);
                  if (rows.length === 0) return null;
                  const title = lang === 'en' ? 'Campsite' : '캠핑장 정보';
                  return (
                    <section className="place-detail-info" aria-label={title} data-place-section="camping">
                      <h2 className="place-detail-info-title">{title}</h2>
                      <dl className="place-detail-info-list">
                        {rows.map((row) => (
                          <div className="place-detail-info-row" key={row.label}>
                            <dt>{row.label}</dt>
                            <dd>{row.value}</dd>
                          </div>
                        ))}
                      </dl>
                    </section>
                  );
                })()}
              </div>
            </div>

            {/* 방문 정보(주소·속성·지역 안 위치) · 접근성 — 지도 위에 탭으로, 내용은 칩. 서버 렌더는 절을 그대로 쌓는다(색인용) */}
            <AttractionInfoTabs
              badges={badges}
              wellness={wellness}
              accessIcons={accessIcons}
              accessRows={accessRows}
              address={attraction.address ?? null}
              phrase={attraction.region ? phrase : null}
              hub={attraction.region && hubCode ? { to: regionPath(lang, hubCode), label: L.explore(regionPlaceName(attraction, lang)) } : null}
              samePlace={attraction.samePlace ?? []}
              lang={lang}
            />
            {/* 주변 탐색 — 같은 분류 가까운 곳 · 주변 명소 · 숙소 · 행사 · 편의시설을 지도 한 장과 목록 하나로.
                지도를 못 그리면(키 없음 · 좌표 이상 · 로더 실패) 목록만 남고 아래 링크가 위치를 대신한다. */}
            <NearbyExplore
              items={explore}
              center={center}
              centerTitle={attraction.title}
              showMap={hasMapKey && plottable}
              lang={lang}
              viewId={viewId}
              screenRef={id}
            />
            {/* 날씨·대기질·혼잡 — 주변 탐색(지도) 아래, 탭 하나로. 서버 렌더에는 없는 절이다 */}
            <AttractionConditions
              weather={weather}
              place={regionPlaceName(attraction, lang)}
              air={air}
              congestion={attraction.congestion}
              latitude={attraction.latitude}
              longitude={attraction.longitude}
              today={today}
              lang={lang}
            />
            <AttractionLinks links={attraction.links} lang={lang} />
            {/* 거리와 무관한 추천 둘 — 주변 탐색과 따로, 탭으로 묶는다 */}
            <RecommendTabs similar={similar} related={related} lang={lang} viewId={viewId} screenRef={id} />
          </article>
        )}

      </main>

      {/* 지도와 주변 목록을 다 본 뒤 (ADR-0076). 행사·숙박·코스 상세에는 지면을 두지 않는다 —
          원천 개요를 그대로 쓰는 페이지가 반려 사유였고, 지면을 다시 켜는 재심사 뒤에도 유지한다. */}
      {!kind && (
        <AdSlot
          placement="attraction-end"
          contextKey={attraction?.sidoCode ? `place:${attraction.sidoCode}` : ''}
          shape="horizontal"
          minHeight={90}
        />
      )}

      {resumeNotice && (
        <p className="favorite-resume-notice" role="status">
          {resumeNotice}
        </p>
      )}

      {/* 통합 푸터 + 출처표시 의무 슬롯 — 허브(PlacePage)와 동일 구성 (data-sources.md §0) */}
      <Footer lang={lang}>
        <p>
          <a href={PLACE_ORIGIN}>{placeBrand(lang)}</a>
          {' · '}
          {placeSourceLine(attraction, lang)}
          {' · GeoNames (CC BY 4.0)'}
        </p>
      </Footer>
    </div>
  );
}

/**
 * 비슷한 곳 · 함께 간 곳 — 거리와 무관한 두 추천을 탭으로 묶는다. 하나만 있으면 탭 없이 그 목록이다.
 * 클릭 기록 섹션은 각자 그대로(SIMILAR_ELSEWHERE · RELATED_PLACES).
 */
function RecommendTabs({
  similar,
  related,
  lang,
  viewId,
  screenRef,
}: {
  similar: Array<{ id: string; title: string; sidoName?: string | null }>;
  related: Array<{ id: string; title: string; category?: string | null }>;
  lang: PlaceLang;
  viewId: string;
  screenRef: string;
}) {
  const L = UI[lang];
  const tabs = [
    { key: 'similar' as const, title: L.similar, items: similar.map((n) => ({ id: n.id, title: n.title, note: n.sidoName ?? null })) },
    { key: 'related' as const, title: L.related, items: related.map((n) => ({ id: n.id, title: n.title, note: n.category ?? null })) },
  ].filter((t) => t.items.length > 0);
  const [picked, setPicked] = useState<'similar' | 'related'>('similar');
  if (tabs.length === 0) return null;
  const current = tabs.find((t) => t.key === picked) ?? tabs[0];
  const sectionId = current.key === 'similar' ? 'SIMILAR_ELSEWHERE' : 'RELATED_PLACES';
  const sectionIndex = current.key === 'similar' ? SIMILAR_SECTION_INDEX : RELATED_SECTION_INDEX;
  return (
    <section className="place-detail-same" aria-label={current.title} data-place-section="recommend">
      {tabs.length > 1 ? (
        <div className="place-tabs" role="tablist">
          {tabs.map((t) => (
            <button
              type="button"
              role="tab"
              key={t.key}
              className="place-tab"
              aria-selected={t.key === current.key}
              onClick={() => setPicked(t.key)}
            >
              {t.title}
            </button>
          ))}
        </div>
      ) : (
        <h2 className="place-detail-info-title">{current.title}</h2>
      )}
      <ul className="place-near-list" role={tabs.length > 1 ? 'tabpanel' : undefined}>
        {current.items.map((n, i) => (
          <li key={n.id}>
            <TrackedLink
              className="place-near-link"
              to={attractionPath(lang, n.id)}
              viewId={viewId}
              item={{
                entityType: 'ATTRACTION',
                entityId: n.id,
                screenType: 'ATTRACTION_DETAIL',
                screenRef,
                sectionId,
                sectionIndex,
                itemIndex: i,
              }}
            >
              <span className="place-near-title">{n.title}</span>
              {n.note && <span className="place-near-distance">{n.note}</span>}
            </TrackedLink>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** 유형별 절 — 서버 렌더 `typeSection` 과 같은 구성. 그릴 것이 없으면 절을 내지 않는다. */
function KindSection({
  attraction,
  kind,
  lang,
  today,
}: {
  attraction: Attraction;
  kind: PlaceKind;
  lang: PlaceLang;
  today: string;
}) {
  const period = kind === 'event' ? effectivePeriod(attraction.eventStart, attraction.eventEnd) : null;
  const status = kind === 'event' ? eventStatusText(period, today, lang) : null;
  const rows = [
    ...(period ? [{ key: 'period', label: EVENT_PERIOD_LABEL[lang], value: eventPeriodLabel(period) }] : []),
    ...kindIntroRows(attraction.introRaw, kind, lang),
  ];
  const stops = kind === 'course' ? (attraction.courseStops ?? []) : [];
  if (!status && rows.length === 0 && stops.length === 0) return null;
  const title = KIND_SECTION_TITLE[kind][lang];
  return (
    <section className="place-detail-info" aria-label={title} data-place-section={kind}>
      <h2 className="place-detail-info-title">{title}</h2>
      {status && (
        <p className="place-event-status" data-event-status>
          {status}
        </p>
      )}
      {rows.length > 0 && (
        <dl className="place-detail-info-list">
          {rows.map((row) => (
            <div className="place-detail-info-row" key={row.key}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {stops.length > 0 && (
        <ol className="place-course-stops">
          {stops.map((stop, i) => (
            <li key={`${i}-${stop.contentId ?? stop.name}`}>
              {stop.attractionId != null ? (
                <Link to={attractionPath(lang, String(stop.attractionId))}>{stop.name}</Link>
              ) : (
                stop.name
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
