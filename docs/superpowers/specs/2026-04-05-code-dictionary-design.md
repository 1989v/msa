# Code Dictionary — 구현 설계

## 개요

msa 프로젝트 코드베이스를 IT 개념 단위로 색인화하고, 웹에서 키워드/자연어 검색으로 코드 위치(파일 + 라인 + git permalink)를 유사도 순으로 반환하는 서비스.

## 아키텍처

```
[React 웹 UI] → [Spring Boot REST API (code-dictionary)]
                        ↓                    ↓
                   [MySQL DB]          [OpenSearch]
                 (source of truth)      (검색 엔진)
                   - concept 사전         - Nori 한국어
                   - concept_index        - synonym filter
                        ↓                 - knn_vector (Phase 2)
                   [Ollama] (Phase 2)
                  (임베딩 생성)
```

### 데이터 흐름

```
[색인] LLM 분석 → RDB 저장 → OpenSearch 색인
[검색] 웹 UI → REST API → OpenSearch 쿼리 → BM25 스코어 순 반환
[풀 재색인] RDB 조회 → OpenSearch 벌크 색인 (LLM 재호출 불필요)
[사전 관리] 웹 UI → REST API → RDB CRUD → OpenSearch synonym 동기화
```

## 모듈 구조

기존 msa 패턴(domain + app 2-모듈)을 따름.

```
code-dictionary/
├── domain/
│   ├── model/
│   │   ├── Concept.kt              # IT 개념 (사전 항목)
│   │   ├── CodeLocation.kt         # 코드 위치 (파일, 라인, git URL)
│   │   └── ConceptIndex.kt         # 개념-코드 매핑 (색인 단위)
│   ├── policy/
│   │   └── IndexingPolicy.kt       # 색인 규칙
│   └── exception/
│       └── CodeDictionaryException.kt
├── app/
│   ├── application/
│   │   ├── usecase/
│   │   │   ├── SearchConceptUseCase.kt     # 검색 유스케이스
│   │   │   ├── IndexCodeUseCase.kt         # 색인 유스케이스
│   │   │   └── ManageConceptUseCase.kt     # 사전 CRUD 유스케이스
│   │   ├── port/
│   │   │   ├── ConceptSearchPort.kt        # OpenSearch 검색 포트
│   │   │   ├── ConceptIndexPort.kt         # OpenSearch 색인 포트
│   │   │   ├── ConceptRepositoryPort.kt    # RDB 사전 포트
│   │   │   └── ConceptIndexRepositoryPort.kt # RDB 색인 결과 포트
│   │   └── dto/
│   │       ├── SearchCommand.kt
│   │       ├── SearchResult.kt
│   │       ├── IndexCommand.kt
│   │       └── ConceptDto.kt
│   ├── infrastructure/
│   │   ├── persistence/
│   │   │   ├── entity/
│   │   │   │   ├── ConceptEntity.kt
│   │   │   │   └── ConceptIndexEntity.kt
│   │   │   ├── repository/
│   │   │   │   ├── ConceptJpaRepository.kt
│   │   │   │   └── ConceptIndexJpaRepository.kt
│   │   │   └── adapter/
│   │   │       ├── ConceptRepositoryAdapter.kt
│   │   │       └── ConceptIndexRepositoryAdapter.kt
│   │   ├── opensearch/
│   │   │   ├── ConceptSearchAdapter.kt     # 검색 구현
│   │   │   ├── ConceptIndexAdapter.kt      # 색인 구현
│   │   │   └── config/
│   │   │       └── OpenSearchConfig.kt
│   │   └── config/
│   │       ├── DataSourceConfig.kt
│   │       └── FlywayConfig.kt
│   └── presentation/
│       └── controller/
│           ├── SearchController.kt         # 검색 API
│           ├── ConceptController.kt        # 사전 CRUD API
│           └── IndexController.kt          # 색인 관리 API
└── web/
    └── search-ui/                          # React 검색 인터페이스
```

## RDB 스키마

