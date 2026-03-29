# Doc Gardening (문서 동기화)

## Doc Impact Scan (구현 성공 후)

```bash
git diff --name-only HEAD
```

변경된 파일 키워드 → agent-os/standards/ 매칭 → 관련 문서 보고

## 동기화 대상
- spec.md ↔ 실제 구현
- tasks.md ↔ 완료 상태
- key-decisions.md ↔ 코드 내 결정

## 원칙
- 구현이 성공한 후에만 문서 동기화
- 문서는 코드의 결과물, 코드가 source of truth
