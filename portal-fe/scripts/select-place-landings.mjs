/**
 * 속성 랜딩 선정 — 「부산 중구 주차 가능 관광지」처럼 속성 하나 × 시군구 하나의 랜딩 목록을 만든다.
 *
 *   node scripts/select-place-landings.mjs
 *
 * 결과 `src/content/place-landings.json` 은 커밋한다. 빌드는 이 목록을 읽기만 한다 —
 * 빌드마다 다시 고르면 배포 사이에 주소가 생겼다 사라진다.
 *
 * 순서: ① 언어 × 시군구마다 분류 필터만 건 `facets=true` 질의로 예비 후보 ② 예비 후보마다 필터 질의로
 * 건수(N = totalElements)와 상위 30건 id ③ `selectLandings` 가 하한·상한·중복도로 고른다.
 * 운영 검색 API 는 GET 만 부르고, 요청 사이에 간격을 둔다.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  PLACE_LANDING_ATTRS,
  PLACE_LANDING_MAX_JACCARD,
  PLACE_LANDING_MAX_PER_ATTR,
  PLACE_LANDING_MAX_TOTAL,
  PLACE_LANDING_MIN_RESULTS,
  SIGHT_CATEGORIES,
} from '../src/seo/copy.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'src/content/place-landings.json');
const API_ORIGIN = process.env.SEO_API_ORIGIN || 'https://api.1989v.com';
const LANGS = ['ko', 'en'];
/** 필터 질의 크기 — 랜딩 본문이 보이는 결과 수이자 중복도를 재는 id 수 */
const TOP_IDS = 30;
/** 운영 API 를 연달아 두드리지 않도록 요청 사이 간격 */
const GAP_MS = 250;

// 직접 실행일 때만 돈다 — 테스트가 import 만으로 운영 API 를 부르지 않게 (prerender-seo.mjs 와 같은 방식)
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(`[landings] 실패 — 목록을 쓰지 않았습니다: ${err.message}`);
    process.exit(1);
  });
}

/** 시군구 5자리 → 검색 API 인자(시도 2자리 · 시군구 3자리) */
function regionParams(code) {
  return `sidoCode=${code.slice(0, 2)}&sigunguCode=${code.slice(2)}`;
}

function facetCount(facets, facetKey) {
  const [group, value] = facetKey.split('.');
  return facets[group]?.[value] ?? 0;
}

/**
 * 한 언어의 후보를 모은다. facet 건수로 예비 후보를 고르고, 예비 후보마다 필터 질의를 한 번 더 해
 * 그 `totalElements` 를 건수로 싣는다 — facet 은 시간 초과·실패 때 null 이라 N 으로 쓰지 않는다.
 * facet 이 null 이면 예외다(조용히 건너뛰면 그 시군구가 목록에서 빠진 채 커밋된다 — 다시 돌린다).
 * @param {{ lang: string, regions: Array<{ code: string }>, get: (path: string) => Promise<any> }} args
 *   regions 는 그 언어의 시군구 행, get 은 검색 응답의 `data` 를 돌려주는 조회 함수
 * @returns {Promise<Array<{ lang: string, code: string, attr: string, count: number, ids: string[] }>>}
 */
export async function buildCandidates({ lang, regions, get }) {
  const attrs = PLACE_LANDING_ATTRS.filter((a) => a.langs.includes(lang));
  const base = `/api/search/attractions?lang=${lang}&category=${SIGHT_CATEGORIES.join(',')}`;
  const out = [];
  for (const region of regions) {
    const scope = `${base}&${regionParams(region.code)}`;
    const summary = await get(`${scope}&facets=true&size=1`);
    const facets = summary?.attributeFacets;
    if (facets == null) throw new Error(`facet 이 비었습니다 — ${lang}/${region.code}. 다시 돌리세요`);
    for (const def of attrs) {
      if (facetCount(facets, def.facetKey) < PLACE_LANDING_MIN_RESULTS) continue;
      const page = await get(`${scope}&${def.param.key}=${def.param.value}&sort=relevance&page=0&size=${TOP_IDS}`);
      out.push({
        lang,
        code: region.code,
        attr: def.attr,
        count: page.totalElements ?? 0,
        ids: (page.attractions ?? []).map((a) => String(a.id)),
      });
    }
  }
  return out;
}

