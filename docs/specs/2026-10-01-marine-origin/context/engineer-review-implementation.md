# Implementation review — REVISE

이번 산출물은 계획·아트이며 런타임 코드를 수정하지 않는다. 다음 두 항목은 T7 착수 전에 계약을 명확히 하면 해결 가능하며 사용자 판단을 요구하는 BLOCK은 아니다.

## 발견 사항

### I1. 저장 원정 핸드셰이크와 기존 릴레이 시작 방식을 연결해야 한다
- 근거: `planning/platform.md:5`는 connect 중심 API를 열거하고 `planning/platform.md:23`, `planning/platform.md:45`, `planning/platform.md:56`은 버전 및 checkpoint 검증을 마친 뒤 시작하도록 한다.
- 실제 코드: `portal-fe/public/games/lib/relay.js:163`의 connect는 일반 join이다. `game/feature/src/main/kotlin/com/kgd/game/infrastructure/ws/GameRelayRegistry.kt:357`은 manualStart가 아니고 만석이면 자동 start한다. 같은 릴레이는 2석에 입장 알림 seat를 보내지 않는다(`:351`). `lib/relay.js`에는 이미 createParty/enterParty/startRound가 있다.
- 영향: 일반 connect의 onStart를 캠페인 시작으로 바로 취급하면 저장 원정 전송·버전 확인 전에 새 게임이 실행된다. 수동 시작 방에서 seat 알림만 기다리면 2인 준비 상태가 진행되지 않는다.
- 수정: `createParty({seats:2})`/`enterParty(code)` 및 hi/ready 교환을 사용하고, 두 참가자의 버전·checkpoint hash 검증 뒤 startRound를 호출하는 순서를 명시한다. 또는 서버 start와 별도의 application-ready 장벽을 명확히 정의한다. 신규 서버 프로토콜은 필요 없다. T7에 버전 불일치 및 초기 checkpoint 전송 중 조기 start 차단을 넣는다.

### I2. 송신 백로그의 개수·바이트·기한과 중단 정책이 없다
- 근거: `planning/platform.md:34`는 2초마다 완전 checkpoint 생산, `planning/platform.md:41`은 수신 staging만 제한, `planning/platform.md:42`는 송신 빈도 제한, `planning/platform.md:43`은 밀린 완전 checkpoint/확정 거래를 삭제하지 못하게 한다.
- 실제 코드: `portal-fe/public/games/lib/relay.js:88`의 send는 열린 소켓에 JSON을 넘기는 단순 경로이며 체크포인트 대기열/backpressure를 제공하지 않는다. `GameRelayRegistry.kt:61`의 peer40msg/s 상한은 전송량을 제한할 뿐 애플리케이션 큐를 비우지 않는다.
- 영향: 느린 연결/재전송 동안 새 checkpoint는 계속 생성되고 기존 것은 제거할 수 없으므로 송신 큐가 무제한 증가한다. 문서의 5초 손실 목표도 이 조건에서는 보장되지 않는다.
- 수정: 송신 대기 checkpoint 수/바이트/최장 체류시간과 미확정 거래 수를 제한한다. 한도에 이르면 새 checkpoint 생성을 미루고 입력을 제한하며, 정해진 기한 초과 시 명시적인 동기화 중단/복구 상태로 전환한다. 또는 최신 미전송 checkpoint로 대체 가능한 조건을 정의하되 이미 확인된 거래와 원자성을 보존한다. 5초는 정상 연결 목표임을 명시한다. T7에 지속적인 처리량 저하와 한도 도달 사례를 추가한다.

## 확인 결과
- 참조된 relay/platform 및 서버 Registry는 실제 존재하며 메시지4096자/초당40개 제한과 계획이 맞는다.
- 저장 원본 보존, 별도 solo/coop 키, 크기 실측, 공용 adapter 회귀검증, dirty 작업 보호, 실제 플랫폼 통합 선행조건이 계획에 있다.
- T1~T8은 기능별 검증과 아트 검증을 나누고 있으며 실행 순서에 치명적인 순환 의존성은 없다.
- 숫자/원본 지도 충실도/신규 아트는 제안으로 표시되어 있다. 사용자 승인 미술 톤과 신규 제안을 혼동하지 않는다.

검증: 문서와 실제 API 소스 대조. 런타임 코드·테스트·배포 변경 없음. 아직 없는 구현을 실패로 판정하지 않았다.

## Round 2 — SHIP (2026-10-01)

최신 판정은 **SHIP**, 미해결 implementation 발견0건이다. 위 Round 1 지적은 이력으로 보존한다.

- **I1 해소:** `planning/platform.md:102`에서 createParty({seats:2})/enterParty를 고정하고 HELLO/READY로 2석 seat 알림 부재를 처리한다. `:105`는 socket onStart와 game step 시작을 구분하고, `:106`은 초기 checkpoint 검증/hashAck 후 GO로 진행한다. 기존 relay의 로비 move와 manualStart API로 가능한 흐름이다. `planning/test-quality.md:49`, `tasks.md:63`에 버전 불일치·earlyGO·초기 checkpoint 오류 차단 검증이 추가됐다.
- **I2 해소:** `planning/platform.md:54`에 in-flight1+대기1,96KiB/96message 상한과 대기본 대체 정책이 있고, `:55`에 ack64/5초 신규거래 정지, `:56`에 10초 복구 화면 및 bufferedAmount64KiB send 중단이 있다. 정상 연결의 복구 나이 목표와 지속혼잡 비보장을 구분한다. `planning/test-quality.md:50` 및 `tasks.md:64`가 지속 지연 검증을 다룬다.

문서/실제 API 대조만 수행했다. 이 SHIP은 다음 구현의 계약이 정리되었다는 의미이며 구현 완료·실행 테스트 통과·배포 준비 완료 주장이 아니다. 런타임 코드 수정 없음.

<!-- source: portal-fe/public/games/lib/relay.js -->
<!-- source: portal-fe/public/games/marine-command/js/sim.js -->
