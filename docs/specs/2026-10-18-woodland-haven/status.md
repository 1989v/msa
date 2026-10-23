<!-- source: portal-fe/public/games/woodland-haven/model.mjs -->
<!-- source: portal-fe/public/games/woodland-haven/art.mjs -->
<!-- source: portal-fe/public/games/woodland-haven/harvest-animation.mjs -->
<!-- source: portal-fe/public/games/woodland-haven/life.mjs -->
<!-- source: portal-fe/public/games/woodland-haven/life-ui.mjs -->
# 검증 기록 — 2026-10-18

## 2026-10-19 동물·크기 조절 사육장 최종 검증
- Chrome preconnect로 발견한 종료 대기 문제도 보완했다. 마지막 전체 Node는 `# tests 180`, `# pass 180`, `# fail 0`, 74740.16025ms. 유휴연결/미완성 요청의 제한시간 종료, 정상 응답 및 저장 보존, 잠금 해제/재시작 독립 검증 SHIP. 서버 전용 후속 수정은 구문·전체 Node로 검증했으며 이전 프런트 빌드 결과는 유지된다.
- 이후 사용자가 건축·다층·사육 Chrome 검증을 명시 승인했다. 전용8350/시크릿 창에서 하단 건축→집짓기→부품,2×2바닥,북·동 벽과R회전,문,2층 지지 바닥·계단 설치를 실제 확인했다. 테스트 자원/공터만 seed했다. 걷기는 도구의 순간 keydown/up으로 이동 입력이 유지되지 않아 확인하지 못했다. 계단 왕복·창문/가구 성공 설치·포획·사육장·새로고침 복원은 다른 게임으로 Chrome 활성창이 전환되어 입력을 중지한 시점에 아직 미검증이다. 재개 여부 사용자 응답 대기.
- 최종 실제 저장 기동에서 발견한 legacy 보관함 필드 이행 누락은 `b75547e0`으로 수정했다. 관련26/26, 실제 백업 읽기 전용 파싱/왕복 및 기존 물품·위치 보존, 독립 리뷰 SHIP. 수정 후 기존 데이터로8349 새 서버 기동 성공. 게시 복사본은 원본과 woodland Git tree hash가 동일하다.
- 닭 보존과 토끼16·양16 추가, 종별 포획/가방/먹이/생산물, 개인v6·공유record v2 이행, 사육장 두 모서리 선택/문/확장·축소/기존 시설 전환을 구현했다.
- 최종 전체 Node: `# tests 175`, `# pass 175`, `# fail 0`, 69611.988125ms. 최신 큰 사육장 렌더 경계+DOM 보완21/21. 신규 실제 HTTP 종별 포획·경합·사육장 변경·재시작2/2, 최대 월드 저장6/6, 집중 DOM/domain23/23.
- `tsc -b` exit0, Vite `built in 1m 34s`. 모델/저장/서버 및 UI/art/OpenAPI 독립 리뷰 모두 SHIP. malformed species, 현행 필수 필드 누락, pen 지상 좌표, 종별 수거,320크기 화면 경계를 회귀로 고정했다.
- 공개 배포/PvP/운영 서버 전환은 이 변경에 포함하지 않는다. 루트 Doctor는 기존 무관 문서 인용 누락을 FAIL로 보고하므로 전체 저장소 harness 통과를 주장하지 않는다.

## 2026-10-19 건축 재설계 1단계
- 게임 커밋 `6ec0c223`: 하단 건축의 분류→부품 흐름, 바닥 가장자리 벽/문/창문, R 변 선택, 자유 울타리 연결, 기존 완성 건물 보존 및 신규 생성 차단, C 제작 분리.
- 전체 Node 결과: `# tests 146`, `# pass 146`, `# fail 0`, 64972.066375ms. `tsc -b` exit0, Vite `built in 2m 28s`. 독립 리뷰 SHIP 및 네 울타리 회귀 최소 재현 PASS.
- 기존 울타리 임의 좌표/반경 보존, 실제2×2방의 모서리·문 출입·공유변 중복·저장 배열 순서·HTTP 재시작을 포함한다. 실제 브라우저 검증은 아직 실행하지 않았다.

