import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FREQUENTLY_CLICKED_MIN, SAVED_MIN } from '../visitSignals';

/**
 * 방문 근거의 언어 경계 반대편 검사 — 화면 상수·문구와 search 서버 렌더가 어긋나지 않게 한다.
 *
 * 하한은 화면(TS)과 서버 렌더(Kotlin)가 각자 갖는다. 함께 import 할 수 없어서 테스트에 3·5 를 적어 양쪽과 비교하면
 * 검사가 자기 근거를 만든다 — 그래서 **Kotlin 파일을 텍스트로 읽어 뽑은 값**과 화면 상수를 비교한다.
 * 나머지 두 검사는 소스 텍스트 grep 이다(집중률 순위 금지 · 서버 렌더 금지어).
 */
const REPO = resolve(__dirname, '../../../../..');
const read = (rel: string) => readFileSync(resolve(REPO, rel), 'utf-8');

const KOTLIN_SIGNALS = [
  'search/domain/src/main/kotlin/com/kgd/search/domain/attraction/model/AttractionClickSignal.kt',
  'search/domain/src/main/kotlin/com/kgd/search/domain/attraction/model/AttractionSaveSignal.kt',
];
const RENDERER = 'search/app/src/main/kotlin/com/kgd/search/infrastructure/render/AttractionPageRenderer.kt';

/** 서버 하한 — `const val (SAVED_MIN|MIN_SAMPLE) = (\d+)`. 한 건도 못 뽑으면 실패한다(검사가 조용히 빈 채 통과하지 않게). */
function kotlinMins(): Record<string, number> {
  const found: Record<string, number> = {};
  for (const rel of KOTLIN_SIGNALS) {
    for (const m of read(rel).matchAll(/const val (SAVED_MIN|MIN_SAMPLE) = (\d+)/g)) found[m[1]] = Number(m[2]);
  }
  return found;
}

/** Kotlin 문자열 리터럴(보통 · 원시 문자열) — 주석·식별자는 판정에 넣지 않는다. */
function kotlinStringLiterals(src: string): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(/"""([\s\S]*?)"""|"((?:[^"\\\n]|\\.)*)"/g)) out.push(m[1] ?? m[2] ?? '');
  return out;
}

/** 집중률로 줄 세우는 줄 — 같은 줄에 congestion 과 정렬·순위 낱말이 함께 있으면 잡는다. */
const CONGESTION_ORDERING = /congestion[^\n]*(sort|order|rank|compare|정렬|순위)|(sort|order|rank|compare|정렬|순위)[^\n]*congestion/i;
const CONGESTION_TARGETS = ['portal-fe/src/pages/place/visitSignals.ts', 'portal-fe/src/pages/place/RegionPage.tsx', RENDERER];

describe('하한 — 화면 ↔ search 상수', () => {
  it('Kotlin 상수 파일에서 SAVED_MIN · MIN_SAMPLE 을 뽑는다(0건이면 실패)', () => {
    const mins = kotlinMins();
    expect(Object.keys(mins).sort()).toEqual(['MIN_SAMPLE', 'SAVED_MIN']);
  });

  it('찜 하한: visitSignals SAVED_MIN == AttractionSaveSignal.SAVED_MIN', () => {
    expect(SAVED_MIN).toBe(kotlinMins().SAVED_MIN);
  });

  it('클릭 하한: visitSignals FREQUENTLY_CLICKED_MIN == AttractionClickSignal.MIN_SAMPLE', () => {
    expect(FREQUENTLY_CLICKED_MIN).toBe(kotlinMins().MIN_SAMPLE);
  });
});

describe('집중률은 순위에 쓰지 않는다', () => {
  it('판정식이 실제로 무는지 — 정렬 한 줄은 잡고 집중률 표시 줄은 놓아준다', () => {
    expect(CONGESTION_ORDERING.test('items.sort((a, b) => b.congestion - a.congestion)')).toBe(true);
    expect(CONGESTION_ORDERING.test('.sortedByDescending { it.congestion?.peak }')).toBe(true);
    expect(CONGESTION_ORDERING.test('<AttractionCongestion congestion={a.congestion} />')).toBe(false);
  });

  for (const rel of CONGESTION_TARGETS) {
    it(`${rel} 에 congestion 정렬·순위가 없다`, () => {
      const hits = read(rel).split('\n').filter((line) => CONGESTION_ORDERING.test(line));
      expect(hits).toEqual([]);
    });
  }
});

describe('서버 렌더 문구', () => {
  const literals = () => kotlinStringLiterals(read(RENDERER));

  it('문자열 리터럴을 실제로 뽑는다', () => {
    expect(literals().length).toBeGreaterThan(50);
  });

  it('「인기」「많이 본」「핫플」이 없다', () => {
    const hits = literals().filter((s) => /인기|많이 본|핫플/.test(s));
    expect(hits).toEqual([]);
  });

  it('이 사이트 근거 문구에 「방문자 · visitor」가 없다', () => {
    const hits = literals().filter((s) => (/이 사이트/.test(s) && /방문자/.test(s)) || (/on this site/i.test(s) && /visitor/i.test(s)));
    expect(hits).toEqual([]);
  });
});
