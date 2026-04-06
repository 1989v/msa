# Benchmark: PEPE Docs-Tree+ (2026-04-06)

**Source:** MRT PEPE팀 — docs-tree-tools 플러그인 업데이트
**Comparison against:** hns harness (v0.3.1)

---

## 비교 요약

| 외부 패턴 | HNS 대응 커맨드 | 커버리지 | 핵심 갭 |
|-----------|-----------------|---------|---------|
| **docs-loop** (one-shot 문서 파이프라인) | init, doc-gen, validate | 60% | 상태 기반 라우팅, 품질 게이트 |
| **doctor-docs-tree** (문서 검색 품질) | doc-html | 20% | BM25 검색, 스키마 자동 보완 |
| **session-wrapup** (자동 회고) | harness-evolve (부분) | 10% | 세션 회고, 리스크 분류 |

---

## 패턴 1: docs-loop (One-Shot 문서 파이프라인)

### 외부 접근
- scaffold → 문서 생성 → 품질 검증을 **한 번 실행**으로 완료
- 상태 기반 라우팅: 이미 있으면 스킵, 빈 곳만 채우기, 전체 재생성
- `--fill-gaps-only` 플래그
- 멀티스택 감지 (JVM/FE/Android/Go/Python/Rust)
- 품질 게이트: boilerplate, 중복, bullet-only 문서 자동 차단

### HNS 현재 상태
- `init` → `doc-gen` → `validate`로 3단계 수동 실행
- 상태 기반 라우팅 없음 (항상 전체 생성)
- 멀티스택 감지는 init에서 지원
- 품질 게이트 없음

### 채택 권장 항목
1. **doc-gen에 상태 기반 라우팅 추가** — `--full | --fill-gaps-only | --skip-existing` 플래그
2. **품질 게이트 추가** — boilerplate/중복/bullet-only 감지 후 차단
3. **doc-gen + validate 파이프라인 연결** — doc-gen 완료 후 자동 validate 실행 옵션

### 미채택 사유
- **별도 `docs-loop` 커맨드 생성 불필요** — `doc-gen`에 플래그 추가로 충분. 커맨드 수 증가를 피함

---

## 패턴 2: doctor-docs-tree (문서 검색 품질)

### 외부 접근
- BM25 스코어링 엔진 (단순 문자열 매칭 → 관련성 기반)
- title/keywords 가중치 3배
- MMR (Maximal Marginal Relevance) 중복 제거
- docs/index.yml 스키마 자동 보완

### HNS 현재 상태
- `doc-html`이 HTML 사이트 생성하지만 검색 없음
- `docs/index.yml` 존재하지만 자동 보완 없음

### 채택 권장 항목
1. **docs/index.yml 자동 보완** — validate 실행 시 누락된 문서를 index.yml에 자동 추가

### 미채택 사유
- **BM25/MMR 검색 엔진** — 현재 프로젝트 규모에서 문서 수가 ~20개 수준. 검색 엔진 도입은 과잉. 문서가 50개 이상으로 증가하면 재검토
- **검색 UI** — doc-html의 네비게이션 트리로 충분

---

## 패턴 3: session-wrapup (자동 회고)

### 외부 접근
- 세션 데이터를 읽어 자동 회고 문서 생성
- What went well / Where blocked / What to change
- Evidence 기반
- 리스크 분류: LOW / MEDIUM / HIGH

### HNS 현재 상태
- `harness-evolve`가 실패 패턴 캡처 (한 방향만)
- `implement-tasks`가 progress.md 추적
- 세션 전체 회고는 없음

### 채택 권장 항목
1. **`/hns:wrapup` 커맨드 신규 생성** — 세션 종료 시 자동 회고
   - 입력: context/progress.md, 태스크 완료/실패 이력, 검증 리포트
   - 출력: docs/retrospectives/{date}-session.md
   - 섹션: What Went Well / Where Blocked / What to Change
   - 리스크 분류: LOW(바로 실행) / MEDIUM(계획 필요) / HIGH(사람 판단 필요)

### 미채택 사유
- 없음 (전부 채택 권장)

---

## 채택 결정 요약

| # | 항목 | 우선순위 | 결정 |
|---|------|----------|------|
| 1 | doc-gen 상태 기반 라우팅 (`--fill-gaps-only`) | HIGH | **채택** |
| 2 | doc-gen 품질 게이트 (boilerplate/중복 차단) | MEDIUM | **채택** |
| 3 | docs/index.yml 자동 보완 | MEDIUM | **채택** (validate에 통합) |
| 4 | `/hns:wrapup` 세션 회고 | HIGH | **채택** (신규 커맨드) |
| 5 | BM25/MMR 검색 엔진 | LOW | **미채택** (문서 규모 부족) |
| 6 | 검색 UI | LOW | **미채택** (nav tree 충분) |

---

## Next Steps

채택 항목 구현 순서:
1. `/hns:wrapup` 커맨드 생성 (신규, 독립적)
2. `doc-gen`에 `--fill-gaps-only` 플래그 추가
3. `validate --docs`에 index.yml 자동 보완 로직 추가
4. `doc-gen`에 품질 게이트 추가

→ 사용자 승인 후 `harness-evolve`로 반영
