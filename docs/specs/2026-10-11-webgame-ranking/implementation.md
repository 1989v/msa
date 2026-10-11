# 게임 이용 안내 구현·검증
<!-- source: portal-fe/src/seo/gameGuide.mjs, portal-fe/src/pages/games/GamesPage.tsx, portal-fe/src/pages/games/GameDetailPanels.tsx, portal-fe/scripts/prerender-seo.mjs -->

## 구현

L2 콘텐츠 보완. 홈페이지의 기존 이용 안내 안에 Block Burst·Minefield·Rift의 다른 플레이 방식과 언어별 상세 링크를 추가했다. 대상 상세의 기존 소개 원문 뒤에 목표·조작법·첫 플레이 팁을 표시한다. 안내가 없는 게임의 소개는 유지한다.

`src/seo/gameGuide.mjs`가 한국어·영어 안내의 공통 원본이며 런타임과 프리렌더가 직접 가져온다. 홈페이지 메타·장르/태그/정렬·개인화·광고·플레이·평가·기록 컴포넌트 동작은 변경하지 않았다. 상세 초기 HTML도 소개 원문 → 안내 → 통계/평점 순서로 읽힌다. 기존 DESIGN.md arcade 토큰과 guide 타이포를 재사용했고 신규 색상·장식·카드 그리드는 추가하지 않았다.

## 실제 게임 근거

읽은 games 서브모듈 revision: `d1bbfa6a91bda9172113c22a8b506ffa7af08c27`. 인계된 `bf2c52436854a00b7d71c79c8e7a1f22824e870b`는 해당 서브모듈에서 tree object로 조회되지 않아 실제 HEAD를 명시했다. 원본 작업트리와 게임 본체는 수정하지 않았다.

2026-10-11 production GET 결과 세 게임 모두 소스와 동일했다. 차이는 공용 자산 URL의 `?v=915ca41`뿐이다. 해당 문자열 제거 후 바이트 일치와 SHA256을 [game-source-audit.json](evidence/game-source-audit.json)에 기록했다. 게임을 실제 플레이한 것으로 해석하지 않는다.

| 게임 소스(서브모듈 기준) | 안내의 근거 |
|---|---|
| `block-burst/index.html:97–98, 145–161, 311–337, 449–479` | 8×8 보드, 줄 제거, 배치 불가 종료, 드래그/터치 입력, 큰 조각, 여러 줄/연속 제거 점수. 빈 공간 확보는 큰 조각·배치 불가 종료 규칙에서 도출한 팁이다. |
| `mine-pioneer/index.html:76–80, 123–130, 219–264, 294–310, 418–481` | 안전한 칸 모두 열기, 목숨 3개/연속 돌파/퇴각, 클래식 초급 9×9, 클릭/탭/길게 누르기/우클릭/모드 버튼, 첫 칸 이후 판마다 스캔 한 번. |
| `rift-front/index.html:124–133, 899–938, 1358–1366, 1414–1421` | 수호탑 2기→적 첨탑, 방향키/WASD 이동, 자동 공격, Q/E 스킬, 터치 조작, 크립과 진격/레벨업/본진 회복. |

공개 원본: [Block Burst](https://game.1989v.com/games/block-burst/index.html), [Minefield](https://game.1989v.com/games/mine-pioneer/index.html), [Rift](https://game.1989v.com/games/rift-front/index.html).

## 검증 결과

작업 위치: `/Users/gideok-kwon/.codex/worktrees/8849/msa` (격리 워크트리). 시작 시 touch/delete로 쓰기 권한을 확인했다. hns:start 및 agent-behavior에 따라 승인된 L2 범위를 구현했다.

- `node scripts/render-content.mjs`: exit 0. tech 콘텐츠 및 편집 페이지 3장 생성.
- `npx tsc -b`: exit 0. 최종 테스트/프리렌더 순서 수정 후 다시 확인.
- `npx vite build`: exit 0, `✓ built in 690ms` (2,817 modules). 이후 변경은 프리렌더 순서·테스트·증거 문서뿐이다.
- 관련 Vitest 5파일: `Test Files 5 passed (5)` / `Tests 60 passed (60)`. 소개 안내 대상/비대상, ko/en 링크·문구, renderHub/renderDetail 직접 호출 초기 HTML, 읽기 순서, 기존 82종 메타/canonical, 상세 조회 루프/플레이 회귀를 포함한다. [실행 로그](evidence/implementation-tests.txt). 기존 상세 loop 테스트의 act/XHR stderr 경고는 남았으며 해당 4테스트도 통과했다.
- 변경 TS/TSX 테스트 포함 ESLint: exit 0. MJS 두 파일은 임시 ESLint 설정으로 `@eslint/js` recommended + Node globals 검사: exit 0. `node --check` 두 MJS: exit 0.
- `git diff --check`: exit 0.
- Chrome 390/1280 × 홈페이지 ko/en·세 상세 ko/en = 16화면. 가로 넘침 0, 안내 표시·언어별 링크 3개, 상세 플레이 버튼 존재(첫 화면 top 약536px/747px), 기존 소개·내 기록·평가 패널 확인. 홈페이지 API 완료 후 4표본 모두 82종/82 free 메타 확인. [browser-audit.json](evidence/browser-audit.json), 같은 폴더의 16 PNG. 모바일 Rift/데스크톱 홈페이지 이미지도 눈으로 확인했다. Runtime exception 0.

브라우저 검증은 신규 Vite 빌드 번들을 로컬 `game.localhost:5189`에서 실행하고, 읽기 전용 production GET API 응답을 CDP로 공급했다. 이미지 파일은 원본 public 디렉토리에서 읽었다. 운영 배포 화면 검증이나 실제 게임 플레이 검증은 아니다. 플레이 클릭/세션 쓰기는 실행하지 않았다. 독립 Chrome 프로필(`/private/tmp/webgame-ranking-worker/scratchpad/cdp/ranking-worker`)은 `scripts/cdp-chrome.sh stop`으로 정리했다.

public/games 서브모듈이 격리 트리에서 초기화되지 않았고 관광지 전체 프리렌더는 이번 범위가 아니므로 `npm run build`의 전체 프리렌더 단계는 실행하지 않았다. 변경된 게임 렌더 함수는 회귀 테스트에서 직접 호출했다. 순위 달성·색인 증가를 이 검증으로 주장하지 않는다. push/배포/외부 게시 없음.
