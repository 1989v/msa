import type { Attraction } from '../../api/placeApi';

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

/**
 * 유형별로 묶되 **한 줄로** 이어 붙인다 — 유형마다 캐로셀을 만들면 관광지 하나에
 * 가로 스크롤러가 셋 생겨 화면이 스크롤러 더미가 된다.
 *
 * 유형 순서는 그 자리에 실제로 많은 쪽이 앞이다 — 관광지마다 상점가인지 먹자골목인지 다르고,
 * 순서를 고정해 두면 해운대에서도 쇼핑이 음식 앞에 온다.
 * 각 유형은 거리순 앞에서부터 `perKind` 개만 가져간다.
 */
export function groupByCategory(items: Attraction[], perKind: number): Attraction[] {
  const byCategory = new Map<string, Attraction[]>();
  for (const item of items) {
    const key = item.category ?? '';
    const bucket = byCategory.get(key);
    if (bucket) bucket.push(item);
    else byCategory.set(key, [item]);
  }
  return [...byCategory.values()]
    .sort((a, b) => b.length - a.length)
    .map((bucket) => bucket.slice(0, perKind))
    .flat();
}

/**
 * 지도에 찍어도 되는 좌표인지.
 *
 * **원천이 틀린 좌표를 준다.** TourAPI 의 `계남근린공원`(contentId 2611568)은 주소가
 * 서울 양천구인데 mapx/mapy 가 117.99 / 19.69 로 온다 — 대만·필리핀 사이 바다다.
 * 같은 이름·같은 주소의 정상 레코드(3428372)가 따로 있는 중복이고, 원천에서 그렇게 준다.
 * 2026-09-05 기준 59,735건 중 39건(0.065%)이 이 범위 밖이고 2건은 0,0 이다.
 *
 * **값은 지우지 않는다** — 원천이 준 것은 그대로 두고 노출에서만 거른다
 * (data-sources.md §0 ②). 언젠가 원천이 고치면 그때부터 저절로 정상이 된다.
 *
 * 범위는 대한민국 극점 기준으로 조금 넉넉히: 남 마라도 33.06 · 북 고성 38.6 ·
 * 서 백령도 124.61 · 동 독도 131.87.
 */
export function isPlottable(lat: number | null | undefined, lng: number | null | undefined): boolean {
  if (lat == null || lng == null) return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  return lat >= 33.0 && lat <= 38.7 && lng >= 124.5 && lng <= 132.0;
}

/* ─── detailIntro2 원문 펼치기 ───────────────────────────────────────────────
 * 원천은 같은 개념을 관광 타입마다 다른 키로 준다: `usetime` / `usetimeculture` /
 * `usetimeleports` / `opentimefood` …. 접미사를 떼고 개념 하나로 모으면 라벨 표를
 * 20개쯤으로 줄일 수 있고, **원천이 새 타입을 추가해도 따라간다.**
 */

/** 관광 타입 접미사 — 길이 내림차순으로 지워야 `food` 가 `lodging` 앞을 먹지 않는다. */
const TYPE_SUFFIXES = ['babycarriage', 'creditcard', 'festival', 'lodging', 'shopping',
                       'culture', 'leports', 'food'] as const;

export function introBaseKey(key: string): string {
  const lower = key.toLowerCase();
  // chk* 는 접미사가 개념의 일부다 (chkbabycarriage = 유모차) — 그것만 먼저 통과시킨다
  for (const concept of ['chkbabycarriage', 'chkcreditcard', 'chkpet']) {
    if (lower.startsWith(concept)) return concept;
  }
  for (const suffix of TYPE_SUFFIXES) {
    if (lower.endsWith(suffix) && lower.length > suffix.length) return lower.slice(0, -suffix.length);
  }
  return lower;
}

/** 화면에 낼 값이 아닌 것 — 식별자와 내부 번호. */
const INTRO_SKIP = new Set(['contentid', 'contenttypeid', 'lcnsno']);

/**
 * 파생 컬럼이 이미 보여 주는 개념 — 여기에 라벨을 달면 같은 값이 두 줄로 나온다.
 * 별도 제외 목록을 두지 않는 이유: 라벨이 없으면 어차피 안 나오므로 그 목록은 한 번도
 * 걸리지 않는 죽은 가드가 된다(실제로 그렇게 만들었다가 회귀가 안 물려서 걷어냈다).
 * 대신 **아래 표에 이 개념이 없다는 것**을 테스트가 지킨다.
 */
export const INTRO_DERIVED_CONCEPTS = ['usetime', 'opentime', 'restdate', 'usefee',
                                       'parking', 'parkingfee', 'infocenter'] as const;

export const INTRO_LABELS: Record<string, { ko: string; en: string }> = {
  expguide: { ko: '체험 안내', en: 'Programs' },
  expagerange: { ko: '체험 가능 연령', en: 'Age range' },
  spendtime: { ko: '소요시간', en: 'Time needed' },
  useseason: { ko: '이용 시기', en: 'Season' },
  accomcount: { ko: '수용 인원', en: 'Capacity' },
  chkbabycarriage: { ko: '유모차 대여', en: 'Stroller rental' },
  chkcreditcard: { ko: '신용카드', en: 'Credit cards' },
  chkpet: { ko: '반려동물 동반', en: 'Pets' },
  kidsfacility: { ko: '어린이 놀이방', en: 'Kids area' },
  restroom: { ko: '화장실', en: 'Restrooms' },
  firstmenu: { ko: '대표 메뉴', en: 'Signature dish' },
  treatmenu: { ko: '취급 메뉴', en: 'Menu' },
  saleitem: { ko: '판매 품목', en: 'Items sold' },
  fairday: { ko: '장서는 날', en: 'Market days' },
  opendate: { ko: '개장일', en: 'Opened' },
  scale: { ko: '규모', en: 'Scale' },
  heritage: { ko: '문화재 지정', en: 'Designated heritage' },
};

