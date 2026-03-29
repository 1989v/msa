# Risk Classification & Confirmation

## Risk Levels

| Level | Task Type | Action |
|-------|-----------|--------|
| **L1** | 리팩토링, 포맷, 주석, 문서 | Auto-proceed + build check |
| **L2** | 신규 파일, 메서드 시그니처, 테스트 추가 | Auto-proceed + Ralph Loop |
| **L3** | 비즈니스 로직, 도메인 개념, 아키텍처 변경 | **WAIT for human approval** |

## Ralph Loop (L2/L3)

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

## L3 Approval Request Format
```
## Work Confirmation Request
**Task**: [what]  **Reason**: [why]  **Impact**: [files/features]
**Evidence**: [docs/code referenced]
Proceed?
```
