# 통합 검색 런처 — 배포 기준 호환 구현

Status: 구현 및 배포 사용자 승인, 2026-10-21. 이 문서는 최신 origin/main에서의 최종 계약이다.
초기 공유 작업 트리가 원격보다 오래되어 같은 경로의 기존 통합 검색을 놓쳤다. 배포 패키지는
`59644dd328bfc2821654cef4646513bd9eb1b97a` 기준으로 격리 재구성했으며 기존 API/코퍼스를 보존한다.

## 사용자 흐름

`/search`는 이름 입력 → debounce 자동완성 → 기본 첫 결과/방향키 선택 → Enter/터치/클릭으로
실제 서비스 상세로 이동하는 독립 런처다. `/s`는 query를 보존해 `/search`로 정규화한다.
IME 확정 Enter, 입력 변경 직후 과거 선택, 취소·역순 응답으로 잘못 이동하지 않는다.
전체 결과 버튼은 같은 화면에서 전체 결과를 보여주며 q/type/page/all URL 상태를 복원한다.
기존 메인·`/tech`와 기존 여섯 비관광지 타입을 유지하고 cafe_drink를 추가한다.
종류 필터: attraction, game, blog_post, concept, deal_offer, service, product, cafe_drink.

## 최신 원격 아키텍처 보존

- `unified`는 기존 여섯 타입 + cafe_drink를 담는다. 기존 매핑/읽기·쓰기 문서 계약을 바꾸지 않는다.
- 관광지는 `attractions` 별도 인덱스를 유지한다. 기존 query-vector/sidecar, 모델 스탬프, 조건어·hybrid 경로를 재사용한다.
  중복 관광지 벡터나 별도 검색 인덱스를 만들지 않는다. 게임·음료는 keyword 전용이다.
- `GET /api/search/unified`는 기존 `{query, understood, groups:[{type,total,hits}]}` 응답을 보존한다.
  맨 뒤 기본값0인 page를 추가해 두 검색 경로에 전달한다. 크기는 기존1..20 clamp를 유지한다.
- `GET /api/search/unified/suggest`만 새로운 flat `{hits,total,page,size,mode:"bm25"}` 계약이다.
  기존 관광지 suggest와 unified 이름 exact/prefix/BM25를 사용하고 벡터를 호출하지 않는다.
  exact→prefix→기타 이름 매칭 순, 안정적 ID tie. 영문 keyword term/prefix는 case_insensitive.
- 공개 원천 API만 수집한다. 음료 비교 그룹·브랜드는 기존 facets에 넣는다.
  게임은 sort=new로 고정하고 공개 상태/총건수/중복/페이지 완전성을 검사한다.
  카페 원천은 안정적 자연키 해시와 완전 수집 검사를 사용한다.
- 기존 재색인의 원천별 재시도와 CronJob 일정·리소스를 유지한다. bulk 오류와 refresh 후 정확한 총건수를
  추가로 검사해 부분 세대를 활성화하지 않는다. 기존 alias live-count 하한/안전한 retention도 보존한다.

## 프런트·PWA

전체 결과는 기존 grouped API를 프런트에서 표시 형태로 변환한다(검색 엔진 대체 필터링이 아님).
타입별 페이지 수 중 최댓값으로 전체 페이지를 계산한다. 목적지는 기존 unifiedHitHref를 확장해
구성하며 임의 원천 URL로 내비게이션하지 않는다. 음료는 이름·그룹 URL을 비교 화면에 전달한다.
검색 manifest/start_url/scope `/search`, 전용192/512 아이콘과 MIME을 제공한다.
서비스 워커/API 캐시는 없으며 인터넷 연결 필요를 안내한다. 기존 모바일 홈 셸은 검색에서 숨긴다.

## 검증·배포

격리 체크아웃에서 Gradle app/batch/domain 테스트, verifyArchitecture, FE tsc -b/관련 테스트/production build를 다시 실행한다.
이전 공유 트리의189개 테스트 결과를 이 배포판의 증거로 사용하지 않는다.
정상 Git hook으로 격리 커밋을 만든 뒤 부모가 push/build/deploy/운영 재색인을 담당한다.
브라우저 도구는 이번 배포 작업에 사용하지 않는다. 운영 인계와 실제 출력은 operations.md를 따른다.
