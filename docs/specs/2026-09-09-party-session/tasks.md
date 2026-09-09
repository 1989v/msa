# Task Breakdown: 파티 세션

> 스펙 `spec.md` (SR-1~9) · 검사 `planning/test-quality.md` (T1~T65) · 결정 `docs/adr/ADR-0092`.
> 인용은 **요구 문구**로 한다 — 서수는 스펙이 자랄 때 밀린다(리뷰에서 두 번 어긋났다).

## Overview

Total Task Groups: **14**  ·  완료: TG1~TG12 (TG13·TG14 남음)

세로로 얇게 자르지 않고 **레이어로 자른다.** 이유는 릴레이·채점·명부가 서로 다른 속도로 움직이고,
FE 는 그 셋이 다 선 뒤에야 붙일 수 있기 때문이다. TG1~TG3 이 기반이고 나머지는 그 위에 얹힌다.

**먼저 알 것 셋**
- 릴레이의 시간 함수는 `nowMs` 를 인자로 받는다 — 90초를 실제로 기다리지 않는다
- 게임 JS 는 IIFE 라 `import` 할 심이 없다. TG7 의 W1 배선이 없으면 검사가 시뮬 사본을 보게 된다
- **N석 릴레이 경로는 운영에서 한 번도 돈 적이 없다**(배포된 3종이 전부 2석) — 파티가 첫 사용자다

---

### Task Group 1: 릴레이 확장 — 파티 방

**Dependencies:** None
**Phase:** foundation
**Required Skills:** Kotlin, Spring WebSocket, Kotest

`docs/conventions/package-structure.md` — 릴레이 어댑터는 `infrastructure/ws`, 좌석 조회는
`application/party/port` 에 포트로 선언한다(레지스트리를 직접 읽으면 레이어 게이트가 문다).

- [x] 1.0 파티 방을 릴레이 위에 세운다
  - [x] 1.1 테스트 8개: T6(30초 뒤에도 안 시작 + 빈 좌석이 참가자로 안 듦) · T7(판이 끝나면 방이 다시 열린다) · T8(`private` 로 두 방장이 다른 방 / 옵션 없는 기존 대전은 여전히 합쳐진다) · T43(알 수 없는 코드로 방이 안 만들어진다 / 「방 만들기」로는 만들어진다) · T54(방장 승계) · T55(무입력 91초 생존 / ping 끊기면 정리) · T56(3석 이상 join→배정→시작 전) · T61(좌석 0 이 아닌 시작 명령 거부)
  - [x] 1.2 `Room` 에 종류를 넣고 join 옵션 `private`·`manualStart` 를 받는다
  - [x] 1.3 `startDueLobbies` 와 빠른 매칭에서 파티 방을 제외한다
  - [x] 1.4 `started` 와 **`seed` 를 함께 판 단위**로 바꾼다 — 판 번호(방 코드 + 순번)를 방에 둔다
  - [x] 1.5 **시작 명령**을 받는다. 좌석 0 에서 온 것만 받고, 설정을 불투명 값으로 함께 실어 시드와 **한 메시지**로 뿌린다. 시드 대입을 「방이 찼다」 경로에서 떼어 이리로 옮긴다
  - [x] 1.6 관전자를 좌석 없이 받는다 — 시작 신호의 참가자 목록에서 뺀다
  - [x] 1.7 알 수 없는 코드로는 방을 만들지 않는다(방 고갈 방어)
  - [x] 1.8 `application/party/port` 에 좌석 조회 포트를 선언하고 레지스트리가 구현한다
  - [x] 1.9 회귀 주입으로 T6·T7·T8·T61 이 실제로 빨간불을 내는지 확인
  - [x] 1.10 Verify: `./gradlew :game:feature:test --tests "*GameRelayRegistry*" --tests "*PartyRoom*"`

**Acceptance Criteria:**
- 파티 방이 생성 30초 뒤에도 열려 있고, 판이 끝나면 다시 열린다
- 두 방장이 코드 없이 방을 열면 서로 다른 방에 앉고, **기존 대전 매칭은 그대로 합쳐진다**
- 시드가 시작 명령 수신 시점에 뽑히고 설정과 한 메시지로 나간다
- 회귀 4종이 각각 빨간불을 냈다

---

### Task Group 2: 좌석 토큰 — 발급과 검증

**Dependencies:** Task Group 1
**Phase:** foundation
**Required Skills:** Kotlin, HMAC, Kotest

