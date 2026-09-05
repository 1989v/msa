# ADR-0091 에이전트 하네스 — 실제 훅과 증거 게이트, 레포 밖 지식베이스 읽기

## Status
Accepted (2026-09-05)

**Related**: ADR-0073(배포 안전장치 — 막힌 것을 푸는 물건은 막힌 것이 배포하지 않는다) · ADR-0083(레이어 표준 — 게이트가 없는 규칙은 지켜지지 않는다) ·
ADR-0026(문서 분류) · hns 플러그인 ADR-005/006(`ai/plugins/hns/docs/decisions/`) · `docs/benchmarks/2026-04-06-hns-review.md`(이전 hns 점검)

## Context

### 있는 것과 켜진 것은 다르다 — 2026-09-05 실측

이 레포는 4월부터 hns 플러그인의 3단계 훅 템플릿을 `.claude/hooks/hnsf-automation.json` 으로 복사해 두고 있었다. 그 파일의 `type: reminder` ·
`PrePrompt` · `condition: context.usage > 0.75` 는 **Claude Code 에 존재하지 않는 필드**다. settings 어디에서도 참조되지 않았고, 한 번도 발화한 적이
없다. 실제로 동작한 훅은 손으로 만든 네 개(`adr-check.sh` · `cdp-chrome-guard.sh` · `submodule-auto-push.sh` · `game-mobile-check.sh`)뿐이었다.

플러그인 쪽도 같았다. 세션 기록 99건에서 사용자가 `/hns:*` 를 직접 친 횟수 0, hns 에이전트 디스패치 0, `hns:start` 자동 진입 14. 플러그인
`skills/` 는 한 단계만 탐색하므로 `skills/core/*` 등 2단계 아래의 숨은 스킬 22개는 발견된 적이 없었다. 그 사이 이 레포의 하네스 진화는
`CLAUDE.md` · `docs/standards/agent-behavior.md` · auto memory 에서 일어났고, 규칙 대부분이 **"검증 출력 없이 통과를 주장하지 않는다"** 류의
증거 규칙이었다. 문서가 요구하는 것을 기계가 강제하지 않았다.

### 레포 밖에 있는 지식

개인 볼트(Obsidian `1989v`, 58페이지)에 이 플랫폼의 결정·함정·현황 페이지(`single-node-gitops-pitfalls`, `msa-platform-status`,
`hybrid-search-local-embedding` 등)가 쌓여 있다. 쓰기는 `obsidian-organize` 스킬이 담당하지만 에이전트가 읽는 경로가 없었다. 레포 문서는
"무엇" 을 말하고 볼트는 "왜" 와 "지난번에 뭐가 깨졌나" 를 말하는데, 후자를 못 봤다.

## Decision

**D1. Claude Code 훅을 실제 스키마로 건다 (hns 0.15.1, tier `enforce`).** 스크립트는 `.claude/hooks/hns/` 에 추적하고, 배선은 기존 손수
훅과 같은 `settings.local.json`, 설정은 `.claude/hns-hooks.env`.

| 이벤트 | 동작 |
|---|---|
| `SessionStart` | 최신 `docs/specs/*/context/progress.md` · key-decisions · 열린 pre-impl 수 · 최근 커밋 주입. 볼트 이름·페이지 수·마지막 ingest 한 줄 |
| `PreCompact` | 요약이 보존할 5항목과 progress 파일 경로 지시 |
| `PreToolUse` `git commit` | **바뀐 파일이 속한 Gradle 모듈만** `compileKotlin compileTestKotlin`, portal-fe 는 `tsc -b`. 실패 시 `permissionDecision: deny` |
| `PostToolUse` Write\|Edit | 린트 없음(ktlint/detekt 미사용) — `HNS_LINT_CMD` 비움 |
| `Stop` (prompt) | 마지막 답이 성공·완료를 주장하는데 실행 명령과 결과 줄이 없으면 `ok: false` 로 종료 차단. 실패·차단 보고와 질문은 통과 |

**D2. 커밋 게이트는 전체 빌드가 아니라 바뀐 모듈만 본다.** `compile-changed.sh` 가 staged+unstaged 파일에서 가장 가까운 `build.gradle.kts` 를
찾아 `:a:b` 로 바꾸고, `src/` 가 없는 집계 모듈은 건너뛴다. `docs/standards/agent-behavior.md` 의 "시그니처 변경은 `compileTestKotlin` 이
잡는다" · "FE 는 `tsc -b`" 를 게이트로 옮긴 것이다.

