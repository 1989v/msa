# Agent Behavior Standards

## Core Rules

### Explore First, Evidence Based
- 코드나 문서를 먼저 읽고, 추론하지 말 것
- 가정 대신 증거 기반 접근
- 불확실하면 질문

### Pre-Work Checklist (모든 코드 수정 전)
1. Read `docs/specs/{feature}/context/key-decisions.md` (if exists)
2. Read `docs/specs/{feature}/spec.md`
3. Read `docs/specs/{feature}/tasks.md` → confirm current task
4. Check `docs/standards/` → matching standard
5. If unclear → ask "Please confirm: [specific question]"

## Risk Classification & Confirmation

### Risk Levels

| Level | Task Type | Action |
|-------|-----------|--------|
| **L1** | 리팩토링, 포맷, 주석, 문서 | Auto-proceed + build check |
| **L2** | 신규 파일, 메서드 시그니처, 테스트 추가 | Auto-proceed + Ralph Loop |
| **L3** | 비즈니스 로직, 도메인 개념, 아키텍처 변경 | **WAIT for human approval** |

### Ralph Loop (L2/L3)

```
MAX_RETRIES = 3
LOOP:
  1. BUILD   → fail → FIX
  2. TEST    → pass → EXIT (success)
  3. ANALYZE → identify root cause
  4. FIX     → different approach
  5. ITERATION++ → if >= 3 → EXIT (escalate)
```

Failure Classification:
- **Execution Failure** (Mock 누락, 파싱 오류) → 루프 내 수정
- **Implementation Failure** (404, 500, spec 불일치) → 즉시 STOP

### L3 Approval Request Format
```
## Work Confirmation Request
**Task**: [what]  **Reason**: [why]  **Impact**: [files/features]
**Evidence**: [docs/code referenced]
Proceed?
```

## Session Management

### Session Start
1. Read CLAUDE.md
2. Read docs/product/mission.md (if exists)
3. Check recent spec status in docs/specs/
4. Load active task context

### Session End
- Ensure all changes committed
- Update status.md if applicable
- Note next steps in tasks.md

### Post-Compaction Recovery
- Follow compaction.md recovery steps
- Ask specific questions if context insufficient

## Compaction Rules

### 컴팩션 실행 권장 시점
- Task Group 완료 시
- Spec 문서 작성 완료 시
- 구현 완료 후 테스트 작성 전
- Phase 전환 시

### 컴팩션 실행 금지 시점
- 구현 도중
- 테스트 디버깅 중
- 중요한 의사결정 논의 중

### Pre-Compact Checklist
- [ ] 현재 작업을 git commit으로 저장
- [ ] 중요 의사결정을 key-decisions.md에 기록
- [ ] 다음 Task 계획 확인
- [ ] 현재 작업이 완전히 종료되었는지 확인

### Post-Compact Recovery
1. CLAUDE.md 읽기
2. key-decisions.md 읽기
3. open-questions.yml 확인
4. tasks.md 체크박스 확인
5. git log 최근 커밋 확인

## Doc Gardening

### 원칙

- **코드가 SOT, 문서는 결과물**. 문서는 코드의 상태를 반영하기 위한 파생물.
- 구현이 성공한 후에만 문서 동기화 (실패한 구현을 문서화하지 않는다).
- `docs/doc-index.lock.json` 은 **검증 아티팩트**이지 SOT 가 아니다 — drift 신호 용도.

### Doc Impact Scan (구현 성공 후)

```bash
python3 ai/plugins/hns/scripts/doc_scan.py --base HEAD
```

출력:
- **Impacted docs**: 변경된 소스와 매핑된 문서 → 내용 갱신 검토
- **New sources**: 문서 미연결 신규 소스 → `docs/doc-index.json` 에 링크 등록 또는 문서 초안 작성
- **Deleted sources**: 삭제된 소스 → 연결 문서 아카이브/갱신 검토

JSON 출력이 필요한 경우 (agent 연동): `--json` 플래그.

### Lock Drift 검사

```bash
python3 ai/plugins/hns/scripts/doc_map.py --check
```

- 정책/소스/문서 변경 후 lock 이 오래되었으면 exit 1 + 안내 메시지.
- 갱신: `python3 ai/plugins/hns/scripts/doc_map.py` (인자 없이) → `docs/doc-index.lock.json` 재생성 → 커밋.

### 동기화 대상

- `spec.md` ↔ 실제 구현
- `tasks.md` ↔ 완료 상태
- `key-decisions.md` ↔ 코드 내 결정
- `docs/adr/**` ↔ 아키텍처 변경
- 서비스 `{service}/CLAUDE.md` ↔ 서비스 특성 변경

### Citation (선택)

문서 상단 또는 섹션 첫 줄에 HTML 주석으로 explicit link 선언 (컬럼 0 에서 시작):

```markdown
<!-- source: product/app/src/main/kotlin/com/kgd/product/service/ProductService.kt -->

# Product Service
```

렌더링에 영향 없음. `doc_map.py` 가 파싱하여 `link_type: explicit` 로 등록.

### 참고

- ADR-0023 Doc Index Tracking (`docs/adr/ADR-0023-doc-index-tracking.md`)
- 정책: `docs/doc-index.json`
- 검증 아티팩트: `docs/doc-index.lock.json`

## Self-Review Protocol

### L1/L2: Automated Review
- 프로젝트 린터 실행 → 위반 시 수정

### L3: Fresh Context Review (품질 모드)
- 서브에이전트로 fresh context reviewer 호출
- git diff + spec + standards만 제공
- 구현 히스토리 제외 (편향 방지)

### L3: Inline Checklist (효율 모드)
- [ ] spec.md 요구사항 전부 반영?
- [ ] 기존 코드 패턴 일관?
- [ ] 에러 핸들링 누락 없음?
- [ ] 테스트 약화/삭제 없음?

### Verdict
- **SHIP** → BUILD 진행
- **REVISE** → 재구현 (max 2회)
- **BLOCK** → 에스컬레이션
