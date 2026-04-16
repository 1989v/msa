# Harness Benchmark: docs-tree-tools (myrealtrip/claude-code-plugins)

**Date**: 2026-04-15
**Source (local)**: `/Users/gideok-kwon/IdeaProjects/claude-code-plugins/docs-tree-tools`
**Upstream**: https://github.com/myrealtrip/claude-code-plugins
**Version reviewed**: v0.56.0 (2026-04-15) — "Docs-Map: Source-to-Doc Coverage Tracking"
**Category**: Source ↔ Doc coverage tracking + autonomous doc gardening (CI 기반)

> 사용자 제공 핵심 요약: "AI가 코드 변경사항을 자동 감지하고 관련 문서를 자동 업데이트"
> - push 시 drift 감지 → 낡은 문서 자동 수정 PR
> - 삭제된 코드 → 문서 자동 아카이빙
> - 신규 코드 → stub 문서 초안 자동 생성
> - Mon/Wed cron 으로 전체 점검 (quality-gc, doctor)

---

## 1. 외부 소스 개요

### 1.1 구성

| 레이어 | 산출물 | 역할 |
|---|---|---|
| Policy | `docs/docs-map.yml` | 사람이 유지 — ignore/manual/pattern_rules |
| Lock | `docs/docs-map.lock.yml` | 스크립트가 생성 — mappings/unmapped_sources/orphan_docs |
| Scanner | `scripts/docs_map_generator.py` | 소스 트리 vs 문서 트리 비교, `> Source:` citation 파서 |
| Impact Scanner | `scripts/doc_impact_scan.py` | diff 기반 비용-저렴 impact 스캐너 (LLM 비사용 fast path) |
| Doctor | `scripts/doctor_docs_tree.py` | 8-layer health check (Layer 8 = git drift) |
| Caller template | `templates/caller-docs-gardening.yml` | 각 리포가 얇게 호출 |
| Reusable Workflow | `.github/workflows/docs-gardening.yml` | 실제 3-job 엔진 |
| Skills | 15 skills (glossary/usecase/spec/standard/product/architecture/...) | 문서 생성 서피스 |
| Commands | 22 commands (`/docs-loop`, `/doc-impact-scan`, `/doctor-docs-tree`, `/write-*` 등) | 대화형 진입점 |

### 1.2 자동화 동선 (핵심 메커니즘)

**A. Push-trigger: `stale-doc-update` job**
1. `pull_request` / `push(main)` 시 caller 워크플로가 reusable 워크플로를 호출
2. 변경된 소스 파일 추출 (language별 자동 pattern 감지)
3. `doc_impact_scan.py` 로 diff → 영향받는 문서 후보 도출 (JSON/MD 리포트)
4. `docs_map_generator.py` 로 lock 갱신 + `DOCS_MAP_DIFF.json` 생성
5. `anthropics/claude-code-base-action@v0.0.63` 으로 Claude 호출
   - impacted 문서만 update
   - `new_unmapped` 중요 소스 → stub 문서 생성 (`status: draft`)
   - `new_orphans` → `docs/legacies/deprecated/` 로 이동
   - lock 파일 포함하여 **PR 생성** (`gc/stale-docs-YYYY-MM-DD`)

**B. Scheduled: `doc-quality-gc` (Mon 01:00 UTC)**
- orphan_run_count ≥ 2 인 문서만 아카이브 (2-run safety)
- 링크/포맷/중복 GC, coverage 메트릭을 PR body 에 삽입

**C. Scheduled: `doctor-gardening` (Wed 01:00 UTC)**
- `doctor_docs_tree.py --strict` 실행 → PASS/WARN/FAIL
- WARN/FAIL 시에만 Claude 호출, 자동-fix PR 생성
- index registration drift, spec↔tasks drift, stale doc 검출 (Layer 8)

**D. Docs-Map Contract (v0.56.0 신규)**
- `sync_status`: full / partial / stub / orphan
- `mapping_mode`: explicit(`> Source:` citation) / pattern(glob rule) / manual
- `--bootstrap` 플래그로 파괴적 액션 없이 초기 lock 생성 (`DOCS_MAP_BOOTSTRAP_REPORT.md`)
- `base_commit` 만 변경 시 업데이트 (timestamp 배제로 diff noise 억제)

### 1.3 철학

