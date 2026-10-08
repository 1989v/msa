import { useLocation, useParams } from 'react-router-dom';
import landings from '../../content/place-landings.json';
import { PLACE_LANDING_ATTRS, PLACE_ORIGIN, landingPath } from '../../seo/copy.mjs';
import NotFoundPage from '../NotFoundPage';
import PlacePage from './PlacePage';
import type { AttributeChipId } from './placeAttributes';

/** 커밋된 랜딩 목록의 항목 — 은퇴 표시는 일부 항목에만 있다 */
interface PlaceLandingEntry {
  lang: string;
  code: string;
  sidoCode: string;
  attr: string;
  retired?: boolean;
}
const LANDINGS = landings as ReadonlyArray<PlaceLandingEntry>;

/**
 * 속성 랜딩 `/regions/{시군구 5자리}/{attr}` — 「부산 중구 주차 가능 관광지」.
 * 목록(place-landings.json)에 있는 (언어, 코드, 속성)만 연다. 없으면 404 화면이다 — nginx 도 파일이 없어 404 를 낸다.
 * 화면은 허브를 프리셋으로 연 것이다(지역·속성을 고른 채 시작).
 */
export default function PlaceLandingRoute() {
  const { code = '', attr = '' } = useParams();
  const { pathname } = useLocation();
  const lang = pathname.startsWith('/en') ? 'en' : 'ko';
  const entry = LANDINGS.find((e) => e.lang === lang && e.code === code && e.attr === attr);
  const def = PLACE_LANDING_ATTRS.find((a) => a.attr === attr);
  if (!entry || !def) return <NotFoundPage />;
  return (
    // 다른 랜딩으로 옮기면 새로 마운트한다 — 프리셋은 useState 초기값이라 같은 인스턴스에서는 다시 읽지 않는다
    <PlacePage
      key={`${lang}/${code}/${attr}`}
      preset={{
        sidoCode: entry.sidoCode,
        sigunguCode: entry.code.slice(2),
        attribute: def.chipId as AttributeChipId,
        retired: entry.retired === true,
        seo: { code: entry.code, attr: entry.attr, canonical: `${PLACE_ORIGIN}${landingPath(lang, entry.code, entry.attr)}` },
      }}
    />
  );
}
