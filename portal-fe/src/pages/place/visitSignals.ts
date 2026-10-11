import type { PlaceLang } from '../../api/placeApi';

/*
 * 방문 근거 — 「사람이 몰린다」는 신호를 근거마다 따로 보인다. 셋을 합친 점수·순위는 만들지 않는다.
 *
 *   KTO_REGION_VISITORS  한국관광공사 시군구 방문자 수(이동통신 추정). 「방문자」라는 말은 이 근거에만 쓴다.
 *   SITE_SAVES           이 사이트 회원의 찜 수(코드 이름의 saved = 찜).
 *   SITE_CLICKS          이 사이트 이용자의 14일 클릭 고유 수(같은 사람은 한 번). 클릭은 방문이 아니다.
 *
 * 근거 줄은 「{원천} · {대상} · {기간}」이다. 문구·하한·이름의 원본은 이 파일이고, search 서버 렌더는
 * 같은 하한을 search/domain 상수로 갖는다 — 두 값은 visitSignalsGate.test.ts 가 Kotlin 파일을 읽어 대조한다.
 * 「많이 본 곳」「인기」「핫플」 같은 이름은 쓰지 않는다 — 무엇을 셌는지 말하지 않는 이름이라서다.
 */

export type SignalKind = 'KTO_REGION_VISITORS' | 'SITE_SAVES' | 'SITE_CLICKS';

export const SIGNAL_KINDS: readonly SignalKind[] = ['KTO_REGION_VISITORS', 'SITE_SAVES', 'SITE_CLICKS'];

/**
 * 「많이 찜한 곳」 하한 — 찜한 회원이 이 수 이상일 때만 근거로 낸다. 표시 정책이다(적은 수는 신호가 아니다).
 * search `AttractionSaveSignal.SAVED_MIN`(search/domain) 과 같은 값이어야 한다.
 */
export const SAVED_MIN = 3;

/**
 * 「많이 클릭한 곳」 최소 표본 — 14일 고유 클릭 이용자가 이 수 이상일 때만 배지·근거 줄을 붙인다.
 * search `AttractionClickSignal.MIN_SAMPLE`(search/domain) 과 같은 값이어야 한다 — 서버 렌더가 그 상수로 판단한다.
 */
export const FREQUENTLY_CLICKED_MIN = 5;

interface SignalCopy {
  /** 근거 줄 첫 칸 — 원천 */
  source: string;
  /** 지역 페이지 절 제목 */
  sectionTitle: string;
}

export const SIGNAL_COPY: Record<SignalKind, Record<PlaceLang, SignalCopy>> = {
  KTO_REGION_VISITORS: {
    ko: { source: '한국관광공사 빅데이터(이동통신 추정)', sectionTitle: '타지 방문자가 많은 시군구' },
    en: {
      source: 'Korea Tourism Organization big data (mobile carrier estimate)',
      sectionTitle: 'Districts with the most visitors from elsewhere',
    },
  },
  SITE_SAVES: {
    ko: { source: '이 사이트 회원 찜', sectionTitle: '많이 찜한 곳' },
    en: { source: 'Saves by members of this site', sectionTitle: 'Most saved' },
  },
  SITE_CLICKS: {
    ko: { source: '이 사이트 이용자 클릭(같은 사람은 한 번)', sectionTitle: '이 사이트에서 많이 누른 곳' },
    en: { source: 'Clicks by people on this site (each person once)', sectionTitle: 'Most clicked on this site' },
  },
};

/**
 * 근거 줄 「{원천} · {대상} · {기간}」(+ 덧붙임). 대상·기간 중 하나라도 비면 줄을 내지 않는다 —
 * 원천만 있고 무엇을·언제 셌는지 없는 줄은 근거가 아니다.
 */
export function formatSignalLine(
  kind: SignalKind,
  parts: { target: string | null | undefined; period: string | null | undefined; note?: string | null },
  lang: PlaceLang = 'ko',
): string | null {
  const target = parts.target?.trim();
  const period = parts.period?.trim();
  if (!target || !period) return null;
  const note = parts.note?.trim();
  return [SIGNAL_COPY[kind][lang].source, target, period, ...(note ? [note] : [])].join(' · ');
}

/** 이 사이트 근거가 하한에 닿았나 — 값이 없으면 닿지 않은 것이다. */
export function meetsSignalMin(kind: 'SITE_SAVES' | 'SITE_CLICKS', count: number | null | undefined): boolean {
  if (count == null) return false;
  return count >= (kind === 'SITE_SAVES' ? SAVED_MIN : FREQUENTLY_CLICKED_MIN);
}

/**
 * 관광지 상세의 이 사이트 근거 문장. 하한 미만·값 없음이면 null(줄을 내지 않는다).
 * `asOf`(색인 `signalsAsOf`, YYYY-MM-DD)가 있으면 「{날짜} 기준」을 붙인다.
 */