- **결정적 스크립트 + LLM 편집기 분리**: scan/generate 는 Python, 해석/편집은 Claude
- **Report-first**: `/doc-impact-scan` 은 **mutate 금지**, 편집은 별도 단계
- **2-run safety**: orphan 탐지 1회는 경고, 2회 연속 시 archive
- **Draft PR → regular PR** (v0.56.0 에서 전환됨): reviewer 부담 감소
- **Source of Truth = AGENTS.md → CLAUDE.md → docs/index.yml** (단방향 체인)

---

## 2. 현재 harness 요약 (doc 관련 발췌)

| 영역 | 위치 | 트리거 | 비고 |
|---|---|---|---|
| 문서 생성 | `ai/plugins/hns/commands/doc-gen.md` + `agents/doc-gen-agent.md` | 수동 (`/hns:doc-gen`) | 템플릿 기반 CLAUDE.md + docs/ 초기화 |
| GC (drift/dead) | `ai/plugins/hns/commands/gc.md` + `agents/gc-agent.md` | 수동 (`/hns:gc`) | dead code / doc drift / rule violation / stale harness |
| Doc Gardening 표준 | `agent-os/standards/agent-behavior/doc-gardening.md` | 구현 성공 후 수동 | `git diff` → standards 매칭 → 보고 |
| 재인덱싱 | `.claude/skills/reindex/SKILL.md` | 수동 | code-dictionary 재인덱싱 |
| Portfolio 갱신 | `.claude/skills/portfolio-gen/SKILL.md` | 수동 | 기술 포트폴리오 재생성 |
| PostToolUse 훅 | `.claude/hooks/hnsf-automation.json` | spec.md / tasks.md Write 시 | 체크리스트 주입 (드리프트 탐지 아님) |
| ADR 가드 | `.claude/hooks/adr-check.sh` | architecture-sensitive 파일 편집 | ADR 존재 확인만 |
| CI | `.github/workflows/ci.yml` | PR/push | Gradle build + test (문서 검증 없음) |
| 서비스별 컨텍스트 | `{service}/CLAUDE.md` | 자동 로드 | docs-tree-tools 는 없는 계층형 컨텍스트 |
| ADR 디렉토리 | `docs/adr/` | 수동 | 강제된 ADR 프로세스 |

**핵심 공백**: push 시점에 문서 드리프트를 자동 탐지/수정하는 기전이 없다. `/hns:gc`, `/hns:doc-gen` 모두 사람이 호출해야 동작한다. doc↔source mapping 자체가 암묵적이며, lock 파일 같은 machine-checkable 상태가 없다.

---

## 3. 비교 매트릭스

| # | 메커니즘 | docs-tree-tools | MSA harness | 우리 상응물 | Delta |
|---|---|---|---|---|---|
| 1 | Source↔Doc mapping 상태파일 | ✅ `docs/docs-map.lock.yml` (deterministic, diffable) | ❌ | 없음 | **GAP (핵심)** |
| 2 | Mapping policy (ignore/manual/pattern) | ✅ `docs/docs-map.yml` | ❌ | 암묵적 | **GAP** |
| 3 | `> Source:` citation 기반 explicit mapping | ✅ 파서 | ⚠️ 관습적으로 일부 docs 에 존재 | 강제 규칙 없음 | **GAP** |
| 4 | Diff-driven impact scan | ✅ `doc_impact_scan.py` (non-LLM, JSON+MD) | ⚠️ `doc-gardening.md` 표준에 명시 but 스크립트 미구현 | 수동 `git diff` | **GAP** |
| 5 | Push-trigger 자동 drift 수정 | ✅ `stale-doc-update` job + Claude PR | ❌ | `/hns:gc` 수동 호출 | **GAP (핵심)** |
| 6 | 신규 소스 → stub 문서 생성 | ✅ `new_unmapped` 처리 | ❌ | 없음 | **GAP** |
| 7 | 삭제된 소스 → 문서 아카이브 | ✅ `docs/legacies/deprecated/` | ❌ | 없음 | **GAP** |
| 8 | Orphan 2-run safety | ✅ `orphan_run_count ≥ 2` | ❌ | 없음 | **GAP** |
| 9 | 주간 cron (quality-gc / doctor) | ✅ Mon/Wed 01:00 UTC | ❌ | 없음 | **GAP** |
| 10 | Doctor health check (8-layer) | ✅ `doctor_docs_tree.py --strict` | ⚠️ `/hns:validate` 있으나 doc-tree 전용 아님 | 부분 대응 | **부분 GAP** |
| 11 | Reusable workflow (멀티-리포) | ✅ caller-template 패턴 | ❌ (단일 리포) | 불필요 | N/A |
| 12 | Bootstrap 모드 (비파괴 초기화) | ✅ `--bootstrap` | ❌ | `/hns:doc-gen` 은 파일 단위 fill-gaps | **부분 GAP** |
| 13 | 서비스별 CLAUDE.md 계층 | ❌ (flat) | ✅ 9개 서비스 | **우리 강점** | — |
| 14 | ADR governance | ❌ | ✅ `adr-check.sh` + `docs/adr/` | **우리 강점** | — |
| 15 | Compaction/context 관리 | ❌ | ✅ `COMPACTION-GUIDE.md` + PrePrompt 훅 | **우리 강점** | — |
| 16 | 리스크 분류(L1/L2/L3) | ❌ | ✅ agent-behavior/confirmation.md | **우리 강점** | — |
| 17 | hns 파이프라인 (shape→tasks→implement) | ❌ | ✅ `/hns:start` | **우리 강점** | — |
| 18 | code-dictionary reindex | ❌ | ✅ `.claude/skills/reindex/` | **우리 강점** | — |
| 19 | Portfolio-gen | ❌ | ✅ `.claude/skills/portfolio-gen/` | **우리 강점** | — |
| 20 | Kafka/DB 도메인 스키마 | ❌ (general-purpose) | ✅ docs/architecture 전반 | **우리 강점** | — |