## 2026-10-19 실제 다층 주택
- 게임 커밋 `70788f6d`: 지지 바닥, 1~3층과 실제 계단 왕복, 층별 이동/배치/상호작용/투영, 상층 침대 귀환, 개인 저장v5 및 기존 기록1층 이행.
- 전체 Node: `# tests 159`, `# pass 159`, `# fail 0`, 68.30초. 전체 실행 이후 추가된3층 사례 포함 levels11/11, 최종 DOM8/8, HTTP 계단·앵커·문 및 재시작3/3. `tsc -b` exit0, Vite `built in 2m 10s`. 독립 리뷰 SHIP.
- 상층 보관함 지지, 상층 legacy 앵커 거부, 오프라인 지상 행동 차단, 상층 계단 렌더 누락을 리뷰로 수정했다. 실제 브라우저 사용 승인은 응답 대기이며 UI 실행은 없었다.

## 맨손 보정 및 도끼 장착

- 펀치 팔꿈치 잠김/상체 반동을 줄이고 도끼 장착·대기·이동·공격을 연결했다. 대기와 공격 양 끝의 손/자루 자세를 일치시켰다. C 도구 창에서 장착/해제하며 도끼 공격은 허공 포함 내구도1, 파손 시 자동 해제한다. 마지막 공격은 도끼 스냅샷으로 마친다.
- 개인 장착 저장, legacy 기본값, 잘못된/파손 장착 거부, HTTP 명령 중복·쿨다운·재시작 복원을 검증했다. 구현자 전체 Node suite: tests98/pass98/fail0(57.9s). 이후 끝점 연결 보정은 집중 테스트로 확인했다.
- 부모 재검증: `node --test portal-fe/public/games/woodland-haven/tests/equipment.test.mjs portal-fe/public/games/woodland-haven/tests/combat-animation.test.mjs portal-fe/public/games/woodland-haven/tests/ground-pickup.test.mjs` → tests13/pass13/fail0, duration685.398875ms. 독립 리뷰 최종 SHIP. 구문/diff 검사 통과.
- portal `npm run build` exit0: `tsc -b`, Vite(`built in 1m 28s`), SEO/HTML 후처리까지 성공. 기존 chunk/plugin 경고. 로컬 공유 서버8349는 기존 데이터로 재시작, 모션 모듈 HTTP200 확인. 게임 커밋 `5951ce3e`(11파일), 루트 서브모듈 포인터는 타 작업과 공유 중이므로 변경하지 않았다.
- Chrome의 실제 모션 확인은 별도 승인 요청 중이며 아직 실행하지 않았다. 코드/좌표/DOM 회귀 검증을 실제 화면의 자연스러움 확인으로 간주하지 않는다.

## 구현 에이전트 명령 증거

- `node --test portal-fe/public/games/woodland-haven/tests/model.test.mjs` → `# tests 13`, `# pass 13`, `# fail 0`.
- `node --check` — `model.mjs`, `art.mjs`, `game.mjs`, `palette.mjs` 각각 exit 0.
- `git -C portal-fe/public/games diff --check -- woodland-haven` → exit 0.
- 정적 HTTP 확인: `/games/woodland-haven/`와 `/games/woodland-haven/game.mjs` → `HTTP/1.0 200 OK`, 각각 `text/html`, `text/javascript`.
- 최초 `npm run build` (portal-fe): exit 0. TypeScript 통과, Vite `2912 modules transformed`, `✓ built in 43.77s`. SEO `[seo] 프리렌더 184개 페이지 · 게임 82종`, `[html] 주석 제거 6856개 파일`. 기존 SearchPage 500 kB 초과 경고 있음.

## 승인 확장 검증

- `node --test portal-fe/public/games/woodland-haven/tests/*.test.mjs` → `# tests 24`, `# pass 24`, `# fail 0`, `# duration_ms 88.606875`. 부모 재실행도 pass24/fail0.
- 확장 후 네 `.mjs`의 `node --check` 모두 exit 0.
- `npx tsc -b && npx vite build` (portal-fe) → exit 0, `2912 modules transformed`, `✓ built in 28.30s`. SEO 후처리는 반복하지 않음. 기존 번들 크기/플러그인 시간 경고만 있음.
- 원래 자원 206개 보존, 새 영역에 673개 추가(총 879개). 원래 노드 JSON SHA256: `190077fa3e10f0d59a30c58532ce2ed9efda9b67d52b8089dbf8c15bfcfd5284`.
- 확장 리뷰의 보물 앞 보관함 R 가림 문제: 랜드마크 건축 금지 구역 및 획득 후 보물 상호작용 제외, 회귀 테스트 추가. Fresh-context reviewer SHIP.
- 확장 UI 승인은 미확인 상태. 확장 지역 렌더·브라우저 전투/보관함/지도·새로고침의 직접 동작 확인은 하지 않았고 부모에게 인계했다. 모델 테스트는 이 기능들의 상태 변화를 확인한다.

