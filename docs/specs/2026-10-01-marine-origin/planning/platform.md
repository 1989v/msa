# Platform integration / network / save contract
2026-10-02 구현 동기화. `js/origin/transport.js`, `save.js`, `session.js`와 공용 플랫폼 저장 상태 확장이 구현되었다.
아래 로컬 검증 결과와 실제 서버·브라우저 미검증 범위를 구분한다.
## 확인한 기존 코드
| 파일 | 실제 제공 | 재사용/주의 |
|---|---|---|
| portal-fe/public/games/lib/relay.js | GameRelay.create, createParty/enterParty/startRound, onJoined/onStart/onMove/onLeft/onDrop, move(d,to), leave | 새 소켓 프로토콜 복사 구현 금지 |
| game/feature/src/main/kotlin/com/kgd/game/infrastructure/ws/GameRelayRegistry.kt:58 | 전체 수신 JSON문자열4096자, 초당40메시지/peer | d만이 아니라 {t, d, to} 전체 측정 |
| game/feature/src/main/kotlin/com/kgd/game/infrastructure/ws/GameRelayWebSocketConfig.kt | /ws/games/* | 게임 규칙을 모르는 전달 서버 |
| portal-fe/public/games/lib/platform.js | localStorage saveKeys 수집,600ms debounce PUT, 서버본 bootstrap/reload, 선택적 저장 상태 callback/event | requestSave()로 명시적 저장 요청, 실제 saved 응답 전 클라우드 성공 표시 금지 |
| game/feature/src/main/kotlin/com/kgd/game/application/play/service/GameSaveService.kt:30 | 저장 JSON UTF-8 전체64KB, version, memberId/code, playable catalog 필요 | 신규 game row 없이 서버 저장 성공 불가 |
| portal-fe/public/games/lib/auth.js, lib/rank.js | 공용 로그인·닉네임/프로필 UI | localStorage nickname을 소유권 인증으로 사용 금지 |
| portal-fe/src/pages/games/GameDetailPage.tsx | iframe 게임 상세 셸 | 이 파일에 기존 dirty 변경이 많음; 전면 수정 금지 |
| portal-fe/public/games/frost-outpost/index.html | 호스트 시뮬레이션/의도 전달 선례 | 역할 분담 builder/commander는 이번 설계와 다름 |

ADR-0088/0092의 호스트 권위와 공용 relay를 그대로 사용. 신규 서버·DB·서비스 통신 방식 변경 계획 없음.
카탈로그 등록용 V103 migration 파일이 작성되었으며 **실행하지 않았다**. 등록 파일 존재는 서버 등록 완료를 뜻하지 않는다.
실제 적용 전 대상 DB의 migration 이력을 확인한다. 미등록 또는 playable이 아닌 게임은 서버 save 게이트를 통과하지 못한다.
DB 적용·공개 전환·배포는 별도 실행 범위이며, 이번 문서의 로컬 검증에는 포함되지 않는다.

## 플레이 모드/경제 소유권
- 기본2인. 양쪽 모두 활잡이1/목수0/금화0. 각자 원정대, 금화, 업그레이드, 고용 슬롯 소유.
- 본진HP·진행 목표·시야 공유. 처치기여 분배는 gameplay.md, 타인의 소유 유닛/자금 조작 금지.
- 모드 선택은 title: 싱글 / 온라인 협동 / 이어하기. 협동 로비: 방 만들기·코드 입장·새 원정 또는 저장 원정.
- 두 명 모두 같은 mapVersion/contentVersion/protocolVersion 확인 후 시작, 불일치 시 시작 차단과 갱신 안내.
- 협동 고용/업그레이드 UI는 일시정지하지 않음. 싱글 pause와 혼용 금지.
- 기본판 랭킹 없음. 공용 플랫폼 게임세션·프로필·저장 사용, coop을 solo기록에 제출하지 않음.

## 호스트 권위 메시지
- seat0가 시뮬레이션30Hz, 게스트는 입력 의도 최대10Hz, 변화없으면 반복 이동 패킷 생략.
- 이동 의도와 거래 의도 분리. intent={protocolVersion,epoch,channel,seatSequence,kind,args}.
  channel은 transaction/movement이며 좌석별 sequence를 별도로 유지한다. 이동 패킷 생략이 거래 sequence gap을 만들지 않는다.
- 호스트는 relay가 붙인 sender seat와 epoch별 relaySeat→campaignOwnerId 매핑으로 권한을 판정한다.
  payload ownerId는 목표 선택 요청일 뿐 권한이 아니다. 새 원정은0→0/1→1, 이어하기는 방장이 선택한 소유자에1:1매핑.
  실제 호스트는 relay seat0이며 campaignOwner1을 조작할 수도 있다. 매핑은 시작 전 합의 후 epoch 동안 고정.
- 게스트는 ack/view/checkpoint/GO를 현재 epoch의 host relay seat0에서 온 경우만 수신한다. UTF-8 FNV-1a hash는 오염검사이지 인증이 아니다.
- sequence는1..2^31-1 정수, epoch+sender별 단조증가. 거래는 동시에미확정1개, 같은seq 재전송만 허용.
  maxAcceptedSeq보다작은명령은재실행금지; 최근256결과는 bounded ack cache, 오래된중복은 stale ack만 보냄.
  기대 seq보다큰거래는 gap 오류로 거부. 이동은최신seq만유지. epoch교체/재접속에는 미확정거래 자동재전송금지.
- 명령 검증: 종류 allowlist, 정수 ID, finite 좌표, world bounds, 소유권, 위치·비용·병력/탑 상한,
  행위별 재사용 시간, 이전 sequence 중복. 피해/금화/HP 직접 쓰는 명령은 없다.
- 한 거래에 성공 또는 사유 있는 거부 ack1회, 클라이언트 낙관적 자원 차감 금지.
- 현재 구현은 의존 delta 대신 **독립적인 표시 전용 keyframe을 5Hz로 생성**한다. 완전 checkpoint는2초마다 생성한다.
  표시 프레임은 최대3조각, 전용 조립기·단조증가 ID를 사용하고 조립/검증 완료 후만 적용한다. 오래된 프레임·tick 역행은 적용하지 않는다.
  전송 중인 표시 프레임은 끝까지 보내며 대기 프레임만 최신본으로 교체한다. 전송 계층에 의존 delta가 들어오면 그 체인은 임의 삭제하지 않는다.
  표시 투영은 AI/기여자 기록·대기 스폰 등 실행 전용 데이터를 제외하고 위치를1world 단위로 반올림한다. 양수HP는 올림하여 사망을 앞당겨 표시하지 않는다.
  이 투영은 실행·저장·단독 복구에 사용하지 않는다. 경제·소유·보스 상태를 게스트가 예측하지 않는다.
  별도의100ms 보간 완료를 주장하지 않는다. 실제 시각 지연/부드러움은 브라우저 검증 항목이다.
  표시 프레임이3조각 예산을 초과하면 display-budget-exceeded 상태를 알린다. 최대 규모 fixture는3조각에 들어가는 것을 확인했다.
- solo fork/협동 이어하기는 마지막 검증된 완전 checkpoint만 사용한다. delta를 실행상태에 섞지 않는다.
  rollback 가능한 최근 행위를 안내하고 체크포인트 이후 이동/고용/합성·골드 모두 함께 되돌린다. 무료골드/유닛만 남기는 부분복구 금지.
- checkpoint includes RNG, tick, pending spawns, gold, upgrades, units/jobs/cargo, towers/occupants,
  enemies/combat timers, camps/dungeon room/rewards, wave timers, explored mask, accepted command sequences.
  피해가 예약된 warning/effects와 해당 타이머도 반드시 보존한다. 현재 전체 JSON 상태를 보존하며, 렌더 자원·외부 경로 캐시는 시뮬레이션 상태에 넣지 않는다.
- 정적 타일은 mapVersion=`origin-se-topology-1`로 로컬 로드한다. 저장/세션은 map.js의 실제 상수를 공유한다.
- full checkpoint는 숫자를 lossless float64/정수로 표현하는 binary 형식→gzip→base64 (`gzip-binary-v1`)로 압축한다.
  `gzip-base64-v1` 읽기는 호환 지원하지만 새 저장은 binary 형식이다. 완전 상태의 좌표·HP·타이머를 양자화하지 않는다.
  CompressionStream/DecompressionStream이 필요하며 미지원·압축 실패는 명시적 오류다. 압축 해제는1MiB 상한과 구조 검증을 가진다.
- packed checkpoint JSON≤28KiB, 전체 릴레이 JSON escape 후 길이를 검사한다. 초과하면 실패를 알리며 보스/실행 개체를 누락하지 않는다.
- 각 릴레이 봉투≤3800자, chunk payload≤3000자, chunkCount≤12, checkpointId+epoch+index+count+hash 포함.
- 조각 수신은 staging buffer에 모아 hash 검증 후 원자적 적용. 최대2그룹·그룹40KB·유효기간3초.
- 호스트 전체 송신≤30/s(rolling1sec), 표시 조각≤15/s, checkpoint 조각≤6/s이며 각각 간격을 둔다. 제어/재전송도 전체 예산에 포함한다.
  표시는5Hz **생성 목표**이며 실제 전달 속도는 공유 예산/네트워크의 영향을 받는다. 부분 전송 프레임을 섞거나 중간 조각을 폐기하지 않는다.
- 송신 application queue: checkpoint in-flight1+대기1,총96KiB/96message 상한. 같은 체크포인트 진행중이면 새 생성은 미루거나 대기1개 대체.
  확정 거래 ack는 최대64개, 초과 또는 상대 checkpoint확인5초없음이면 새 거래/체크포인트 생성을 멈추고 동기화중 상태.
  현재검증복구본을 보존하고10초실패면네트워크중단/복구UI. 소켓 bufferedAmount>64KiB이면 추가send중단.
  공용relay.state.ws의 read-only bufferedAmount를 확인하고 다른게임의send동작을 바꾸지 않는다.
- guest 입력≤10/s+제어≤5/s. ping25초는 공용 relay.
- 체크포인트 완료 전 시작/이어하기 버튼 잠금. 네트워크 접속 자체를 '온라인 구현 완료'로 판단하지 않는다.
- 체크포인트 ACK 후에도 가장 큰 ID를 기억하여 과거 체크포인트를 다시 송신 큐에 등록하지 않는다.
  버전/소유자 협상 실패·초기 snapshot 검증 실패·소켓 오류는 onError와 재시도 가능한 error 상태로 알린다.

## 이탈·재연결·이어하기
- 정상 상대 left: 남은 클라이언트가 최신 검증된 완전 checkpoint로 solo fork 전환. 별도 forkId, coop-derived 표시.
  기존 ownerIds·지갑·공방업·정원은 그대로. controller.allowedOwners가 두 소유자를 제어하도록 변경된다.
  원정 UI에서 대상소유자를 전환하고 고용/강화/수리 비용은 그 소유자 지갑에서만 낸다. 다른owner끼리 합성 금지.
  이탈 소유자 부대는 마지막 위치에서 방어/목수작업을 지속하며, 남은 사용자가 대상소유자를 선택해 새 명령을 내릴 수 있다.
- 호스트 종료/연결불명(drop): 입력 잠금·상태 안내. 최대10초 동안 서버 종료 정보 확인, 이후 '마지막 동기화 기록으로 혼자 계속' 또는 타이틀.
  임의 양쪽 호스트 자동승격/무한 재접속으로 분기 원정 합치기 금지.
- 원래 방으로 투명한 중간 재입장은 기본판에서 약속하지 않는다. '협동 이어하기'로 새 방을 만들고 합류한다.
- 온라인 복구는 새 room epoch, 선택한 저장기록 한 개가 기준. 상대의 다른 원정 저장을 합치지 않는다.
- 방장은 어느 좌석을 본인이 맡는지 고르고 친구는 나머지를 맡는다. 모든 원정 자산은 캠페인 안의 자산,
  계정 자산 이전이나 nickname 소유권 주장 아님.
- 방장 저장 checkpoint를 보내고 두 명이 hash/contentVersion을 확인한 후 start. 외부 서버가 게임 결과를 권위 검증하지 않으므로 경쟁 공정성 주장 없음.
- 정상 연결에서 최신 검증 checkpoint의 나이는2초+조립3초 기준5초 목표이며 지속혼잡/단절에서는 보장하지 않는다. 자동 복구 완료라고 표시하기 전 상태 검증.

## 이어하기 저장
- slug는 기존 marine-command 유지, 화면명은 '전초선: 활잡이 원정'(가칭). 파일경로/카탈로그 slug 임의 변경 금지.
- 새 키 marine-command.origin.solo.v1 / marine-command.origin.coop.v1. 각 slot1개, 선택한 slot만 명시적으로 덮어쓰기.
- 이전 frontline-expedition-v1 키는 보존. 새 규칙으로 변환하지 않고 '이전 시험판 기록'이라고 설명.
- 저장 schemaVersion1, contentVersion, mapVersion, mode, campaignId,forkId,checkpointTick,saveTime,checksum.
- PlatformAdapter.init saveKeys는 위2개. auth→rank→platform 스크립트 순서, 게임 부트 이전 초기화.
- 두 슬롯을 묶고 문자열 중첩 escape까지 거친 data JSON의 UTF-8≤60KiB(서버64KiB 대비여유).
  단일 packed checkpoint≤28KiB. 현재 탐색은 실제 terrain의 packed bitset 전체를 압축 보존하며, 이전 초안의192×128 크기를 강제하지 않는다.
  정적지형/렌더 자원은 저장 대상이 아니다. 피해 예약 효과·보스 패턴 타이머는 실행 상태이므로 저장한다.
- 자동저장: 싱글15초/거래/보스 처치/일시정지. coop은 호스트만 canonical checkpoint를 쓴다.
  게스트는 검증 replica를 `marine-command.origin.recovery.v1`에 보관하되 PlatformAdapter saveKeys에 등록하지 않는다.
- 호스트 이탈 후 solo fork는 solo slot에 덮어쓰기 전에 기존 기록 경고/선택 필요. coop canonical slot은 보존.
- load: schema/range/finite/enum/ID참조/상한 검증. 실패하면 원본 그대로 보존하고 새 원정/다른기록 선택.
- 저장 그대로 위치·HP·직업·타워·웨이브·몬스터·방 진행 복원. 재로드로 공짜 치유/리젠/수입 지급 금지.
- 로컬 성공과 클라우드 성공을 구분한다. save store의 쓰기 성공은 local:saved/cloud:unconfirmed이며 서버 성공을 추정하지 않는다.
  공용 platform.js에 선택적 `onSaveStatus` callback, `game:save-status` 이벤트, `getSaveStatus()`와 `requestSave()`를 추가했다.
  상태는 local-only/loading/loaded/pending/saving/saved/conflict/error. 이벤트에는 slug/state/일반화된 사유만 넣고 코드·토큰·저장 본문은 노출하지 않는다.
  실제 PUT 성공만 saved이며409/버전 충돌은 conflict다. 기존 게임은 callback을 지정하지 않아도 원래 init/runEnd API를 그대로 사용할 수 있다.
- 게스트 code/계정 이어하기 UI는 기존 상세 셸/인증을 사용. 저장코드·토큰을 네트워크 디버그 로그/시안에 노출하지 않음.

## 통합 검증 선행조건
실제 local game service+gateway/WS와 playable 카탈로그, 2개의 독립 브라우저 컨텍스트가 필요.
정적 python server만으로 온라인/서버 이어하기를 통과시킬 수 없다.
현재 순수 전송/저장/세션 및 공용 저장 상태 테스트는 로컬에서 검증했다. **실제 backend cloud save, 실제 WebSocket 2브라우저 원정, 계정/게스트코드 cross-device 이어하기는 미검증**이다.
네이티브 브라우저 접근이 거부되어 자동화된 컴포넌트·모의 relay 결과를 실제 브라우저 성공으로 바꾸어 표기하지 않는다.

<!-- source: portal-fe/public/games/lib/relay.js -->
<!-- source: portal-fe/public/games/lib/platform.js -->

## 2석 준비/시작 프로토콜 (기존 manualStart 재사용)
1. 방장은 createParty({seats:2}), 게스트는 enterParty(code). 일반 connect 자동start 경로는 사용하지 않는다.
2. 게스트 onJoined에서 host0으로 HELLO(프로토콜/콘텐츠/맵버전) 전송. 2석은 seat알림에 의존하지 않는다.
3. 호스트는 HELLO sender/버전을 확인하고 epoch/owner매핑/신규또는복구모드 제안. 게스트 READY 수신 후 startRound 호출.
4. onStart는 소켓 round 시작일 뿐 게임 step시작아님. 새 원정은 이때 서버seed로초기화,복구는저장seed를유지.
5. host가 초기 완전checkpoint를전송,guest가검증완료hashAck,host가 GO(epoch,checkpointId)를보내면양쪽play화면으로진입. tick은검증된checkpoint에들어있다.
6. 불일치/검증 실패는 재시도 가능한 오류 상태로 알리고, 전송 지연은5초 동기화/10초 복구 상태로 전환한다. 체크포인트가읽히기전에전투·소비명령을실행하지 않는다.
공용relay는 로비에서도move(d,to)를 전달하므로 서버수정불필요. 캠페인필드에는party좌석token을저장하지 않는다.

## 최종 최대 규모 로컬 실측
`node --test tests/max-payload.test.mjs`: **1 passed / 0 failed**. 생성된 실제 캠페인의 복사본에 적260/전투48/목수16/탑12/스폰 예약128/필드·던전 전체 탐색/피해 예약 효과40을 채운 fixture이다.
운영 상태를 변경하지 않았으며 압축 해제 결과와 완전 원본의 deep equality를 확인했다.

| 측정 | 결과 | 상한 |
|---|---:|---:|
| 완전 packed checkpoint JSON | 24,260B / 9조각 | 28,672B / 12조각 |
| 두 슬롯 collected JSON UTF-8 | 49,099B | 61,440B (서버65,536B) |
| 표시 전용 packed keyframe | 8,752B / 3조각 | 3조각 |
| 첫1초 전체 송신 | 20메시지 | 30메시지 |
| 첫1초 표시/체크포인트 조각 | 14 / 6 | 각각15 / 6 |

이는 최대 fixture의 직렬화·큐 실측이며 네트워크 지연·실기기 프레임 성능 보장이 아니다.

## 구현 API
- `createSaveStore().read(mode)` → Promise<{ok,state,metadata}|{ok:false,reason}>.
  `write(mode,state,{campaignId,overwrite,forkId})` → Promise<{ok,metadata,bytes,local,cloud}|{ok:false,reason}>.
  새로운 campaignId가 기존 슬롯을 대체하려면 overwrite를 명시한다. `readRecovery()/writeRecovery()`는 cloud 수집에서 제외된다.
- `createSession({createState,stepState,applyCommand,serializeState,deserializeState,validateState,onState,onStatus,onError,onCheckpoint})`.
  createParty/joinParty/start/sendCommand/tick/disconnect는 동기 호출이며 fork는 Promise<{ok,state,allowedOwners,forkId}>다.
  UI는 온라인 메뉴 중에도 tick을 계속 호출한다. fork 반환 자체로 solo 슬롯을 자동 덮어쓰지 않는다.
- 명령 allowlist에는 최신 sim의 leaveDungeon/setGroup/selectGroup/useLink가 포함된다. 게스트 선택 ownerId를 인증으로 사용하지 않는다.

## 플레이 피드백 이후 wire/codec
protocolVersion2: binary-v2 코덱과 아군 발사 시각/방향 표시를 지원한다. 구 peer와 lobby에서 버전 불일치를 표시한다. 저장키는 유지하며 binary-v1/JSON-v1 저장을 계속 읽는다. 표시에서 적의 shot메타데이터는 생략하되 기존 bullets/effects를 사용하고, 완전 저장에서는 보존한다. 새 최대 측정 checkpoint27928B/10청크, 두슬롯56435B, display8324B/3청크, 첫1초20메시지.

## 필드 무리 상태 추가
protocolVersion3,checkpoint상한29KiB. 두슬롯총60KiB,표시3청크,전체30msg/s제한유지. fieldPacks/fieldPackId포함최대실측checkpoint28740B/두슬롯58059B/표시8676B. 기존codec/저장키와v1읽기는유지.