**mock 하지 않는다** — 실제 서명 컴포넌트를 배선한 채로 돈다. 레포의 유일한 선례가 `FakeTokens` 로
서명 의미를 재구현해서, 그대로 따르면 `verify` 를 `return true` 로 바꿔도 통과한다.

- [x] 2.0 좌석 토큰을 세운다
  - [x] 2.1 테스트 3개: T10(위조 3종 — 키가 다른 서명 / 좌석만 바꾼 서명 / 토큰 없음) · T11(다음 판 재사용 불가 / 좌석 물려받은 사람이 전임자 토큰 못 씀) · T12(비밀키 미주입 시 기동 실패) · T44(방 재개설 후 옛 토큰 거부)
  - [x] 2.2 서명 포트를 `application` 에 선언한다 — 인프라 HMAC 을 릴레이가 직접 주입하면 인프라끼리 붙어 게이트가 못 본다
  - [x] 2.3 서명 대상: 방 코드 + **방 생성 시각** · 판 번호 · 좌석 · **좌석 점유 세대**
  - [x] 2.4 릴레이가 좌석 배정 시점에 그 피어에게만 발급한다 (`joined` 응답)
  - [x] 2.5 비밀키 미주입 시 기동 실패 — 기본값 폴백을 없앤다
  - [x] 2.6 회귀 주입으로 T10·T12·T44 확인
  - [x] 2.7 Verify: `./gradlew :game:feature:test --tests "*SeatToken*"`

**Acceptance Criteria:**
- 실제 HMAC 컴포넌트가 배선된 상태에서 위조 3종이 거부된다
- 판·세대가 서명에 들어가 재사용 두 경로가 막힌다
- 키 없이 기동하면 앱이 뜨지 않는다

---

### Task Group 3: 친구 그룹 (roster)

**Dependencies:** None
**Phase:** foundation
**Required Skills:** Kotlin, JPA, Flyway, Kotest

`docs/conventions/jpa-persistence.md` · `game_db` 전용 Flyway. **새 마이그레이션 번호를 잡기 전에
최신 번호를 확인한다** — 여러 세션이 한 워킹트리를 쓰고, 겹치면 전 서비스 이미지가 안 만들어진다.

- [x] 3.0 친구 그룹을 만든다
  - [x] 3.1 테스트 6개: T28(옵트아웃 후 **행이 없다** — 질의로 확인) · T29(회원 탈퇴 시 파기) · T30(보존 스윕이 실제로 지운다) · T31(옵트인 전 서버로 안 나감) · T32(켜져 있으면 서버가 이긴다) · T47(옵트인 켠 **직후** 자동 업로드 안 함)
  - [x] 3.2 `game_db` 스키마 + 도메인 + 포트 + 어댑터 (`application/roster`)
  - [x] 3.3 옵트인 토글 — 끄면 하드 삭제, 끄기 전 서버본 내려받기, 삭제 전 확인
  - [x] 3.4 업로드에서 이름 충돌 시 덮지 않고 묻는다
  - [x] 3.5 회원 탈퇴가 `game_db` 에 닿는 채널 (**OQ-8 — 열어 둔 채 배포하지 않는다**)
  - [x] 3.6 보존 스윕을 주 1회 정리 CronJob 에 **호출자까지** 붙인다
  - [x] 3.7 회귀 주입으로 T28·T29·T30 확인 — 특히 T30 은 상수 검사로는 안 물린다
  - [x] 3.8 Verify: `./gradlew :game:feature:test --tests "*Roster*" --tests "*RosterSchemaIntegration*"`

**Acceptance Criteria:**
- 옵트아웃·탈퇴 후 서버에 행이 남아 있지 않다 (호출 검증이 아니라 질의 검증)
- 보존 스윕에 호출자가 있고, 회귀를 넣으면 빨간불이 난다

---

### Task Group 4: 투표 — HTTP 집계

**Dependencies:** Task Group 2
**Phase:** core
**Required Skills:** Kotlin, Spring MVC, Kotest

UseCase **인터페이스**를 먼저 만든다 — 컨트롤러는 인터페이스만 주입한다(ADR-0083).
최근 세 도메인이 이 한 겹을 빠뜨린 채 리뷰를 통과했다.

