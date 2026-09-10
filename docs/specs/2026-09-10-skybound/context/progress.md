# 이어받기 · 2026-09-10

## 현재

- **T02B-2 텍스처 경로 검증 완료. 다음 T02B-3 주인공 모델. 캐릭터 연결 전.**
- `implementation/t02b/texture-check/`에 1K PNG(24,764 bytes), 내장 GLB(27,892 bytes), 원본/빌드 저장.
  실제 Chrome 152 이미지 디코딩·UV·sRGB·리깅 검사 12/12, 런타임 오류 0.
  `verifications/t02b-2-browser.json`에 원시 증거. GPU 렌더/최종 아트/실기기는 미검증.
- 사용자 잔여 한도 15% 지시에 따라 `planning/t02b-small-steps.md`로 T02B를 4개 소단위로 나눴다.
- `implementation/t02b/rig-check/`에 재현 소스·GLB(2,604 bytes)·테스트·README 저장.
  표준 Three.js exporter/loader의 뼈대·가중치·애니메이션 왕복과 CPU 정점 변형, tests 4/4 직접 재검증.
  진단 메시이며 실제 주인공/텍스처/GPU 렌더 검증이 아니다.
- 저장 위치: `/Users/gideok-kwon/IdeaProjects/msa/docs/specs/2026-09-10-skybound/`.
- 클린룸 폴더 `/private/tmp/skybound-cleanroom/`와 빈 `src/`만 생성했다.
  이 임시 폴더가 없어져도 잃는 구현은 없다. 중요한 결과는 전부 위 문서 폴더에 있다.
- 원화 2장은 `assets/`에 보존. 재생성에는 이미지 생성 호출 2회가 필요하므로
  기존 PNG와 manifest의 프롬프트를 사용하고 불필요하게 다시 생성하지 않는다.
- 실험 소스/GLB/뷰어: `implementation/t01a/`. 재생성은 build.mjs 1회(이번 실행 약 1초 이내).
- 브라우저 원시 결과/캡처: `verifications/t01a-*`. 테스트 5개 통과, 3화면비 실제 GLB 로드.
- 현재 장면: `implementation/t01b/`; 빌드 약 1초 이내, 환경 기하/카메라 테스트 9/9.
- 이동 규칙: `implementation/t02a/`; 테스트 11/11, 약 1초 이내 재실행.
- 최신 화면과 복구 로그: `verifications/t01c-*`; 브라우저 행동 12/12, 3화면비 오류 없음.
- P0 로컬 커밋: `a4750b05`. 병행 세션의 `a2baf0e8`에 T01A 초기 파일이 먼저 포함됐다.
  이 커밋을 되돌리지 않는다. 이후 수정/검증/인계는 본 작업 경로만 별도 커밋한다.
- 사용자 의도: 왕국의 눈물 같은 웹 오픈월드, 기존 게임의 제약을 계승하지 않는
  클린룸 창작, PRD·디자인 먼저, 작은 단계로 나누어 토큰 소모 관리.
- 후속 지시 “순차로 진행해”에 따라 T01B를 새 에이전트 `/root/skybound_t01b`로 재개했다.
  각 단위의 검증/커밋 후 다음 단위로 이어간다. 실행 경계는 tasks.md를 따른다.

## 다음 작업

**T02B-3: 원화 기준 주인공 모델 제작을 작은 단위로 진행·기록·커밋.**

- `planning/t02b-small-steps.md`와 `implementation/t02b/rig-check/README.md`부터 읽는다.
- `implementation/t02b/texture-check/README.md`를 읽는다. Q05 기술 경로는 검증 완료.
- 기존 캐릭터 원화와 art-direction의 8~15k triangles/1K atlas/LOD 목표를 기준으로 제작한다.
- 원본 기하·UV·뼈대 정의와 Canvas 아틀라스 → 표준 GLTFExporter → GLTFLoader 경로를 사용한다.
  진단 스트립을 캐릭터로 대체하지 않는다. 품질 미달 시 도구/제작 방식을 재검토한다.
- 리깅 실험은 반복 제작하지 않는다. 다음 모델 제작·동작 연결은 각각 별도 소단위다.

이후 T02B 전체 연결 계약:

1. README → tasks의 T02B → T02A README → art-direction/캐릭터 원화를 읽는다.
2. 새 창작 세션/에이전트에 그 자료만 전달한다. 다른 게임 소스/문서/아트 금지.
3. 작업 위치는 독립 디렉터리, 최종 통합 위치는 `portal-fe/public/games/skybound/`.
4. Three.js/esbuild의 설치 의존성 사용은 가능하다. 먼저 재현 가능한 빌드 경로를 만든다.
5. Q05(캐릭터 리깅/텍스처 제작 경로)를 먼저 검증하고 모델을 제작한다.
   제한된 정적 T01A exporter를 리깅에 확장하지 않는다. 단순 블록 캐릭터로 원화 기준을 낮추지 않는다.
6. 이동 스냅샷으로 발 위치/애니메이션을 연결하고 검증·다음 입력을 기록한다.
   원화 품질이 아직 미통과인 상태를 명시하고 월드 콘텐츠 확장은 보류한다.

## 금지/주의

- 다른 게임의 품질을 목표나 상한으로 삼지 않는다.
- 원화/PRD 완료를 게임 완료로 표현하지 않는다. 원화는 실제 플레이 화면이 아니다.
- 아직 없는 build/test 명령을 통과했다고 쓰지 않는다.
- 실제 모바일 기기 미검증을 에뮬레이션으로 대체해 통과 처리하지 않는다.
- 사용자의 다른 작업은 건드리지 않는다. 현재 변경은 이 문서 폴더만 소유한다.

## 검증과 막힌 것

- T02B-1 첫 독립 에이전트 실행은 workspace out of credits 오류였다.
  사용자 재개 요청 후 같은 소단위를 재시도해 성공했다. 현재 지속 차단은 아니다.
- 이번 재개에서 T02A 회귀 테스트도 `pass 11 / fail 0` 재확인했다.
- P0 파일/링크/이미지 및 설계 리뷰 결과는 `verifications/p0.md`에 기록한다.
- 검증 결과: 상대 링크 18개 오류 0, PNG 2개 CRC/크기 정상, 독립 설계 리뷰 SHIP.
- T01A: build 성공, node:test `pass 5 / fail 0`; 실제 GLB 브라우저 로드와 색상 캡처 완료.
- T01B/T01C: build 성공, tests `pass 9 / fail 0`; camera behavior `pass 12 / fail 0`.
- T02A: `pass 11 / fail 0`. 실제 지형 삼각형을 어댑터로 받아 접지한다.
- 재발 방지: 수면은 렌더와 같은 -18, 높은 단차는 이전 x/z로 이동을 거부한다.
  실제 캐릭터 캡슐·소품·벽·카메라 충돌은 아직 없다.
- 로컬 서버는 세션 종료로 꺼질 수 있다. HTTP 200 확인 후 브라우저 QA를 실행한다.
  실행법: `python3 -m http.server 8768 --bind 127.0.0.1 --directory docs/specs/2026-09-10-skybound`.
- 브라우저 MCP 프로필이 사용 중이면 사용자/MCP 브라우저를 종료하지 않는다.
  `scripts/cdp-chrome.sh`로만 격리 검증한다. 검증 후 전용 skybound-prop 프로필은 정리했다.
