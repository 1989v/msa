# Decisions

- 2026-10-21: 사용자가 독립 통합 검색 구현과 `/search`·`/s`, 검색 엔진 및 임베딩 확장을 승인했다.
- 기존 메인과 `/tech`를 변경하지 않는다. 이전 9월 계획의 `/tech` 대체는 이번 요청에 적용하지 않는다.
- ADR-0090의 2026-09-08 개정 및 실제 코드를 따른다. 9월 progress/key-decisions의 구형 모델·사전 전용 설명은 사용하지 않는다.
- 자동완성과 전체 검색을 구분해 기존 ADR의 자동완성 벡터 미사용 정책을 유지한다.
- 구현은 gpt-6.1-sol 에이전트 한 명에게 위임한다. 부모는 설계와 리뷰를 담당한다.


## 2026-10-21 배포 기준 개정 — 부모 승인

최신 origin/main에는 이미 grouped 통합 API·기존6타입 unified 인덱스·별도 attractions hybrid가 있다.
이 배포판은 기존 계약·필드·타입을 보존한다. 관광지 중복 색인/새 hybrid 플래그/기존 인덱스 교체는 하지 않는다.
새 suggest와 카페 원천을 덧붙이고 기존 grouped full API에 기본값0 page를 추가한다.
기존 active unified CronJob 일정·리소스·Forbid 정책을 유지한다. 이전 공유 트리 문서의
flat full 응답/모든 관광지 unified 적재/suspended 새 CronJob 설명은 이 배포판에 적용하지 않는다.
