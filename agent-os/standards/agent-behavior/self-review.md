# Self-Review Protocol

## L1/L2: Automated Review
- 프로젝트 린터 실행 → 위반 시 수정

## L3: Fresh Context Review (품질 모드)
- 서브에이전트로 fresh context reviewer 호출
- git diff + spec + standards만 제공
- 구현 히스토리 제외 (편향 방지)

## L3: Inline Checklist (효율 모드)
- [ ] spec.md 요구사항 전부 반영?
- [ ] 기존 코드 패턴 일관?
- [ ] 에러 핸들링 누락 없음?
- [ ] 테스트 약화/삭제 없음?

## Verdict
- **SHIP** → BUILD 진행
- **REVISE** → 재구현 (max 2회)
- **BLOCK** → 에스컬레이션