## 리뷰 수정

- 손상된 저장의 건축물 kind가 객체일 때 TypeError가 발생하던 문제: string/own-key 확인 추가, 회귀 사례 검증.
- 건축 선택 버튼에 초점이 남아 Enter가 선택 취소로 작동하던 문제: 건축 모드 진입 시 canvas에 초점 이동.
- 부모 세션이 승인된 Chrome UI 범위에서 그래픽 렌더 확인. 세부 입력/복원 검증은 부모 기록을 따른다.

구현 에이전트는 UI 도구를 호출하지 않았다. 터치 실기기·저장 공간 차단의 실제 브라우저 오류 주입은 미검증. 목표 플레이 시간은 실측하지 않았다. 모델 테스트는 저장 손상/상태 복원·이동·채집·비용/충돌·목표·허기·건축 제한과 전투/캠프/입출고/탐험/일회성 보물을 확인한다.

## 작업 경계

게임 파일은 `portal-fe/public/games` 서브모듈 내 새 `woodland-haven/`에 있다. 문서는 MSA 본체의 이 spec 디렉터리다. 공유 레지스트리, 기존 게임, 서비스/백엔드, 루트 스테이지는 수정하지 않았다. 부모 후속 지시로 게임 디렉터리만 서브모듈 내부에서 커밋하며 루트 문서/포인터는 부모가 관리한다.

게임 전용 커밋: `3bb6e6f4` (`feat: add Woodland Haven survival and adventure sample`), 새 파일 9개, 서브모듈 작업 트리 clean. 기존 서브모듈 브랜치에서 커밋했으며 푸시하지 않았다. core.hooksPath 미설정, hooks에는 sample만 있어서 실행할 활성 pre-commit 훅은 없었다. 훅 우회 플래그는 사용하지 않았다.

## 지도 안개 검증

- `node --test portal-fe/public/games/woodland-haven/tests/*.test.mjs` → `# tests 32`, `# pass 32`, `# fail 0`, `# duration_ms 85.658417`.
- 기존 네 `.mjs` 및 새 `tests/exploration.test.mjs`의 `node --check` 모두 exit 0. 게임 디렉터리 `git diff --check` exit 0.
- 탐험 누적/저장 복원, v1/v2 구기록의 현재 위치·캠프만 공개, 잘못된 격자 거부, 경계 인덱스, 장소 발견과 탐험의 이중 조건 검증.
- 두 지도 렌더 함수를 기록용 Canvas context로 실행해 첫 불투명 fog 채움, 지형/마커/이름 클립, 미발견 이름 미출력을 검사했다. 브라우저/실제 픽셀 검증은 아니다.
- 지도 안개 요청의 UI 사용 승인은 없으므로 브라우저 조작·스크린샷은 하지 않았다.
- `npx tsc -b && npx vite build` → exit 0, `2912 modules transformed`, `✓ built in 29.72s`. 기존 번들 크기/플러그인 시간 경고만 있음. SEO 미실행.
- Fresh reviewer SHIP. 부모 재실행도 `tests 32`, `pass 32`, `fail 0` (199ms).
- 지도 안개 게임 전용 커밋 `f59d96ea` (7파일). 동시 작업자의 territory-lab 변경은 보존했으며 루트 스테이지/커밋/푸시는 하지 않았다.

## 채집 모션 검증

