# 게임 모바일 전체화면·인앱브라우저 안내 / 튜토리얼 접기

2026-10-05. 사용자 요청: 궁수 키우기 튜토리얼 감추기, 카카오톡에서 공유된 게임 링크로 플레이할 때 주소창·하단바가 남고 가로모드가 되지 않는 문제. 공통 게임에도 적용한다.

## 확인한 원인과 플랫폼 제약

구현 담당의 초기 코드 확인: portal 공통 플레이 화면은 `GameDetailPage.tsx`와 `useStageFit.ts`/`stageOrientation.ts`/`Games.css`를 사용한다. 전체화면 성공 후 방향 잠금을 요청하지만 오류를 숨기고 있었다. CSS 몰입 화면은 앱의 주소창·하단바를 제어하지 못한다. 직접 `/games/<slug>/index.html` 주소는 이 공통 화면을 거치지 않는다.

웹 근거:

- [MDN requestFullscreen](https://developer.mozilla.org/en-US/docs/Web/API/Element/requestFullscreen): 사용자 동작이 필요하고 브라우저 지원·권한에 따라 거절될 수 있다. 요청과 실제 진입을 구분한다.
- [MDN orientation.lock](https://developer.mozilla.org/en-US/docs/Web/API/ScreenOrientation/lock): 지원 여부와 보안 조건에 따라 실패할 수 있다. 전체화면과 화면 방향 잠금은 별도 결과다.
- [카카오 공식 게임웹뷰 SDK](https://gameplay-partners.kakao.com/api-sdk/sdk/kakaotalk-gameplay): 일반 인앱브라우저에는 주소창·헤더가 있고, 별도 전용 게임웹뷰는 없지만 게임플레이 파트너 도메인 등록이 필요하다. 일반 웹페이지가 이 조건 없이 게임웹뷰로 바뀐다고 보장하지 않는다. 문서에 없는 `kakaotalk://web/openExternal` 등 스킴에 의존하지 않는다.
- [Chrome Android intents](https://developer.chrome.com/docs/android/intents): 사용자가 누른 링크로 앱 열기를 시도할 수 있으며 처리 앱·브라우저 정책에 따라 실패한다. fallback과 수동 열기를 제공한다.

사용자 기기는 async 응답으로 Android폰이라고 확인했다. Android 카카오→Chrome 진입과 전체화면/명시 가로 요청을 주 검증 경로로 삼고, iOS에는 수동 메뉴/복사 안내를 제공한다. 실기기 카카오톡 재현을 했다고 주장하지 않는다.

## 승인 범위

### 튜토리얼

궁수 키우기 튜토리얼 내용만 ‘감추기 / 다시 보기’로 접는다. 버튼을 남기고 `aria-expanded`를 실제 상태와 맞춘다. 별도 UI localStorage 키로 선호를 유지하며 읽기/쓰기 차단 시에도 현재 세션에서 작동한다. 튜토리얼 진행·전투·정식 저장 상태를 바꾸지 않는다.

### 공통 플레이 화면

- 사용자가 누른 전체화면 동작에서 지원 API를 호출한다. native 전체화면 성공 여부와 방향 잠금 성공 여부를 구분해 안내한다. 실패해도 플레이를 막는 모달을 띄우지 않고 기존 몰입 레이아웃을 유지한다.
- 기존 가로/세로 메타데이터를 존중한다. 세로 전용 게임을 강제로 가로로 만들지 않는다. BOTH 게임은 자동 가로 강제를 하지 않되 사용자가 명시적으로 가로 버튼을 누르면 가로 잠금을 시도한다. 궁수 키우기의 BOTH 설정 때문에 기존 가로 버튼이 무효가 되는 회귀를 만들지 않는다. API가 없거나 거절되면 기기 회전·회전 잠금 해제 및 외부 브라우저 이용 방법을 안내한다.
- 카카오 일반 인앱 감지 시 작은 접이식 안내를 제공한다. iOS는 카카오 메뉴에서 외부 브라우저 열기 안내와 현재 링크 복사. Android는 사용자가 누른 ‘Chrome에서 열기’ intent 시도와 수동 메뉴/복사 대안. 성공을 미리 단정하지 않는다.
- 링크는 현재 origin/path/query/hash를 보존한다. URL 조합 시 intent 구문 주입을 막고 입력을 검증한다. 자동 외부 이동·앱 설치 유도·알 수 없는 URL 전달은 하지 않는다. 복사 실패는 수동 복사 가능한 주소와 상태로 처리한다.
- 일반 브라우저에는 불필요한 카카오 전용 안내를 표시하지 않는다. 방향 잠금은 이 화면이 요청한 경우에만 해제하고, 비동기 요청 도중 종료·회전한 경우도 상태가 어긋나지 않도록 한다.

### 직접 게임 HTML 링크

공통 SDK `lib/platform.js`를 사용하는 게임의 최상위 직접 실행에도 동일한 진입 도움을 제공한다. iframe 안에서는 부모 공통 안내와 중복하지 않는다. 외부 브라우저로 이동한 직접 HTML에 전체화면 진입 버튼이 없어지는 경우를 놓치지 않는다. 게임별 파일을 일괄 수정하지 않고 공통 SDK에서 해결하며 실제 지원 범위를 기록한다.

## 하지 않는 것

웹 코드로 카카오 앱 소유 주소창을 강제로 제거했다고 주장하지 않는다. CSS 90도 강제 회전으로 모든 게임의 터치 좌표를 바꾸지 않는다. 카카오 파트너 등록·전용 SDK 도입·네이티브 앱·DB 작업은 이번 범위가 아니다. 전투·치유 밸런스는 변경하지 않는다.

## 구현과 검증

단일 `gpt-6.1-sol` 구현 담당. 부모는 리서치·명세·결과 기록을 소유하고 동일 코드 탐색/검증을 중복하지 않는다. 최초 관련 분석을 재사용, 전체 수정 후 관련 검증1회와 실패 영향만 재검증. 튜토리얼의 이미 통과한 국소 검증은 변경 없으면 반복하지 않는다.

확인 항목: API 없음/거부/전체화면 성공+잠금 거부, 회전·종료 정리, 프레임 중복 방지, 일반 브라우저 미노출, iOS/Android 안내, URL query/hash 보존 및 복사 차단, 튜토리얼 상태·저장 차단, 대표 기존 게임 화면·FE 타입 검사. 코드/DOM 검증과 실기기 카카오톡 검증은 구분한다.

배포는 games의 궁수 키우기와 승인된 공통 SDK 변경, root의 관련 공통 FE 코드 및 gitlink만 격리 release에 포함한다. 다른 기여자의 변경과 원본 staged gitlink를 보존한다. 새 JS·CSS 캐시 주소와 공개 배포 파일을 확인한다.

## 구현·국소 검증 결과

단일gpt-6.1-sol 구현. 튜토리얼1(4storage조건)/SDK2/portal7=고유10건PASS, FE `tsc -b` PASS, Node문법·diff·내부23캐시참조정합PASS. 직접SDK는top-level모바일만접힘기본버튼을제공하고iframe에서는중복생성하지않는다. BOTH명시가로요청/portrait보존·fullscreen종료unlock·초대query/hash보존·복사거부대안검증. 로컬games e23b4030/root387540b7 정상hookscommit, 기존stagedgames15cf보존. SDK init을사용하지않는직접게임은공통SDK개선대상외다. Android/iPhone실기기카카오톡전환·픽셀미검증이며자동브라우저로우회하지않았다.

## 배포 완료

2026-10-05 games releasea45353da/roota7c053d4/manifestd038fd35, localgamese23b4030/localroot7393bff7. 최신remote-main의startFullscreen/roomquery/loadFailed변경을보존하며전체화면함수충돌만통합하고타입검사와BOTH클릭·종료정리영향1건재검증했다(독립fixture초기화실패수정후PASS). [CI37270562688](https://github.com/1989v/msa/actions/runs/37270562688) SUCCESS. PortalReady/Updated/Available1/이전replica0/ArgoSyncedSucceeded, 전체기존Degraded와별도.

공개31리소스HTTP/MIME·16JS(공유platform포함)정확해시·CSS원본·PNG11일치, GameDetailPage-F2fEpve9.js의도움말/Chromeintent마커확인. 다른게임neon-drifter직접HTML의PlatformAdapter.init과새공통SDKfingerprint확인. 모든게임수를전수조사하거나실기기전체화면성공을주장하지않는다. [공개 증거](verifications/beta-evidence.json) · [롤아웃 증거](verifications/beta-rollout.txt).

튜토리얼버튼은‘튜토리얼 감추기/튜토리얼 다시 보기’. 직접모바일SDK는safe-area아래중앙에기본접힌‘큰 화면 도움말’(카카오일때‘카카오 큰 화면 도움말’), ‘전체화면/Chrome에서 열기/현재 링크 복사’를제공한다. portal도움말은stage우상단기존컨트롤아래52px에접는형태이며실패안내가게임을중단하지않는다.

protocol13유지/querymobile-help-13, canonical저장·지도·전투변경없음. 기존rootstaged15cf와다른담당duel-defense변경미수정. Backend/DB변경없음. 브라우저를옮기면로그인/로컬저장환경이다를수있음을UI에안내한다. Android/iPhone실기기·intent실행·실제픽셀미검증.

공통 플레이 주소 검증 정정: 최초 `/marine-command`, `/neon-drifter`의 HTTP200은 SPA fallback이어서 상세 화면 매칭 증거가 아니었다. 실제 React `App.tsx`의 `/games/:slug`와 `seo/copy.mjs` 주소 생성 기준으로 `/games/marine-command`, `/games/neon-drifter`가 올바르다. 두 URL HTTP200을 다시 확인했고 앞선 결과는 evidence.previousFallbackRoutes에 정정 사유와 함께 남겼다. 실제 브라우저 화면 렌더 확인을 의미하지 않는다. [궁수 키우기 공통 플레이 화면](https://game.1989v.com/games/marine-command).
