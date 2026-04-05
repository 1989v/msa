# Code Dictionary — IT개념 코드 위치 추적 서비스

코드베이스를 IT 개념(싱글톤 패턴, 사가 패턴, 분산락 등) 단위로 색인화하고, 웹에서 키워드 검색으로 해당 개념이 적용된 코드 위치(파일 + 라인 + git permalink)를 유사도 순으로 반환하는 서비스.

## 아키텍처

```
[React 웹 UI :5174]  →  [Spring Boot REST API :8089]
                              ↓               ↓
                         [MySQL DB]     [OpenSearch]
                        (source of       (검색 엔진)
                          truth)         Nori + Synonym
```

- **Clean Architecture**: domain(순수 Kotlin) + app(Spring Boot) 2-모듈 구조
- **검색 엔진**: OpenSearch (Nori 한국어 분석 + 동의어 사전 + BM25)
- **데이터 저장**: MySQL (개념 사전 + 색인 결과) → OpenSearch 동기화

## 프로젝트 구조

```
code-dictionary/
├── domain/                  # 순수 도메인 모델 (Spring/JPA 없음)
│   └── src/main/kotlin/com/kgd/codedictionary/domain/
│       ├── concept/model/   # Concept, ConceptLevel, ConceptCategory
│       ├── concept/exception/
│       └── index/model/     # ConceptIndex, CodeLocation
├── app/                     # Spring Boot 애플리케이션
│   └── src/main/kotlin/com/kgd/codedictionary/
│       ├── application/     # 유스케이스, 포트, DTO, 서비스
│       ├── infrastructure/  # JPA, OpenSearch, DataSource 설정
│       └── presentation/    # REST 컨트롤러
└── frontend/                # React 검색 UI (Vite + TypeScript)
```

## 실행 방법

### 1. 인프라 기동

```bash
# MySQL (master: 3338, replica: 3339) + OpenSearch (9210)
docker compose -f docker/docker-compose.infra.yml up -d \
  mysql-code-dictionary-master opensearch
```

헬스체크 확인:
```bash
# MySQL
docker exec mysql-code-dictionary-master mysqladmin ping -uroot -p$MYSQL_ROOT_PASSWORD

# OpenSearch
curl http://localhost:9210/_cluster/health
```

### 2. 백엔드 실행

```bash
./gradlew :code-dictionary:app:bootRun
```

- 포트: `http://localhost:8089`
- Flyway가 자동으로 스키마 생성 + 161개 IT개념 시드 데이터 적재
- Swagger UI: `http://localhost:8089/swagger-ui.html`

### 3. OpenSearch 동기화

앱 기동 후 RDB 데이터를 OpenSearch에 색인:

```bash
curl -X POST http://localhost:8089/api/v1/index/sync
```

### 4. 프론트엔드 실행

```bash
cd code-dictionary/frontend
npm install
npm run dev
```

- 개발 서버: `http://localhost:5174`
- API 프록시: `/api` → `localhost:8089`

### 5. Docker 전체 기동

```bash
docker compose -f docker/docker-compose.infra.yml up -d
docker compose -f docker/docker-compose.yml up -d code-dictionary
```

## REST API

### 검색

```bash
# 키워드 검색
GET /api/v1/search?q=싱글톤

# 카테고리 필터
GET /api/v1/search?q=lock&category=CONCURRENCY

# 레벨 필터
GET /api/v1/search?q=패턴&level=BEGINNER

# 페이징
GET /api/v1/search?q=saga&page=0&size=10
```

응답:
```json
{
  "success": true,
  "data": {
    "hits": [
      {
        "conceptId": "singleton-pattern",
        "conceptName": "싱글톤 패턴",
        "category": "DESIGN_PATTERN",
        "level": "BEGINNER",
        "filePath": "product/app/src/.../AppConfig.kt",
        "lineStart": 10,
        "lineEnd": 25,
        "gitUrl": "https://github.com/.../AppConfig.kt#L10-L25",
        "description": "애플리케이션 설정 싱글톤 객체",
        "score": 5.23
      }
    ],
    "totalHits": 1,
    "maxScore": 5.23
  }
}
```

### 개념 사전 CRUD

```bash
# 목록 조회 (페이징, 카테고리/레벨 필터)
GET /api/v1/concepts?category=DESIGN_PATTERN&page=0&size=20

# 단건 조회
GET /api/v1/concepts/{id}

# 생성
POST /api/v1/concepts
{
  "conceptId": "circuit-breaker",
  "name": "서킷 브레이커",
  "category": "DISTRIBUTED_SYSTEM",
  "level": "INTERMEDIATE",
  "description": "장애 전파 방지 패턴",
  "synonyms": ["circuit breaker", "resilience4j"]
}

# 수정
PUT /api/v1/concepts/{id}
{
  "description": "수정된 설명",
  "synonyms": ["circuit breaker", "resilience4j", "장애 격리"]
}

# 삭제
DELETE /api/v1/concepts/{id}
```