export interface IntroRow {
  key: string;
  label: string;
  value: string;
}

/**
 * 원문 JSON → 화면에 낼 줄 목록. 파생 컬럼이 이미 보여 주는 것과 식별자는 뺀다.
 *
 * **라벨이 없는 키는 내지 않는다** — 원천 키 이름(`chkcreditcardleports`)을 그대로
 * 라벨로 쓰면 안 보여 주느니만 못하다. 원천이 새 필드를 늘리면 여기 한 줄을 더한다.
 */
export function introRows(raw: string | null | undefined, lang: 'ko' | 'en'): IntroRow[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];   // 원문이 깨져 있어도 화면은 살아야 한다
  }
  if (!parsed || typeof parsed !== 'object') return [];

  const rows: IntroRow[] = [];
  const used = new Set<string>();
  for (const [key, rawValue] of Object.entries(parsed as Record<string, unknown>)) {
    const value = String(rawValue ?? '').trim();
    if (!value) continue;
    const base = introBaseKey(key);
    if (INTRO_SKIP.has(base)) continue;

    // heritage1~3 은 지정 여부 플래그다 — 0 은 "아님" 이지 정보가 아니고, 1 이면 한 줄로 합친다
    const concept = /^heritage\d$/.test(base) ? 'heritage' : base;
    if (concept === 'heritage') {
      if (value !== '1' || used.has('heritage')) continue;
    }
    const label = INTRO_LABELS[concept];
    if (!label || used.has(concept)) continue;
    used.add(concept);
    rows.push({
      key: concept,
      label: lang === 'en' ? label.en : label.ko,
      value: concept === 'heritage' ? (lang === 'en' ? 'Yes' : '지정') : value,
    });
  }
  return rows;
}

/* ─── 개요 본문 정리 ────────────────────────────────────────────────────────
 * 원천(TourAPI)의 `overview` 는 **평문이 아니다.** 표본 720건에서 실제로 관측된 것:
 *   `<br />` 24 · `<br>` 3 · `<em>`/`<b>`/`<strong>`/`<div class=…>` 소수
 *   `&rsquo;` 32 · `&ldquo;`/`&rdquo;` 각 10 · `&nbsp;` 8 · `&ndash;` 5 · `&lt;`/`&gt;`/`&amp;` …
 * 국문은 대신 `\n` 이 들어온다(180건 중 30건).
 *
 * 지금까지 이걸 그대로 <p> 에 넣어서, 영문 화면에 `<br />` 와 `&rsquo;` 가 **글자로 보이고**
 * 국문은 개행이 공백으로 접혀 문단 구분이 사라졌다 (2026-09-05 라이브 실측).
 */

/** 관측된 엔티티만 명시적으로 푼다. innerHTML 을 쓰지 않는다 — 원천 문자열을 HTML 로 해석하면
 *  거기 담긴 것이 무엇이든 실행 경로가 열린다. 모르는 엔티티는 건드리지 않고 그대로 둔다. */
const ENTITIES: Record<string, string> = {
  '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'",
  '&lsquo;': '‘', '&rsquo;': '’', '&ldquo;': '“', '&rdquo;': '”',
  '&ndash;': '–', '&mdash;': '—', '&hellip;': '…', '&middot;': '·',
  '&deg;': '°', '&eacute;': 'é', '&times;': '×',
};

/**
 * 원천 개요 → 화면에 낼 평문. 줄바꿈은 `\n` 으로 남기고 화면이 `white-space: pre-line` 으로 살린다.
 *
 * 태그를 지우는 것이지 서식을 살리는 것이 아니다 — `<em>` 을 기울임으로 되살리려면 원천 HTML 을
 * 신뢰해야 하는데, 우리가 통제하지 않는 문자열이라 그러지 않는다. 줄바꿈만 뜻이 분명해 살린다.
 */
export function overviewText(raw: string | null | undefined): string {
  if (!raw) return '';
  let text = raw.replace(/\r\n?/g, '\n');
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/(p|div|li)>/gi, '\n');
  text = text.replace(/<[^>]*>/g, '');
  text = text.replace(/&[a-zA-Z]+;/g, (m) => ENTITIES[m.toLowerCase()] ?? m);
  text = text.replace(/&#(\d{1,6});/g, (_, code) => {
    const n = Number(code);
    // 제어문자는 되돌리지 않는다 — 화면에 보이지 않으면서 줄만 어그러뜨린다
    return n >= 32 && n <= 0x10ffff ? String.fromCodePoint(n) : '';
  });
  // 원천이 <br /><br /><br /> 처럼 겹쳐 보내는 곳이 있다 — 빈 줄은 하나까지만
  text = text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n');
  return text.trim();
}
