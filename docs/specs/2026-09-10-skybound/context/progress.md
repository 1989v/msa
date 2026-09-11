# 이어받기 · 2026-09-11

## 현재

**T02B-4a 걷기/달리기 제자리 클립과 검증 뷰어 저장. 다음 T02B-4b 점프/착지·이동 스냅샷 연결.**
게임에서 조작하며 이동하는 상태는 아직 아니다. T02B-3 최종 아트도 REVISE다.

- 사용자 최신 의도: 다른 게임을 참고하지 않는 클린룸 창작, PRD·원화·작은 단위 구현→검증→저장 반복.
  최신 한도 안내는 5h 55%. 남은 양을 직접 측정한 값은 아니다.
- 작업/저장 위치: `/Users/gideok-kwon/IdeaProjects/msa/docs/specs/2026-09-10-skybound/`.
  다른 게임 폴더를 읽거나 변경하지 않는다. 새 창작 컨텍스트에는 이 게임 자료만 전달한다.
- T01A 소품 GLB: `implementation/t01a/`, tests5/5.
- T01B/C 지형·카메라: `implementation/t01b/`, tests9/9, 브라우저 행동12/12.
- T02A 순수 이동/지형 접지: `implementation/t02a/`, tests11/11.
- T02B 리깅/텍스처 진단: `implementation/t02b/rig-check/` tests4/4,
  `texture-check/` 실제 브라우저12/12. 진단 스트립은 주인공이 아니다.
- 주인공 원본/GLB/atlas/뷰어: `implementation/t02b/character/`.
  LOD0 14,882tri / LOD1 5,000tri, 19bones,1K atlas. GLB 2,013,048 / 1,637,492 bytes.
  idle/rig-inspection/walk/run을 표준 GLTFExporter→GLTFLoader로 재로드한다.
- 최신 검증: 모델+동작 **10/10**, 동작 브라우저 **21/21**, 뷰어 **31/31**.
  `verifications/t02b-4a.md`, `t02b-4a-motion-browser.json`, `t02b-4a-browser.json`.
- 재생성 비용: 빌드 약1초 미만, 모델/동작 테스트 약0.3초, 브라우저 GLB 재생성/캡처 수초.
  원화2장은 assets/에 보존하고 재생성하지 않는다. 임시 `/private/tmp/skybound-cleanroom/`에는 중요한 원본이 없다.

## 다음 작은 단위

1. README → tasks → character/motion-report.md → T02A README 연결 계약을 읽는다.
2. **T02B-4b-1**: 점프/낙하/착지 포즈/클립과 전환을 먼저 독립 뷰어에서 검증·저장한다.
3. **T02B-4b-2**: T02A snapshot의 position(발)/velocity/grounded/mode/stamina로
   캐릭터 위치·동작을 연결하고 실제 섬에서 접지를 검증한다. PC/터치 제품 입력은 T02C.
4. walk/run은 제자리 기술 초안이다. 현재 달리기에는 공중 구간·heel/toe roll이 없으며,
   실제 이동 속도/보폭 동기화·경사 적응·접지 IK·전신 관통 검사는 후속이다.
5. 피부/천/헤어·목과 어깨의 원화 품질은 별도 미완료로 유지한다.
   기술 동작 검증을 진행한다고 아트 기준을 낮추거나 통과로 표시하지 않는다.

## 다시 밟지 않을 함정

- 큰 GLB Base64를 한 CDP 응답에 넣으면 시간 초과. `check-character.mjs`의 32KiB 분할 수집 유지.
- 발바닥 높이 테스트만으로 발목 이음새 벌어짐을 못 잡았다. 하단 wrap/boot의 skin weight를
  공유 전이로 바꾸고 실제 정점→삼각형 거리 검사를 추가했다. `t02b-4a-before-ankle-fix.png`가 이전 상태다.
- 천 폭만 늘리면 판형 스카프/관통이 생긴다. 대칭 둘레 loft를 대각선 앞천으로 교체한 기록은 t02b-3c.md.
- 지형은 topHeight 수식이 아닌 실제 초원/길 삼각형 사용. 수면 -18, 높은 단차는 이동 거부.
  실제 캡슐·소품·벽·카메라 충돌은 아직 없다.
- 다른 작업의 커밋/파일은 되돌리지 않는다. 본 작업 경로만 커밋한다.

## 실행 환경과 차단

- 설치 Three.js0.183.2/esbuild0.27.7 사용, 추가 패키지 없이 빌드한다.
- 창작 에이전트가 간헐적으로 workspace out of credits 오류를 냈지만 재개 후 모델/동작을 저장했다.
  과거 오류를 지속 차단으로 가정하지 않는다. 재발 시 정확한 실패와 저장 경계를 기록한다.
- 실제 모바일 성능·게임 완주·배포는 미검증. 외부 공개는 T09의 별도 승인 단계다.
- 서버는 꺼질 수 있다. HTTP200 확인 후 QA:
  `python3 -m http.server 8768 --bind 127.0.0.1 --directory docs/specs/2026-09-10-skybound`.
- 캐릭터: `http://127.0.0.1:8768/implementation/t02b/character/index.html`.
- Chrome은 `CLAUDE_SCRATCHPAD=/private/tmp/skybound-validation`의
  `scripts/cdp-chrome.sh start skybound-prop --gl`(9403)만 사용하고 검사 후 stop한다.
  사용자/MCP Chrome을 종료하지 않는다. 이번 전용 프로필은 종료 완료.
