// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DATA_SOURCES } from '../../seo/dataSources.mjs';

/**
 * 데이터 출처 페이지의 목록이 원천 대장(`docs/architecture/data-sources.md` §1)과 같은지 본다.
 *
 * 기대값을 테스트에 적지 않는다 — 대장을 텍스트로 읽어 정규화한 값과 페이지·프리렌더가 쓰는
 * 상수(`DATA_SOURCES`)를 맞춘다. 대장은 빌드 컨텍스트 밖이라 빌드가 읽지 못하고, 그래서
 * 상수가 사본이 된다. 사본이 원본과 갈라지는 것을 이 검사가 잡는다.
 */
const REPO = resolve(__dirname, '../../../..');
const LEDGER_PATH = 'docs/architecture/data-sources.md';
const FIX_HINT = '`docs/architecture/data-sources.md` §1 을 고쳤다면 `portal-fe/src/seo/dataSources.mjs` 를 같이 고친다';

type Row = { data: string; source: string; license: string; note: string };
type LedgerRow = { data: string; source: string; license: string; rawLicense: string };

const readLedger = () => readFileSync(resolve(REPO, LEDGER_PATH), 'utf-8');

const stripMarks = (s: string) => s.replace(/\*\*/g, '').replace(/`/g, '');

/** 라이선스 칸 괄호 안 내부 메모 — 공개하지 않는다. 약관 조건 같은 다른 괄호는 남긴다. */
const dropInternalMemo = (s: string) => s.replace(/\s*\([^()]*포털 표기 미확인[^()]*\)/g, '');

/** §1 「한눈에」 표를 읽어 데이터·원천·라이선스 세 열을 정규화한다. */
function parseLedger(text: string): LedgerRow[] {
  const start = text.indexOf('## 1. 한눈에');
  if (start < 0) throw new Error(`대장에 「## 1. 한눈에」 절이 없다 — ${FIX_HINT}`);
  const lines = text.slice(start).split('\n');
  const first = lines.findIndex((l) => l.startsWith('|'));
  const table: string[] = [];
  for (let i = first; i < lines.length && lines[i].startsWith('|'); i++) table.push(lines[i]);
  const cells = (line: string) => line.split('|').slice(1, -1).map((c) => c.trim());
  const header = cells(table[0]);
  const col = (name: string) => {
    const at = header.indexOf(name);
    if (at < 0) throw new Error(`대장 §1 표에 「${name}」 열이 없다 — ${FIX_HINT}`);
    return at;
  };
  const [dataAt, sourceAt, licenseAt] = [col('데이터'), col('원천'), col('라이선스')];

  const rows: LedgerRow[] = [];
  for (const line of table.slice(2)) {
    const c = cells(line);
    const rawLicense = c[licenseAt];
    let license = dropInternalMemo(stripMarks(rawLicense)).trim();
    // 「〃」 는 바로 윗행 값이다. 「〃 (…)」 의 괄호는 행 단위 보충이라 버린다.
    if (license.startsWith('〃')) license = rows[rows.length - 1].license;
    rows.push({
      data: stripMarks(c[dataAt]).trim(),
      source: stripMarks(c[sourceAt]).trim(),
      license,
      rawLicense,
    });
  }
  return rows;
}

/** 대장 텍스트와 행 목록의 차이. 빈 배열이면 같다. */
function compare(ledgerText: string, rows: Row[]): string[] {
  const ledger = parseLedger(ledgerText);
  const problems: string[] = [];
  const ledgerNames = new Set(ledger.map((r) => r.data));
  const rowNames = new Set(rows.map((r) => r.data));
  for (const name of ledgerNames) if (!rowNames.has(name)) problems.push(`상수에 없는 대장 행: ${name}`);
  for (const name of rowNames) if (!ledgerNames.has(name)) problems.push(`대장에 없는 상수 행: ${name}`);
  if (rows.length !== rowNames.size) problems.push('상수에 같은 데이터 이름이 두 번 있다');
  for (const row of rows) {
    const l = ledger.find((r) => r.data === row.data);
    if (!l) continue;
    if (l.source !== row.source) problems.push(`${row.data} 원천: 대장 「${l.source}」 ≠ 상수 「${row.source}」`);
    if (l.license !== row.license) problems.push(`${row.data} 라이선스: 대장 「${l.license}」 ≠ 상수 「${row.license}」`);
  }
  return problems;
}

