# Architecture review — REVISE

검토 대상은 기본판의 **계획 계약**이다. 런타임 구현 부재를 결함으로 판정하지 않았다. 사용자 재승인이 필요한 구조적 BLOCK은 없다.

## 발견 사항

### A1. 복구 시 네트워크 좌석과 원정 소유자 매핑을 고정해야 한다
- 근거: `planning/platform.md:28`은 relay seat0를 호스트로, `planning/platform.md:30`은 송신 좌석을 명령 권한의 근거로 지정한다. 그러나 `planning/platform.md:54`에서는 방장이 기존 원정의 어느 좌석이든 선택할 수 있다.
- 실제 경계: `portal-fe/public/games/lib/relay.js:107`의 joined 처리는 서버의 새 seat를 수신하며, `game/feature/src/main/kotlin/com/kgd/game/infrastructure/ws/GameRelayRegistry.kt:478`은 매번 현재 peer.seat를 붙인다. 저장된 소유자와 동일하다는 보장은 없다.
- 영향: 이전 seat1 자산을 선택한 새 방장이 relay seat0로 명령하면 소유권 검증이 정상 명령을 거절하거나 반대 원정대에 적용할 수 있다.
- 수정: `relaySeat -> campaignOwnerId`의 1:1 매핑을 epoch별 시작 계약에 포함한다. 호스트 권위는 relay seat0에 유지하고, 모든 명령 권한·경제·유닛 상한·기여금 분배는 검증된 매핑의 campaignOwnerId로 판정한다. solo fork는 소유자 ID를 유지한 채 controller 권한만 이전하는지 명시한다. T7에 좌석이 뒤바뀐 저장 원정 재개 사례를 추가한다.

### A2. 복구 가능한 delta와 표시용 snapshot의 계약이 구분되지 않았다
- 근거: `planning/platform.md:34`는 5Hz delta snapshot/표시 보간을, `planning/platform.md:43`은 밀린 delta 합치기를, `planning/platform.md:48`은 완전 checkpoint+연속 delta로 실행 가능한 solo fork 복원을 요구한다.
- 영향: checkpoint 조립 중 더 최신 delta를 이미 적용했거나 중간 delta를 합쳤을 때, 어느 기준 상태에 적용하는지 없으면 거래·스폰·RNG·쿨다운이 누락되거나 과거 상태로 되돌아갈 수 있다. 이는 단순 화면 보간과 다른 실행 상태 일관성 문제다.
- 수정: checkpoint의 tick과 delta의 `baseTick/resultTick` 또는 동등한 기준 ID를 명시한다. delta가 완전 실행 상태 차이인지 표시 전용인지 결정하고, 후자라면 fork는 마지막 완전 checkpoint만 사용하도록 한다. 전자라면 checkpoint 조립 동안 후속 delta의 제한된 버퍼링, 중복/기준 불일치 처리, 병합 허용 조건, 새 checkpoint 요청 규칙을 명시한다. T7에서 checkpoint 조립과 후속 delta가 겹치는 복구를 검증한다.

## 확인한 설계 방향
- 소유자별 sim/단일 act, 저작 world 데이터, navigation/visibility, renderer, relay/save 경계는 책임 분리에 적합하다. DOM/소켓/저장을 시뮬레이션에 넣을 필요가 없다.
- navigation과 visibility는 이동·건설·사격·시야 등 여러 소비자의 복잡성을 감추므로 별도 모듈 근거가 있다. 단일 어댑터를 위한 추상 인터페이스 증식은 요구하지 않는다.
- 초기 목수0, 금화0, 처치 수입 후 고용, 노동 운반, 주둔 탑, 3활잡이 합성, 작은 스프라이트는 사용자 요구와 일치한다.
- 기존 ADR 범위 재사용 계획이며 신규 서버 권위/DB 공유 설계가 없다.

## 탐색/검증 범위
spec·world·gameplay·platform·DESIGN·tasks, context 결정/질문, architecture checklist와 review-protocol, agent-behavior/online-versus-lobby 표준, 실제 relay/platform/registry를 읽었다. docs/checks와 .claude/rules는 없었다. 문서 검토만 수행했으며 실행 테스트/브라우저 검증은 수행하지 않았다.

## Round 2 — SHIP (2026-10-01)

최신 판정은 **SHIP**, 미해결 architecture 발견0건이다. 위 Round 1 지적은 이력으로 보존한다.

- **A1 해소:** `planning/platform.md:30`에 epoch별 relaySeat→campaignOwnerId 매핑, host relay0와 원정 owner의 분리, 시작 전 합의·epoch 동안 고정이 명시됐다. fork는 원래 지갑/강화/정원을 유지하며 controller.allowedOwners만 넓힌다. `planning/test-quality.md:48` 및 `tasks.md:63`에 뒤바뀐 좌석 복구 검증과 구현 항목이 연결됐다.
- **A2 해소:** `planning/platform.md:40`의 delta는 표시 전용, `:43`의 실행 복구는 마지막 완전 checkpoint만 사용한다. view sequence/base 불일치와 표시 버퍼가 실행 checkpoint와 분리되며 최근 행위는 금화/유닛을 함께 되돌린다. `planning/test-quality.md:44`에 정확히 K로 복구한 뒤 동일 입력600step 동등성을 비교하는 oracle이 있다.

판정 범위는 기획 계약의 구현 가능성이다. 실제 네트워크·저장·게임 실행 검증이나 신규 미술 승인을 뜻하지 않는다. 런타임 코드 수정 없음.

<!-- source: portal-fe/public/games/lib/relay.js -->
<!-- source: portal-fe/public/games/marine-command/js/sim.js -->