function jaccard(a, b) {
  const setA = new Set(a);
  const setB = new Set(b);
  let inter = 0;
  for (const x of setA) if (setB.has(x)) inter += 1;
  const union = setA.size + setB.size - inter;
  return union === 0 ? 0 : inter / union;
}

/**
 * @typedef {{ lang: string, code: string, sidoCode: string, attr: string, count: number, jaccardMax: number,
 *   selectedAt: string, retired?: boolean, retiredAt?: string }} LandingEntry
 */

const keyOf = (e) => `${e.lang}/${e.code}/${e.attr}`;
const attrOrder = (attr) => PLACE_LANDING_ATTRS.findIndex((a) => a.attr === attr);
const langOrder = (lang) => LANGS.indexOf(lang);

/**
 * 후보에서 랜딩 목록을 고른다(조회 없음).
 * - 모집단: 그 언어의 시군구 행 · 후보: count ≥ 하한 · 정렬: 건수 내림차순 → ko 먼저 → 코드 오름차순
 * - 상한: 언어별 속성당, 국·영 합산 — 이번에 뽑힌 항목만 센다
 * - 중복도: 같은 언어·같은 시군구에서 이미 뽑힌 랜딩과 id Jaccard 가 상한을 넘으면 건너뛴다
 * - 기존 항목은 지우지 않는다: 안 뽑히면 retired 로 남고, 다시 뽑히면 처음 selectedAt 으로 되살아난다
 * @param {{ regions: Record<string, Array<{ code: string, level?: string }>>, candidates: any[], previous: any[], today?: string }} args
 *   regions 는 언어별 시군구 행, previous 는 지금 커밋된 목록, today 는 KST 날짜(YYYY-MM-DD)
 * @returns {{ entries: LandingEntry[], warnings: string[], excluded: Record<string, number> }}
 */
export function selectLandings({ regions, candidates, previous, today = kstToday() }) {
  const population = Object.fromEntries(
    LANGS.map((lang) => [lang, new Set((regions[lang] ?? []).filter((r) => (r.level ?? 'SIGUNGU') === 'SIGUNGU').map((r) => r.code))]),
  );
  const excluded = { lang: 0, population: 0, belowMin: 0, perAttr: 0, total: 0, jaccard: 0 };

  const eligible = candidates.filter((c) => {
    const def = PLACE_LANDING_ATTRS.find((a) => a.attr === c.attr);
    if (!def || !def.langs.includes(c.lang)) return (excluded.lang += 1), false;
    if (!population[c.lang]?.has(c.code)) return (excluded.population += 1), false;
    if (c.count < PLACE_LANDING_MIN_RESULTS) return (excluded.belowMin += 1), false;
    return true;
  });
  eligible.sort(
    (a, b) =>
      b.count - a.count ||
      langOrder(a.lang) - langOrder(b.lang) ||
      a.code.localeCompare(b.code) ||
      attrOrder(a.attr) - attrOrder(b.attr),
  );

  const picked = [];
  const perAttr = new Map();
  for (const c of eligible) {
    const attrKey = `${c.lang}/${c.attr}`;
    if ((perAttr.get(attrKey) ?? 0) >= PLACE_LANDING_MAX_PER_ATTR) {
      excluded.perAttr += 1;
      continue;
    }
    if (picked.length >= PLACE_LANDING_MAX_TOTAL) {
      excluded.total += 1;
      continue;
    }
    const siblings = picked.filter((p) => p.lang === c.lang && p.code === c.code);
    const jaccardMax = siblings.reduce((m, p) => Math.max(m, jaccard(p.ids, c.ids)), 0);
    if (jaccardMax > PLACE_LANDING_MAX_JACCARD) {
      excluded.jaccard += 1;
      continue;
    }
    perAttr.set(attrKey, (perAttr.get(attrKey) ?? 0) + 1);
    picked.push({ ...c, jaccardMax });
  }

  const prevByKey = new Map(previous.map((e) => [keyOf(e), e]));
  const pickedKeys = new Set(picked.map(keyOf));
  const entries = picked.map((c) => ({
    lang: c.lang,
    code: c.code,
    sidoCode: c.code.slice(0, 2),
    attr: c.attr,
    count: c.count,
    jaccardMax: Math.round(c.jaccardMax * 1000) / 1000,
    selectedAt: prevByKey.get(keyOf(c))?.selectedAt ?? today,
  }));
  for (const prev of previous) {
    if (pickedKeys.has(keyOf(prev))) continue;
    entries.push(prev.retired ? prev : { ...prev, retired: true, retiredAt: today });
  }
  entries.sort(
    (a, b) => langOrder(a.lang) - langOrder(b.lang) || a.code.localeCompare(b.code) || attrOrder(a.attr) - attrOrder(b.attr),
  );

  const retiredCount = entries.filter((e) => e.retired).length;
  const warnings =
    retiredCount > PLACE_LANDING_MAX_TOTAL
      ? [`은퇴 항목 ${retiredCount}건이 합산 상한 ${PLACE_LANDING_MAX_TOTAL}건을 넘습니다 — 정리(삭제)는 사람이 판단합니다(스크립트는 지우지 않음)`]
      : [];
  return { entries, warnings, excluded };
}