요약: **docs-tree-tools 가 가진 것은 "자동 drift 탐지 + 자동 PR" 기전이고, 우리가 가진 것은 "도메인 맞춤 governance + 서비스 계층 컨텍스트".**

---

## 4. 채택 권장 항목

### 4.1 [H1] docs-map Lock + Policy 도입 (HIGH)

**제안**:
- `docs/docs-map.yml` 정책 파일 생성 (서비스별 `ignore_patterns`, `manual_docs`, `pattern_rules`)
- `docs/docs-map.lock.yml` 자동 생성 — docs-tree-tools 의 `docs_map_generator.py` 를 그대로 또는 minimal fork 로 사용
- `docs/index.yml` 을 선택적으로 도입하거나 우리 식 registry (`docs/index.md`) 로 대체

**영향 범위**:
- MSA 는 9개 서비스 × 각 `docs/` → **서비스별 docs-map.yml 9개 + 루트 1개** 또는 루트 통합 1개
- pattern_rules 예: `src/main/kotlin/**/port/*.kt` → `docs/adr/ADR-0020-*.md`
- 기존 ADR/specs 에 `> Source: path/to/file.kt` citation 점진 추가 (manual docs 로 시작해도 됨)

**구현 스케치**:
1. `scripts/docs_map_generator.py` 를 `ai/plugins/hns/scripts/` 로 vendor
2. 루트와 각 서비스에 `docs/docs-map.yml` skeleton 커밋
3. `--bootstrap` 으로 초기 lock 생성, `DOCS_MAP_BOOTSTRAP_REPORT.md` 리뷰
4. lock 파일을 git 에 커밋 (diff 시 drift 가시화)
5. 검증: `./gradlew build && python3 docs_map_generator.py .` 이 zero-diff 면 healthy

### 4.2 [H2] Push-trigger Drift Detection (HIGH, 단 LLM 비용 주의)

**제안**:
- `.github/workflows/docs-gardening.yml` 을 **MSA 전용** 으로 이식 (reusable 패턴 대신 단일 파일)
- 3개 job: `doc-hygiene` (PR), `stale-doc-update` (push main), `doctor-gardening` (Wed cron)
- `stale-doc-update` 는 우리 도메인에 맞게 축소:
  - Kotlin/Gradle 중심 pattern 고정 (`*.kt *.java build.gradle.kts`)
  - 변경된 서비스의 `{service}/docs/` 만 스캔 (전체 트리 X)
  - ADR-sensitive 파일 (ADR-0019/0020/0021/0022) 은 자동편집 금지, Claude 는 리뷰 코멘트만

**영향 범위**:
- `ANTHROPIC_API_KEY` GitHub secret 필요
- Claude 가 직접 main branch 를 수정하지 않고 PR 만 생성 (기존 정책과 호환)
- cost 예상: push 당 한 번 Claude 호출, sonnet 기준 월 수십 달러 수준

**주의사항**:
- `claude[bot]` 의 PR 을 다시 trigger 하지 않도록 loop guard 필요 (docs-tree-tools 에 이미 있음: `github.actor != 'claude[bot]'`)
- ADR 기반 governance 와 충돌 가능 — ADR-sensitive 경로는 block list 로 제외