export function siteSignalSentence(
  kind: 'SITE_SAVES' | 'SITE_CLICKS',
  count: number | null | undefined,
  lang: PlaceLang = 'ko',
  asOf?: string | null,
): string | null {
  if (count == null || !meetsSignalMin(kind, count)) return null;
  const en = lang === 'en';
  const sentence =
    kind === 'SITE_SAVES'
      ? en ? `${count} members of this site saved this` : `이 사이트 회원 ${count}명이 찜했습니다`
      : en
        ? `${count} people on this site clicked this in the last 14 days (each person counted once)`
        : `최근 14일 이 사이트에서 ${count}명이 눌렀습니다(같은 사람은 한 번)`;
  if (!asOf) return sentence;
  return `${sentence} · ${en ? `as of ${asOf}` : `${asOf} 기준`}`;
}

/** 관광지 상세 → 시군구 지역 페이지 링크 문구. 시군구 방문자 수치는 상세에 내지 않는다(시군구 안 관광지 전부에 같은 숫자가 붙어서). */
export function visitorTrendLinkLabel(sigungu: string, lang: PlaceLang = 'ko'): string {
  return lang === 'en' ? `Visitor trend in ${sigungu}` : `${sigungu} 방문 추이 보기`;
}

/** 근거 줄 기간 칸의 달 — `yyyy-MM` → 「2026년 8월」 / 「Aug 2026」. */
export function signalMonthLabel(month: string, lang: PlaceLang = 'ko'): string {
  const [y, m] = month.split('-').map(Number);
  if (lang === 'ko') return `${y}년 ${m}월`;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/**
 * 시도 페이지 「타지 방문자가 많은 시군구」(KTO_REGION_VISITORS) 문구. 원천 수치는 「일자별 순방문자 합」이다 —
 * 같은 사람이 사흘 머물면 3명이라 실제 사람 수보다 크다. 그래서 수치 앞에 「약」을 붙이고, 기준 보기에 정의를 적는다.
 * 원천 정의상 외지인에는 통근·통학(일상생활권 이동)이 들어가지 않는다 — 근거 줄에 「통근 포함」을 붙이지 않는다.
 */
export const KTO_RANKING_COPY: Record<
  PlaceLang,
  {
    target: (sido: string) => string;
    note: string;
    value: (n: number) => string;
    basisToggle: string;
    basis: readonly string[];
    sourceLine: string;
  }
> = {
  ko: {
    target: (sido) => `${sido} 시군구`,
    note: '외지인+외국인',
    value: (n) => `약 ${Math.floor(n).toLocaleString('ko')}명`,
    basisToggle: '기준 보기',
    basis: [
      '한 달 동안 날마다 그 시군구에 머문 사람 수를 더한 값입니다(일자별 순방문자 합). 같은 사람이 사흘 머물면 3명으로 셉니다.',
      '외지인과 외국인만 셉니다. 현지인은 생활 이동이 섞여 뺐습니다.',
      '원천은 거주·통근·통학 같은 일상생활권 이동을 방문으로 치지 않습니다. 이 판정도 이동통신 자료로 한 추정입니다.',
      '달은 시도 안 모든 시군구가 그 달의 모든 날을 받은 마지막 달입니다.',
    ],
    sourceLine: '출처: 한국관광공사 빅데이터 서비스(지역별 방문자 수)',
  },
  en: {
    target: (sido) => `Districts of ${sido}`,
    note: 'from other regions + foreigners',
    value: (n) => `about ${Math.floor(n).toLocaleString('en')}`,
    basisToggle: 'How this is counted',
    basis: [
      'Each day’s visitors in the district, added up over the month (daily unique visitors). One person staying three days counts as 3.',
      'Only visitors from other regions and foreigners. Locals are left out because everyday trips mix in.',
      'The source does not count trips within daily life (home, commuting, school) as visits. That judgment is itself an estimate from mobile carrier data.',
      'The month is the latest one for which every district in the province has every day.',
    ],
    sourceLine: 'Source: Korea Tourism Organization Big Data Service (visitors by region)',
  },
};

/** 시도 순위 근거 줄 — 「한국관광공사 빅데이터(이동통신 추정) · {시도} 시군구 · {YYYY년 M월} · 외지인+외국인」. */
export function ktoRankingSignalLine(sido: string, month: string | null | undefined, lang: PlaceLang = 'ko'): string | null {
  const C = KTO_RANKING_COPY[lang];
  return formatSignalLine(
    'KTO_REGION_VISITORS',
    { target: sido ? C.target(sido) : null, period: month ? signalMonthLabel(month, lang) : null, note: C.note },
    lang,
  );
}
