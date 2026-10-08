# 회귀 주입 (SR-7.3)

HEAD 의 임시 워크트리(`scratchpad/wt-inject`, 2026-10-08)에서 한 건씩 넣고 해당 테스트를 돌린 뒤 되돌렸다. 스크립트 `scratchpad/inject-b.py`. 전부 컴파일되는 변경이다. 끝난 뒤 `git status` 깨끗.

| # | 주입 | 대상 | 결과 |
|---|---|---|---|
| 1 | 패널 정규화 제거 | PlacePage.test.tsx | 종료 1 · 3 failed | 41 passed (44) |
| 2 | 카드에 FE 재정규화 추가 | PlacePage.test.tsx | 종료 1 · 1 failed | 43 passed (44) |
| 3 | 고른 칩 그리기 제거 | PlacePage.langSwitch.test.tsx | 종료 1 · 1 failed (1) |
| 4 | 순수 함수가 기본 분류를 조건에 넣음 | PlacePage.relax.test.tsx | 종료 1 · 11 failed | 9 passed (20) |
| 5 | 해제 핸들러가 triggerRef 를 안 심음 | PlacePage.relax.test.tsx | 종료 1 · 13 failed | 7 passed (20) |
| 6 | 「모두 해제」에서 attributes 비우기 삭제 | PlacePage.relax.test.tsx | 종료 1 · 1 failed | 19 passed (20) |
| 7 | 지역 해제를 selectRegion 호출로 | PlacePage.relax.test.tsx | 종료 1 · 1 failed | 19 passed (20) |
| 8 | placeApi 의 exact 직렬화 삭제 | placeApi.test.ts | 종료 1 · 1 failed | 3 passed (4) |
| 9 | petPartial 의 only: 'ko' 삭제 | PlacePage.test.tsx | 종료 1 · 2 failed | 42 passed (44) |
| 10 | UnifiedSearchPage summary 재정규화 | UnifiedSearchPage.test.tsx | 종료 1 · 1 failed (1) |
| 11 | 서버 자르기 순서 되돌림 | SearchAttractionServiceTest | 종료 1 · tests=46 failures=2 errors=0 |
| 12 | findById 에 정규화 | SearchAttractionServiceTest | 종료 1 · tests=46 failures=1 errors=0 |
| 13 | exact 분기 제거 | SearchAttractionServiceTest | 종료 1 · tests=46 failures=1 errors=0 |
| 14 | 컨트롤러 exact 바인딩 삭제 | AttractionSearchControllerTest | 종료 1 · tests=11 failures=1 errors=0 |
| 15 | PARKING_NO 에 n/a 복원 | AttractionAttributeParserTest | 종료 1 · tests=11 failures=1 errors=0 |
| 16 | 실패 시 이전 사전 유지 삭제 | CategoryLexiconServiceTest | 종료 1 · tests=11 failures=3 errors=0 |
| 17 | 빈 집합 가드 삭제 | CategoryLexiconServiceTest | 종료 1 · tests=11 failures=2 errors=0 |
| 18 | 서비스가 상수 10 을 넘김 | CategoryLexiconServiceTest | 종료 0 · tests=11 failures=0 errors=0 |
| 19 | lexicon(null) 이 EMPTY | CategoryLexiconServiceTest | 종료 1 · tests=11 failures=1 errors=0 |
| 20 | lclsSystm1 하위 집계 읽기 삭제 | AttractionSearchAdapterCategoryCodesTest | 종료 1 · tests=4 failures=1 errors=0 |
| 21 | sum_other_doc_count 검사 삭제 | AttractionSearchAdapterCategoryCodesTest | 종료 1 · tests=4 failures=1 errors=0 |
| 22 | 집계 버킷 크기 지정 삭제 | AttractionSearchAdapterCategoryCodesTest | 종료 1 · tests=4 failures=1 errors=0 |

## 처리
- **#18 이 처음에 초록이었다.** 테스트 ⑧ 의 픽스처 코드표가 10행 이하라 상수 10 도 「행 수 이상」을 만족했다. ⑧ 만 30행 남짓(기존 + 20행)으로 바꾼 뒤 다시 주입해 `tests=11 failures=1` 로 빨간불을 확인했고, 원래 코드에서는 `tests=11 failures=0`(2026-10-08T13:12 UTC).
- **「사전을 다 만든 뒤 거르기」는 주입할 수 없다.** `QueryIntent.Lexicon` 이 코드 목록을 밖에 내놓지 않아(`byName` private) 다 만든 사전을 거르는 코드를 컴파일되게 쓸 수 없다. 구조가 그 회귀를 막는다. 테스트 ③ 은 그대로 둔다.
