# 웹게임 상위 노출 보완 2차 — 검토 결과
<!-- source: portal-fe/src/seo/gameGuide.mjs, portal-fe/src/pages/games/GamesPage.tsx, portal-fe/src/pages/games/GameDetailPanels.tsx, portal-fe/scripts/prerender-seo.mjs -->

상태: 구현·검증 완료, 운영 배포 승인 대기. `웹게임` 상위 노출 목표는 아직 미달성이다.

## 변경

- 홈페이지 이용 안내에 Block Burst·Minefield·Rift의 플레이 방식별 선택 이유와 상세 링크를 추가했다.
- 세 게임 소개에 목표·PC/터치 조작법·첫 플레이 팁을 한국어·영어로 제공한다.
- 실제 운영 게임 소스와 대조했으며 실제 화면·초기 HTML은 같은 안내 원본을 사용한다.
- 기존 82종 메타·광고·게임 본체·플레이 버튼과 기록 기능을 보존했다.

## 검증

- 관련 Vitest `5 passed`, `60 passed`.
- TypeScript·Vite·변경 lint·공백 검사 성공. 변경된 게임 초기 HTML 렌더는 테스트에서 직접 확인했다.
- 모바일390/데스크톱1280, ko/en 총16화면에서 넘침·실행 오류0, 홈페이지 메타82종·상세 플레이 버튼 확인.
- 로컬 신규 번들+읽기 전용 운영 API를 사용한 브라우저 검증이다. 신규 변경의 운영 배포 검증은 아직 아니다.
- 부모가 변경 diff와 검증 출력을 검토하고 모바일 홈페이지·상세 스크린샷을 확인했다.

작업트리 `/Users/gideok-kwon/.codex/worktrees/8849/msa`, 구현 커밋 `1db272eae`.

## 상세 자료

- [구현·명령 출력·소스 근거](implementation.md)
- [검색 기준선·HTTP·수집 로그 표본](baseline.md)
- [외부 소개 글 초안](outreach-drafts.md) — 게시·연락 미실행
- [모바일 홈페이지 안내](evidence/browser-390-home-ko.png)
- [모바일 Block Burst 안내](evidence/browser-390-games-block-burst.png)
- [승인 범위·검증 요구사항](spec.md)

## 배포 후 확인

승인 후 portal-fe만 배포하고 초기 HTML·실제 브라우저의 안내/메타를 확인한다.
네이버 `웹게임` 첫 페이지의 비광고 웹사이트 결과 진입 여부와 검색 설명 갱신을 기준선과 비교한다.
검색 결과에 이미 다수 게임 상세가 존재하므로 진단 CSV의 색인1개만으로 원인을 확정하지 않는다.
외부 소개용 초안은 준비됐으나 실제 인용·리뷰·외부 링크는 아직 확보되지 않았다.
