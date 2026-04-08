# Benchmark: OpenAI Harness Engineering (2026-04-08)

**Source:** 캐슬 AI YouTube — "OpenAI는 하네스 엔지니어링을 어떻게 할까?"
**원본:** [OpenAI: Harness Engineering](https://openai.com/index/harness-engineering/)
**Comparison against:** MSA Commerce Platform harness (agent-os + CLAUDE.md + hooks)

---

## 비교 요약

| OpenAI 원칙 | 현재 하네스 대응 | 커버리지 | 갭 |
|-------------|-----------------|---------|-----|
| 1. Observation Capabilities (관찰 능력) | ai-debugger IO 캡처 | 40% | UI 검증, 빌드 결과 자동 피드백 루프 부족 |
| 2. Strategic Context Management (계층적 컨텍스트) | CLAUDE.md + docs/ 계층 | 80% | AGENTS.md 미사용, 서비스별 컨텍스트 파일 부재 |
| 3. Repository-Embedded Knowledge (레포 내 지식) | agent-os/ + docs/ + ADR | 90% | 거의 완벽, 일부 암묵지 남아있을 수 있음 |
| 4. Comprehensible Architecture (이해 가능한 구조) | Clean Architecture + 표준 기술스택 | 85% | 양호, 모듈 간 의존성 시각화 부재 |
| 5. Continuous Garbage Collection (지속적 정리) | doc-gardening + /hns:gc | 70% | 주기적 자동 실행 없음, 에이전트 생성 코드 품질 감사 부재 |

---

## 원칙별 상세 분석

### 1. Observation Capabilities (에이전트 관찰 능력)

#### OpenAI 접근
- Chrome DevTools 연결로 에이전트가 UI 동작을 직접 검증
- 빌드/테스트 결과를 에이전트에게 자동 피드백
- 에이전트가 스스로 결과를 "볼 수 있는" 환경 구축

#### 현재 하네스
- ✅ `ai-debugger` 플러그인: IO 캡처, curl 생성, 로그 분석
- ✅ Ralph Loop: BUILD → TEST → ANALYZE → FIX 자동 반복 (max 3)
- ❌ UI/프론트엔드 검증 수단 없음 (현재 백엔드 중심)
- ❌ 빌드 결과의 자동 피드백 파이프라인 미비 (수동으로 빌드 실행 필요)

#### 권장 채택 항목
- **[A1] 빌드/테스트 자동 피드백 훅**: PostToolUse에서 코드 변경 후 자동으로 해당 모듈 빌드+테스트 실행, 결과를 에이전트 컨텍스트에 주입
- **[A2] 스크린샷 기반 UI 검증** (향후 프론트엔드 추가 시): Playwright/Puppeteer로 스크린샷 캡처 후 에이전트가 시각적 검증

---

### 2. Strategic Context Management (계층적 컨텍스트 관리)

#### OpenAI 접근
- **AGENTS.md**: 필수 규칙만 (항상 로드)
- **docs/ 하위 디렉토리**: 상세 스펙 (필요시 참조)
- 계층화로 토큰 효율성 극대화

#### 현재 하네스
- ✅ CLAUDE.md가 진입점 역할 (필수 규칙 + 네비게이션 맵)
- ✅ docs/ 계층 구조로 상세 문서 분리
- ✅ agent-os/ 에 행동 표준 분리
- ⚠️ AGENTS.md 미사용 — CLAUDE.md가 모든 역할 수행 (OpenAI는 명시적으로 분리)
- ❌ 서비스별 로컬 AGENTS.md 없음 (product/, order/ 등에 서비스 특화 컨텍스트 없음)

#### 권장 채택 항목
- **[B1] 서비스별 컨텍스트 파일**: 각 서비스 디렉토리에 `CLAUDE.md` 또는 `AGENTS.md`를 배치하여 서비스 특화 규칙/주의사항 기술 (예: product의 SSOT 규칙, order의 사가 패턴 주의점)
- **[B2-미채택]** AGENTS.md 분리: 현재 CLAUDE.md 구조가 이미 네비게이션 맵 역할을 잘 수행하고 있어 별도 AGENTS.md 분리의 실익이 크지 않음

---

### 3. Repository-Embedded Knowledge (레포 내 지식 집중)

#### OpenAI 접근
- 모든 중요한 규칙은 레포 안에 존재해야 함
- Slack, 사람 머릿속에만 있는 지식은 에이전트가 활용 불가
- 레포 = 단일 진실 소스(Single Source of Truth)

#### 현재 하네스
- ✅ agent-os/product/mission.md — 프로젝트 미션/비전
- ✅ agent-os/product/tech-stack.md — 기술 스택 명세
- ✅ agent-os/standards/ — 행동 규칙, 코딩 표준
- ✅ docs/adr/ — 아키텍처 결정 기록 (21개)
- ✅ docs/architecture/ — 11개 아키텍처 문서
- ✅ 서비스별 docs/ — 각 서비스 디렉토리 내 문서 (ADR-0016)
- ✅ ADR 강제 훅 (adr-check.sh)

#### 평가
- 이 영역은 현재 하네스의 **가장 강한 부분**. 거의 모든 지식이 레포에 체화되어 있음.
- 유일한 위험: 시간이 지나면서 문서와 코드 사이 괴리가 생길 수 있음 → doc-gardening이 이를 커버하지만 주기적 검증이 필요

---

### 4. Comprehensible Architecture (이해 가능한 구조)

#### OpenAI 접근
- 의존성 단순화, 불투명한 추상화 회피
- 잘 알려진(well-established) 기술만 사용
- 에이전트가 코드를 "이해"할 수 있어야 함

#### 현재 하네스
- ✅ Clean Architecture: 명확한 레이어 분리, 의존성 방향 규칙
- ✅ 표준 기술스택: Kotlin + Spring Boot + 잘 알려진 인프라 (MySQL, Redis, Kafka)
- ✅ 모듈 구조 문서화 (module-structure.md)
- ⚠️ 모듈 간 의존성 그래프 시각화 없음
- ⚠️ 서비스 간 통신 흐름도 부재 (communication.md는 있으나 시각적 다이어그램 미확인)

#### 권장 채택 항목
- **[C1] 의존성 시각화**: Gradle 의존성 또는 서비스 간 통신을 Mermaid 다이어그램으로 docs/architecture/에 추가 — 에이전트가 구조를 빠르게 파악하는 데 도움

---

### 5. Continuous Garbage Collection (지속적 정리)

#### OpenAI 접근
- 에이전트가 생성한 코드의 체계적 정리
- 데드 코드 제거, 문서 업데이트
- 머지 속도 > 사전 리뷰 (작은 PR을 빠르게)

#### 현재 하네스
- ✅ `/hns:gc` 스킬: 데드 코드, 문서 드리프트, 규칙 위반 스캔
- ✅ doc-gardening: 구현 후 문서 동기화
- ✅ self-review: L3 변경에 대한 서브에이전트 리뷰
- ❌ **주기적/자동 GC 실행 없음** — 현재 수동 호출만 가능
- ❌ 에이전트 생성 코드에 대한 별도 품질 감사 프로세스 없음
- ❌ 머지 전략에 대한 가이드 없음 (작은 PR vs 큰 PR)

#### 권장 채택 항목
- **[D1] 주기적 GC 스케줄**: `/schedule` 또는 cron 훅으로 주 1회 `/hns:gc` 자동 실행 → 결과 리포트 생성
- **[D2] PR 크기 가이드라인**: agent-os/standards/에 "작은 PR을 빠르게 머지" 원칙 추가 — 에이전트가 큰 변경을 분할하도록 유도
- **[D3] 에이전트 생성 코드 태깅**: Co-Authored-By 태그를 활용한 에이전트 생성 코드 추적 및 주기적 품질 리뷰

---

## 추가 발견: 현재 하네스에만 있는 패턴

| 패턴 | 설명 | 평가 |
|------|------|------|
| Risk-Based Approval (L1/L2/L3) | 변경 위험도별 승인 수준 | ✅ OpenAI에 없는 고급 패턴 — 유지 |
| Ralph Loop (자동 수정 루프) | BUILD→TEST→FIX 3회 반복 | ✅ Observation과 결합된 자동 복구 — 유지 |
| ADR 강제 훅 | 아키텍처 변경 시 ADR 컨텍스트 자동 주입 | ✅ 레포 내 지식 강화 — 유지 |
| Compaction 전략 | 토큰 관리 + 복구 체크리스트 | ✅ 장시간 세션 안정성 — 유지 |
| Idea Bank (init/bs/impl) | 아이디어→PRD→구현 파이프라인 | ✅ 독자적 워크플로우 — 유지 |
| Code Reindexing | 코드 개념 태깅/검색 | ✅ 코드 이해도 향상 — 유지 |

→ 이 패턴들은 과잉이 아닌 **차별화 포인트**. 모두 유지 권장.

---

## 채택 권장 우선순위

| 순위 | 항목 | 난이도 | 임팩트 | 비고 |
|------|------|--------|--------|------|
| 1 | **[B1]** 서비스별 컨텍스트 파일 | 낮음 | 높음 | 서비스 특화 규칙을 에이전트가 자동 로드 |
| 2 | **[D1]** 주기적 GC 스케줄 | 낮음 | 중간 | /schedule 활용으로 간단 구현 가능 |
| 3 | **[A1]** 빌드/테스트 자동 피드백 훅 | 중간 | 높음 | PostToolUse 훅 확장 필요 |
| 4 | **[C1]** 의존성 시각화 다이어그램 | 낮음 | 중간 | Mermaid로 1회성 작업 |
| 5 | **[D2]** PR 크기 가이드라인 | 낮음 | 낮음 | 표준 문서 추가만 |
| 6 | **[D3]** 에이전트 생성 코드 추적 | 중간 | 낮음 | git log 분석 스크립트 |

---

## 미채택 사유

| 항목 | 사유 |
|------|------|
| AGENTS.md 별도 분리 | CLAUDE.md가 이미 네비게이션 맵 역할 수행, 분리 시 관리 포인트만 증가 |
| Chrome DevTools 연결 | 현재 백엔드 전용 프로젝트, 프론트엔드 추가 시 재검토 |
| "머지 속도 우선" 전면 채택 | 1인 프로젝트 특성상 PR 프로세스보다 직접 커밋이 효율적 |

---

## 결론

현재 하네스는 OpenAI의 5가지 원칙 중 **3번(레포 내 지식)과 4번(이해 가능한 구조)**에서 이미 높은 수준을 달성.
**1번(관찰 능력)**과 **5번(지속적 GC)**에서 자동화 수준을 높이면 가장 큰 개선 효과 기대.
**2번(컨텍스트 계층화)**은 서비스별 컨텍스트 파일 추가로 보완 가능.