```sql
-- IT개념 사전 마스터
CREATE TABLE concept (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    concept_id VARCHAR(100) NOT NULL UNIQUE,  -- e.g. "distributed-lock"
    name VARCHAR(200) NOT NULL,               -- e.g. "분산락"
    category VARCHAR(50) NOT NULL,            -- e.g. "concurrency"
    level VARCHAR(20) NOT NULL,               -- beginner | intermediate | advanced
    description TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 동의어 테이블 (1:N)
CREATE TABLE concept_synonym (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    concept_id BIGINT NOT NULL,
    synonym VARCHAR(200) NOT NULL,
    FOREIGN KEY (concept_id) REFERENCES concept(id) ON DELETE CASCADE
);

-- 관련 개념 테이블 (N:M)
CREATE TABLE concept_relation (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    source_concept_id BIGINT NOT NULL,
    target_concept_id BIGINT NOT NULL,
    FOREIGN KEY (source_concept_id) REFERENCES concept(id) ON DELETE CASCADE,
    FOREIGN KEY (target_concept_id) REFERENCES concept(id) ON DELETE CASCADE,
    UNIQUE KEY uk_relation (source_concept_id, target_concept_id)
);

-- 코드-개념 매핑 (색인 결과)
CREATE TABLE concept_index (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    concept_id BIGINT NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    line_start INT NOT NULL,
    line_end INT NOT NULL,
    code_snippet TEXT,
    git_url VARCHAR(1000),
    description TEXT,
    git_commit_hash VARCHAR(40),
    indexed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (concept_id) REFERENCES concept(id) ON DELETE CASCADE,
    INDEX idx_concept_index_concept (concept_id),
    INDEX idx_concept_index_file (file_path)
);
```

## OpenSearch 인덱스

```json
{
  "settings": {
    "analysis": {
      "tokenizer": {
        "nori_mixed": {
          "type": "nori_tokenizer",
          "decompound_mode": "mixed"
        }
      },
      "filter": {
        "concept_synonym": {
          "type": "synonym_graph",
          "synonyms": []
        }
      },
      "analyzer": {
        "concept_analyzer": {
          "type": "custom",
          "tokenizer": "nori_mixed",
          "filter": ["lowercase", "nori_part_of_speech", "concept_synonym"]
        }
      }
    }
  },
  "mappings": {
    "properties": {
      "concept_id": { "type": "keyword" },
      "concept_name": { "type": "text", "analyzer": "concept_analyzer" },
      "synonyms": { "type": "text", "analyzer": "concept_analyzer" },
      "category": { "type": "keyword" },
      "level": { "type": "keyword" },
      "file_path": { "type": "keyword" },
      "line_start": { "type": "integer" },
      "line_end": { "type": "integer" },
      "code_snippet": { "type": "text" },
      "git_url": { "type": "keyword" },
      "description": { "type": "text", "analyzer": "concept_analyzer" },
      "indexed_at": { "type": "date" }
    }
  }
}
```

## 인프라 배치

| 항목 | 값 |
|------|---|
| 서비스 포트 | 8089 |
| Docker IP | 172.20.0.80 |
| MySQL Master | 3338 |
| MySQL Replica | 3339 |
| OpenSearch | 9210 (기존 ES 9200과 분리) |
| DB명 | code_dictionary_db |

## REST API

```
# 검색
GET  /api/v1/search?q={query}&category={cat}&level={level}&page={p}&size={s}

# 사전 CRUD
GET    /api/v1/concepts                    # 목록 (페이징, 필터)
GET    /api/v1/concepts/{conceptId}        # 상세
POST   /api/v1/concepts                    # 생성
PUT    /api/v1/concepts/{conceptId}        # 수정
DELETE /api/v1/concepts/{conceptId}        # 삭제

# 색인 관리
POST   /api/v1/index/sync                  # RDB → OpenSearch 전체 동기화
GET    /api/v1/index/status                # 색인 상태 조회
```

## MVP 범위 (Phase 1)

1. 백엔드: domain + app 모듈, RDB 스키마 (Flyway), REST API
2. OpenSearch: Nori + synonym + BM25 검색
3. IT개념 사전: Flyway 시딩으로 초기 데이터 적재 (초보~고급 전 레벨)
4. 웹 UI: React 검색 인터페이스 (검색 바 + 결과 리스트 + git 링크)
5. Docker: OpenSearch + MySQL 컨테이너 추가
6. RDB → OpenSearch 동기화 API

## Phase 2 (이후)

- Ollama 임베딩 + kNN 하이브리드 검색 (search_pipeline)
- 자동 태깅 hook (post-push-reindex)
- `/reindex` Claude Code 스킬
- 로컬 모델 튜닝/고도화
- 사전 웹 관리 UI (CRUD 화면)