/** 오늘 날짜(KST, YYYY-MM-DD) */
export function kstToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

async function main() {
  let calls = 0;
  const get = async (path) => {
    if (calls > 0) await new Promise((r) => setTimeout(r, GAP_MS));
    calls += 1;
    const res = await fetch(`${API_ORIGIN}${path}`, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
    const body = await res.json();
    if (!body.success) throw new Error(`GET ${path} → ${body.error?.code}`);
    return body.data;
  };

  const previous = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : [];
  const regions = {};
  const candidates = [];
  for (const lang of LANGS) {
    // 지역 프리렌더와 같은 범위 — 관광 분류 건수가 0 인 시군구는 지역 페이지가 없다
    const rows = [];
    const sidos = (await get(`/api/places/administrative-regions?level=SIDO&lang=${lang}`)).regions ?? [];
    for (const sido of sidos) {
      const children = (await get(`/api/places/administrative-regions?level=SIGUNGU&parent=${sido.code}&lang=${lang}`)).regions ?? [];
      rows.push(...children.filter((c) => (c.attractionCount ?? 0) > 0));
    }
    regions[lang] = rows;
    const found = await buildCandidates({ lang, regions: rows, get });
    candidates.push(...found);
    console.log(`[landings] ${lang}: 시군구 ${rows.length} · 예비 후보 ${found.length}`);
  }

  const { entries, warnings, excluded } = selectLandings({ regions, candidates, previous });
  writeFileSync(OUT, `${JSON.stringify(entries, null, 2)}\n`);
  for (const lang of LANGS) {
    const active = entries.filter((e) => e.lang === lang && !e.retired);
    const byAttr = PLACE_LANDING_ATTRS.map((a) => `${a.attr} ${active.filter((e) => e.attr === a.attr).length}`).join(' · ');
    console.log(`[landings] ${lang}: 선정 ${active.length} (${byAttr})`);
  }
  console.log(`[landings] 제외 사유: ${JSON.stringify(excluded)}`);
  console.log(`[landings] 은퇴 ${entries.filter((e) => e.retired).length} · 전체 항목 ${entries.length} · 호출 ${calls}회 (${API_ORIGIN})`);
  for (const w of warnings) console.warn(`[landings] 경고: ${w}`);
}