### 색인 관리

```bash
# RDB → OpenSearch 전체 동기화
POST /api/v1/index/sync

# 색인 상태 조회
GET /api/v1/index/status
```

## 개념 카테고리

| 카테고리 | 설명 | 예시 |
|---------|------|------|
| `BASICS` | 프로그래밍 기초 | 변수, 클래스, 제네릭, 리플렉션 |
| `DATA_STRUCTURE` | 자료구조 | 해시맵, 트리, 블룸 필터 |
| `ALGORITHM` | 알고리즘 | BFS, DP, 일관 해싱 |
| `DESIGN_PATTERN` | 디자인 패턴 | 싱글톤, 팩토리, 전략, 옵저버 |
| `CONCURRENCY` | 동시성 | 분산락, 세마포어, 코루틴 |
| `DISTRIBUTED_SYSTEM` | 분산시스템 | 사가, CQRS, 서킷 브레이커 |
| `ARCHITECTURE` | 아키텍처 | 클린 아키텍처, DDD, MSA |
| `INFRASTRUCTURE` | 인프라/DevOps | Docker, K8s, CI/CD |
| `DATA` | 데이터 | 역인덱싱, 샤딩, 캐싱 |
| `SECURITY` | 보안 | XSS, JWT, OAuth |
| `NETWORK` | 네트워크 | HTTP, gRPC, WebSocket |
| `TESTING` | 테스팅 | TDD, BDD, Mock |
| `LANGUAGE_FEATURE` | 언어 특성 | 확장 함수, sealed class, DSL |

## 코드 색인 (태깅) 방법

### Phase 2 — 자동 태깅 (미구현, 예정)

git push hook 또는 CI에서 LLM이 변경 파일을 분석하여 자동 태깅.

### 수동 색인 등록

현재는 API를 통해 수동으로 코드-개념 매핑을 등록:

```bash
# 예: product 서비스의 싱글톤 패턴 코드를 색인
curl -X POST http://localhost:8089/api/v1/index \
  -H "Content-Type: application/json" \
  -d '{
    "conceptId": "singleton-pattern",
    "filePath": "product/app/src/main/kotlin/com/kgd/product/config/AppConfig.kt",
    "lineStart": 10,
    "lineEnd": 25,
    "codeSnippet": "object AppConfig { ... }",
    "gitUrl": "https://github.com/user/msa/blob/main/product/app/src/.../AppConfig.kt#L10-L25",
    "description": "애플리케이션 설정 싱글톤 객체",
    "gitCommitHash": "abc123"
  }'
```

### `/reindex` 스킬 (Phase 2 예정)

```bash
/reindex              # 변경 파일 대상 증분 재색인
/reindex --all        # 전체 코드베이스 재색인
/reindex --file path  # 특정 파일 재색인
```

LLM이 코드를 분석하여 IT 개념을 자동 추출 → 개발자 확인 → RDB 저장 → OpenSearch 색인.

## 기술 스택

| 항목 | 기술 |
|------|------|
| 언어 | Kotlin |
| 프레임워크 | Spring Boot 4.0.x |
| 검색 엔진 | OpenSearch 2.19 (Nori + synonym + BM25) |
| DB | MySQL 8.0 (Master/Replica) |
| ORM | Spring Data JPA + QueryDSL |
| 마이그레이션 | Flyway |
| 프론트엔드 | React + TypeScript + Vite |
| 서비스 디스커버리 | Eureka |
| API 문서 | springdoc-openapi (Swagger UI) |

## 인프라 포트 매핑

| 서비스 | 포트 |
|--------|-----|
| Spring Boot API | 8089 |
| React Dev Server | 5174 |
| MySQL Master | 3338 |
| MySQL Replica | 3339 |
| OpenSearch | 9210 |

## 빌드

```bash
# 전체 빌드
./gradlew :code-dictionary:app:build

# 도메인 테스트만
./gradlew :code-dictionary:domain:test

# bootJar 생성
./gradlew :code-dictionary:app:bootJar

# 프론트엔드 빌드
cd code-dictionary/frontend && npm run build
```

## Phase 2 로드맵

- [ ] Ollama 로컬 임베딩 + kNN 하이브리드 검색 (`search_pipeline`)
- [ ] 자동 태깅 hook (`post-push-reindex`)
- [ ] `/reindex` Claude Code 스킬
- [ ] 사전 웹 관리 UI (CRUD 화면)
- [ ] 로컬 모델 튜닝/고도화