- [x] 4.0 익명 투표를 세운다
  - [x] 4.1 테스트 4개: T18(릴레이를 안 지나고, HTTP 응답 어디에도 좌석→선택이 없다 — 방장 응답 포함) · T19(진행 중엔 제출 수만) · T20(토큰 없는 투표 거부 / 한 좌석 한 표) · T50(최다득표 / 전원 기권이면 무작위)
  - [x] 4.2 `application/party/usecase` 인터페이스 + `service` 구현 + 컨트롤러
  - [x] 4.3 (방·판·좌석)→선택을 **메모리에만** 들고 마감 시 집계만 내보낸 뒤 버린다
  - [x] 4.4 회귀 주입으로 T18 둘 확인 (방장 응답에 상세 추가 / 릴레이로도 브로드캐스트)
  - [x] 4.5 Verify: `./gradlew :game:feature:test --tests "*PartyVote*"`

**Acceptance Criteria:**
- 투표 값이 릴레이 프레임에 한 번도 실리지 않는다
- 진행 중 득표 수가 공개되지 않는다

---

### Task Group 5: 채점 — 아케이드 스택 확장

**Dependencies:** Task Group 2
**Phase:** core
**Required Skills:** Kotlin, Kotest

**OQ-2(원그리기 채점식)를 먼저 정한다.** 선정 기준에 「위조 궤적이 그 식에서 만점을 받는가」를 넣는다.
**OQ-9(참여형을 정수 결정적 코어 위에 지을 것인가)도 여기서 결정한다** — 안 쓰면 채점 산식이 두 벌이 된다.

- [x] 5.0 서버 채점을 세운다
  - [x] 5.1 테스트 6개: T13(재제출은 첫 값 유지 + **성공 응답**) · T14(실패 시 판 무효, 폴백 없음) · T15(미제출자 둘 이상 순위 / 전원 미제출이면 무효) · T16(개연성 위반 거부 + 사유 집계) · T17(원자료 크기 상한) · T52(제출 DTO 에 **점수 필드가 없다**)
  - [x] 5.2 7초 — 서버 시계로 잰다(판 시작 스탬프 + 도착 시각)
  - [x] 5.3 원그리기 — 개연성 검사(표본 간격 분포 · 떨림 분산 · 총 소요). **완전한 방어가 아니라는 것을 코드 주석에 남긴다**
  - [x] 5.4 멱등 저장소는 판 확정과 함께 버린다
  - [x] 5.5 마감 — 제한 시간 60초, 미제출 최하위, 동률 무작위, 전원 미제출 무효
  - [x] 5.6 회귀 주입으로 T13·T52 확인
  - [x] 5.7 Verify: `./gradlew :game:feature:test --tests "*PartyScoring*"`

**Acceptance Criteria:**
- 제출 DTO 에 점수 필드가 없다 — 폴백할 값 자체가 없다
- 마감이 항상 결과를 만든다 (자리가 멈추지 않는다)

---

### Task Group 6: 결과 해시 다수결

**Dependencies:** Task Group 2, Task Group 5
**Phase:** core
**Required Skills:** Kotlin, Kotest

- [x] 6.0 해시 판정을 세운다
  - [x] 6.1 테스트 5개: T25(갈리고 다수가 없으면 무효, 2회 연속이면 게임 잠금) · T60(**거짓 해시 하나로는 무효가 안 된다** — 다수가 결과, 소수는 이탈) · **T66(해시 제출이 좌석 토큰을 요구하고 좌석당 한 건만 센다 — T60 이 서 있는 바닥이다. 없으면 외부인이 다수를 쥐고 어느 결과를 방의 결과로 만들지 고른다)** · T64(방장 종료 신호 무시) · T65(무효는 열거된 셋에서만)
  - [x] 6.2 해시를 좌석 토큰과 함께 채점 서버가 받아 다수결로 판정한다
  - [x] 6.3 소수 기기에 「내 화면이 방과 달라졌다」를 알린다
  - [x] 6.4 릴레이는 **도착 수만** 센다 — 값 비교는 하지 않는다
  - [x] 6.5 회귀 주입으로 T25·T60·T66 확인 — T66 은 둘(토큰 검사 제거 / 같은 좌석 두 번째 해시를 함께 세기)
  - [x] 6.6 Verify: `./gradlew :game:feature:test --tests "*RoundVerdict*"`

**Acceptance Criteria:**
- 참가자 한 명이 재추첨을 만들 수 없다
- **좌석 없는 사람은 해시를 못 보낸다** — 다수를 쥐어 결과를 고르는 경로가 없다
- 판 종료·무효를 사람이 부를 수 없다

---

### Task Group 7: 결정적 재생 — 검사 배선과 `sin/cos` 교체

**Dependencies:** None
**Phase:** core
**Required Skills:** JavaScript, Vitest

