import { Link, useParams, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AMENITY_CATEGORIES,
  fetchAttraction,
  searchAttractions,
  SIGHT_CATEGORIES,
  type PlaceLang,
} from '../../api/placeApi';
import {
  PLACE_ORIGIN,
  attractionMeta,
  attractionPath,
  attractionUrl,
  breadcrumbJsonLd,
  placeBrand,
  placeCategoryLabel,
  placePath,
  placeUrl,
  touristAttractionJsonLd,
} from '../../seo/copy.mjs';
import { useSeo } from '../../seo/useSeo';
import { useHeritageSurface } from '../../hooks/useHeritageSurface';
import AttractionLinks from './AttractionLinks';
import { googleMapsSearchUrl } from './googleMaps';
import Footer from '../../components/Footer';
import FavoriteButton from '../../components/favorite/FavoriteButton';
import { groupByCategory, isNotFoundError, titleParts } from './placeView';
import './PlacePage.css';
import AdSlot from '../../components/ads/AdSlot';
import { ADSENSE_SLOTS } from '../../seo/copy.mjs';

const UI = {
  ko: { back: '← 관광지 탐색', nearby: '주변 명소', amenities: '주변 편의시설', map: '구글 지도에서 보기', notFound: '관광지를 찾을 수 없습니다.', failed: '정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.', loading: '불러오는 중…' },
  en: { back: '← Explore Korea', nearby: 'Nearby places', amenities: 'Nearby amenities', map: 'Open in Google Maps', notFound: 'Attraction not found.', failed: 'Could not load this page. Please try again in a moment.', loading: 'Loading…' },
} as const;

/** 주변 검색 반경 — 명소 목록과 편의시설 캐로셀이 같은 값을 쓴다. */
const NEARBY_RADIUS_KM = 5;
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
        size: 7,
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

  // 문서 자신의 언어를 SEO 기준으로 삼는다 — id 는 언어별로 다르므로 /en/attractions/{ko-id}
  // 같은 어긋난 주소가 들어올 수 있고, 그때 canonical 이 올바른 쪽을 가리켜야 한다.
  const docLang: PlaceLang = attraction?.lang ?? lang;
  const meta = attraction ? attractionMeta(docLang, attraction) : null;
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
          noindex: !attraction.overview,
          // hreflang 없음 — TourAPI 는 국문/영문을 별도 콘텐츠로 관리해 같은 장소라도
          // id·contentId 가 다르다(경복궁 ko 126508 / en 264337). 짝을 알 수 없으므로
          // 잘못된 대체 주소를 선언하느니 걸지 않는다. 허브(/ ↔ /en)만 진짜 번역쌍이다.
          jsonLd: [
            touristAttractionJsonLd(docLang, attraction),
            breadcrumbJsonLd(docLang, [
              { name: docLang === 'en' ? 'Explore Korea' : '한국 관광지 탐색', url: placeUrl(docLang) },
              { name: meta.heading, url: attractionUrl(docLang, attraction.id) },
            ]),
          ],
        }
      : // 조회 실패·로딩 중에는 메타를 건드리지 않는다. 실패에 noindex 를 심으면 게이트웨이가
        // 잠깐 흔들린 사이 크롤러가 들어왔을 때 멀쩡한 페이지가 색인에서 빠진다 —
        // 2026-08-22 실측: /attractions/1 이 'NOINDEX 태그에 의해 제외' 판정을 받았다.
        // 프리렌더 HTML 이 이미 정확한 메타를 갖고 있으므로 그대로 두는 쪽이 항상 옳다.
        { title: '', lang },
  );

  const others = (nearby?.attractions ?? []).filter((a) => a.id !== id).slice(0, 6);
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
            {attraction.imageUrl && (
              <img
                className="place-detail-img"
                src={attraction.imageUrl}
                alt={`${attraction.title}${lang === 'en' ? ' photo' : ' 사진'}`}
              />
            )}
            <h1 className="place-detail-title">{attraction.title}</h1>
            {/* 원어 병기명은 별도 요소다 — 제목에 괄호로 다시 붙이지 않는다 (t2 백엔드 계약) */}
            {titleParts(attraction).secondary && (
              <p className="place-detail-local">{titleParts(attraction).secondary}</p>
            )}
            {/* 찜 (ADR-0074) — 로그인 전용, 게스트는 로그인으로 복귀 유도 */}
            <FavoriteButton type="ATTRACTION" targetKey={attraction.id} />
            {attraction.category && (
              <span className="place-chip active">{placeCategoryLabel(attraction.category, lang)}</span>
            )}
            {attraction.address && <p className="place-detail-addr">{attraction.address}</p>}
            {attraction.tel && <p className="place-detail-tel">{attraction.tel}</p>}
            {attraction.overview && <p className="place-detail-overview">{attraction.overview}</p>}
            <a
              className="place-btn"
              href={googleMapsSearchUrl(attraction)}
              target="_blank"
              rel="noreferrer"
            >
              {L.map}
            </a>
            <AttractionLinks id={attraction.id} lang={lang} />
          </article>
        )}

        {others.length > 0 && (
          <section className="place-list" aria-label={L.nearby}>
            <h2 className="place-subtitle">{L.nearby}</h2>
            {others.map((a) => (
              <Link key={a.id} className="place-card" to={attractionPath(lang, a.id)}>
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
              </Link>
            ))}
          </section>
        )}

        {amenities.length > 0 && (
          <section className="place-amenities" aria-label={L.amenities}>
            <h2 className="place-subtitle">{L.amenities}</h2>
            {/* 카드는 위 "주변 명소" 와 같은 .place-card 를 쓴다 — 같은 화면에서 크기가 다르면
                아래쪽이 덤처럼 보인다. 다른 것은 가로로 이어진다는 점뿐이다. */}
            <ul className="place-amenity-row">
              {amenities.map((a) => (
                <li key={a.id} className="place-amenity-slide">
                  <Link className="place-card" to={attractionPath(lang, a.id)}>
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
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {/* 지도와 주변 목록을 다 본 뒤 (ADR-0076) */}
      <AdSlot slot={ADSENSE_SLOTS.attractionEnd} shape="horizontal" minHeight={90} />

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
