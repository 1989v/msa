# 이어받기 · 2026-09-12

## 현재

**T03A-4 전용 양팔 활공 자세·손 횡봉 접촉 저장. 다음 T03B 기류·공중 경로.**
traversal 단위13/13, 활공 브라우저19/19 최종 통과. `verifications/t03a-4.md`.
손 접점 보정은 실제 뼈 길이와 공유 횡봉 목표를 사용하고 접기/reset 때 복원한다.
터치 재누름 첫 검사 실패→로그 추가 재실행 통과. 원인 미확정, 다음 단계에서 반복/실기기 타이밍 재확인.
하체는 fall 포즈 초안이며 손가락·옷·돛 최종 아트 REVISE 유지.
전체 구축 추정 **약 30%** 유지: [산정 근거](completion-estimate.md).
전환/카메라/터치 단위10/10, 브라우저 터치15/15·PC11/11·이동19/19. `verifications/t02c-2.md`.
사용자 최신 선호: 별도 요청 전에는 설명·데모 안내를 최소화하고 개발·검증·기록 중심으로 진행한다.
PC 키보드 이동·달리기·점프가 가능한 진단 프로토타입이다. 전체 게임/최종 아트는 미완료다.

- 새 실행 위치: `implementation/t02b/traversal/`. 원본 world/simulation/character는 수정하지 않고 연결했다.
- 전환 어댑터3/3, 이전 이동규칙11/11, 실제브라우저19/19 직접 통과. `verifications/t02b-4b2.md`.
- 재빌드 약1초 미만, 소프트웨어 WebGL QA 수십초. 많은 프레임을 단일 CDP 평가에서 렌더하면 timeout; 소량씩 나눠서 검사한다.
- 고정150ms 대기로 키입력을 판정하지 않는다. 실제 위치변화를 제한시간 안에 관찰해 판정한다. FPS성능 통과로 해석하지 않는다.

- 사용자 최신 의도: 다른 게임을 참고하지 않는 클린룸 창작, PRD·원화·작은 단위 구현→검증→저장 반복.
  최신 한도 안내는 5h 7%. 계정 잔여 한도 조회 도구가 없어 직접 확인할 수 없다.
  사용자 수치를 기준으로 한 소단위씩 진행한다. 크레딧 오류가 나면 저장 경계를 기록한다.
- 작업/저장 위치: `/Users/gideok-kwon/IdeaProjects/msa/docs/specs/2026-09-10-skybound/`.
  다른 게임 폴더를 읽거나 변경하지 않는다. 새 창작 컨텍스트에는 이 게임 자료만 전달한다.
- T01A 소품 GLB: `implementation/t01a/`, tests5/5.
- T01B/C 지형·카메라: `implementation/t01b/`, tests9/9, 브라우저 행동12/12.
- T02A 순수 이동/지형 접지: `implementation/t02a/`, tests11/11.
- T02B 리깅/텍스처 진단: `implementation/t02b/rig-check/` tests4/4,
  `texture-check/` 실제 브라우저12/12. 진단 스트립은 주인공이 아니다.
- 주인공 원본/GLB/atlas/뷰어: `implementation/t02b/character/`.
  LOD0 14,882tri / LOD1 5,000tri, 19bones,1K atlas. GLB 2,096,808 / 1,721,252 bytes.
  idle/rig-inspection/walk/run/jump/fall/land를 표준 GLTFExporter→GLTFLoader로 재로드한다.
- 최신 검증: 모델+동작 **13/13**, 공중동작 브라우저 **24/24**, 기존 보행 **21/21**, 뷰어 **31/31**.
  `verifications/t02b-4b1.md` 및 `t02b-4b1-*-browser.json`에 증거 저장.
- jump/land는 일회 재생 후 끝 자세 유지 및 종료, fall은 반복한다. 종료 후 재재생/reset 확인.
  root의 실제 포물선 이동은 T02A가 소유하며 traversal에서 연결했다.
- 재생성 비용: 빌드 약1초 미만, 모델/동작 테스트 약0.3초, 브라우저 GLB 재생성/캡처 수초.
  원화2장은 assets/에 보존하고 재생성하지 않는다. 임시 `/private/tmp/skybound-cleanroom/`에는 중요한 원본이 없다.

## 다음 작은 단위

1. README → tasks → character/motion-report.md → T02A README 연결 계약을 읽는다.
2. character/aerial-report.md를 읽는다. 점프/낙하/착지 원본과 뷰어 검증은 완료했으므로 재작성하지 않는다.
3. **T03B-1**: `verifications/t03a-4.md`와 PRD SR-2를 읽고 기류 하나의 표시·상승·회복을 연결한다.
   터치 재누름 타이밍 재확인 포함. 이어서 중간 착지점·필수 경로와 기본 기력 완주를 검증한다.
   T02C 터치·PC 입력 기술 검증은 완료했다. 돛 표현과 공중 경로는 후속 단위로 분리한다.
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

- T03A-1 구현 에이전트가 최초 크레딧 오류 후 9/12 재개에서 파일 저장·검사에 성공했다. 과거 오류를 현재 차단으로 간주하지 않는다.

- 설치 Three.js0.183.2/esbuild0.27.7 사용, 추가 패키지 없이 빌드한다.
- 창작 에이전트가 간헐적으로 workspace out of credits 오류를 냈지만 재개 후 모델/동작을 저장했다.
  과거 오류를 지속 차단으로 가정하지 않는다. 재발 시 정확한 실패와 저장 경계를 기록한다.
- 실제 모바일 성능·게임 완주·배포는 미검증. 외부 공개는 T09의 별도 승인 단계다.
- 서버는 꺼질 수 있다. HTTP200 확인 후 QA:
  `python3 -m http.server 8768 --bind 127.0.0.1 --directory docs/specs/2026-09-10-skybound`.
- PC 이동: `http://127.0.0.1:8768/implementation/t02b/traversal/index.html` — 시작 후 WASD/Shift/Space.
- 캐릭터 스튜디오: `http://127.0.0.1:8768/implementation/t02b/character/index.html`.
- Chrome은 `CLAUDE_SCRATCHPAD=/private/tmp/skybound-validation`의
  `scripts/cdp-chrome.sh start skybound-prop --gl`(9403)만 사용하고 검사 후 stop한다.
  사용자/MCP Chrome을 종료하지 않는다. 이번 전용 프로필은 종료 완료.