**이 그룹이 없으면 뒤의 모든 게임 검사가 시뮬 사본을 보게 된다.** 배선이 먼저다.

- [x] 7.0 게임 시뮬을 검사 가능하게 만들고 엔진 동일성을 확보한다
  - [x] 7.1 W1 배선: 가짜 `window` 에 `rng`·`physics`·`courses`·`parts`·`game` 을 올려 실행하는 로더 + 테스트 위치 확정 + `vitest.config.ts` 의 `include` 확장
  - [x] 7.2 테스트 5개: T1(같은 입력 두 번 → `Game.state().order` 같다) · T2(시드 다르면 다르다) · T3(**출하 시뮬 파일에 `Math.sin/cos/tan` 호출 없음** + 고정 각도 값 표) · T4·T5(비율·인원 수, 결정자 3종 각각)
  - [x] 7.3 `physics.js` 의 `Math.cos/sin` 호출 2곳을 정수 양자화 룩업으로 교체 — `art.js`·`fx.js` 는 렌더라 건드리지 않는다
  - [x] 7.4 다시보기 코드 재현성이 한 번 끊긴다는 안내를 화면에 붙인다
  - [x] 7.5 회귀 주입으로 T1·T3 둘(되돌리기 / **룩업을 `Math.sin` 으로 채우기**) 확인 — 두 번째가 이 그룹의 핵심이다
  - [x] 7.6 Verify: `pnpm --dir portal-fe vitest run games/`

**Acceptance Criteria:**
- 검사가 게임이 내놓은 `order` 를 본다 — 사본이 아니다
- 룩업을 `Math.sin` 으로 채우는 회귀에서 빨간불이 난다

---

### Task Group 8: 명부 규약 확장 · 결정자 3종 개조

**Dependencies:** Task Group 7
**Phase:** core
**Required Skills:** JavaScript, TypeScript, Vitest

**OQ-3(사다리가 비율을 어떻게 실현하나 — 한 사람이 여러 줄이면 이름이 여러 번 나온다)을 먼저 정한다.**

- [x] 8.0 인원 수·비율을 게임까지 흘린다
  - [x] 8.1 테스트 4개: T42(**`v` 가 1로 유지**되고 새 필드를 얹어도 배포된 파서가 받아낸다) · T45(`mode='order'` 에 인원 수 입력 없음) · T48(링크·QR 어느 문자열에도 별칭 없음) · T57(판 설정 미저장)
  - [x] 8.2 `party.ts`·`party.js` 에 선택 필드를 **가법 추가**한다. 버전은 올리지 않는다
  - [x] 8.3 결정자 3종이 인원 수·비율을 받아 각자 방식으로 실현한다 (구슬=구슬 개수, 카드=장수, 사다리=OQ-3 결정)
  - [x] 8.4 게임에 이미 있는 말을 새말로 덮지 않는다 — 배당률 어휘를 쓰지 않는다
  - [x] 8.5 회귀 주입으로 T42 확인 (`v` 를 2로 올리기)
  - [x] 8.6 Verify: `pnpm --dir portal-fe vitest run games/ src/pages/games/`

**Acceptance Criteria:**
- 배포된 파서가 새 필드가 붙은 페이로드를 그대로 받아낸다
- 3종 모두 인원 수와 비율이 실제로 결과에 반영된다

---

### Task Group 9: 공용 릴레이 클라이언트

**Dependencies:** Task Group 1
**Phase:** core
**Required Skills:** JavaScript

**파티보다 먼저 만든다.** 지금 온라인 3종이 각자 `index.html` 안에 사본을 갖고 있다 —
게임 21곳이 각자 토큰 읽기를 복사해 갖고 있다가 쿠키 전환이 통째로 지나간 사고와 같은 모양이다.

- [x] 9.0 `public/games/lib/relay.js` 를 만들고 모은다
  - [x] 9.1 테스트 1개: T59(릴레이에 붙는 게임이 공용 클라이언트를 쓴다 — 정적 게이트, T39 에 얹는다)
  - [x] 9.2 join·시작 명령·이동·ping·재접속을 한 곳에 모은다
  - [x] 9.3 기존 3종을 이관한다
  - [x] 9.4 **빈 좌석을 봇으로 채우는 관례를 파티가 상속하지 않게 한다** — 봇 충원은 서버가 아니라 클라이언트가 한다
  - [x] 9.5 Verify: `python3 scripts/lint-game-mobile.py --strict && pnpm --dir portal-fe vitest run games/`

