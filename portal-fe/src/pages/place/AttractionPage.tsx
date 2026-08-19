import { Link, useParams, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchAttraction, searchAttractions, type PlaceLang } from '../../api/placeApi';
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
import './PlacePage.css';

const UI = {
  ko: { back: '← 관광지 탐색', nearby: '주변 명소', map: '구글 지도에서 보기', notFound: '관광지를 찾을 수 없습니다.', loading: '불러오는 중…' },
  en: { back: '← Explore Korea', nearby: 'Nearby places', map: 'Open in Google Maps', notFound: 'Attraction not found.', loading: 'Loading…' },
} as const;

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

  const { data: attraction, isLoading, isError } = useQuery({
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
        radiusKm: 5,
        sort: 'distance',
        size: 7,
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
      : isError
        ? { title: `${L.notFound} | ${placeBrand(lang)}`, lang, noindex: true }
        : { title: '', lang }, // 로딩 중 — 이미 심어둔 메타를 유지한다
  );

  const others = (nearby?.attractions ?? []).filter((a) => a.id !== id).slice(0, 6);

  return (
    <div className="place-page">
      <header className="place-header">
        <nav aria-label={lang === 'en' ? 'Breadcrumb' : '탐색 경로'}>
          <Link className="place-btn" to={placePath(lang)}>
            {L.back}
          </Link>
        </nav>
      </header>

      <div className="place-body">
        {isLoading && <p className="place-empty">{L.loading}</p>}
        {isError && <p className="place-empty">{L.notFound}</p>}

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
            {attraction.category && (
              <span className="place-chip active">{placeCategoryLabel(attraction.category, lang)}</span>
            )}
            {attraction.address && <p className="place-detail-addr">{attraction.address}</p>}
            {attraction.tel && <p className="place-detail-tel">{attraction.tel}</p>}
            {attraction.overview && <p className="place-detail-overview">{attraction.overview}</p>}
            <a
              className="place-btn"
              href={`https://www.google.com/maps/search/?api=1&query=${attraction.latitude},${attraction.longitude}`}
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
                  {a.address && <p className="place-card-addr">{a.address}</p>}
                </div>
              </Link>
            ))}
          </section>
        )}
      </div>

      <footer className="place-footer">
        <a href={PLACE_ORIGIN}>{placeBrand(lang)}</a>
      </footer>
    </div>
  );
}
