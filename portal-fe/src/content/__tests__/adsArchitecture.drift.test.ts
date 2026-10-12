// @vitest-environment node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * 광고 드릴다운(`/tech/ads`)의 적용 값이 광고 코드 · 화면 코드와 같은지 본다.
 *
 * 값의 원본은 온톨로지(`code-dictionary/.../ontology/ads.yaml`)의 `applied.facts[].key` 이고, 이 테스트는
 * 그것을 내보낸 `src/content/drill/ads.json` 을 읽는다. 레포 루트의 ads · engagement · common 파일을 직접 읽으므로
 * **CI 체크아웃에서만 돈다**. 파일이 없으면 실패한다(건너뛰지 않는다).
 * 운영 매니페스트는 이 값들을 env 로 덮지 않는다(engagement 는 토큰 비밀값만 받는다).
 */

const repo = (path: string) => fileURLToPath(new URL(`../../../../${path}`, import.meta.url));
const read = (path: string) => readFileSync(repo(path), 'utf8');

const A = 'ads/domain/src/main/kotlin/com/kgd/ads/domain/';
const F = 'ads/feature/src/main/kotlin/com/kgd/ads/';
const DRILL = 'portal-fe/src/content/drill/ads.json';
const CAMPAIGN = `${A}campaign/model/Campaign.kt`;
const HEADROOM = `${A}decision/policy/WalletHeadroom.kt`;
const PCTR = `${A}decision/policy/PredictedCtr.kt`;
const SIGNER = `${A}token/policy/ServeTokenSigner.kt`;
const SPLIT = `${A}ledger/policy/RevenueSplit.kt`;
const CREDITS = `${A}ledger/model/Credits.kt`;
const EVENTS = `${F}application/event/service/AdEventService.kt`;
const SETTLEMENT_JOB = `${F}infrastructure/scheduling/SettlementJob.kt`;
const INDEX_JOB = `${F}infrastructure/scheduling/CandidateIndexRefreshJob.kt`;
const REDIS_KEYS = `${F}infrastructure/redis/AdsRedisKeys.kt`;
const ENGAGEMENT_YML = 'engagement/app/src/main/resources/application.yml';
const COPY = 'portal-fe/src/seo/copy.mjs';
const ADS_API = 'portal-fe/src/components/ads/adsApi.ts';
const IMPRESSION = 'portal-fe/src/analytics/useImpression.ts';

/** 대조하는 사실 키 — 온톨로지의 facts[].key 와 같은 이름 */
const KEY = {
  frequency: 'frequency-cap-per-day',
  hourlyCap: 'hourly-cap-percent',
  unsettled: 'max-unsettled-hours',
  pctr: 'pctr-prior',
  token: 'token-lifetime-hours',
  clickRate: 'click-rate-limit',
  publisherShare: 'publisher-share-percent',
  settlement: 'settlement-interval-minutes',
  indexRefresh: 'index-refresh-seconds',
  adsense: 'adsense-client',
  decisionTimeout: 'decision-timeout-seconds',
  visitorTtl: 'visitor-frequency-ttl-hours',
  viewability: 'viewability',
  topup: 'topup-limits',
} as const;

type Fact = { label: string; value: string; key?: string };
const drill = JSON.parse(read(DRILL)) as { concepts: Record<string, { applied?: { facts?: Fact[] } }> };
const facts = Object.values(drill.concepts).flatMap((c) => c.applied?.facts ?? []).filter((f) => f.key);
const docValue = (key: string) => facts.find((f) => f.key === key)?.value;
/** 화면 값 안의 수를 순서대로 — 「10분에 방문자당 5회」 → [10, 5] */
const numbers = (v: string | undefined) => (v?.match(/\d+(\.\d+)?/g) ?? []).map(Number);
/** 코드의 수 리터럴 — `5 * 60_000L` 같은 곱도 푼다 */
const literal = (v: string | undefined) =>
  v === undefined ? NaN : v.split('*').reduce((acc, part) => acc * Number(part.trim().replace(/_/g, '').replace(/L$/, '')), 1);

function expectNumbers(key: string, codeValues: number[]) {
  const v = docValue(key);
  expect(v, `드릴다운 데이터에서 사실 키 ${key} 를 못 찾음`).toBeDefined();
  expect(codeValues.every((n) => Number.isFinite(n)), `코드 쪽 ${key} 값을 못 읽음`).toBe(true);
  expect(numbers(v), `${key}: 온톨로지 값과 코드 값이 다르다`).toEqual(codeValues);
}