**Acceptance Criteria:**
- 릴레이를 쓰는 게임에 WS 코드 사본이 남아 있지 않다

---

### Task Group 10: 카드 뽑기 입력 중계

**Dependencies:** Task Group 9
**Phase:** core
**Required Skills:** JavaScript

- [x] 10.0 입력형 비참여형을 성립시킨다
  - [x] 10.1 테스트 2개: T24(한쪽이 뒤집으면 다른 기기 판도 같아진다 — 중계를 끊으면 갈려야 한다) · T51(판당 릴레이 프레임이 시작 신호 한 건 + 입력 수)
  - [x] 10.2 「누가 몇 번째를 뒤집었다」를 릴레이로 뿌린다
  - [x] 10.3 Verify: `pnpm --dir portal-fe vitest run games/card-flip`

---

### Task Group 11: 카탈로그 신호 3축

**Dependencies:** None
**Phase:** core
**Required Skills:** Kotlin, Flyway, TypeScript

- [x] 11.0 게임 분류 신호를 세운다
  - [x] 11.1 테스트 4개: T37(새 필드를 안 읽는 게임은 조절 불가로 표시) · T38(목록이 선언에서 만들어진다 — 선언을 지우면 빠진다) · T46(태그 이름이 기존 `party` 와 안 겹친다) · T49(참여형이 `[랜덤]`에 안 섞인다)
  - [x] 11.2 신호 셋을 태그 축으로 만든다 — ① 명부 규약 ② 릴레이 ③ 입력이 결과를 바꾸는가
  - [x] 11.3 장르는 건드리지 않는다 (게임당 하나라 배타가 된다)
  - [x] 11.4 Verify: `./gradlew :game:feature:test --tests "*GameSchemaIntegration*" && pnpm --dir portal-fe vitest run src/pages/games/`

---

### Task Group 12: 파티 FE

**Dependencies:** Task Group 1, 3, 4, 6, 8, 9, 11
**Phase:** ui
**Required Skills:** React, TypeScript, Vitest

`DESIGN.md` 토큰 우선. hex 직접 입력 금지. 모바일 1순위 — 세로·가로 두 방향.

- [x] 12.0 방·초대·로비·선정 화면을 만든다
  - [x] 12.1 테스트 6개: T22(관전자 — 표 없음·좌석 없음·자리 비면 전환) · T23(자리 경합 거절 후 남은 자리 목록) · T26(늦참자 자리 픽 먼저 → 빨리 감기) · T27(**토글 제외가 그룹 원본을 안 바꾼다**) · T33(그룹 저장 실패해도 판 시작) · T36(방 유실 시 안내 + 명부 유지) · T58(파티 밖에서 그룹 사용)
  - [x] 12.2 방 만들기 → 코드·초대 링크·**QR(클라이언트에서 그린다)**
  - [x] 12.3 자리 픽 · 관전 입장
  - [x] 12.4 판 구성 — 제외 토글 · 걸리는 인원 · 비율
  - [x] 12.5 선정 — `[게임 픽]`/`[랜덤]`/`[참여형]` → 목록 → `[랜덤]`/`[하나 픽]`(투표)
  - [x] 12.6 막다른 길 없음 — 자리 픽 거절 · 판 무효 · 방 유실에 복귀 경로
  - [x] 12.7 별칭 렌더는 이스케이프를 거친다
  - [x] 12.8 Verify: `pnpm --dir portal-fe vitest run src/pages/party/ && pnpm --dir portal-fe exec tsc --noEmit`

**Acceptance Criteria:**
- 제외가 그룹을 바꾸지 않는다 — 이 스펙에서 가장 오해하기 쉬운 지점이다
- 되돌아갈 수 없는 화면이 없다

---

### Task Group 13: 참여형 게임 2종

**Dependencies:** Task Group 5, 9, 11
**Phase:** ui
**Required Skills:** JavaScript, Canvas, CDP

`docs/standards/game-cleanroom-pipeline.md` 가드레일. 게임 제작이라 각각이 별도 세션 규모다.
**코드 전에 목표 이미지를 만들어 확인받는다.**

