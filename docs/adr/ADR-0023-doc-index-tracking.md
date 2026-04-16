# ADR-0023 Doc Index Tracking (문서-소스 매핑 추적)

## Status
Proposed (2026-04-15)

## Context

- 현재 `/hns:gc`, `/hns:doc-gen`, `agent-os/standards/agent-behavior/doc-gardening.md` 는 모두 수동 트리거. 소스 변경이 관련 문서에 반영되었는지 **기계적으로 검증할 방법이 없다**.
- 문서 드리프트가 주로 발견되는 시점은 리뷰/온보딩 — 즉 이미 부패한 뒤.
- 다수의 서비스 × 각자 `{service}/docs/` + 루트 `docs/adr|architecture|conventions|specs` 구조라, 사람 눈으로 drift 를 stationary 하게 추적하기 어렵다.
- `doc-gardening.md` 의 "코드가 SOT, 문서는 결과물" 원칙은 유지하되, 그 원칙이 실제로 지켜지는지 확인할 **검증 아티팩트**가 필요하다.

## Decision

**문서-소스 링크를 lock 파일로 추적한다.**

### 구성 요소

| 레이어 | 파일 | 역할 | SOT 여부 |
|---|---|---|---|
| 정책 | `docs/doc-index.json` | 사람이 유지 — `ignore_patterns`, `manual_links`, `pattern_rules` | 정책 SOT |
| Lock | `docs/doc-index.lock.json` | 스크립트가 생성 — 실제 링크 상태, coverage, missing/dangling | **검증 아티팩트 (SOT 아님)** |
| 스캐너 | `ai/plugins/hns/scripts/doc_map.py` | 소스↔문서 매칭 → lock 생성 | — |
| Impact | `ai/plugins/hns/scripts/doc_scan.py` | `git diff` → 영향 문서 후보 리포트 | — |
| Citation (선택) | 문서 상단 `<!-- source: path/to/file.kt -->` HTML 주석 | explicit link | 렌더 영향 없음 |

### SOT 계층 (doc-gardening 원칙 유지)

```
소스 코드 (SOT)
  ↓ 반영
문서 (결과물)
  ↓ 검증
doc-index.lock.json (검증 아티팩트, 실패 시 drift 신호)
```

lock 은 **커밋하되 SOT 는 아님**. lock diff 가 발생하면 "문서 또는 정책 중 하나가 업데이트되어야 한다" 는 신호.

### Link Type

- `explicit` — 문서의 `<!-- source: ... -->` 주석이 명시
- `pattern` — `doc-index.json` 의 pattern rule 로 매칭
- `manual` — 정책의 `manual_links` 에 하드코딩 (ADR 같이 pattern 으로 표현 불가능한 문서)

### 서비스 계층

lock 의 각 항목은 `service: product|order|search|...|root` 필드를 갖는다. 서비스별 coverage 산출 가능.

### 운영 파이프라인

```
[로컬] doc_map.py       → lock 갱신
[로컬] doc_scan.py      → 영향 문서 리포트
[로컬] 사람이 문서 수정  → doc_map.py → lock 재생성 → 커밋
[CI]   doc_map.py --check → drift 있으면 PR 차단
```

검출은 자동, 파괴적 수정은 보수적 (사람 승인 후). LLM 자동 수정 PR 은 범위 밖.

### 단계적 도입

| Phase | 내용 | 비용 | 상태 |
|---|---|---|---|
| 1 | 정책 skeleton + 스크립트 + lock 초기화 + 표준 개정 | 0 | 완료 |
| 2 | `/hns:gc --docs` 서브플로우 (doc_map refresh → doc_scan → report) | 0 | 진행 |
| 2.5 | 서비스별 대표 pattern_rules / manual_links 채워 매핑 밀도 확보 | 0 | 대기 |
| 3a | CI에 `doc_map.py --check` gating (API key 불필요) | 0 | 대기 |
| 4 | `<!-- source: ... -->` citation 점진 도입 | 0 | 대기 |
| ~~3b~~ | ~~LLM 자동 수정 PR~~ | ~~API 비용~~ | **보류 (optional addon)** |