### 4.3 [H3] doc-impact-scan 스크립트 이식 (HIGH, 저비용)

**제안**:
- `doc_impact_scan.py` 는 **비-LLM fast path**. Python 만 있으면 됨
- `agent-os/standards/agent-behavior/doc-gardening.md` 의 수동 절차를 이 스크립트로 대체
- `/hns:gc` 실행 시 내부적으로 먼저 `doc_impact_scan` 을 호출하도록 파이프라인화

**영향 범위**:
- `ai/plugins/hns/scripts/doc_impact_scan.py` 추가
- `gc-agent.md` 수정: scan → impact-scan JSON 을 입력으로 doc-drift 검증
- 완전 로컬 도구라 cost 0

### 4.4 [M1] Orphan 2-run Safety (MEDIUM)

**제안**:
- 현재 `/hns:gc` 는 즉시 삭제 제안. 2-run safety 규칙을 채택하여 false-positive 방지
- `harness-gc-report.md` 에 `orphan_run_count` 필드 추가, 2회 연속 시 archive 승인

**영향 범위**: `gc-agent.md` 로직에 state 저장 (lock 파일로 충분)

### 4.5 [M2] `docs/legacies/deprecated/` 규약 도입 (MEDIUM)

**제안**:
- 아카이브 디렉토리 지정 (`docs/legacies/deprecated/`) + frontmatter 규약 (`status: deprecated`, `deprecated_reason`)
- 삭제 대신 이동으로 히스토리 보존

**영향 범위**: 새 규약 1개, 기존 문서 영향 없음 (신규 archive 부터 적용)

### 4.6 [M3] `> Source:` Citation 관습화 (MEDIUM)

**제안**:
- ADR 및 spec 문서에 `> Source: path/to/file.kt` 를 frontmatter 또는 첫 블록에 명시
- `explicit` mapping 이 늘어날수록 pattern_rules 의존도 감소 → 정확도 ↑
- 기존 ADR 에 점진 추가 (모두 한 번에 안 해도 됨)

---

## 5. 미채택 / 보류 항목

| 항목 | 이유 |
|---|---|
| 15개 write-* 스킬 (write-usecase, write-spec, write-standard, ...) | 이미 hns 파이프라인이 동일 역할 수행. 중복 |
| Reusable workflow + caller template 패턴 | MSA 는 단일 모노레포. 멀티-리포 오케스트레이션 불필요 |
| `docs/index.yml` YAML 레지스트리 | 우리는 `docs/index.md` + 서비스 CLAUDE.md 계층으로 동일 기능 제공. 중복 도입 시 두 개의 SOT 위험 |
| glossary-engine / tacit-knowledge-engine | code-dictionary 서비스가 이미 동일 역할. 통합 불필요 |
| `AGENTS.md` 루트 도입 | 우리는 `CLAUDE.md` 단일 진입점 + `agent-os/standards/` 로 충분. AGENTS.md 추가는 SOT 분산 |
| 8-layer doctor 전부 이식 | Layer 8 (git drift) 만 유용. 나머지는 우리 환경에 과함 |
| quality-gc (Mon cron) | stale-doc-update + doctor-gardening 으로 대부분 커버. MSA 는 월 1회 수동 `/hns:gc` 로 충분 |

---

## 6. 의사결정 질문

1. **Push-trigger 자동 PR을 도입할 의향이 있는가?**
   - 예 → GitHub Actions + `ANTHROPIC_API_KEY` secret + `anthropics/claude-code-base-action` 도입
   - 아니오 → docs-map lock 까지만 도입하고 drift 수정은 `/hns:gc` 유지

2. **`ANTHROPIC_API_KEY` 를 GitHub Actions 시크릿으로 등록 가능한가?**
   - 팀/조직 정책 상 OK 인지 확인 필요 (결과 Claude 호출 비용 발생)

3. **자동 PR 의 base branch 는 `main` 인가, 별도 `docs` 브랜치인가?**
   - docs-tree-tools 기본값은 `main`. ADR 거버넌스 와 충돌 시 `docs-gc` 브랜치를 둘 수도 있음

4. **서비스별 `docs-map.yml` 9개 + 루트 1개 vs 루트 통합 1개?**
   - 서비스 분리 유지 시: 서비스별 GC 가능, 파일 9개 관리 부담
   - 루트 통합 시: 단순, 다만 서비스 경계가 pattern_rules 에서 흐려짐
   - 권장: **루트 1개 + 서비스별 `pattern_rules` 섹션 분리**

