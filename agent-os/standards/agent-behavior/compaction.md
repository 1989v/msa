# Compaction Rules

## 컴팩션 실행 권장 시점
- Task Group 완료 시
- Spec 문서 작성 완료 시
- 구현 완료 후 테스트 작성 전
- Phase 전환 시

## 컴팩션 실행 금지 시점
- 구현 도중
- 테스트 디버깅 중
- 중요한 의사결정 논의 중

## Pre-Compact Checklist
- [ ] 현재 작업을 git commit으로 저장
- [ ] 중요 의사결정을 key-decisions.md에 기록
- [ ] 다음 Task 계획 확인
- [ ] 현재 작업이 완전히 종료되었는지 확인

## Post-Compact Recovery
1. CLAUDE.md 읽기
2. key-decisions.md 읽기
3. open-questions.yml 확인
4. tasks.md 체크박스 확인
5. git log 최근 커밋 확인
