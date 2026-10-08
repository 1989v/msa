// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * 검색 아키텍처 문서(`search-architecture.md`) §4 표의 핵심 값 9개가 검색 코드·매니페스트와 같은지 본다.
 *
 * 레포 루트의 search·k8s 파일을 직접 읽으므로 **CI 체크아웃에서만 돈다** — Docker 빌드는 portal-fe 만
 * 컨텍스트로 받고 테스트를 돌리지 않는다. 파일이 없으면 실패한다(건너뛰지 않는다).
 *
 * 문서 쪽 값은 §4 표에서 `항목` 열이 고정 키인 행의 `현재 값` 열 첫 백틱 토큰이다. 키를 바꾸면
 * 「행을 못 찾음」으로, 값이 어긋나면 `toBe` 로 갈라 실패한다. 그림·나머지 행은 사람이 고친다.
 */

const repo = (path: string) => fileURLToPath(new URL(`../../../../${path}`, import.meta.url));
const read = (path: string) => readFileSync(repo(path), 'utf8');

const DOC = 'portal-fe/src/content/search-architecture.md';
const RRF_INITIALIZER =
  'search/app/src/main/kotlin/com/kgd/search/infrastructure/opensearch/HybridSearchPipelineInitializer.kt';
const APP_YML = 'search/app/src/main/resources/application.yml';
const DEPLOYMENT = 'k8s/base/search/deployment.yaml';
const REINDEX_CRONJOB = 'k8s/base/search-batch/cronjob-attraction-reindex.yaml';
const INDEX_JSON = 'search/batch/src/main/resources/opensearch/attractions-index.json';

/** §4 표 `항목` 열 고정 키 */
const KEY = {
  dictionary: 'nori 사용자 사전 줄 수',
  synonyms: '동의어 줄 수',
  hybrid: '하이브리드 켜짐',
  fusion: '융합 방식',
  rankConstant: 'RRF rank_constant',
  modelRef: '임베딩 모델 ref',
  dimension: '벡터 차원',
  m: 'HNSW m',
  efConstruction: 'HNSW ef_construction',
  sightWeight: '관광 분류 가중치',
  commerceWeight: '상업 분류 가중치',
  clickBoost: 'clickBoost 켜짐',
} as const;

type Row = { key: string; value: string | undefined; evidence: string };

const cellText = (cell: string) => cell.replace(/`/g, '').trim();

/** `## 4.` 로 시작하는 h2 아래 첫 표의 본문 행 */
function techTableRows(markdown: string): Row[] {
  const lines = markdown.split('\n');
  const start = lines.findIndex((l) => /^## 4\./.test(l));
  if (start < 0) return [];
  const end = lines.findIndex((l, i) => i > start && /^## /.test(l));
  const table = lines.slice(start + 1, end < 0 ? undefined : end).filter((l) => l.startsWith('|'));
  if (table.length < 3) return [];
  const split = (l: string) => l.replace(/^\|/, '').replace(/\|\s*$/, '').split('|');
  const header = split(table[0]).map(cellText);
  const keyCol = header.indexOf('항목');
  const valueCol = header.indexOf('현재 값');
  const evidenceCol = header.indexOf('근거');
  return table.slice(2).map((l) => {
    const cells = split(l);
    return {
      key: cellText(cells[keyCol] ?? ''),
      value: cells[valueCol]?.match(/`([^`]+)`/)?.[1],
      evidence: cells[evidenceCol] ?? '',
    };
  });
}

const doc = read(DOC);
const rows = techTableRows(doc);
const docValue = (key: string) => rows.find((r) => r.key === key)?.value;

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
  expect(v, `§4 표에서 ${key} 행을 못 찾음`).toBeDefined();
  expect(codeValue, `코드 쪽 ${key} 값을 못 읽음`).toBeDefined();
  expect(v, `${key}: 문서 값과 코드 값이 다르다`).toBe(String(codeValue));
}

describe('검색 아키텍처 문서 드리프트', () => {
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

describe('검색 아키텍처 문서 구조', () => {
  it('머리 출처 주석의 경로가 전부 있다', () => {
    const source = doc.match(/<!--\s*source:([\s\S]*?)-->/)?.[1];
    expect(source, '머리에 <!-- source: … --> 주석이 없다').toBeDefined();
    const paths = source!.split(',').map((p) => p.trim()).filter(Boolean);
    expect(paths.length).toBeGreaterThan(0);
    expect(paths.filter((p) => !existsSync(repo(p))), '없는 출처 경로').toEqual([]);
  });

  it('§4 표의 행마다 근거 파일이 있고 그 파일이 전부 있다', () => {
    expect(rows.length, '§4 표를 못 찾음').toBeGreaterThan(0);
    const missing: string[] = [];
    for (const row of rows) {
      const files = [...row.evidence.matchAll(/`([^`]+)`/g)].map((m) => m[1].replace(/:[\d,-]+$/, ''));
      expect(files.length, `${row.key} 행에 근거 파일이 없다`).toBeGreaterThan(0);
      missing.push(...files.filter((f) => !existsSync(repo(f))));
    }
    expect(missing, '없는 근거 파일').toEqual([]);
  });
});