- [ ] 13.0 7초를 맞춰라 · 원그리기 정확도
  - [ ] 13.1 테스트 3개: T39(정적 배선 게이트 — 모바일 규격 · 점수 제출 배선) · T40(세로 390×844 · 가로 844×390 CDP 실측) · T53(방침 일수 == 보존 상수, 두 파일을 텍스트로 읽어 비교)
  - [ ] 13.2 두 게임 제작 — 서버 채점 경로에 붙이고, 혼자서도 되게 한다
  - [ ] 13.3 랭킹은 **일반 게임 점수 보드**를 쓴다 (아케이드 리더보드가 아니다)
  - [ ] 13.4 카탈로그 시드 — `released_at` 을 채운다(BETA 로 넣으면 `NOW(6)`)
  - [ ] 13.5 **검증 브라우저는 측정이 끝난 시점에 닫는다** — start·측정·stop 을 한 명령으로
  - [ ] 13.6 Verify: `python3 scripts/lint-game-mobile.py --strict && ./gradlew :game:feature:test --tests "*GameSchemaIntegration*"`

---

### Task Group 14: 개인정보 · 관측 · E2E

**Dependencies:** Task Group 12, 13
**Phase:** release
**Required Skills:** TypeScript, Kotlin, CDP

- [ ] 14.0 약속을 지키는지 확인하고 완주한다
  - [ ] 14.1 테스트 4개: T34(별칭이 로그·메트릭·예외에 안 실린다 — 어펜더를 붙여 확인) · T35(HTML 이스케이프) · T41(**두 번째 판까지** 두 기기로 완주) · T62·T63(시드 판마다 재발급 · 원자적 발급)
  - [ ] 14.2 `/privacy` §6 에 친구 그룹 항목 추가 — 방침 숫자와 상수를 맞춘다
  - [ ] 14.3 관측 — 방 수·좌석 점유·유휴 종료(릴레이) / 채점 거부 사유별·해시 불일치(채점 서버)
  - [ ] 14.4 **장르 표준의 「이름은 이 기기 밖으로 나가지 않는다」를 함께 고친다**
  - [ ] 14.5 `docs/context-map.md` 에 `game` BC 행 추가 + `/hns:glossary` 실행
  - [ ] 14.6 Verify: `./gradlew :code-dictionary:app:build && pnpm --dir portal-fe vitest run && pnpm --dir portal-fe exec tsc --noEmit`

**Acceptance Criteria:**
- 픽스처 별칭 문자열이 로그 출력 전체에 없다
- 두 기기가 두 번째 판까지 같은 결과를 본다

---

## Execution Order

```
1. TG1 릴레이 확장 ─┬─ TG2 좌석 토큰 ─┬─ TG4 투표
                    │                  ├─ TG5 채점 ─┬─ TG6 해시 다수결
                    │                  │            └─ TG13 참여형 2종
                    └─ TG9 릴레이 클라 ─┴─ TG10 카드 입력 중계
2. TG3 친구 그룹     (독립)
3. TG7 결정적 재생   (독립) ── TG8 명부 확장·3종 개조
4. TG11 카탈로그 신호 (독립)
5. TG12 파티 FE      (TG1·3·4·6·8·9·11 이후)
6. TG14 개인정보·관측·E2E (마지막)
```

병렬 가능: **TG1 · TG3 · TG7 · TG11** 넷은 서로 안 건드린다.

## 구현 전에 답이 필요한 것

| OQ | 무엇 | 어느 그룹에서 |
|---|---|---|
| OQ-2 | 원그리기 채점식 (「위조 궤적이 만점을 받는가」를 선정 기준에) | TG5 |
| ~~OQ-3~~ | ~~사다리 비율~~ → **닫힘**: 한 사람이 줄을 여러 개 갖는다. 이름이 여러 번 나오는 것이 오히려 확률을 눈으로 보여 준다 | TG8 ✅ |
| ~~OQ-7~~ | ~~관전자~~ → **닫힘**: 좌석 배열 밖의 별도 목록. 배열에 넣으면 모든 경로에 필터가 붙는다 | TG1 ✅ |
| ~~OQ-8~~ | ~~회원 탈퇴 채널~~ → **닫힘**: member 가 game 내부 API 를 동기 호출 + 보존 스윕 그물 | TG3 ✅ |
| OQ-9 | 참여형을 정수 결정적 코어 위에 지을 것인가 | TG5 |

## 이 스펙 밖이지만 TG2 전에 닫혀야 하는 것

**`GAME_HMAC_SECRET` 이 클러스터에 주입돼 있지 않다.** 좌석 토큰이 그 위에 얹히므로,
주입 없이 TG2 를 배포하면 서명이 공개된 기본값으로 이루어진다. 지금 아케이드 세션 토큰이
같은 상태라는 것은 별건이다 — 사용자 판단을 기다린다.
