// @vitest-environment node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * 검색 드릴다운(`/tech/search`)의 적용 값 12개가 검색 코드·매니페스트와 같은지 본다.
 *
 * 값의 원본은 온톨로지(`code-dictionary/.../ontology/search.yaml`)의 `applied.facts[].key` 이고, 이 테스트는
 * 그것을 내보낸 `src/content/drill/search.json` 을 읽는다. 레포 루트의 search·k8s 파일을 직접 읽으므로
 * **CI 체크아웃에서만 돈다** — Docker 빌드는 portal-fe 만 컨텍스트로 받고 테스트를 돌리지 않는다.
 * 파일이 없으면 실패한다(건너뛰지 않는다). 키를 바꾸면 「키를 못 찾음」으로, 값이 어긋나면 `toBe` 로 갈라 실패한다.
 */

const repo = (path: string) => fileURLToPath(new URL(`../../../../${path}`, import.meta.url));
const read = (path: string) => readFileSync(repo(path), 'utf8');

const DRILL = 'portal-fe/src/content/drill/search.json';
const RRF_INITIALIZER =
  'search/app/src/main/kotlin/com/kgd/search/infrastructure/opensearch/HybridSearchPipelineInitializer.kt';
const APP_YML = 'search/app/src/main/resources/application.yml';
const DEPLOYMENT = 'k8s/base/search/deployment.yaml';
const REINDEX_CRONJOB = 'k8s/base/search-batch/cronjob-attraction-reindex.yaml';
const INDEX_JSON = 'search/batch/src/main/resources/opensearch/attractions-index.json';

/** 대조하는 사실 키 — 온톨로지의 facts[].key 와 같은 이름 */
const KEY = {
  dictionary: 'nori-user-dictionary-lines',
  synonyms: 'synonym-lines',
  hybrid: 'hybrid-enabled',
  fusion: 'fusion-technique',
  rankConstant: 'rrf-rank-constant',
  modelRef: 'embedding-model-ref',
  dimension: 'vector-dimension',
  m: 'hnsw-m',
  efConstruction: 'hnsw-ef-construction',
  sightWeight: 'sight-weight',
  commerceWeight: 'commerce-weight',
  clickBoost: 'click-boost-enabled',
} as const;

type Fact = { label: string; value: string; key?: string };
const drill = JSON.parse(read(DRILL)) as { concepts: Record<string, { applied?: { facts?: Fact[] } }> };
const facts = Object.values(drill.concepts).flatMap((c) => c.applied?.facts ?? []).filter((f) => f.key);
const docValue = (key: string) => facts.find((f) => f.key === key)?.value;

/** 매니페스트 env 값. 없으면 undefined */
function envValue(yaml: string, name: string): string | undefined {
  return yaml.match(new RegExp(`- name: ${name}\\s*\\n\\s*value:\\s*"?([^"\\n]+)"?`))?.[1];
}

/** 켜짐 스위치 — deployment.yaml env 가 있으면 그 값, 없으면 application.yml 의 `${ENV:기본값}` */
function switchValue(envName: string): string | undefined {
  return envValue(read(DEPLOYMENT), envName) ?? read(APP_YML).match(new RegExp(`${envName}:(true|false)\\}`))?.[1];
}

function expectDocValue(key: string, codeValue: unknown) {
  const v = docValue(key);
  expect(v, `드릴다운 데이터에서 사실 키 ${key} 를 못 찾음`).toBeDefined();
  expect(codeValue, `코드 쪽 ${key} 값을 못 읽음`).toBeDefined();
  expect(v, `${key}: 온톨로지 값과 코드 값이 다르다`).toBe(String(codeValue));
}

describe('검색 드릴다운 적용 값 드리프트', () => {
  it('대조 키가 아닌 사실 키는 없다 — 키를 달면 여기에 대조도 단다', () => {
    const known = new Set<string>(Object.values(KEY));
    expect(facts.map((f) => f.key).filter((k) => !known.has(k!))).toEqual([]);
  });

  const index = JSON.parse(read(INDEX_JSON));
  const analysis = index.settings.analysis;

  it('RRF rank_constant 가 파이프라인 정의와 같다', () => {
    expectDocValue(KEY.rankConstant, read(RRF_INITIALIZER).match(/"rank_constant":\s*(\d+)/)?.[1]);
  });

  it('관광·상업 분류 가중치가 application.yml 과 같다', () => {
    const yml = read(APP_YML);
    expectDocValue(KEY.sightWeight, yml.match(/sight-weight:\s*([\d.]+)/)?.[1]);
    expectDocValue(KEY.commerceWeight, yml.match(/commerce-weight:\s*([\d.]+)/)?.[1]);
  });

  it('모델 ref 가 검색 앱과 재색인 두 매니페스트 모두와 같다', () => {
    expectDocValue(KEY.modelRef, envValue(read(DEPLOYMENT), 'SEARCH_EMBEDDING_MODEL_REF'));
    expectDocValue(KEY.modelRef, envValue(read(REINDEX_CRONJOB), 'SEARCH_EMBEDDING_MODEL_REF'));
  });

  it('벡터 차원·HNSW m·ef_construction 이 색인 매핑과 같다', () => {
    const embedding = index.mappings.properties.embedding;
    expectDocValue(KEY.dimension, embedding.dimension);
    expectDocValue(KEY.m, embedding.method.parameters.m);
    expectDocValue(KEY.efConstruction, embedding.method.parameters.ef_construction);
  });

  it('사용자 사전 줄 수가 색인 설정과 같다', () => {
    const tokenizer = Object.values(analysis.tokenizer as Record<string, { user_dictionary_rules?: string[] }>).find(
      (t) => t.user_dictionary_rules,
    );
    expectDocValue(KEY.dictionary, tokenizer?.user_dictionary_rules?.length);
  });

  it('동의어 줄 수가 색인 설정과 같다', () => {
    expectDocValue(KEY.synonyms, analysis.filter.tourism_synonyms.synonyms.length);
  });

  it('하이브리드 켜짐이 운영 매니페스트와 같다', () => {
    expectDocValue(KEY.hybrid, switchValue('SEARCH_ATTRACTION_HYBRID_ENABLED'));
  });

  it('clickBoost 켜짐이 운영 매니페스트(없으면 application.yml 기본값)와 같다', () => {
    expectDocValue(KEY.clickBoost, switchValue('SEARCH_ATTRACTION_CLICK_BOOST_ENABLED'));
  });

  it('융합 방식이 application.yml 과 같다', () => {
    expectDocValue(KEY.fusion, read(APP_YML).match(/attraction-hybrid:[\s\S]*?\n\s+fusion:\s*(\S+)/)?.[1]);
  });
});
