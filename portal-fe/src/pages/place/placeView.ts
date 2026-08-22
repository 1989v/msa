/**
 * PlacePage 의 화면 로직 중 DOM/지도 없이 검증 가능한 순수 함수.
 * 무한 스크롤 페이지 전개와 표시명 분리는 조건이 미묘해 컴포넌트 밖으로 꺼내 테스트한다.
 */

/** 다음 페이지 번호 — 더 없으면 null. IO 센티널과 '더 보기' 버튼이 같은 판정을 쓴다. */
export function nextPage(current: number, totalPages: number): number | null {
  return current + 1 < totalPages ? current + 1 : null;
}

/**
 * 무한 스크롤 누적 (모바일 전용). page 0 은 새 검색이라 통째로 교체하고,
 * 이후 페이지는 뒤에 붙인다. 검색 도중 문서가 밀리면 같은 id 가 두 페이지에
 * 걸칠 수 있어 — React key 중복 경고와 중복 카드를 막기 위해 — id 로 걸러낸다.
 */
export function mergePages<T extends { id: string }>(prev: T[], incoming: T[], page: number): T[] {
  if (page === 0) return incoming;
  const seen = new Set(prev.map((item) => item.id));
  const fresh = incoming.filter((item) => !seen.has(item.id));
  return fresh.length === 0 ? prev : [...prev, ...fresh];
}

/**
 * 관광지 표시명 분리 — title 이 정제된 주 표시명, titleLocal 이 괄호에서 분리된 원어명.
 * 필드가 없는 구 응답, 빈 문자열, 주 표시명과 같은 값이면 보조명을 내지 않는다.
 * 두 이름을 다시 한 문자열로 합치는 소비처를 만들지 않는다 (백엔드가 분리한 이유가 사라진다).
 */
export function titleParts(doc: { title: string; titleLocal?: string | null }): {
  primary: string;
  secondary: string | null;
} {
  const local = (doc.titleLocal ?? '').trim();
  return { primary: doc.title, secondary: local && local !== doc.title ? local : null };
}

/**
 * 진짜 "없는 자원"과 일시적 장애를 가른다.
 *
 * 둘을 뭉뚱그려 "찾을 수 없습니다"를 띄우면, 게이트웨이가 잠깐 흔들린 사이 크롤러가
 * 본 페이지가 **200 인데 '찾을 수 없음' 문구**를 담게 된다 — 구글이 정의하는 Soft 404 다
 * (2026-08-22 /attractions/1 실측). 404 일 때만 "없음"이라고 말한다.
 */
export function isNotFoundError(error: unknown): boolean {
  const status = (error as { response?: { status?: number } } | null)?.response?.status;
  return status === 404 || status === 410;
}