const rows = DATA_SOURCES as Row[];
const AIR_REALTIME = '대기 실시간 측정';

describe('데이터 출처 — 대장 §1 과 상수가 같은 목록을 말한다', () => {
  it('데이터 이름 집합이 같고, 행마다 원천·라이선스가 같다', () => {
    const problems = compare(readLedger(), rows);
    expect(problems, `${FIX_HINT}\n${problems.join('\n')}`).toEqual([]);
  });

  it('상수 어느 칸에도 〃·**·백틱이 없고, 라이선스는 비어 있지 않다', () => {
    for (const row of rows) {
      for (const [key, value] of Object.entries(row)) {
        expect(value, `${row.data}.${key}`).not.toMatch(/〃|\*\*|`/);
      }
      expect(row.license, `${row.data} 라이선스가 비었다 — ${FIX_HINT}`).not.toBe('');
    }
  });
});

describe('데이터 출처 — 비고는 대장 본문에 있는 사실만 싣는다', () => {
  const ledgerPlain = () => stripMarks(readLedger());

  it('대기 실시간 측정 비고는 대장 본문의 문장 그대로다', () => {
    const note = rows.find((r) => r.data === AIR_REALTIME)?.note ?? '';
    expect(note, `「${AIR_REALTIME}」 비고가 비었다`).not.toBe('');
    expect(ledgerPlain(), `비고 「${note}」 가 대장 본문에 없다 — ${FIX_HINT}`).toContain(note);
  });

  it('TourAPI 행마다 유형 비고 — 대장이 그 사실을 말하고, 해당 행 비고마다 실려 있다', () => {
    const plain = ledgerPlain();
    expect(plain, '대장에 「행마다 다르다」 가 없다').toContain('행마다 다르다');
    expect(plain, '대장에 「출처표시·변경금지」 가 없다').toContain('출처표시·변경금지');
    const perRow = parseLedger(readLedger()).filter((r) => r.rawLicense.includes('(행마다'));
    expect(perRow.length, '대장 §1 에 「(행마다」 가 달린 행이 없다').toBeGreaterThan(0);
    for (const l of perRow) {
      const note = rows.find((r) => r.data === l.data)?.note ?? '';
      expect(note, l.data).toContain('행마다');
      expect(note, l.data).toContain('출처표시·변경금지');
    }
  });

  it('비고가 있는 행 = 대장 「(행마다」 행 ∪ 대기 실시간 측정', () => {
    const expected = new Set([
      ...parseLedger(readLedger())
        .filter((r) => r.rawLicense.includes('(행마다'))
        .map((r) => r.data),
      AIR_REALTIME,
    ]);
    const actual = new Set(rows.filter((r) => r.note !== '').map((r) => r.data));
    expect([...actual].sort(), FIX_HINT).toEqual([...expected].sort());
  });
});

describe('데이터 출처 — 대조가 어긋남을 실제로 잡는다', () => {
  it('대장에 행이 하나 더 있으면 실패한다', () => {
    const text = readLedger();
    const firstRow = parseLedger(text)[0];
    const anchor = text.split('\n').find((l) => l.startsWith(`| ${firstRow.data} |`));
    expect(anchor, '대장 첫 행을 못 찾았다').toBeDefined();
    const extended = text.replace(anchor!, `${anchor}\n| 시험용 추가 행 | 시험 원천 | 불필요 | 제한 없음 | - |`);
    expect(compare(extended, rows)).not.toEqual([]);
  });

  it('〃 로 펼쳐지는 행의 라이선스만 바꾸면 실패한다', () => {
    const text = readLedger();
    const ditto = parseLedger(text).find((r) => r.data === '관광지 개요');
    expect(ditto?.rawLicense, '「관광지 개요」 라이선스가 〃 가 아니면 이 사례를 다른 행으로 옮긴다').toMatch(/^〃/);
    const changed = rows.map((r) => (r.data === '관광지 개요' ? { ...r, license: `${r.license} 변경` } : r));
    expect(compare(text, changed)).not.toEqual([]);
  });

  it('한 행의 원천만 바꾸면 실패한다', () => {
    const changed = rows.map((r, i) => (i === 0 ? { ...r, source: `${r.source} 변경` } : r));
    expect(compare(readLedger(), changed)).not.toEqual([]);
  });
});
