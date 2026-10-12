// @vitest-environment node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * 추천 드릴다운(`/tech/recommendation`)의 적용 값이 추천 코드 · 매니페스트와 같은지 본다.
 *
 * 값의 원본은 온톨로지(`code-dictionary/.../ontology/recommendation.yaml`)의 `applied.facts[].key` 이고, 이 테스트는
 * 그것을 내보낸 `src/content/drill/recommendation.json` 을 읽는다. 레포 루트의 recommendation · common · k8s 파일을
 * 직접 읽으므로 **CI 체크아웃에서만 돈다**. 파일이 없으면 실패한다(건너뛰지 않는다).
 * 화면 값에는 단위가 붙는다(「30일」) — 앞의 수를 코드 값과 비교한다.
 */

const repo = (path: string) => fileURLToPath(new URL(`../../../../${path}`, import.meta.url));
const read = (path: string) => readFileSync(repo(path), 'utf8');

const DRILL = 'portal-fe/src/content/drill/recommendation.json';
const WEIGHTS = 'recommendation/domain/src/main/kotlin/com/kgd/recommendation/domain/recommendation/policy/ActionWeightedScore.kt';
const WILSON = 'common/src/main/kotlin/com/kgd/common/statistics/Wilson.kt';
const SIMILARITY =
  'recommendation/feature/src/main/kotlin/com/kgd/recommendation/infrastructure/persistence/ClickHouseItemSimilarityComputer.kt';
const PERSONALIZED = 'recommendation/feature/src/main/kotlin/com/kgd/recommendation/application/recommendation/usecase/GetPersonalizedUseCase.kt';
const CB_SYNC = 'recommendation/feature/src/main/kotlin/com/kgd/recommendation/infrastructure/sync/CbScoreSync.kt';
const BANDIT = 'recommendation/feature/src/main/kotlin/com/kgd/recommendation/infrastructure/bandit/BanditPolicy.kt';
const ANN_APP = 'recommendation-ann/app.py';
const ANN_DEPLOYMENT = 'k8s/base/recommendation-ann/deployment.yaml';
const ENGAGEMENT_DEPLOYMENT = 'k8s/base/engagement/deployment.yaml';

/** 대조하는 사실 키 — 온톨로지의 facts[].key 와 같은 이름 */
const KEY = {
  reservation: 'reservation-weight',
  click: 'click-weight',
  addwish: 'addwish-weight',
  pageview: 'pageview-weight',
  wilsonZ: 'wilson-z',
  windowDays: 'ppmi-window-days',
  minCoCount: 'ppmi-min-co-count',
  topPerItem: 'ppmi-top-per-item',
  hnswM: 'ann-hnsw-m',
  efSearch: 'ann-hnsw-ef-search',
  minActions: 'personalized-min-actions',
  topPerPartition: 'cb-top-per-partition',
  ttlHours: 'cb-ttl-hours',
  bandit: 'bandit-enabled',
} as const;

type Fact = { label: string; value: string; key?: string };
const drill = JSON.parse(read(DRILL)) as { concepts: Record<string, { applied?: { facts?: Fact[] } }> };
const facts = Object.values(drill.concepts).flatMap((c) => c.applied?.facts ?? []).filter((f) => f.key);
const docValue = (key: string) => facts.find((f) => f.key === key)?.value;

/** 매니페스트 env 값. 없으면 undefined */
function envValue(yaml: string, name: string): string | undefined {
  return yaml.match(new RegExp(`- name: ${name}\\s*\\n\\s*value:\\s*"?([^"\\n]+)"?`))?.[1];
}

/** 수는 앞의 수끼리, 그 밖은 글자 그대로 비교한다 */
function expectDocValue(key: string, codeValue: string | undefined) {
  const v = docValue(key);
  expect(v, `드릴다운 데이터에서 사실 키 ${key} 를 못 찾음`).toBeDefined();
  expect(codeValue, `코드 쪽 ${key} 값을 못 읽음`).toBeDefined();
  const n = Number(codeValue);
  if (Number.isNaN(n)) expect(v, `${key}: 온톨로지 값과 코드 값이 다르다`).toBe(codeValue);
  else expect(parseFloat(v!), `${key}: 온톨로지 값과 코드 값이 다르다`).toBe(n);
}

describe('추천 드릴다운 적용 값 드리프트', () => {
  it('대조 키가 아닌 사실 키는 없다 — 키를 달면 여기에 대조도 단다', () => {
    const known = new Set<string>(Object.values(KEY));
    expect(facts.map((f) => f.key).filter((k) => !known.has(k!))).toEqual([]);
  });

  it('행동 가중치 넷이 도메인 정책과 같다', () => {
    const src = read(WEIGHTS);
    const weight = (name: string) => src.match(new RegExp(`WEIGHT_${name}: Double = ([\\d.]+)`))?.[1];
    expectDocValue(KEY.reservation, weight('RESERVATION'));
    expectDocValue(KEY.click, weight('CLICK'));
    expectDocValue(KEY.addwish, weight('ADDWISH'));
    expectDocValue(KEY.pageview, weight('PAGEVIEW'));
  });

  it('Wilson z 가 공통 통계 함수의 기본값과 같다', () => {
    expectDocValue(KEY.wilsonZ, read(WILSON).match(/fun lowerConfidenceBound\([^)]*z: Double = ([\d.]+)/)?.[1]);
  });

  it('PPMI 기간 · 최소 동시 출현 · 아이템당 상위가 계산기 기본값과 같다', () => {
    const src = read(SIMILARITY);
    expectDocValue(KEY.windowDays, src.match(/windowDays: Int = (\d+)/)?.[1]);
    expectDocValue(KEY.minCoCount, src.match(/minCoCount: Long = (\d+)/)?.[1]);
    expectDocValue(KEY.topPerItem, src.match(/topPerItem: Int = (\d+)/)?.[1]);
  });

  it('HNSW M · efSearch 가 사이드카 매니페스트(없으면 앱 기본값)와 같다', () => {
    const app = read(ANN_APP);
    const manifest = read(ANN_DEPLOYMENT);
    const value = (name: string) => envValue(manifest, name) ?? app.match(new RegExp(`"${name}", "(\\d+)"`))?.[1];
    expectDocValue(KEY.hnswM, value('HNSW_M'));
    expectDocValue(KEY.efSearch, value('HNSW_EF_SEARCH'));
  });

  it('개인화 최소 행동 수가 유스케이스 상수와 같다', () => {
    expectDocValue(KEY.minActions, read(PERSONALIZED).match(/MIN_ACTIONS_FOR_PERSONALIZED = (\d+)L/)?.[1]);
  });

  it('카테고리 베스트 상위 수 · TTL 이 동기화 기본값과 같다', () => {
    const src = read(CB_SYNC);
    expectDocValue(KEY.topPerPartition, src.match(/topPerPartition: Int = (\d+)/)?.[1]);
    expectDocValue(KEY.ttlHours, src.match(/Duration\.ofHours\((\d+)\)/)?.[1]);
  });

  it('밴딧 켜짐이 운영 매니페스트(없으면 코드 기본값)와 같다', () => {
    const fallback = read(BANDIT).match(/recommendation\.bandit\.enabled:(true|false)\}/)?.[1];
    expectDocValue(KEY.bandit, envValue(read(ENGAGEMENT_DEPLOYMENT), 'RECOMMENDATION_BANDIT_ENABLED') ?? fallback);
  });
});