5. **주간 cron 스케줄러는 GitHub Actions schedule 로 충분한가, k3d-lite 의 Kubernetes CronJob 으로 넣을 것인가?**
   - CI 성격 → GitHub Actions 가 자연스러움
   - Doctor 가 k8s 리소스 검증까지 하려면 CronJob 고려

6. **기존 ADR / docs 에 `> Source:` citation 을 일괄 추가할지, 신규 문서부터만 적용할지?**
   - 권장: 신규부터, 기존은 pattern_rules 로 커버

7. **`doc_impact_scan.py` 를 그대로 vendor 할지, 자체 포팅할지?**
   - 그대로 vendor → upstream 업데이트 추적 가능 but 라이선스/의존 관리 필요
   - 포팅 → MSA 도메인 맞춤 but 유지 비용

---

## 7. 다음 액션 (사용자 승인 시 `/hns:evolve` 반영 대상)

**Phase 1 — 안전한 기반 (승인만 되면 즉시 가능, 비용 0)**
1. `ai/plugins/hns/scripts/doc_impact_scan.py` + `docs_map_generator.py` vendor
2. 루트 `docs/docs-map.yml` policy skeleton 생성 (ignore 만 설정)
3. `--bootstrap` 실행 → `docs/docs-map.lock.yml` 초기 커밋
4. `agent-os/standards/agent-behavior/doc-gardening.md` 업데이트 — 매뉴얼 → 스크립트 호출 절차

**Phase 2 — GC 강화 (로컬 실행 기반)**
5. `/hns:gc` 가 내부적으로 `doc_impact_scan` → `docs_map_generator` 순으로 호출
6. `gc-agent.md` 에 orphan 2-run safety 로직 추가
7. `docs/legacies/deprecated/` 규약 및 frontmatter 정의

**Phase 3 — 자동화 (조직 승인 필요)**
8. `.github/workflows/docs-gardening.yml` 도입 — MSA 축소판
9. `ANTHROPIC_API_KEY` secret 등록
10. 첫 1주는 `workflow_dispatch` 수동 실행으로 dry-run, 검증 후 `push` 트리거 활성화

**Phase 4 — 진화**
11. `> Source:` citation 점진 도입 (새 ADR 부터)
12. ADR-sensitive 경로 block list 튜닝
13. cost/효과 리뷰 후 quality-gc(Mon) 추가 여부 판단

---

## 8. 참고 파일 경로

### 외부 소스
- `/Users/gideok-kwon/IdeaProjects/claude-code-plugins/docs-tree-tools/CHANGELOG.md` (v0.56.0)
- `/Users/gideok-kwon/IdeaProjects/claude-code-plugins/docs-tree-tools/references/docs-map-contract.md`
- `/Users/gideok-kwon/IdeaProjects/claude-code-plugins/docs-tree-tools/scripts/docs_map_generator.py`
- `/Users/gideok-kwon/IdeaProjects/claude-code-plugins/docs-tree-tools/scripts/doc_impact_scan.py`
- `/Users/gideok-kwon/IdeaProjects/claude-code-plugins/docs-tree-tools/scripts/doctor_docs_tree.py`
- `/Users/gideok-kwon/IdeaProjects/claude-code-plugins/docs-tree-tools/templates/caller-docs-gardening.yml`
- `/Users/gideok-kwon/IdeaProjects/claude-code-plugins/.github/workflows/docs-gardening.yml`
- `/Users/gideok-kwon/IdeaProjects/claude-code-plugins/docs-tree-tools/commands/doc-impact-scan.md`

### 현재 harness (MSA)
- `/Users/gideok-kwon/IdeaProjects/msa/ai/plugins/hns/commands/doc-gen.md`
- `/Users/gideok-kwon/IdeaProjects/msa/ai/plugins/hns/commands/gc.md`
- `/Users/gideok-kwon/IdeaProjects/msa/ai/plugins/hns/agents/gc-agent.md`
- `/Users/gideok-kwon/IdeaProjects/msa/ai/plugins/hns/agents/doc-gen-agent.md`
- `/Users/gideok-kwon/IdeaProjects/msa/agent-os/standards/agent-behavior/doc-gardening.md`
- `/Users/gideok-kwon/IdeaProjects/msa/.claude/hooks/hnsf-automation.json`
- `/Users/gideok-kwon/IdeaProjects/msa/.claude/hooks/adr-check.sh`
- `/Users/gideok-kwon/IdeaProjects/msa/.github/workflows/ci.yml`
