import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AMENITY_CATEGORIES,
  EVENT_CATEGORY,
  fetchAttraction,
  searchAttractions,
  SIGHT_CATEGORIES,
  STAY_CATEGORY,
  type Attraction,
  type PlaceLang,
} from '../../api/placeApi';
import {
  PLACE_ORIGIN,
  attractionMeta,
  attractionPath,
  attractionBreadcrumbJsonLd,
  attractionUrl,
  placeBrand,
  placeCategoryLabel,
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
import EventLine from './EventLine';
import { googleMapsSearchUrl, loadGoogleMaps, mapsApiKey } from './googleMaps';
import Footer from '../../components/Footer';
import FavoriteButton from '../../components/favorite/FavoriteButton';
import {
  galleryImages,
  groupByCategory,
  introRows,
  isNotFoundError,
  isPlottable,
  overviewText,
  repeatInfoRows,
  sourceText,
  titleParts,
  type IntroRow,
} from './placeView';
import {
  distanceLabel,
  EVENT_PERIOD_LABEL,
  KIND_SECTION_TITLE,
  kindIntroRows,
  placeKind,
  regionHubCode,
  regionPhrase,
  regionPlaceName,
  visitorBadges,
  type PlaceKind,
} from './placeAttributes';
import './PlacePage.css';
import AdSlot from '../../components/ads/AdSlot';
import TrackedLink from '../../analytics/TrackedLink';
import { newViewId } from '../../analytics/identity';
import { installFlushOnLeave } from '../../analytics/tracker';

const UI = {
  ko: { badges: '방문 정보 요약', region: '지역 안 위치', explore: (p: string) => `${p} 둘러보기`, sameCategory: '같은 분류 가까운 곳', similar: '비슷한 곳', back: '← 관광지 탐색', nearby: '주변 명소', amenities: '주변 편의시설', nearbyEvents: '근처 행사', nearbyStays: '근처 숙소', info: '이용 안내', photos: '사진', mapAria: '위치 지도', mapBadCoords: '원천 좌표가 정확하지 않아 지도를 표시하지 않습니다', mapKeyMissing: '지도 키가 설정되지 않아 위치 링크만 표시합니다', useTime: '이용시간', restDate: '쉬는날', useFee: '이용요금', parking: '주차', parkingFee: '주차요금', infoCenter: '문의', map: '구글 지도에서 보기', notFound: '관광지를 찾을 수 없습니다.', failed: '정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.', loading: '불러오는 중…' },
  en: { badges: 'At a glance', region: 'In the area', explore: (p: string) => `Explore ${p}`, sameCategory: 'Similar places nearby', similar: 'Similar places in other regions', back: '← Explore Korea', nearby: 'Nearby places', amenities: 'Nearby amenities', nearbyEvents: 'Nearby events', nearbyStays: 'Nearby stays', info: 'Visitor info', photos: 'Photos', mapAria: 'Location map', mapBadCoords: 'Source coordinates look wrong, so the map is hidden.', mapKeyMissing: 'Map key is not configured — showing the link only.', useTime: 'Hours', restDate: 'Closed', useFee: 'Admission', parking: 'Parking', parkingFee: 'Parking fee', infoCenter: 'Contact', map: 'Open in Google Maps', notFound: 'Attraction not found.', failed: 'Could not load this page. Please try again in a moment.', loading: 'Loading…' },
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

const NEARBY_RADIUS_KM = 5;
/** 주변 명소는 6곳을 보인다. 자기 자신과 위 「같은 분류 가까운 곳」(최대 5)에 나온 곳을 빼고 남는 만큼. */
const NEARBY_SHOWN = 6;
const NEARBY_FETCH = NEARBY_SHOWN + 1 + 5;
/**
 * 상세 지도의 줌. 허브에서 관광지를 고를 때와 같은 상한이다 (ADR-0071 §4) —
 * 건물 단위까지 당기면 "이 근처가 어디인지" 라는 주변 감각이 사라진다.
 */
const DETAIL_ZOOM = 16;
/**
 * 편의시설은 넉넉히 받아 **유형마다 몫을 잘라** 담는다.
 *
 * 거리순 상위만 그대로 쓰면 상점가에서는 전부 쇼핑이 된다 — 명동 영문은 18건 전부,
 * 100건을 받아도 음식이 1건뿐이었다. 그러면 유형별로 묶은 의미가 없다.
 * 60건은 지도 오버레이(OVERLAY_SIZE)와 같은 크기라 이 화면 계열에서 새 숫자가 아니다.
 */
const AMENITY_FETCH = 60;
/** 유형당 최대 — 한 유형이 캐로셀을 다 먹지 않게 한다. 적으면 있는 만큼만 나온다. */
const AMENITY_PER_KIND = 6;
/** 근처 행사 — 축제는 하루 나들이 거리까지 본다. 숙소·명소(5km)보다 넓다. */
const NEARBY_EVENTS_RADIUS_KM = 20;
/** 근처 행사·근처 숙소는 6건까지. 자기 자신과 위 「같은 분류 가까운 곳」(최대 5)을 걸러도 남는 크기로 받는다. */
const NEARBY_KIND_SHOWN = 6;
const NEARBY_KIND_FETCH = NEARBY_KIND_SHOWN + 1 + 5;


/**
 * 관광지 상세 (ADR-0065 / ADR-0062). 검색 UI 의 사이드 패널과 같은 정보를 고유 URL 로 연다 —
 * 고유명사 검색("경복궁", "Gyeongbokgung")의 착지점이 없으면 관광지 데이터 전체가 색인 밖이다.
 */
export default function AttractionPage() {
  useHeritageSurface();
  const { id = '' } = useParams();
  const { pathname } = useLocation();
  const lang: PlaceLang = pathname.startsWith('/en') ? 'en' : 'ko';
  const L = UI[lang];

  const { data: attraction, isLoading, isError, error } = useQuery({
    queryKey: ['attraction', id],
    queryFn: () => fetchAttraction(id),
    enabled: id !== '',
  });

  const { data: nearby } = useQuery({
    queryKey: ['attraction-nearby', id, attraction?.latitude, attraction?.longitude],
    queryFn: () =>
      searchAttractions({
        lang,
        lat: attraction!.latitude,
        lng: attraction!.longitude,
        radiusKm: NEARBY_RADIUS_KM,
        sort: 'distance',
        // 이 절을 빠뜨리면 "주변 명소" 가 주변 상점이 된다 — 적재의 절반 이상이 음식·쇼핑이라
        // 반경 5km 거리순은 상점이 먼저 걸린다 (명동에서 국문·영문 모두 7/7 이 쇼핑이었다).
        category: SIGHT_CATEGORIES.join(','),
        // 자기 자신 + 같은 분류 가까운 곳(최대 5)을 걸러도 6곳이 남는 크기
        size: NEARBY_FETCH,
      }),
    enabled: attraction?.latitude != null && attraction?.longitude != null,
  });

  // 명소에서 걷어낸 상점·음식점은 버리지 않고 아래 캐로셀로 따로 보여준다 —
  // 목록에 섞이면 관광지를 덮지만, 유형이 붙은 채 따로 있으면 그 자리에서 쓸 정보다.
  const { data: nearbyAmenities } = useQuery({
    queryKey: ['attraction-amenities', id, attraction?.latitude, attraction?.longitude],
    queryFn: () =>
      searchAttractions({
        lang,
        lat: attraction!.latitude,
        lng: attraction!.longitude,
        radiusKm: NEARBY_RADIUS_KM,
        sort: 'distance',
        category: AMENITY_CATEGORIES.join(','),
        size: AMENITY_FETCH,
      }),
    enabled: attraction?.latitude != null && attraction?.longitude != null,
  });

  // 근처 행사·근처 숙소 — 「주변 명소」처럼 화면이 그린다. 서버 렌더 본문에는 넣지 않는다(관광지당 조회 한 번 규칙).
  const { data: nearbyEvents } = useQuery({
    queryKey: ['attraction-nearby-events', id, attraction?.latitude, attraction?.longitude],
    queryFn: () =>
      searchAttractions({
        lang,
        lat: attraction!.latitude,
        lng: attraction!.longitude,
        radiusKm: NEARBY_EVENTS_RADIUS_KM,
        category: EVENT_CATEGORY,
        eventStatus: 'NOT_ENDED',
        sort: 'eventStart',
        size: NEARBY_KIND_FETCH,
      }),
    enabled: attraction?.latitude != null && attraction?.longitude != null,
  });

  const { data: nearbyStays } = useQuery({
    queryKey: ['attraction-nearby-stays', id, attraction?.latitude, attraction?.longitude],
    queryFn: () =>
      searchAttractions({
        lang,
        lat: attraction!.latitude,
        lng: attraction!.longitude,
        radiusKm: NEARBY_RADIUS_KM,
        sort: 'distance',
        category: STAY_CATEGORY,
        size: NEARBY_KIND_FETCH,
      }),
    enabled: attraction?.latitude != null && attraction?.longitude != null,
  });

  // 문서 자신의 언어를 SEO 기준으로 삼는다 — id 는 언어별로 다르므로 /en/attractions/{ko-id}
  // 같은 어긋난 주소가 들어올 수 있고, 그때 canonical 이 올바른 쪽을 가리켜야 한다.
  const docLang: PlaceLang = attraction?.lang ?? lang;

  const meta = attraction ? attractionMeta(docLang, attraction) : null;
  // 행사 상태·만료는 렌더 시점의 KST 오늘로 판정한다(서버 렌더와 같은 규칙)
  const today = todayKst();
  const kind = placeKind(attraction?.contentTypeId);
  useSeo(
    attraction && meta
      ? {
          title: meta.title,
          description: meta.description,
          canonical: attractionUrl(docLang, attraction.id),
          lang: docLang,
          image: attraction.imageUrl,
          // 개요가 없으면 제목·주소·좌표뿐이라 본문이 없는 문서다. 사이트맵도 이런 문서를
          // 싣지 않지만(prerender-seo.mjs) 이미 색인된 것은 사이트맵에서 빠져도 남는다 —
          // 빼는 일은 noindex 가 한다. 수집 배치가 개요를 채우면 저절로 풀린다.
          // 끝난 지 31일이 지난 행사도 뺀다 — 서버 렌더와 같은 판정이라 하이드레이션이 robots 를 뒤집지 않는다.
          noindex: attractionNoindex(attraction, today),
          // hreflang 없음 — TourAPI 는 국문/영문을 별도 콘텐츠로 관리해 같은 장소라도
          // id·contentId 가 다르다(경복궁 ko 126508 / en 264337). 짝을 알 수 없으므로
          // 잘못된 대체 주소를 선언하느니 걸지 않는다. 허브(/ ↔ /en)만 진짜 번역쌍이다.
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

  /*
   * 노출 기록용 화면 식별자 (ADR-0095). 관광지가 바뀌면 새 한 벌이다 —
   * 같은 값을 이어 쓰면 다른 관광지에서 본 카드가 같은 노출로 묶인다.
   */
  // eslint-disable-next-line react-hooks/exhaustive-deps -- contentId 가 바뀔 때만 새 한 벌이다
  const viewId = useMemo(() => newViewId(), [attraction?.contentId]);
  // 화면을 떠날 때 아직 안 보낸 노출을 흘린다 — 그 순간의 fetch 는 취소된다.
  useEffect(installFlushOnLeave, []);

  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const [mapFailed, setMapFailed] = useState(false);
  const hasMapKey = mapsApiKey() !== '';
  const lat = attraction?.latitude;
  const lng = attraction?.longitude;
  // 원천이 한반도 밖 좌표를 주는 레코드가 있다 — 그대로 찍으면 바다에 핀이 선다
  const plottable = isPlottable(lat, lng);

  useEffect(() => {
    if (!hasMapKey || !plottable || lat == null || lng == null) return;
    let cancelled = false;
    loadGoogleMaps()
      .then((maps) => {
        if (cancelled || !mapDivRef.current) return;
        const map = new maps.Map(mapDivRef.current, {
          center: { lat, lng },
          zoom: DETAIL_ZOOM,
          clickableIcons: false,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
        });
        new maps.Marker({ map, position: { lat, lng }, title: attraction?.title });
      })
      .catch(() => {
        if (!cancelled) setMapFailed(true);
      });
    return () => {
      cancelled = true;
    };
    // 제목은 마커 툴팁일 뿐이라 바뀌어도 지도를 다시 그리지 않는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMapKey, plottable, lat, lng]);

  // 같은 분류 가까운 곳에 이미 나온 곳은 주변 명소에서 뺀다 — 한 화면에 같은 카드가 두 번 뜬다
  // 재색인 뒤 끝난 행사 항목은 오늘 기준으로 한 번 더 거른다(서버 렌더와 같은 규칙 — 오늘 끝나는 것은 남긴다)
  const notEnded = (n: { eventEndEffective?: string | null }) => !n.eventEndEffective || n.eventEndEffective >= today;
  const sameCategory = (attraction?.region?.sameCategoryNearby ?? []).filter(notEnded);
  const similar = (attraction?.similarElsewhere ?? []).filter(notEnded);
  const shownAbove = new Set(sameCategory.map((n) => n.id));
  const others = (nearby?.attractions ?? [])
    .filter((a) => a.id !== id && !shownAbove.has(a.id))
    .slice(0, NEARBY_SHOWN);
  const badges = attraction ? visitorBadges(attraction, lang) : [];
  const phrase = attraction ? regionPhrase(attraction, lang) : null;
  const hubCode = attraction ? regionHubCode(attraction) : null;
  // 자기 자신과 위에 이미 나온 곳은 뺀다 — 행사 상세의 「같은 분류 가까운 곳」은 행사, 숙박 상세는 숙소다
  const notShown = (a: Attraction) => a.id !== id && !shownAbove.has(a.id);
  const events = (nearbyEvents?.attractions ?? []).filter(notShown).slice(0, NEARBY_KIND_SHOWN);
  const stays = (nearbyStays?.attractions ?? []).filter(notShown).slice(0, NEARBY_KIND_SHOWN);
  const amenities = groupByCategory(
    (nearbyAmenities?.attractions ?? []).filter((a) => a.id !== id),
    AMENITY_PER_KIND,
  );

  return (
    <div className="place-page">
      <header className="place-header">
        <nav aria-label={lang === 'en' ? 'Breadcrumb' : '탐색 경로'}>
          <Link className="place-btn" to={placePath(lang)}>
            {L.back}
          </Link>
        </nav>
      </header>

      {/* 상세 페이지는 지도가 없어 좌우로 나눌 이유가 없다. 허브(PlacePage)의 `22rem | 1fr`
          그리드를 그대로 물려받으면 본문이 20% 칸에 갇혀 설명이 부실해 보인다 —
          위에 이 관광지, 아래에 주변으로 쌓는다 (1440px 실측: 본문 352 → 1344px). */}
      <div className="place-body place-body-stacked">
        {isLoading && <p className="place-empty">{L.loading}</p>}
        {/* 404 일 때만 '없음' 이라고 말한다 — 일시 장애까지 그렇게 쓰면 200 응답에 '찾을 수
            없음' 문구가 실려 Soft 404 로 잡힌다 (placeView.isNotFoundError 주석 참조) */}
        {isError && (
          <p className="place-empty">{isNotFoundError(error) ? L.notFound : L.failed}</p>
        )}

        {attraction && (
          <article className="place-detail" aria-label={attraction.title}>
            {/* 원천 사진은 폭 940px · 대부분 3:2 다(표본 16장 중 15장이 1.4~1.8).
                꽉 채워 자르면 위아래가 날아가고 1360px 로 늘리면 흐려진다. 비율 그대로
                두고 높이만 고정하며, 남는 옆 공간은 같은 사진을 흐리게 깔아 메운다. */}
            {shown && (
              <>
                <div
                  className="place-detail-hero"
                  style={{ backgroundImage: `url(${JSON.stringify(shown.url).slice(1, -1)})` }}
                >
                  <img
                    className="place-detail-img"
                    src={shown.url}
                    alt={shown.name || `${attraction.title}${lang === 'en' ? ' photo' : ' 사진'}`}
                  />
                </div>
                {/* 썸네일 줄 — 사진이 하나뿐이면 고를 것이 없으니 그리지 않는다.
                    원천이 24장까지 주는 곳이 있어 가로 스크롤로 둔다. */}
                {gallery.length > 1 && (
                  <div className="place-gallery" role="group" aria-label={L.photos}>
                    {gallery.map((img, i) => (
                      <button
                        type="button"
                        key={img.url}
                        className="place-gallery-thumb"
                        aria-current={i === shownIndex}
                        aria-label={img.name || `${L.photos} ${i + 1}`}
                        onClick={() => setShownIndex(i)}
                      >
                        <img src={img.url} alt="" loading="lazy" />
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
            <h1 className="place-detail-title">{attraction.title}</h1>
            {/* 원어 병기명은 별도 요소다 — 제목에 괄호로 다시 붙이지 않는다 (t2 백엔드 계약) */}
            {titleParts(attraction).secondary && (
              <p className="place-detail-local">{titleParts(attraction).secondary}</p>
            )}
            {/* 찜 (ADR-0074) — 로그인 전용, 게스트는 로그인으로 복귀 유도 */}
            <FavoriteButton type="ATTRACTION" targetKey={attraction.id} lang={lang} />
            {attraction.category && (
              <span className="place-chip active">{placeCategoryLabel(attraction.category, lang)}</span>
            )}
            {attraction.address && <p className="place-detail-addr">{attraction.address}</p>}
            {attraction.tel && <p className="place-detail-tel">{attraction.tel}</p>}
            {/* 넓은 화면에서 개요와 이용 안내를 나란히 둔다. 세로로 쌓으면 개요가 긴
                관광지(1,400자가 넘는 것도 있다)에서 이용 안내가 화면 밖으로 밀려
                "없는 것"처럼 보인다. 탭으로 감추지 않는 이유는 색인이다 — 이 페이지는
                관광지 5만 건의 착지점이라 접힌 내용이 본문에서 빠지면 안 된다. */}
            <div className="place-detail-read">
              {/* 원천 개요는 평문이 아니다 — <br>·HTML 엔티티가 섞여 오고 국문은 \n 이 온다.
                  overviewText 가 태그·엔티티를 풀고 줄바꿈만 남기며, CSS 가 그것을 살린다. */}
              {overviewText(attraction.overview) && (
                <p className="place-detail-overview">{overviewText(attraction.overview)}</p>
              )}

              {/* 행사 · 숙박 · 여행코스는 일반 이용 안내 대신 유형별 절이다 — 파생 값(이용시간·요금·주차)이
                  같은 원문 키에서 와서 두 번 나가기 때문이다. 서버 렌더와 같은 제목·라벨·순서. */}
              {kind && <KindSection attraction={attraction} kind={kind} lang={lang} today={today} />}

              {/* 이용 안내 (detailIntro2). 원천이 유형마다 다른 키로 주는 것을 서버가 모아 준다.
                  점진 보강이라 아직 안 받은 관광지가 있다 — 값이 없는 줄은 그리지 않고,
                  다 없으면 블록 자체를 내지 않는다(빈 표는 "정보 없음"보다 나쁘다). */}
              {!kind && (() => {
                // 파생 6개(유형별 키를 서버가 모은 것) → 그 다음 원문에만 있는 나머지.
                // 원천이 준 것을 다 보여준다 — 상세는 이 관광지에 대해 아는 전부를 내는 자리다.
                const derived: IntroRow[] = [
                  { key: 'useTime', label: L.useTime, value: attraction.useTime ?? '' },
                  { key: 'restDate', label: L.restDate, value: attraction.restDate ?? '' },
                  { key: 'useFee', label: L.useFee, value: attraction.useFee ?? '' },
                  { key: 'parking', label: L.parking, value: attraction.parking ?? '' },
                  { key: 'parkingFee', label: L.parkingFee, value: attraction.parkingFee ?? '' },
                  { key: 'infoCenter', label: L.infoCenter, value: attraction.infoCenter ?? '' },
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
            </div>

            {/* 아래 셋은 서버 렌더(AttractionPageRenderer)와 같은 문구·같은 순서다 — 개요·이용 안내
                원문 → 방문 정보 요약 → 지역 안 위치 → 같은 분류 가까운 곳 → 비슷한 곳. 해석된 값만 그린다. */}
            {badges.length > 0 && (
              <section className="place-detail-badges" aria-label={L.badges}>
                <h2 className="place-detail-info-title">{L.badges}</h2>
                <ul className="place-badge-list">
                  {badges.map((b) => (
                    <li key={b} className="place-badge">{b}</li>
                  ))}
                </ul>
              </section>
            )}
            {attraction.region && (
              <section className="place-detail-region" aria-label={L.region}>
                <h2 className="place-detail-info-title">{L.region}</h2>
                {phrase && <p className="place-region-phrase">{phrase}</p>}
                {hubCode && (
                  <Link className="place-region-hub" to={regionPath(lang, hubCode)}>
                    {L.explore(regionPlaceName(attraction, lang))}
                  </Link>
                )}
              </section>
            )}
            {sameCategory.length > 0 && (
              <section className="place-detail-same" aria-label={L.sameCategory}>
                <h2 className="place-detail-info-title">{L.sameCategory}</h2>
                <ul className="place-near-list">
                  {sameCategory.map((n, i) => (
                    <li key={n.id}>
                      <TrackedLink
                        className="place-near-link"
                        to={attractionPath(lang, n.id)}
                        viewId={viewId}
                        item={{
                          entityType: 'ATTRACTION',
                          entityId: n.id,
                          screenType: 'ATTRACTION_DETAIL',
                          screenRef: id,
                          sectionId: 'SAME_CATEGORY_NEARBY',
                          sectionIndex: SAME_CATEGORY_SECTION_INDEX,
                          itemIndex: i,
                        }}
                      >
                        <span className="place-near-title">{n.title}</span>
                        <span className="place-near-distance">{distanceLabel(n.distanceMeters)}</span>
                      </TrackedLink>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {/* 다른 시도의 비슷한 곳 — 거리는 뜻이 없어 시도 이름을 둔다(서버 렌더 「{제목} · {시도}」) */}
            {similar.length > 0 && (
              <section className="place-detail-same" aria-label={L.similar}>
                <h2 className="place-detail-info-title">{L.similar}</h2>
                <ul className="place-near-list">
                  {similar.map((n, i) => (
                    <li key={n.id}>
                      <TrackedLink
                        className="place-near-link"
                        to={attractionPath(lang, n.id)}
                        viewId={viewId}
                        item={{
                          entityType: 'ATTRACTION',
                          entityId: n.id,
                          screenType: 'ATTRACTION_DETAIL',
                          screenRef: id,
                          sectionId: 'SIMILAR_ELSEWHERE',
                          sectionIndex: SIMILAR_SECTION_INDEX,
                          itemIndex: i,
                        }}
                      >
                        <span className="place-near-title">{n.title}</span>
                        {n.sidoName && <span className="place-near-distance">{n.sidoName}</span>}
                      </TrackedLink>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* 지도 — 링크만으로는 "어디쯤인지" 를 이 화면에서 알 수 없다.
                키가 없거나 로더가 실패하면 아래 링크가 그대로 그 역할을 한다. */}
            {!plottable ? (
              <div className="place-map place-detail-map place-map-placeholder">
                {L.mapBadCoords}
              </div>
            ) : hasMapKey && !mapFailed ? (
              <div
                ref={mapDivRef}
                className="place-map place-detail-map"
                role="application"
                aria-label={`${attraction.title} ${L.mapAria}`}
              />
            ) : (
              <div className="place-map place-detail-map place-map-placeholder">
                {L.mapKeyMissing}
              </div>
            )}
            <a
              className="place-btn"
              href={googleMapsSearchUrl(attraction)}
              target="_blank"
              rel="noreferrer"
            >
              {L.map}
            </a>
            <AttractionLinks links={attraction.links} lang={lang} />
          </article>
        )}

        {others.length > 0 && (
          <section className="place-list" aria-label={L.nearby}>
            <h2 className="place-subtitle">{L.nearby}</h2>
            {others.map((a, i) => (
              <TrackedLink
                key={a.id}
                className="place-card"
                to={attractionPath(lang, a.id)}
                viewId={viewId}
                item={{
                  entityType: 'ATTRACTION',
                  entityId: a.id,
                  screenType: 'ATTRACTION_DETAIL',
                  screenRef: id,
                  sectionId: 'NEARBY_ATTRACTIONS',
                  sectionIndex: NEARBY_SECTION_INDEX,
                  itemIndex: i,
                }}
              >
                {a.imageUrl ? (
                  <img className="place-card-img" src={a.imageUrl} alt="" loading="lazy" />
                ) : (
                  <div className="place-card-img place-card-img-empty" aria-hidden />
                )}
                <div className="place-card-body">
                  <h3 className="place-card-title">{a.title}</h3>
                  {titleParts(a).secondary && <p className="place-card-local">{titleParts(a).secondary}</p>}
                  {a.address && <p className="place-card-addr">{a.address}</p>}
                </div>
              </TrackedLink>
            ))}
          </section>
        )}

        {amenities.length > 0 && (
          <section className="place-amenities" aria-label={L.amenities}>
            <h2 className="place-subtitle">{L.amenities}</h2>
            {/* 카드는 위 "주변 명소" 와 같은 .place-card 를 쓴다 — 같은 화면에서 크기가 다르면
                아래쪽이 덤처럼 보인다. 다른 것은 가로로 이어진다는 점뿐이다. */}
            <ul className="place-amenity-row">
              {amenities.map((a, i) => (
                <li key={a.id} className="place-amenity-slide">
                  {/* 캐로셀 안 순서(itemIndex)를 섹션 순서(sectionIndex)와 따로 남긴다 —
                      한 칸으로 누르면 「캐로셀 3번째」와 「3번째 섹션」이 구분되지 않는다 */}
                  <TrackedLink
                    className="place-card"
                    to={attractionPath(lang, a.id)}
                    viewId={viewId}
                    item={{
                      entityType: 'ATTRACTION',
                      entityId: a.id,
                      screenType: 'ATTRACTION_DETAIL',
                      screenRef: id,
                      sectionId: 'AMENITY_CAROUSEL',
                      sectionIndex: AMENITY_SECTION_INDEX,
                      itemIndex: i,
                    }}
                  >
                    {a.imageUrl ? (
                      <img className="place-card-img" src={a.imageUrl} alt="" loading="lazy" />
                    ) : (
                      <div className="place-card-img place-card-img-empty" aria-hidden />
                    )}
                    <div className="place-card-body">
                      {a.category && (
                        <span className="place-amenity-kind">
                          {placeCategoryLabel(a.category, lang)}
                        </span>
                      )}
                      <h3 className="place-card-title">{titleParts(a).primary}</h3>
                      {a.address && <p className="place-card-addr">{a.address}</p>}
                    </div>
                  </TrackedLink>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* 편의시설 캐로셀에서 옮겨 온 숙박 몫 — 같은 자리(바로 아래)에 같은 카드로 둔다 */}
        <NearbyCarousel
          title={L.nearbyStays}
          items={stays}
          lang={lang}
          viewId={viewId}
          screenRef={id}
          sectionId="NEARBY_STAYS"
          sectionIndex={NEARBY_STAYS_SECTION_INDEX}
        />
        <NearbyCarousel
          title={L.nearbyEvents}
          items={events}
          lang={lang}
          viewId={viewId}
          screenRef={id}
          sectionId="NEARBY_EVENTS"
          sectionIndex={NEARBY_EVENTS_SECTION_INDEX}
        />
      </div>

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

      {/* 통합 푸터 + 출처표시 의무 슬롯 — 허브(PlacePage)와 동일 구성 (data-sources.md §0) */}
      <Footer lang={lang}>
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

/**
 * 근처 행사·근처 숙소 캐로셀 — 편의시설 캐로셀과 같은 카드·같은 가로 줄이다. 카드에 거리(행사는 기간·상태도)를 붙인다.
 * 0건이면 절을 그리지 않는다 — 영문 숙박은 211건뿐이라 대부분 0건이 정상이다.
 */
function NearbyCarousel({
  title,
  items,
  lang,
  viewId,
  screenRef,
  sectionId,
  sectionIndex,
}: {
  title: string;
  items: Attraction[];
  lang: PlaceLang;
  viewId: string;
  screenRef: string;
  sectionId: 'NEARBY_EVENTS' | 'NEARBY_STAYS';
  sectionIndex: number;
}) {
  if (items.length === 0) return null;
  return (
    <section className="place-amenities" aria-label={title} data-place-section={sectionId}>
      <h2 className="place-subtitle">{title}</h2>
      <ul className="place-amenity-row">
        {items.map((a, i) => (
          <li key={a.id} className="place-amenity-slide">
            <TrackedLink
              className="place-card"
              to={attractionPath(lang, a.id)}
              viewId={viewId}
              item={{
                entityType: 'ATTRACTION',
                entityId: a.id,
                screenType: 'ATTRACTION_DETAIL',
                screenRef,
                sectionId,
                sectionIndex,
                itemIndex: i,
              }}
            >
              {a.imageUrl ? (
                <img className="place-card-img" src={a.imageUrl} alt="" loading="lazy" />
              ) : (
                <div className="place-card-img place-card-img-empty" aria-hidden />
              )}
              <div className="place-card-body">
                <h3 className="place-card-title">{titleParts(a).primary}</h3>
                {a.distanceKm != null && (
                  <span className="place-near-distance">{distanceLabel(Math.round(a.distanceKm * 1000))}</span>
                )}
                <EventLine attraction={a} lang={lang} />
                {a.address && <p className="place-card-addr">{a.address}</p>}
              </div>
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
