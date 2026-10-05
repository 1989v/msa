# R6 BETA 배포

플레이: https://game.1989v.com/games/duel-defense/index.html
카탈로그: https://game.1989v.com/games/duel-defense

- 공개 카탈로그 API: id89, slug duel-defense, 대전 디펜스, BETA, AI 상대·15웨이브·공용군량·강화/연구 설명, SDK 미통합/점수판 없음. 원문 `r6-public-catalog.json`.
- 격리 games 릴리스 `bf2c5243`: 원격 최신 `a45353da`에 duel-defense34파일만 추가. 다른 게임/공통 라이브러리 보존. 검증된 게임 원본은 `d1bbfa6a`(R6 gameplay `8b2bc8c0`).
- 서버 등록 `94378f059`: V105 단일 게임 멱등 카탈로그/통계/태그 등록. [content CI](https://github.com/1989v/msa/actions/runs/37337239738) SUCCESS, scoped JVM tests·jib·manifest commit 모두 SUCCESS.
- 화면 포인터 릴리스 `f0779a148`, [전용 portal-fe CI](https://github.com/1989v/msa/actions/runs/37340689102) SUCCESS. 공용 main 큐의 대기 run이 다른 커밋에 의해 취소되어 전용 release/duel-defense-beta 브랜치 + services=portal-fe로 빌드했다. 전체 rebuild는 사용하지 않았다.
- 전용 브랜치는 자동 manifest commit-back 대상이 아니므로 최신 원격 main 위에 portal-fe 태그만 `f0779a1`로 수정한 `23497aca4`를 배포. 다른 서비스 태그 보존.
- 최종 OCI: portal-fe:f0779a1 / content:94378f0. 양쪽 successfully rolled out, Ready1/Updated1/Available1. Argo Synced/Succeeded, sync revision23497aca4. 기존 전체 health Degraded는 해결한 것으로 주장하지 않는다.
- 공개 리소스15개 HTTP200/MIME PASS. 7개mjs와6개PNG bytes/SHA 원본 일치. `r6-public-http.json`. 실제 게임 HTML AI대전·15표시·main.mjs 참조, 상세 SEO title/AI15 설명 확인.
- 실제 공개 Chrome PASS: 원화6개 준비·15표시·첫45초/280군량·빨간시간, 클릭carry단일40구매/취소·연구81/378·바로시작/실제이동·pause정지·390px시작. Runtime/console/network오류0, 실제 시간 사용·상태/군량/단계 주입 없음. `r6-public-browser-output.txt`, `r6-public-network.json`, `r6-public-verification.md` 및 공개 스크린샷. 로컬21/21과 구분하며 전체15 실제 wall-clock 반복 주장은 하지 않는다.
- 기존 공유 작업폴더의 staged games pointer/타 작업 보존. 릴리스 체크아웃의 정확한 파일만 정상 commit/push, hook 우회 없음.
- 독립 R6 코드·SQL 리뷰 SHIP. 원작 비교는 `r6-benchmark-review.md`: 개인수비/단계자원/공용 공격/조선/5×5/15개 있음; 사람 온라인1:1 없음, 히든 콤보 사용자 보류, 구체 원작 일치도 미검증.