- `node --test portal-fe/public/games/woodland-haven/tests/*.test.mjs` → `# tests 36`, `# pass 36`, `# fail 0`, `# duration_ms 86.469625`. 부모 재실행도 pass36/fail0(96.91775ms).
- `harvest-animation.mjs`, `art.mjs`, `game.mjs`, 새 모션 테스트의 `node --check` exit 0. 게임 디렉터리 `git diff --check` exit 0.
- 실패 결과의 모션 거부, 마지막 소진 대상 스냅샷/피드백, 이동 유지, 네 방향 정렬, 준비·타격·회수/대기 전 종료, reduced-motion의 고정 자세/흔들림·파편 없음 검증.
- Fresh reviewer SHIP. 카메라/채집 모델/대기 시간/저장 스키마는 수정하지 않았다.
- 새 브라우저 사용 승인이 없어 실제 동작·픽셀/체감 확인은 하지 않았다. 수치/그리기 호출 검증과 시각 검증을 구분한다.
- `npx tsc -b && npx vite build` → exit 0, `2912 modules transformed`, `✓ built in 30.83s`. 기존 번들/플러그인 경고만 있음. SEO 미실행.
- 게임 전용 커밋 `cb9478db` (5파일). 루트 문서/포인터/스테이지는 부모에게 인계하며 푸시하지 않았다.

## 채집 방향/시선 수정 검증

- 수정 전 새 회귀 테스트 5개가 모두 실패(`tests 5`, `pass 0`, `fail 5`). 실제 drawPlayer 기록에서 우측/정면 호출 동일, 준비 도구 끝의 y변위 동쪽-35px/서쪽+28px, 최초 충격 효과 시 도구-대상 각도차66°를 재현했다. 코드 추적에서 마지막 타격 앵커18px 차이, 이동 시 조준 미갱신을 확인했다.
- 수정 후 `node --test portal-fe/public/games/woodland-haven/tests/*.test.mjs` → `# tests 43`, `# pass 43`, `# fail 0`, `# duration_ms 88.486083`. 부모 재실행도 pass43/fail0(88.704792ms).
- 두 방향 준비의 위쪽 궤적, 투영 대각선 시선, 동적 방향 전환, 정면/등/반전 측면 구분, 8방향×3자원의 도구 끝/효과 접촉, 소진 전후 동일 앵커, 북쪽 도구 레이어를 검증한다. 이전 타이밍 테스트는 새150ms 접촉 계약으로 갱신했다.
- `geometry.mjs`, `harvest-animation.mjs`, `art.mjs`, `game.mjs`, 변경된 모션 테스트 두 개의 `node --check` exit0. 게임 디렉터리 `git diff --check` exit0.
- Fresh reviewer SHIP. 실제 브라우저 사용 승인 미응답으로 시각적 자연스러움은 검증하지 않았다. 로컬 Canvas raster 라이브러리 canvas/@napi-rs/canvas/skia-canvas가 없어 별도 설치/렌더 에뮬레이션을 하지 않았다.
- `npx tsc -b && npx vite build` → exit0, `2912 modules transformed`, `✓ built in 34.61s`. 기존 번들/플러그인 경고만 있음. SEO 미실행.
- 게임 전용 커밋 `89c1885d` (7파일). 서브모듈 작업 트리 clean, 루트 스테이지/커밋/포인터는 수정하지 않고 부모에게 인계. 푸시하지 않음.

## 생활/식물 관리 확장 검증