describe('광고 드릴다운 적용 값 드리프트', () => {
  it('대조 키가 아닌 사실 키는 없다 — 키를 달면 여기에 대조도 단다', () => {
    const known = new Set<string>(Object.values(KEY));
    expect(facts.map((f) => f.key).filter((k) => !known.has(k!))).toEqual([]);
  });

  it('빈도 · 시간당 상한 · 정산 지연 한도 · 예측 클릭률 사전값이 도메인 정책과 같다', () => {
    const campaign = read(CAMPAIGN);
    expectNumbers(KEY.frequency, [literal(campaign.match(/DEFAULT_FREQUENCY_CAP_PER_DAY = (\S+)/)?.[1])]);
    expectNumbers(KEY.hourlyCap, [literal(campaign.match(/HOURLY_CAP_PERCENT = (\S+)/)?.[1])]);
    expectNumbers(KEY.unsettled, [literal(read(HEADROOM).match(/val MAX_UNSETTLED: Duration = Duration\.ofHours\((\d+)\)/)?.[1])]);
    const pctr = read(PCTR);
    expectNumbers(KEY.pctr, [
      Number(pctr.match(/PRIOR_CLICKS = ([\d.]+)/)?.[1]),
      Number(pctr.match(/PRIOR_IMPRESSIONS = ([\d.]+)/)?.[1]),
    ]);
  });

  it('토큰 수명 · 클릭 속도 제한 · 빈도 식별자 보관이 이벤트 코드와 같다', () => {
    expectNumbers(KEY.token, [literal(read(SIGNER).match(/val LIFETIME: Duration = Duration\.ofHours\((\d+)\)/)?.[1])]);
    const events = read(EVENTS);
    expectNumbers(KEY.clickRate, [
      literal(events.match(/CLICK_WINDOW_MINUTES = (\S+)/)?.[1]),
      literal(events.match(/ads\.click\.max-per-visitor-per-window:(\d+)\}/)?.[1]),
    ]);
    expectNumbers(KEY.visitorTtl, [literal(read(REDIS_KEYS).match(/VISITOR_FREQUENCY_TTL_HOURS = (\S+)/)?.[1])]);
  });

  it('퍼블리셔 몫 · 정산 주기 · 인덱스 갱신 · 충전 한도가 코드와 같다', () => {
    expectNumbers(KEY.publisherShare, [literal(read(SPLIT).match(/DEFAULT_PUBLISHER_RATE_BASIS_POINTS = (\S+)/)?.[1]) / 100]);
    expectNumbers(KEY.settlement, [literal(read(SETTLEMENT_JOB).match(/const val INTERVAL_MS = ([^\n]+)/)?.[1]) / 60_000]);
    expectNumbers(KEY.indexRefresh, [literal(read(INDEX_JOB).match(/REFRESH_INTERVAL_MS = (\S+)/)?.[1]) / 1000]);
    const perCredit = literal(read(CREDITS).match(/MICROS_PER_CREDIT = (\S+)/)?.[1]);
    const yml = read(ENGAGEMENT_YML);
    expectNumbers(KEY.topup, [
      literal(yml.match(/max-per-call-micros: (\d+)/)?.[1]) / perCredit,
      literal(yml.match(/daily-limit-micros: (\d+)/)?.[1]) / perCredit,
    ]);
  });

  it('AdSense 게시자 ID · 결정 대기 한도 · 가시 노출 기준이 화면 코드와 같다', () => {
    expect(docValue(KEY.adsense)).toBe(read(COPY).match(/export const ADSENSE_CLIENT = '([^']+)'/)?.[1]);
    expectNumbers(KEY.decisionTimeout, [literal(read(ADS_API).match(/DECISION_TIMEOUT_MS = (\S+);/)?.[1]) / 1000]);
    const imp = read(IMPRESSION);
    expectNumbers(KEY.viewability, [
      literal(imp.match(/VISIBLE_RATIO = (\S+);/)?.[1]) * 100,
      literal(imp.match(/DWELL_MS = (\S+);/)?.[1]) / 1000,
    ]);
  });
});