Phase 3b 보류 사유: coverage 0% 상태에서 자동 PR 은 신호 대 잡음비가 낮음. 매핑 밀도 확보 + CI gating 안정화가 선결. 필요 시 별도 워크플로로 추가.

### Phase 1 스코프 (완료)

1. 정책 skeleton (`ignore_patterns` 만 채움)
2. 스크립트 2개 (`doc_map.py`, `doc_scan.py`) — Python 3 stdlib only (외부 의존 없음, PEP 668 호환)
3. 초기 lock 생성 (`--init` 플래그, 비파괴)
4. `doc-gardening.md` 개정 — 수동 `git diff` 단계를 `doc_scan.py` 호출로 교체
5. `CLAUDE.md` Key Conventions 에 1줄 추가

### Phase 2 스코프

1. `/hns:gc` 에 `--docs` 서브플로우 추가
2. gc-agent 의 Doc Drift 탐지를 `doc_map` refresh → `doc_scan` → report 순서로 파이프라인화
3. orphan 탐지는 보고만 (자동 아카이브/삭제 금지 — `gc.md` "Delete files without explicit user confirmation" 규칙 준수)

### Phase 2.5 스코프

1. `docs/doc-index.json` 의 `pattern_rules` 에 서비스별 대표 경로 등록
2. `manual_links` 에 cross-cutting ADR 등록
3. lock 재생성 → coverage 메트릭 확인

### Phase 3a 스코프

1. `.github/workflows/ci.yml` 에 `doc_map.py --check` step 추가
2. drift 감지 시 CI 실패 (PR 차단)
3. `ANTHROPIC_API_KEY` 불필요

## Alternatives Considered

1. **아무것도 안 한다 (status quo)** — 수동 gardening 유지. 규모 확대 시 부채 누적. 기각.
2. **문서 frontmatter 에 `source:` 필드 강제** — YAML frontmatter 는 렌더러마다 처리 다르고, 모든 문서에 추가 필요 (ADR 19개 소급). 점진 적용이 어려움. 기각.
3. **Git hook 기반 pre-commit 차단** — 드리프트 발생 시 커밋 실패. 너무 strict, 작성 흐름 방해. 기각.
4. **외부 플러그인 이식** — 결합도 ↑, 업스트림 추적 부담, 라이선스 이슈. MSA 도메인(서비스 계층, ADR governance) 과 맞지 않음. 기각.
5. **자체 구현 (본 ADR)** — 최소 표면적, MSA 용어/구조 맞춤, 점진 도입 가능. **채택**.

## Consequences

### Positive
- lock diff 만으로 문서 drift 가시화. `git status` 에서 즉시 확인.
- `/hns:gc` 와 doc-gardening 표준이 결정적 입력을 얻음 (LLM 호출 전 사전 필터).
- 서비스별 coverage 메트릭 산출 가능.
- Phase 3a (CI gating) 의 기반.

### Negative / Risk
- lock 파일 merge conflict 가능성 — 스크립트 재생성으로 해결 (`doc_map.py` 재실행).
- pattern_rules 튜닝 비용 — 초기엔 `manual_links` 중심, 점진 pattern 화.
- ADR-sensitive 경로 (ADR-0019~0022) 의 변경이 lock drift 를 유발 → false positive 가능. 정책의 `ignore_patterns` 로 조정.

### Neutral
- 기존 문서/스펙 수정 불필요 (점진 도입).
- 외부 의존 없음 (stdlib 만 사용).

## References

- `agent-os/standards/agent-behavior/doc-gardening.md` (본 ADR 에 따라 개정됨)
- `agent-os/standards/agent-behavior/core-rules.md` (탐색 우선 원칙)
- `agent-os/standards/agent-behavior/confirmation.md` (L3 승인 프로세스)
- `docs/benchmarks/2026-04-15-docs-tree-tools.md` (내부 벤치마크 참고)
- `ADR-0016-service-local-docs.md` (서비스 계층 문서 구조)