- `node --test portal-fe/public/games/woodland-haven/tests/*.test.mjs` → `# tests 59`, `# pass 59`, `# fail 0`, `# duration_ms 99.180458`. 직전58개 부모 재실행도 pass58/fail0(224ms). 추가1개는 작은 dt 산란90초 경계 회귀다.
- 모든 게임/테스트 `.mjs`의 `node --check` exit0. `git diff --check -- woodland-haven` exit0.
- 도구 초기 손 수집/제작/파손/수리 원자성, 재생 지연/식재 회수/성숙/재식재, 농사·음식, 포획 유일성/닭장 먹이/달걀 보존, 관리 속도/치료/주기/재접속, v1/v2→v3 및 손상 거부를 검증했다. 기존 전투/안개/시선 회귀 유지.
- 공간 조회는512그루 상태에서2,000회 제한 영역 질의를1,500ms 미만으로 검사한다. 최대 수량 형태(나무512·밭64·닭장4·보관함100·원래자원/탐험 전체)의 대표 저장 크기171,467자, 원문 제한240,000자. 크기 진단은 의도적으로 겹치는 배치의 형태 측정이며 합법적인 지형 배치 주장 아님.
- 기존 portal jsdom으로 모달 단위 진단: 재료 부족 제작 실패 문구가 모달 안에 표시되고 제작 버튼 초점을 유지함을 확인했다. 실제 브라우저 검증과 구분한다.
- `npx tsc -b && npx vite build` exit0, `2912 modules transformed`, `✓ built in 43.43s`. 이후 공개 정적 life.mjs의 산란 경계1줄 수정은59개 회귀 및 구문 검사로 재확인한다. SEO 미실행, 기존 번들 크기/플러그인 시간 경고만 있음.
- 최신 산란 경계 수정을 포함해 `npx vite build` 재실행 exit0, `✓ built in 27.52s`. 부모 UI 피드백의 안내 문구는 이후 수정했다.
- Fresh reviewer SHIP. 어린 나무 반경 증가로 갇힘, 캠프 이동 후 유효 저장 거부, crop 성공 결과의 node 없음, 손 수집의 가짜 도구 동작 문제를 통합 중 수정했다.
- 부모가 승인된 격리 origin8348에서 C 창·물품/도구·야생닭/수집물 렌더, 가지/돌/풀 실제 E 수집을 확인했다. 부족 제작의 모달 피드백 누락은 발견 후 수정했다. 키보드 불확실성/일시적 회색 화면은 공유 Chrome 간섭/페인트 상황이 겹쳤으며 원인을 IME/게임 오류로 확정하지 않았다. 구현 에이전트는 UI 도구를 호출하지 않았다. 이후 전체 제작/성장/포획/산란/재접속의 브라우저 직접 검증 상태는 부모 최종 기록을 따른다.
- 추가 부모 실제 UI 확인: 손 수집→도끼24 제작→나무3회 채집 후 도끼21/묘목1, 괭이32 제작, 묘목 식재, R관리 창의 건조.60배(수분32)→물100/건강1.50배, 물주기 전후 성장23% 유지. 모달 내부 결과 문구 표시 확인. 농사/병충해/포획/산란/재접속은 계속 검증 중이다.
- 추가 부모 실제 UI 확인: 나무 성장89%/수분22/병충해 상태의.30배에서 병충해 제거 후 같은89%/.60배, 물주기 후1.50배로 전환. 밭 생성 시 괭이32→31, 파종0%→물주기 후20% 성장, 포획망12 제작을 확인했다. 작물 수확/저장 복원은 계속 확인 중이며 동물 포획부터 산란까지 전체 UI 순환은 아직 확인하지 않았다.
- 최종 부모 재실행: `node --test portal-fe/public/games/woodland-haven/tests/*.test.mjs` → `tests 59`, `pass 59`, `fail 0`, `duration_ms 106.577208`.
- 최종 부모 실제 UI: 물 준 작물0→20→100%, 성숙 작물의 병충해 제거 후.30→.60배, 수확 곡물3/씨앗2 획득. 새로고침 후 곡물3/씨앗4, 도끼20/24·괭이31/32·포획망12/12와 빈 밭 복원 확인. 식재 나무 성숙도 시각 확인했다. 닭 포획→닭장→먹이→산란 전체 순환과 도구 수리는 모델 테스트로 검증했으며 브라우저 전체 순환은 미실행이다. 승인 UI 검증은 완료했고 C도구 창을 열어 게임 시간을 멈춘 상태로 종료했다.
- 게임 전용 커밋 `958bcf52` (`feat: add Woodland Haven crafting farming and animal care`),16파일. 루트 문서/포인터/스테이지는 수정하지 않고 부모에게 인계하며 푸시하지 않았다.

## 바닥 줍기 자세 수정

- 가지/작은 돌/풀만 별도 줍기 자세로 분리했다. 무릎을 굽히고 머리를 낮추며 두 마디 팔 길이는 대상 거리와 무관하다. 허리 하단은 -7, 발 윗면은 -3을 유지해 상체가 무릎/발을 덮지 않는다. 머리 크기와 발 위치를 유지한다.
- 부모 검증: `node --test portal-fe/public/games/woodland-haven/tests/harvest-animation.test.mjs portal-fe/public/games/woodland-haven/tests/harvest-direction.test.mjs portal-fe/public/games/woodland-haven/tests/ground-pickup.test.mjs` → `tests14/pass14/fail0`, duration65.898792ms. 도구/열매 경로와 150ms 접촉·300ms 종료를 유지한다.
- 구현자 구문 검사/diff-check exit0. `npx tsc -b && npx vite build` exit0, built55.10s. 빌드가 진행되는 동안 허리 보정을 마쳤고 마지막 정적 JS 보정은 구문/집중 테스트로 재확인했다. 기존 chunk/plugin 경고만 있었다.
- 독립 리뷰에서 최초 상체가 발 아래까지 내려가는 오류를 발견해 허리 축을 고정한 뒤 SHIP. 브라우저 자연스러움은 새 컴퓨터 사용 승인이 없어 직접 검증하지 않았다. 서버·경제·저장 변경 없음.

