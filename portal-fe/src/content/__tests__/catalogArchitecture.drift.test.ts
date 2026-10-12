// @vitest-environment node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * 상품 · 재고 드릴다운(`/tech/catalog`)의 적용 값이 상품 · 재고 · 혜택 · 장바구니 코드와 같은지 본다.
 *
 * 값의 원본은 온톨로지(`code-dictionary/.../ontology/commerce-catalog.yaml`)의 `applied.facts[].key` 이고, 이 테스트는
 * 그것을 내보낸 `src/content/drill/commerce-catalog.json` 을 읽는다. 레포 루트 파일을 직접 읽으므로 **CI 체크아웃에서만 돈다**.
 * 앱 설정(application.yml)이 값을 주면 그것이, 없으면 코드 기본값이 운영 값이다 — 운영 매니페스트는 이 값들을 덮지 않는다.
 */

const repo = (path: string) => fileURLToPath(new URL(`../../../../${path}`, import.meta.url));
const read = (path: string) => readFileSync(repo(path), 'utf8');

const DRILL = 'portal-fe/src/content/drill/commerce-catalog.json';
const COMMERCE_YML = 'commerce/app/src/main/resources/application.yml';
const EXPIRY = 'inventory/feature/src/main/kotlin/com/kgd/inventory/application/reservation/service/ReservationExpiryService.kt';
const HOLD_EXPIRY = 'promotion/feature/src/main/kotlin/com/kgd/promotion/infrastructure/scheduler/PromotionHoldExpiryScheduler.kt';
const CART = 'order/domain/src/main/kotlin/com/kgd/order/domain/cart/model/CartItem.kt';
const PRODUCTS = 'product/feature/src/main/kotlin/com/kgd/product/presentation/product/controller/ProductController.kt';
const REPUBLISH = 'product/feature/src/main/kotlin/com/kgd/product/application/product/service/ProductRepublishService.kt';
const SELLER = 'seller/domain/src/main/kotlin/com/kgd/seller/domain/seller/model/Seller.kt';

/** 대조하는 사실 키 — 온톨로지의 facts[].key 와 같은 이름 */
const KEY = {
  hold: 'hold-minutes',
  expiry: 'reservation-expiry-check-seconds',
  reconciliation: 'stock-reconciliation-minutes',
  holdExpiry: 'promotion-hold-expiry-seconds',
  concurrent: 'max-concurrent-reservations',
  cart: 'cart-max-quantity',
  pageSize: 'product-page-size',
  republish: 'republish-page-size',
  pii: 'seller-pii-retention-days',
} as const;

type Fact = { label: string; value: string; key?: string };
const drill = JSON.parse(read(DRILL)) as { concepts: Record<string, { applied?: { facts?: Fact[] } }> };
const facts = Object.values(drill.concepts).flatMap((c) => c.applied?.facts ?? []).filter((f) => f.key);
const docValue = (key: string) => facts.find((f) => f.key === key)?.value;
/** 화면 값 안의 수를 순서대로 — 「기본 100 · 최대 500」 → [100, 500] */
const numbers = (v: string | undefined) => (v?.match(/\d+(\.\d+)?/g) ?? []).map(Number);

function expectNumbers(key: string, codeValues: (string | number | undefined)[]) {
  const v = docValue(key);
  expect(v, `드릴다운 데이터에서 사실 키 ${key} 를 못 찾음`).toBeDefined();
  const code = codeValues.map(Number);
  expect(code.every((n) => Number.isFinite(n)), `코드 쪽 ${key} 값을 못 읽음`).toBe(true);
  expect(numbers(v), `${key}: 온톨로지 값과 코드 값이 다르다`).toEqual(code);
}

const yml = read(COMMERCE_YML);
/** 앱 설정의 `부모:\n  …\n    키: 값` — 부모 블록 안의 첫 키만 */
const ymlValue = (parent: RegExp, key: string) => yml.match(new RegExp(`${parent.source}(?:\\n {2,}.*)*?\\n {2,}${key}: (\\d+)`))?.[1];

describe('상품 · 재고 드릴다운 적용 값 드리프트', () => {
  it('대조 키가 아닌 사실 키는 없다 — 키를 달면 여기에 대조도 단다', () => {
    const known = new Set<string>(Object.values(KEY));
    expect(facts.map((f) => f.key).filter((k) => !known.has(k!))).toEqual([]);
  });

  it('보류 기한 · 예약 만료 · Redis 대사 · 혜택 보류 만료 · 동시 예약 상한이 앱 설정(없으면 코드 기본값)과 같다', () => {
    expectNumbers(KEY.hold, [yml.match(/^commerce:\n {2}hold-minutes: (\d+)$/m)?.[1]]);
    expectNumbers(KEY.expiry, [Number(read(EXPIRY).match(/inventory\.reservation\.expiry-check-interval-ms:(\d+)\}/)?.[1]) / 1000]);
    expectNumbers(KEY.reconciliation, [Number(ymlValue(/\n {2}reconciliation:/, 'interval-ms')) / 60_000]);
    const holdExpiry = ymlValue(/\npromotion:/, 'interval-ms') ?? read(HOLD_EXPIRY).match(/promotion\.hold-expiry\.interval-ms:(\d+)\}/)?.[1];
    expectNumbers(KEY.holdExpiry, [Number(holdExpiry) / 1000]);
    expectNumbers(KEY.concurrent, [yml.match(/max-concurrent-reservations: \$\{INVENTORY_MAX_CONCURRENT_RESERVATIONS:(\d+)\}/)?.[1]]);
  });

  it('장바구니 수량 · 공개 목록 페이지 · 재발행 묶음 · 반려 개인정보 보관이 코드와 같다', () => {
    expectNumbers(KEY.cart, [read(CART).match(/const val MAX_QUANTITY = (\d+)/)?.[1]]);
    const page = read(PRODUCTS).match(/@RequestParam\(defaultValue = "(\d+)"\) @Min\(1\) @Max\((\d+)\) size: Int/);
    expectNumbers(KEY.pageSize, [page?.[1], page?.[2]]);
    expectNumbers(KEY.republish, [read(REPUBLISH).match(/const val PAGE_SIZE = (\d+)/)?.[1]]);
    expectNumbers(KEY.pii, [read(SELLER).match(/val REJECTED_PII_RETENTION: Duration = Duration\.ofDays\((\d+)\)/)?.[1]]);
  });
});
