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


## 2026-10-21 검색 화면 개정 — 사용자 요청

- 종류/카테고리 필터와 type 상태를 제거한다. legacy `?type=game`도 무시하며 모든 검색 요청은 전체 타입으로 보낸다.
- q/all/page 복원과 페이지 이동, 자동완성 첫 Enter/방향키/IME/역순 응답 보호, `/s`, PWA 동작은 유지한다.
- 기존 heritage hook·ThemeToggle을 유지하고 DESIGN.md §12의 kh-field/kh-display/kh-button-ghost로 일반 CSS를 정리한다.
- 결과의 타입은 목적지 구분용 수동 라벨로만 남긴다. API·검색 엔진은 변경하지 않는다.


## 2026-10-21 GNB 서비스 탐색 자동완성 — 사용자 승인

- GNB 검색 Enter가 /search를 경유해 두 번 Enter를 요구하던 흐름을 제거한다. ready 선택 결과로 즉시 이동한다.
- `useUnifiedSearch`로 /search와 ServiceExplorer의 요청·선택·키보드·IME·취소/역순응답 보호를 공유한다.
- 첫 Escape는 자동완성만 닫고 이후 Escape는 기존 KhSheet가 처리한다. 조합 중 Escape는 전파하지 않는다. KhSheet 자체는 변경하지 않는다.
- 전체 보기 링크는 기존 unifiedSearchHref에 all=1을 추가한다. 백엔드/API/PWA는 변경하지 않는다.
