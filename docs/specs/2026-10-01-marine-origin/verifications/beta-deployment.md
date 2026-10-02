# 베타 배포 완료

플레이: https://game.1989v.com/games/marine-command/index.html

- 공개 API에서 marine-command 카탈로그 BETA, entryUrl 일치 확인.
- 게임 전용 격리 릴리스: games386bc590 (marine-command 및 필요한 lib/platform.js). 원격 최신 auth/rank/relay는 보존.
- 서버 릴리스ecd1dba: BETA 카탈로그 V103, marine-command에 한한128KiB저장 상한. 기존 다른게임64KiB유지.
- 프런트 릴리스d2cacba: games포인터만변경. manifestad16fc3. 이후독립place릴리스aad7089가서버에반영되었으며우리서버수정포함.
- 최종 OCI portal-fe:d2cacba/content:aad7089, 양쪽Ready1/Updated1/Available1 및rolloutsuccess확인. ArgoSynced/Succeeded;기존전체aggregateDegraded는해결한것으로보고하지않는다.
- 백엔드CI: https://github.com/1989v/msa/actions/runs/37066060784 — SUCCESS
- 프런트CI: https://github.com/1989v/msa/actions/runs/37067190708 — SUCCESS
- 공개리소스31개status/MIME통과,PNG11개실제bytes/SHA원본일치. index의origin/main.js와platform?v=d2cacba참조확인. HTML no-cache,must-revalidate/CloudflareDYNAMIC,SEO상세title확인.
- 최초PythonHTTP클라이언트는Cloudflare1010으로403,정상curlHTTP검증으로재수집했다. 브라우저제어우회나실제화면검증은하지않았다.
- 기존작업폴더의stagedgamespointer15cf171c...및다른변경보존,격리checkout둘clean. 훅우회없음.
- 저장서비스국소11테스트및배포이미지확인으로변경배포를검증. 운영저장레코드생성/삭제는하지않았다. 실제브라우저플레이/FPS/두기기협동은미검증.

원문증거: beta-deployment-evidence.json / beta-rollout.txt.
