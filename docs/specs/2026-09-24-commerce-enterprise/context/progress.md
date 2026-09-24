# Progress — commerce 엔터프라이즈화

작업 위치: 워크트리 `/Users/gideok-kwon/IdeaProjects/msa-commerce-ent` (브랜치 `feat/commerce-enterprise`, origin/main 기반).
공유 트리(`msa`)에는 다른 세션의 미커밋 변경이 많다 — 여기서만 작업하고 단계 끝에 origin/main 위로 리베이스해 main 에 푸시한다.
서브모듈 초기화: auth · gifticon · ai (career · ideabank · private · games 는 미초기화, 빌드 무관).

| 그룹 | 상태 |
|---|---|
| TG1 아웃박스 보강 | 완료 |
| TG2 보안·결함 | 완료 |
| P0 배포 | 완료 (269c352) |
| TG3 seller 도메인 | 완료 |
| TG4 역할 연동 | 완료 (auth fe0f5f6 미푸시) |
| TG5 판매자 화면 | 완료 |
| P1 배포 | 완료 (ace7837, 실제 로그인 흐름은 미확인) |
| TG6 payment | 완료 · P2 push 043a9e87 |
| TG7 promotion | 완료 |
| TG8 주문서 | 완료 |
| TG9 장바구니·주문서 화면 | 완료 |
| P3 배포 | 완료 (64b0a51) — 단 읽기 모델은 리스너 미등록으로 비어 있음 |
| TG10 명령 핸들러 | 완료 · 배포(421d2be), 리스너 23개 · product_view 24 |
| TG11 사가 | 완료 |
| TG12 사가 E2E·결제 대기 화면 | 진행 중 |

다음: TG1 → TG2 → P0 배포
블로커: 없음
