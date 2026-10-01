# Implementation task handoff — 이번 세션 실행 금지
모든 항목은 미구현. 각 그룹이 끝나면 해당 검증 출력·시각 증거·리뷰를 남기고 커밋한다.
고정 세션 문서부터 읽고 작은 그룹 하나씩 구현. 전체 기능을 한 번에 생성하거나 옛tests를 그대로 통과 기준으로 쓰지 않는다.

## T0 — 참조/환경/기반 고정
**Dependencies:** none · **Phase:** preparation · **Required skills:** hns:start, agent-behavior
- [ ] 원본 전체 맵/참조 구간과 world.md 차이 검토. 자료부족은 사용자 확인; 임의 동일복제 주장 금지.
- [ ] 현재 git/서브모듈/dirty현황 확인하고 자기 변경만 작업. 최신 AGENTS 및 frontend/game 표준 읽기.
- [ ] 2인/수치/새아트의 제안 상태 확인. 새 결정을 key-decisions에 기록.
- [ ] 로컬 game API/WS/카탈로그·게스트/회원 이어하기 환경 확인.
- [ ] 위변경이 기존ADR범위 안인지 확인, DB스키마/통신 변경은 ADR검토 선행.
**Acceptance:** 지도충실도 범위·실행환경·대체할구현 목록 명확.

## T1 — 초반 경제/병력
**Dependencies:** T0 · **Phase:** simulation · **Required skills:** hns:implement-tasks
- [ ] 초기조건/처치골드/목수·활잡이·장궁수 고용/공방업/3기합성 행동 테스트6개 먼저.
- [ ] sim을 소유자별 roster/gold/upgrades와 단일 act 경계로 바꾸기.
- [ ] 옛 유료승급/환전/초기목수 코드를 제거하고 UI 호출목록 정리.
- [ ] Verify: 게임 폴더에서 `node --test tests/economy.test.mjs`.
**Acceptance:** 첫 목수는 처치 수입으로만 구매,3기합성 원자적,unit cap 준수.

## T2 — 고저차 맵/LOS/탐색
**Dependencies:** T0,T1 · **Phase:** world · **Required skills:** hns:implement-tasks
- [ ] 램프경로/절벽/숲시야/기억안개/조합시야/건설보호 테스트6개.
- [ ] data/world + navigation + visibility 모듈 분리,world.md 지역을 저작 데이터로 표현.
- [ ] Verify: `node --test tests/world.test.mjs`.
**Acceptance:** 원본비교동선과collision 일치,안개에적정보 누출0.

## T3 — 목수 채집/건설/주둔
**Dependencies:** T1,T2 · **Phase:** economy-defense · **Required skills:** hns:implement-tasks
- [ ] 왕복채집/운반/목수전환/건설중단/4주둔/탑파괴 테스트6개.
- [ ] 작업state machine,탑owner/occupants/진행도,입장예약·강제퇴각.
- [ ] Verify: `node --test tests/workers-towers.test.mjs`.
**Acceptance:** 빈탑공격0,짐/합성/퇴각 중복개체0.

## T4 — 적/웨이브/캠페인
**Dependencies:** T1,T2,T3 · **Phase:** content · **Required skills:** hns:implement-tasks
- [ ] 6캠프/방스폰cap/보스해금/웨이브/재로드보상/소프트락 테스트6개.
- [ ] 적6+보스3,스폰큐4종,던전3방×2,필드동시진행.
- [ ] Verify: `node --test tests/campaign.test.mjs` + `node tests/progression.mjs`.
**Acceptance:** 정상행동 완주,스탯직접주입0,최종보스 필수.

## T5 — 시각 slice와 전체아트
**Dependencies:** T2,T3, 디자인확인 · **Phase:** visual · **Required skills:** imagegen, frontend-design
- [ ] approved-tone/manifest로 활잡이·목수·지형·주둔탑 1구간 먼저 제작.
- [ ] browser에서 기본캐릭터28~36CSSpx,모바일16~22px,움직임·발사·고도·fog 캡처 검증.
- [ ] slice 확인 뒤 나머지 유닛/적/보스/지역 atlas,오디오,UI 확대.
- [ ] Verify: `node --check js/view.js`; 실제브라우저 수동검증 표준4해상도,최대개체성능.
**Acceptance:** 배경원화 한장을게임으로위장하지 않음. 움직이는 플레이가 시안톤과 일치.

## T6 — save/platform
**Dependencies:** T4 · **Phase:** integration · **Required skills:** hns:implement-tasks
- [ ] roundtrip/2슬롯크기/구버전보존/저장실패/충돌 테스트5개.
- [ ] host계약에 쓸 complete serialization,플랫폼공용 auth/rank/save 연결,저장상태처리.
- [ ] 카탈로그 row 필요시 기존 패턴의 신규 migration;등록/배포승인은 별도.
- [ ] Verify: `node --test tests/save.test.mjs`; 공유 adapter수정시해당회귀테스트;
  backend수정시 `./gradlew :game:feature:test`,portal React수정시 `cd portal-fe && npx tsc -b`.
**Acceptance:** 전체data≤60KiB,실제계정/게스트코드 cross-device 이어하기. 환경없으면 미검증.

## T7 — 온라인2인
**Dependencies:** T4,T6 · **Phase:** multiplayer · **Required skills:** hns:implement-tasks
- [ ] ownership/dedupe/chunk/rate/disconnect/resume 테스트6개.
- [ ] 공용GameRelay의 manualStart+HELLO/READY/초기checkpoint/GO를 연결. relaySeat→campaignOwner/controller 매핑 고정.
- [ ] host권위/의도/중복결과캐시/표시전용delta/완전checkpoint/solo fork, bounded backlog를 연결.
- [ ] planning/test-quality.md 리뷰추가 fixture: 좌석뒤바뀐복구,early start차단,지속저속전송,old epoch/가짜host검증.
- [ ] Verify: `node --test tests/network.test.mjs`; 실제2브라우저및WS로시나리오 수행.
**Acceptance:** 작은상태테스트만으로끝내지 않고 최대규모payload/rate 실측,이탈/이어하기 동등.

## T8 — 통합/사용자 플레이/출시전검증
**Dependencies:** T5,T6,T7 · **Phase:** verification · **Required skills:** hns:verify, hns:drift-check
- [ ] 게임 `npm test` / `npm run test:progression`,참조기반 맵검토,실제2브라우저플레이.
- [ ] firstworker/firsttower/보스도달 시간 기록,목수투자/합성/장궁수 모두 유효한선택인지평가.
- [ ] 프레임/캐릭터크기/모바일input/저장/온라인 캡처,독립코드리뷰,docs동기화.
- [ ] `python3 scripts/lint-game-mobile.py marine-command --strict`;미제공도구 관련게이트는 거짓통과표시금지.
**Acceptance:** 검증증거가 모인 뒤만 기본판완료. 배포/공개는 사용자승인 후 별도.

<!-- source: portal-fe/public/games/lib/relay.js -->
<!-- source: portal-fe/public/games/lib/platform.js -->