## 공격 모션

- 420ms 준비/타격/회수의 4방향 맨손 동작. 7+7 길이 팔, 허리 축 회전, 전방 주먹 궤적. 가까운 살아 있는 적 방향을 비동기 명령 전 캡처하고, 성공한 빈 공격도 표현하며 실패 시 기존 동작을 보존한다. 채집과 공격은 마지막 성공한 동작만 표시한다.
- 부모 검증: `node --test portal-fe/public/games/woodland-haven/tests/combat-animation.test.mjs portal-fe/public/games/woodland-haven/tests/ground-pickup.test.mjs portal-fe/public/games/woodland-haven/tests/harvest-animation.test.mjs portal-fe/public/games/woodland-haven/tests/harvest-direction.test.mjs` → tests19/pass19/fail0, duration70.429792ms. 실제 핸들러 VM 검증 포함. 구현자의 추가 모델/모험 테스트24/pass24/fail0.
- 북쪽 준비/회수 팔이 머리 뒤에 가려진 문제를 독립 검토에서 수정, 어깨x9와 소매 연결/7시점 가시성 회귀 후 SHIP. reduced-motion은 고정 자세다. 실제 브라우저 조작은 미실행이며 사용자의 줍기 확인을 공격 UI 승인으로 간주하지 않았다.
- JS 구문/diff 검사 통과. `npx tsc -b && npx vite build` exit0, built1m11s. 북쪽 마지막 보정은 집중 테스트/구문으로 확인했다. 모델/서버 전투 판정 변경 없음. server.mjs는 새 정적 모듈 허용 항목만 추가했다.
- 검증용 로컬 서버8349를 같은 데이터 경로로 정상 종료/재시작했고 `GET /combat-animation.mjs` HTTP200 확인. UI 호출 없음. 다른 접속자의 공격 이벤트 동기화는 범위 밖이다.

## 열매 줍기·회전·바닥 재료 제외 (진행)

- 부모 집중 재검증: ground-pickup/build-rotation/camp-forage/build-input의 Node 테스트11/pass11/fail0, duration1004.8615ms. 열매 이동 중 짧은 팔, R/버튼/미리보기/설치 방향, 저장 호환, 재생/복원 뒤 제외를 검증했다. 독립 리뷰 SHIP.
- 실제 Chrome 조작은 새 승인이 없어 실행하지 않았다. 대형 월드와 주택/농사 확장은 이어지는 별도 단계다.
- 최종 구현자 전체 Node110/pass110/fail0(48.97s), `npx tsc -b && npx vite build` exit0/built2m27s. 기존 열매의 원거리 손길이 테스트를 새 고정팔 요구로 대체하되 도구 접촉/최종 소진 검증은 유지했다. 게임 커밋765e2166, 기존 데이터로8349 재시작.

## A 대형 월드 완료
- 게임f174e96e:32000×24000, WORLD75783/FORAGE29661, 옛879/84 ID·좌표·variant 해시보존. v4compactexploration과개인별1회이행, LRU20, 주변미니맵/전체지도캐시. 전체Node121/pass121/fail0(60.114s), tsc/Viteexit0(1m25s).
- 부모 `node --test .../large-world.test.mjs .../large-map.test.mjs .../exploration.test.mjs`16/pass16/fail0(4744.388ms). 독립리뷰의 큰SSEpayload와 모서리수목4921누락을 주변2304범위전송/4모서리회귀로 수정후SHIP.
- 실제HTTP:먼좌표건축저장·재시작, 이동으로범위이탈/복귀시소진상태보존·추가보상없음. partialsnapshot은resourceScope로표시하고parseSave거부. 서버전체record는보존.
- `/private/tmp/woodland-large-world-measure.json`:최대64기록3.36MB/parse약4.9s,8snapshot합1.10MB, 전체tick추산59ms(약17Hz). 이는로컬프로토타입최대상태측정이며공개운영SLA아님. 원자료로그`/private/tmp/woodland-stage-a-{node,vite}.log`.
- 기존QA데이터의v4전환전백업`/private/tmp/woodland-shared-world-qa-20261018/world.pre-v4.json`. 8349는f174e96e고정복사본으로재시작해B/C작업중프론트/서버불일치방지. 실제UI조작없음.

