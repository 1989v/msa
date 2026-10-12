// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * 주문 · 결제 드릴다운(`/tech/order`)의 적용 값이 주문 · 결제 · 정산 코드와 같은지 본다.
 *
 * 값의 원본은 온톨로지(`code-dictionary/.../ontology/commerce-order.yaml`)의 `applied.facts[].key` 이고, 이 테스트는
 * 그것을 내보낸 `src/content/drill/commerce-order.json` 을 읽는다. 레포 루트의 order · payment · settlement · commerce · k8s
 * 파일을 직접 읽으므로 **CI 체크아웃에서만 돈다**. 파일이 없으면 실패한다(건너뛰지 않는다).
 * 운영 매니페스트는 이 값들을 env 로 덮지 않는다 — 덮기 시작하면 코드 기본값 대신 매니페스트 값과 대조하도록 고친다.
 */

const repo = (path: string) => fileURLToPath(new URL(`../../../../${path}`, import.meta.url));
const read = (path: string) => readFileSync(repo(path), 'utf8');

const DRILL = 'portal-fe/src/content/drill/commerce-order.json';
const COMMERCE_YML = 'commerce/app/src/main/resources/application.yml';
const SAGA_CONFIG = 'order/feature/src/main/kotlin/com/kgd/order/infrastructure/config/OrderSagaConfig.kt';
const IDEMPOTENCY = 'order/domain/src/main/kotlin/com/kgd/order/domain/idempotency/model/IdempotencyKey.kt';
const PLACEMENT = 'order/feature/src/main/kotlin/com/kgd/order/application/order/service/OrderPlacementService.kt';
const SHEET = 'order/feature/src/main/kotlin/com/kgd/order/application/sheet/service/OrderSheetService.kt';
const PURCHASE_CONFIRM = 'order/feature/src/main/kotlin/com/kgd/order/application/order/service/PurchaseConfirmService.kt';
const PAYMENT = 'payment/domain/src/main/kotlin/com/kgd/payment/domain/payment/model/Payment.kt';
const MOCK_PG = 'payment/feature/src/main/kotlin/com/kgd/payment/infrastructure/pg/mock/MockPgAdapter.kt';
const STATEMENT = 'settlement/domain/src/main/kotlin/com/kgd/settlement/domain/statement/model/SettlementStatement.kt';

/** 대조하는 사실 키 — 온톨로지의 facts[].key 와 같은 이름 */
const KEY = {
  pg: 'payment-pg',
  sheetTtl: 'order-sheet-ttl-minutes',
  lease: 'idempotency-lease-seconds',
  retention: 'idempotency-retention-hours',
  pendingLimit: 'pending-order-limit',
  stepTimeout: 'saga-step-timeout-seconds',
  prePivot: 'saga-pre-pivot-minutes',
  maxRetries: 'saga-max-retries',
  hold: 'hold-minutes',
  fee: 'mock-pg-fee-percent',
  backoff: 'payment-inquiry-backoff',
  confirmDays: 'purchase-confirm-days',
  batchCron: 'settlement-batch-cron',
  recordYears: 'record-retention-years',
} as const;

type Fact = { label: string; value: string; key?: string };
const drill = JSON.parse(read(DRILL)) as { concepts: Record<string, { applied?: { facts?: Fact[] } }> };
const facts = Object.values(drill.concepts).flatMap((c) => c.applied?.facts ?? []).filter((f) => f.key);
const docValue = (key: string) => facts.find((f) => f.key === key)?.value;

/** 화면 값의 첫 수 — 「배송 완료 7일 뒤」 → 7 */
const firstNumber = (v: string | undefined) => Number(v?.match(/\d+(\.\d+)?/)?.[0]);

function expectNumber(key: string, codeValue: string | undefined) {
  const v = docValue(key);
  expect(v, `드릴다운 데이터에서 사실 키 ${key} 를 못 찾음`).toBeDefined();
  expect(codeValue, `코드 쪽 ${key} 값을 못 읽음`).toBeDefined();
  expect(firstNumber(v), `${key}: 온톨로지 값과 코드 값이 다르다`).toBe(Number(codeValue));
}

