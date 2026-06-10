# Requirements — Portfolio Card

> Status: Implemented (retro-documented 2026-06-10)

## User Stories

1. 방문자는 `/portfolio` 에서 작업 이력을 카드 그리드로 훑어볼 수 있다.
2. 방문자는 최신순/임팩트순 정렬을 전환할 수 있다.
3. 방문자는 기술 스택 태그를 다중 선택(AND)해 카드를 좁힐 수 있다.
4. 방문자는 키워드로 제목/요약/본문을 검색할 수 있다.
5. 방문자는 카드를 클릭(또는 키보드)해 본문 상세 모달을 볼 수 있다.
6. 운영자는 PRIVATE 카드로 외부 비노출 항목을 관리할 수 있다.

## Acceptance Criteria

- [x] PUBLIC 카드만 목록/상세에 노출되고, PRIVATE 상세 접근은 NOT_FOUND
- [x] impact 1~10 범위 밖 데이터는 도메인/DDL 양쪽에서 거부 (require + CHECK)
- [x] 빈 검색어/빈 스택 필터는 전체 목록과 동일
- [x] API 응답은 공통 `ApiResponse<T>` 포맷
- [x] FE 는 DESIGN.md 토큰만 사용 (raw hex 0건)
- [x] 모달 ESC/백드롭 클릭 닫기 + 스크린리더 dialog 시맨틱
- [x] 로딩/에러/빈 상태 각각 별도 UI