## B/C 주택·시설·농사 완료
- 부모집중 `node --test .../housing.test.mjs .../tilling.test.mjs .../build-input.test.mjs`14/pass14/fail0(688.235708ms). 레이어공존/얇은벽·문/영구사용자보호/단조ID/입출고보존/축사8/고정괭이모션/32스냅후58거리/연속농사모드/철거대상순환 확인.
- 독립리뷰의 창고열기/입출고거리불일치, null/상속키사육시설파싱, 축사UI4마리제한, 겹친철거층선택문제를 회귀와함께수정후최종SHIP.
- 실제HTTP신규3테스트통과 보고: 오프라인플레이어문닫힘보호, 철거환급재전송/ID/재시작, 축사건축비·8방사·9번째거부·비어있지않은철거보호, 밭스냅/거리/내구도재전송/재시작. 부모최종전체검증결과는완료후기록.
- 최종전체Node136/pass136/fail0(65.784s), `npx tsc -b && npx vite build`exit0/built2m27s, 독립SHIP, diffcheckclean. 게임4f6b8a13. 원자료`/private/tmp/woodland-bc-{node,vite}.log`, 성능`/private/tmp/woodland-bc-measure.json`.
- 실제최대1024보관품찬건물·512식재·256밭·16축사/24닭·120000fog·64게스트왕복통과. 개인2.283MB/기록3.578MB,8snapshot합2.854MB(개별357KB),parse5.06s,최대tick56.5ms. 용량확대가파서의복원거부나1MB SSE누적제한과충돌하지않음을검증했다.
- 최종8349는4f6b8a13고정복사본에서기존데이터로재기동, root→index.html?online=1 HTTP200 및structures/till-animation/exploration 모듈HTTP200. 이전기록백업world.pre-housing.json. 실제Chrome검증은미실행:별도8350테스트월드bundle명시승인요청미응답이며8350fixture서버는아직만들지않았다.

## 2026-10-23 — 공개 공유 월드 베타 검증

- 독립 보안/아키텍처 리뷰 SHIP. 이전 SSE 자격 폐기 실제 HTTP 검증: 이전 stream 종료/이전 cookie401/신규 cookie200.
- Node 전체186 tests:185 pass,0 fail,1 skip(Mac Linux전용); 별도 Linux컨테이너 운영6 tests:6 pass,0 fail,0 skip.
- 실제 별도 Node SIGTERM/SIGKILL 재시작, 파일 기록·쿠키·명령 영수증 중복방지 복원 통과. structured lock의 pid를 확인하도록 기존 기대값을 갱신했다.
- JVM Woodland service1+MockMvc bridge3:4 pass,0 failures/errors. gateway compileKotlin+verifyArchitecture BUILD SUCCESSFUL(39 tasks,1m25s); controller추가후 BUILD SUCCESSFUL(27 tasks,44s).
- npm run build: render-content/tsc-b/Vite/SEO/HTML후처리 exit0. 게임 코드 자체는 Node 검증; 브라우저/UI검증은 수행하지 않음.
- Docker 이미지 build 성공. read-only root+tmpfs /data+UID1000 운영실행 readiness200.
- Postman CLI1.74 simulation actualHTTP bridge200, 동일 ticket재사용401. 공개 workspace에 게시하지 않음.
- 실제 운영 adapter:64 영구프로필/8 동시 join batch19.28ms(다른 Linux실행29.1ms), 추가접속/등록409. 최대규모 fixture:64 record3,630,949bytes, parse3.83s,8snapshot3,250,744bytes, 추정 전체tick61.22ms. 50ms보다 느릴 수 있으며 시간을 소급하지 않는 기존 계약 유지.
- OCI overlay render 성공:woodland replicas1/Recreate(전역RollingUpdate 뒤 재적용), RWO PVC, 비root/readOnlyRootFS, requiredsecret, 외부백업egress.
- 개인OCI SSH node/msa 및 기존portal-fe/content Ready확인, woodland-bridge 랜덤secret 생성 완료(값 미출력). mainpush/실서비스 검증은 아래 배포 기록에서 구분한다.


## 2026-10-23 — 공유 월드 운영 배포 완료 (05:01 UTC)

