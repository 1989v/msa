---
name: reindex
description: 코드베이스를 분석하여 IT 개념을 자동 추출하고 code-dictionary 서비스에 색인한다. 코드 분석, 개념 태깅, 리인덱스 등의 자연어 요청에도 반응.
argument-hint: [--all | --file path/to/file.kt | 서비스명]
---

# Code Dictionary — Reindex (코드 분석 + 개념 색인)

코드베이스의 소스 파일을 분석하여 적용된 IT 개념을 식별하고, code-dictionary 서비스의 개념 사전(concept_index)에 등록한다.

## 트리거

- `/reindex` — git diff 기준 변경 파일만 분석
- `/reindex --all` — 전체 코드베이스 분석
- `/reindex --file path/to/file.kt` — 특정 파일만 분석
- `/reindex product` — 특정 서비스(디렉토리) 분석
- 자연어: "코드 분석해서 개념 태깅해줘", "리인덱스", "코드 사전 갱신"

## 실행 단계

### 1. 대상 파일 결정

**인자 파싱**:
- `--all`: msa 루트 하위의 모든 `*.kt`, `*.java`, `*.ts` 소스 파일
- `--file {path}`: 지정한 파일 1개
- `{서비스명}`: 해당 서비스 디렉토리 하위 소스 파일 (예: `product`, `order`, `gifticon`)
- 인자 없음: `git diff --name-only HEAD~1` 기준 변경 파일

**스캔 대상 확장자**: `.kt`, `.java`, `.ts`, `.tsx`
**제외 패턴**: `build/`, `node_modules/`, `dist/`, `*.test.*`, `*.spec.*`, `generated/`, `.gitkeep`

### 2. 개념 사전 로드

`code-dictionary/app/src/main/resources/db/migration/V2__seed_concepts.sql`을 읽어서 현재 등록된 IT 개념 목록을 파악한다. 또는 서비스가 실행 중이면 `GET /api/v1/concepts?size=500` API로 조회한다.

핵심은 **사전에 존재하는 개념만 태깅**하는 것. 사전에 없는 새로운 개념을 발견하면 별도 목록으로 리포트한다.

### 3. 파일별 코드 분석

각 파일을 읽고 다음을 분석한다:

1. **파일 전체 구조 파악**: 클래스/함수/객체 단위의 블록 식별
2. **개념 매칭**: 각 코드 블록에서 사전의 IT 개념이 적용되었는지 판별
   - 클래스/패턴 기반: `object` → singleton, `sealed class` → sealed-class
   - 어노테이션 기반: `@Transactional` → acid, `@Cacheable` → caching
   - 패턴 기반: try-catch → exception-handling, coroutine/suspend → coroutine
   - 아키텍처 기반: Port/Adapter 인터페이스 구현 → port-adapter, clean-architecture
   - 인프라 기반: Kafka producer/consumer → fan-out/event-driven-architecture
3. **코드 위치 특정**: 개념이 적용된 정확한 라인 범위 (함수/클래스 시작~끝)
4. **설명 생성**: 해당 코드가 어떤 맥락에서 해당 개념을 적용했는지 1줄 설명

### 4. 결과 생성

분석 결과를 `code-dictionary/index-data/` 디렉토리에 서비스별 JSON 파일로 저장한다.

**파일 경로**: `code-dictionary/index-data/{service}/{filename}.json`

**JSON 형식**:
```json
[
  {
    "conceptId": "singleton-pattern",
    "filePath": "product/app/src/main/kotlin/com/kgd/product/config/AppConfig.kt",
    "lineStart": 1,
    "lineEnd": 15,
    "codeSnippet": "object AppConfig { ... }",
    "gitUrl": "",
    "description": "애플리케이션 설정을 object 키워드로 싱글톤 구현",
    "gitCommitHash": ""
  }
]
```

### 5. 서비스 연동 (선택)

code-dictionary 서비스가 실행 중인 경우 (`http://localhost:8089` 응답 확인):
- 각 항목을 `POST /api/v1/index` API로 등록
- 완료 후 `POST /api/v1/index/sync`로 OpenSearch 동기화

서비스가 실행 중이 아닌 경우:
- JSON 파일만 생성하고 안내: "서비스 기동 후 `/reindex --sync` 로 동기화 가능"

### 6. 결과 리포트

분석 완료 후 사용자에게 보고:

```
## 코드 분석 결과

| 서비스 | 파일 수 | 태깅 수 | 주요 개념 |
|--------|--------|--------|----------|
| product | 12 | 25 | singleton, factory, adapter |
| order | 8 | 18 | saga, transaction, event-driven |

### 신규 발견 (사전에 없는 개념)
- `retry-with-backoff` (order/app/.../RetryService.kt:15-30)
- ...

### 저장 위치
- code-dictionary/index-data/product/*.json
- code-dictionary/index-data/order/*.json
```

## 분석 기준

### 매칭 우선순위

1. **명확한 패턴**: `object` = singleton, `sealed class` = sealed-class, `data class` = data-class
2. **어노테이션/키워드**: `@Transactional`, `@Cacheable`, `suspend fun`, `by lazy`
3. **아키텍처 패턴**: Port/Adapter 구현, UseCase 인터페이스, Repository 패턴
4. **복합 패턴**: Saga orchestration, CQRS (command/query 분리), Event sourcing

### 태깅 품질 기준

- **한 파일에 여러 개념**: 가능. 각각 별도 항목으로 태깅
- **코드 스니펫**: 핵심 부분만 추출 (최대 10줄). 전체 클래스를 넣지 않음
- **라인 범위**: 해당 개념이 가장 명확하게 드러나는 범위
- **설명**: "이 코드가 왜 이 개념인지" 1줄 설명. 일반적인 개념 정의가 아님

## 에러 처리

- 파일 읽기 실패: 건너뛰고 리포트에 기록
- 서비스 미실행: JSON 파일만 생성, 동기화 안내
- 개념 매칭 0건: 해당 파일은 태깅 없이 건너뜀