**D3. 레포 밖 지식베이스는 읽기만 한다.** `HNS_KB_PATH="~/…/second-brain/1989v"`. `hns:kb` 가 `wiki/index.md` 를 키워드로 grep 해
최대 3페이지를 읽고 `[[page]] (1989v, updated)` 로 인용한다. 레포 문서와 모순되면 레포가 이긴다. 쓰기는 `obsidian-organize` 로만.
홈 경로는 `~` 로 적는다(공개 레포에 사용자명이 남지 않게).

**D4. 죽은 산출물을 없앤다.** `hnsf-automation.json` · `.claude/config.yml`(quality/efficient 모드) · `.claude/COMPACTION-GUIDE.md` 삭제.
표준의 "언제 컴팩션할지" 절은 자동 컴팩션에서 통제 불가라 **파일(progress.md · key-decisions.md)이 원본** 인 규칙으로 바꿨다.

## 운영

- 게이트가 막으면 **컴파일을 고친다.** `--no-verify` 도, `HNS_HOOK_TIER` 를 내리는 것도 답이 아니다(내리는 것은 사용자 결정).
- 수준 조정: `.claude/hns-hooks.env` 의 `HNS_HOOK_TIER=reminder|feedback|enforce`. Stop 게이트만 끄려면 `settings.local.json` 의 `Stop` 항목 제거.
- 새 클론에서는 배선이 없다(`settings.local.json` 은 gitignored). `/hns:setup-hooks enforce` 가 병합해 준다.
- 훅이 살아 있는지: `claude -p --output-format stream-json --include-hook-events` 로 `hook_response` 를 본다. 스크립트 단독은
  `echo '{"tool_input":{"command":"git commit -m x"}}' | HNS_HOOK_TIER=enforce HNS_COMPILE_CMD=false .claude/hooks/hns/commit-gate.sh`.

## Verification (2026-09-05)

| 항목 | 결과 |
|---|---|
| 스크립트 주입 테스트 | 실패 입력 → `deny` / `additionalContext`, 정상 입력 → 출력 없음 exit 0 (5/5) |
| `claude -p` 런타임 | SessionStart 주입 내용을 모델이 인용 · `git commit` deny 후 HEAD 불변, 컴파일 통과 시 HEAD 이동 · 근거 없는 "테스트 통과" 는 Stop 게이트가 차단해 모델이 검증 시도 · 실패 보고·인사말 통과 |
| 모듈 매핑 | `order/domain/…kt` → `:order:domain`, `commerce/app/…` → `:commerce:app`, `order/build.gradle.kts`(집계) → 제외, `portal-fe/*.tsx` → `tsc -b`. `warehouse:domain` 실제 컴파일이 게이트를 4초에 통과 |
| kb 어댑터 | `/hns:start` 질의에서 `kb-search` 호출, 볼트에만 있는 근거("KURE-v2 는 다중 벡터라 `knn_vector` 불가")를 `[[open-embedding-models-2026-ko-en]] (1989v, 2026-09-05)` 로 인용. 레포에 답이 있으면 검색만 하고 인용하지 않음 |

## Consequences

**+** 문서가 요구하던 증거 규칙이 처음으로 강제된다. 컴팩션·세션 경계에서 진행 상태가 파일로 살아남는다. 볼트의 "왜" 가 shape·review 의 근거가 된다.
**−** `git commit` 마다 바뀐 모듈 컴파일(수 초~수십 초). Stop 게이트는 턴마다 빠른 모델 호출 1회. iCloud 가 볼트를 evict 하면 조회가 빈다(스크립트가 stderr 로 알린다).
**−** 훅 배선이 개인 설정에 있어 협업자는 `setup-hooks` 를 직접 돌려야 한다.

## Not adopted
플러그인 레벨 `hooks/hooks.json` 자동 활성(전역 활성 플러그인이라 다른 레포에서도 발화) · 전체 빌드 커밋 게이트(모노레포에서 분 단위) ·
편집마다 린트(린터 없음) · 볼트 index 를 매 세션 주입(3~4K 토큰, JIT 원칙 위반) · docs-health CI 액션 핀 갱신(최근 5회 성공, 동작 중)