/** k8s 매니페스트 전체(yaml)에서 env 이름이 나오는 파일 */
function manifestsSetting(name: string): string[] {
  const hits: string[] = [];
  const walk = (dir: string) => {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.ya?ml$/.test(f) && readFileSync(p, 'utf8').includes(`name: ${name}`)) hits.push(p);
    }
  };
  walk(repo('k8s'));
  return hits;
}

describe('주문 · 결제 드릴다운 적용 값 드리프트', () => {
  it('대조 키가 아닌 사실 키는 없다 — 키를 달면 여기에 대조도 단다', () => {
    const known = new Set<string>(Object.values(KEY));
    expect(facts.map((f) => f.key).filter((k) => !known.has(k!))).toEqual([]);
  });

  it('결제 대행이 운영에서 모의 PG 다 — 앱 기본값이 mock 이고 매니페스트가 덮지 않는다', () => {
    const fallback = read(COMMERCE_YML).match(/^ {2}pg: \$\{PAYMENT_PG:(\w+)\}$/m)?.[1];
    expect(fallback).toBe('mock');
    expect(manifestsSetting('PAYMENT_PG')).toEqual([]);
    expect(docValue(KEY.pg)).toContain(`(${fallback})`);
  });

  it('주문서 · 멱등 키 · 결제 대기 상한이 주문 코드 기본값과 같다', () => {
    expectNumber(KEY.sheetTtl, read(SHEET).match(/order\.sheet\.ttl-minutes:(\d+)\}/)?.[1]);
    expectNumber(KEY.lease, read(IDEMPOTENCY).match(/val LEASE: Duration = Duration\.ofSeconds\((\d+)\)/)?.[1]);
    expectNumber(KEY.retention, read(IDEMPOTENCY).match(/val RETENTION: Duration = Duration\.ofHours\((\d+)\)/)?.[1]);
    expectNumber(KEY.pendingLimit, read(PLACEMENT).match(/order\.pending-order-limit:(\d+)\}/)?.[1]);
  });

  it('사가 기한 · 재시도 · 보류 기한이 설정 기본값과 같다', () => {
    const saga = read(SAGA_CONFIG);
    expectNumber(KEY.stepTimeout, saga.match(/order\.saga\.step-timeout-seconds:(\d+)\}/)?.[1]);
    expectNumber(KEY.prePivot, saga.match(/order\.saga\.pre-pivot-minutes:(\d+)\}/)?.[1]);
    expectNumber(KEY.maxRetries, saga.match(/order\.saga\.max-retries:(\d+)\}/)?.[1]);
    expectNumber(KEY.hold, read(COMMERCE_YML).match(/^commerce:\n {2}hold-minutes: (\d+)$/m)?.[1]);
  });

  it('결제 재조회 간격 · 모의 PG 수수료가 결제 코드와 같다', () => {
    const backoff = read(PAYMENT).match(/val INQUIRY_BACKOFF: List<Duration> = listOf\(([^)]*)\)/)?.[1];
    expect(backoff, '재조회 간격 목록을 못 읽음').toBeDefined();
    const seconds = backoff!.split(',').map((s) => s.trim().replace(/L$/, ''));
    expect(docValue(KEY.backoff)).toBe(`${seconds.join(' · ')}초`);
    expectNumber(KEY.fee, read(MOCK_PG).match(/const val FEE_PERCENT = (\d+)L/)?.[1]);
  });

  it('자동 구매 확정 · 정산 배치 · 기록 보존이 코드와 같다', () => {
    expectNumber(KEY.confirmDays, read(PURCHASE_CONFIRM).match(/order\.purchase-confirm-days:(\d+)\}/)?.[1]);
    const cron = read(COMMERCE_YML).match(/^settlement:[\s\S]*?\n {4}cron: "(\d+) (\d+) (\d+) \* \* \*"$/m);
    expect(cron, '정산 배치 cron 을 못 읽음').not.toBeNull();
    const [, , minute, hour] = cron!;
    expect(docValue(KEY.batchCron)).toBe(`매일 ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`);
    expectNumber(KEY.recordYears, read(STATEMENT).match(/val RECORD_RETENTION: Period = Period\.ofYears\((\d+)\)/)?.[1]);
  });
});