플레이 주소: https://game.1989v.com/games/woodland-haven/index.html

- games main `7014ec741230868b6e9d2142acca86b7b15f812c` (기존 main과 기능 브랜치를 모두 보존).
- MSA 기능 통합 `72a9fd7d6`, CI/라우트 검증 보정 포함 `c05c2cd36`, 운영 포트 설정 수정 `5f6159a1a`, 이미지 commit-back 병합 `6e386423b`. 병행 PWA·카페 변경과 이미지 태그를 보존했고 force push/훅 우회는 하지 않았다.
- [전체 CI 성공](https://github.com/1989v/msa/actions/runs/39900777171): Linux Woodland186 tests/186 pass/0 fail/0 skipped, 이미지 빌드 포함; FE 및 JVM compile·구조·YAML·Kustomize 게이트 성공.
- [명시한4서비스 이미지 배포 성공](https://github.com/1989v/msa/actions/runs/39900790043): content/gateway/portal-fe/woodland, 태그 `c05c2cd`. JVM 서비스 전체 테스트 성공(7.8분). 이미지 태그 commit-back `4c33148f2df12061660f6a580c261a8328fdc169`.
- 운영4 Deployment 모두 Ready1. 이미지 `ap-chuncheon-1.ocir.io/axyooxbyk5yv/{content,gateway,portal-fe,woodland}:c05c2cd`.
- 공개 HTML200; game.mjs200 + text/javascript + games7014ec74 원문 hash 일치. 실제 gateway 경유 플랫폼 게스트 프로필2개 → 티켓/Node join200 → 서로 다른 영구ID. 동시 SSE2개 모두 상대 플레이어1명 전달. 실제 harvest 성공, 개인 명령 순번1→2.
- 운영 보안 확인: 세션 없이 위조 X-User-Id를 붙인 state401, 유효 게스트 쿠키와 잘못된 회원 Bearer를 함께 보낸 tickets401, 다른 Origin403. 세션 쿠키 Secure/HttpOnly/host-only/Path=/api/v1/games/woodland 확인(값 기록하지 않음).
- Node만 한 차례 정상 재기동(월드 초기화 없음) 후 이전 세션401. 새 플랫폼 접속권으로 같은2개 영구ID 재접속, 다음 명령 순번2/1 및 돌2/0 복원. 공개 state200에서 서로 확인.
- 실제 Job `woodland-backup-smoke-20261023` Succeeded1. OCI `msa-db-backup`의 `woodland/woodland-2026-10-23T04-58-16-713Z.json.gz`에 Content-MD5 업로드 성공. 운영자 OCI 인증으로 다운로드 후 별도의 빈 디렉터리 복원에서2프로필 UUID 연결·순번·돌2개를 검증했다. 운영 PVC나 기존 로컬 QA 기록을 덮어쓰지 않았다.
- Argo Synced/operation Succeeded. Application 전체 health는2026-10-04부터 기존 Degraded 상태이며 개별 Degraded resource 목록은 비어 있었다. 이 배포4서비스 Ready와 구분한다.

기동 중 확인한 설정 문제와 조치:
1. PVC WaitForFirstConsumer: 병행 main `80fd54d8d`가 PVC와 Node Deployment를 같은 wave5로 수정한 것을 보존해 Bound 확인.
2. Kubernetes 자동 서비스 환경변수 WOODLAND_PORT=tcp://...가 이미지 숫자 포트를 덮어써 첫 기동 실패. Pod enableServiceLinks=false와 명시 포트8349로 수정. 렌더에서 false/8349/Recreate 확인 후 실제 Ready 확인.
3. 이전 Argo sync가4c331에서 기다리며 최신 설정을 적용하지 못했다. `/operation` 제거만으로 종료되지 않은 것을 확인하고 status.operationState.phase=Terminating으로 정상 종료해 최신6e386 동기화가 진행됐다. watchdog 자체는 이번 범위에서 수정하지 않았다.

제한: 동시8명/등록64프로필의 단일 협동 베타. 로컬 백업7일, 오프노드 기본 무기한(별도 prefix lifecycle 후속). 브라우저·화면·계단/사육 조작의 UI 검증은 이번 배포에서 실행하지 않았다. 접속/규칙/저장/복구 HTTP 검증과 구분한다. QA 쿠키·게스트 자격·운영 비밀은 문서나 저장소에 올리지 않았다.
