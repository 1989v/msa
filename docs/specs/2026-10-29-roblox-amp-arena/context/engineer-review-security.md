# Security Review — AMP ARENA 로블록스 (2026-10-29)

대상: `spec.md` · `planning/requirements.md` · `planning/test-quality.md` · `context/open-questions.yml` · `tasks.md`
기준: `docs/research/2026-10-26-roblox-development/README.md` §3(RemoteEvent 검증 · 네트워크 소유권) · `roblox/archer-command/src/server/Commands.luau`(명령 검사 선례) · `docs/standards/online-versus-lobby.md` §5(치트 범위 명시 선례)
위협 모델: 로블록스 클라이언트–서버 경계. 웹 서비스 보안(JWT·DB)은 무관. 코드 근거는 선행 프로젝트 `roblox/archer-command/` 에서 인용했다(`roblox/amp-arena/` 는 Config·Styles·Accessories 만 있는 상태).

## 체크리스트 판정

| # | 항목 | 판정 | 근거 |
|---|---|---|---|
| 1 | 위협 모델링(STRIDE) | REVISE | 명령 검증은 있으나 **클라이언트 소유 물리 신뢰 범위** 미명시 → F1 |
| 2 | 인증/인가 경계 | REVISE | `OnServerEvent` 의 player 가 신원이라 스푸핑 없음. `loadout`·`ready` 의 단계 게이트 없음 → F4 |
| 3 | 민감 데이터 흐름 | PASS | PII 없음(Roblox DisplayName 뿐), 저장 없음(requirements.md:36), 자유 텍스트 입력 없음 |
| 4 | 입력 검증 바운더리 | REVISE | spec.md:53 enum·유한 Vector3·빈도 정의됨. 빠진 것: 버킷 파라미터 · ProximityPrompt 거리 · 영벡터 → F2·F3·F5 |
| 5 | 서비스 간 통신 | PASS | 단일 서버. 맵·템플릿은 ServerStorage(spec.md:62), 클라이언트→서버 모듈 불참조 게이트(spec.md:67) |
| 6 | 시크릿 | PASS(N/A) | 키·HTTP·DataStore 없음. 공유 모듈은 밸런스 수치뿐 |
| 7 | 암호화 | N/A | Roblox 전송 계층 |
| 8 | 감사 로깅 | PASS(N/A) | 영속 상태 없음. 순위·저장이 들어오면(requirements.md:36 후속) 재검토 |
| C1 | PCI | N/A | — |
| C2 | 변경 권한 검증 | PASS | 점수·KO 크레딧·HP·팀은 서버 계산(spec.md:26, 48, 49) |
| C3 | Rate Limiting / Abuse | REVISE | 토큰 버킷은 있으나 수치 미정, 잡기 탈출 연타와 충돌 · 아군 KO 무패널티 → F2·F6 |

## Findings

### F1 (체크 1) 치트 방어 범위가 명시돼 있지 않다
- 스펙: 히트 기하(spec.md:42)·잡기 성립(spec.md:45)·링아웃(spec.md:48)·착지 판정 `FloorMaterial`(spec.md:43)이 전부 **캐릭터 루트 Position·CFrame·Humanoid 상태**를 읽는다. 이동 잠금은 `WalkSpeed 0`·`JumpPower 0`·`AutoRotate false`(spec.md:46)다.
- 로블록스에서 플레이어 캐릭터 물리는 그 클라이언트가 소유한다. 위 값은 모두 소유 클라이언트가 보고하는 값이고, `WalkSpeed 0` 은 소유 클라이언트가 로컬에서 되돌리면 서버가 모른다. 넉백 `LinearVelocity`(spec.md:43)도 소유 클라이언트가 시뮬한다(requirements.md:28 이 이미 그렇게 적었다).
- 기준 문서: README.md:64 「“서버에서 요청 검증”과 “모든 물리 치트 방어 완료”는 별도 검증 항목으로 취급한다. 이 첫 구현은 경쟁 랭킹용 치트 방어를 인증한 상태가 아니다」. 스펙의 UNVERIFIED(spec.md:69)에 이 항목이 없다.
- 선례: online-versus-lobby.md:97 「어느 쪽도 치트를 막지 않는다 … 막지 않는다고 적어 둔 것이지 빠뜨린 것이 아니다」.
- **수정안**: spec.md §네트워크 끝에 「신뢰 경계」 문단 추가. 서버가 갖는 것(명령 검증·상태 머신·HP·점수·팀·아이템) / 소유 클라이언트를 믿는 것(위치·정면·속도·착지·히트스턴 중 정지) / 막지 않는 것(스피드·텔레포트·비행·넉백 무시·히트스턴 중 이동) / 수용 근거(저장·순위 없음 requirements.md:36, 공개는 OQ5 별도 승인) / 재검토 시점(공개·순위 도입 전). spec.md:69 UNVERIFIED 와 README 「검증하지 않는 것」에도 한 줄.

### F2 (체크 4·C3) 토큰 버킷 수치가 없고, 선례 값은 격투 입력과 충돌한다
- 스펙: spec.md:53 「초당 20」 한 마디. spec.md:32 `Commands.luau` 「명령 모양 검사·토큰 버킷」.
- 선례: Commands.luau:21 `CAP, REFILL = 20, 2` — 버스트 20, **초당 2 회복**. RTS 명령에는 맞지만 격투에는 안 맞는다: spec.md:45 잡기 탈출은 「약공 6회 연타」를 HELD 최대 2초 안에 요구하고, `guard{on/off}` 토글·사슬 연타가 더해지면 몇 초 만에 버킷이 비어 정상 플레이어가 RATE 로 조용히 버려진다(requirements.md:47 거부는 토스트 없음 → 원인을 알 길이 없다).
- 반대로 버스트 20 을 그대로 두면 치트 클라이언트가 한 프레임에 약공 20개를 보내 탈출 6회를 즉시 채운다.
- **수정안**: ① `Config.LIMITS` 에 `commandBurst`·`commandRefillPerSecond` 를 명시(예: 20 / 20)하고 spec.md:53 에 두 값을 적는다. ② HELD 탈출 카운트는 **Heartbeat 틱당 1회(또는 최소 간격 ≥ 0.08초)** 만 센다고 spec.md:45 에 적는다 — 버스트가 탈출 시간을 줄이지 못하게. ③ `Commands.forget(player)` 를 PlayerRemoving 에서 호출(선례 Main.server.luau:125)한다고 spec.md:26 「플레이어 등록」에 해제까지 적는다.

### F3 (체크 4) ProximityPrompt 줍기에 서버 거리 재확인이 없다
- 스펙: spec.md:28 「ProximityPrompt 줍기」, spec.md:67 게이트 「줍기는 ProximityPrompt(클라이언트 E 바인딩 없음)」. `MaxActivationDistance` 는 클라이언트 쪽 UI 조건이라 치트 클라이언트는 거리와 무관하게 `Triggered` 를 발생시킬 수 있다.
- 선례가 같은 구멍을 갖고 있다: Towers.luau:70 `prompt.Triggered:Connect(function(player) Towers.toggleGarrison(player, tower) end)` → Towers.luau:77-92 는 플레이어↔탑 거리를 보지 않는다(85행은 아군↔플레이어 거리). 그대로 베끼면 하트·폭탄을 맵 어디서든 줍는다.
- **수정안**: `Items.luau` 의 Triggered 핸들러 조건을 spec.md:28 에 명시 — 플레이어 루트와 아이템 거리 ≤ `MaxActivationDistance + 2`, 상태가 idle/walk/guard(held·down·dead 아님), 폭탄은 이미 들고 있지 않을 때. 실패는 조용히 무시. verify.py 게이트에 「Items Triggered 핸들러 본문에 거리 검사 포함」 추가(F7).

### F4 (체크 2) `loadout`·`ready` 에 단계 게이트가 없다
- 스펙: spec.md:41 「서버가 상태별로 받는다」는 `intent` 에만 걸려 있고, spec.md:53 `loadout{style,accessory}`·`ready` 는 단계 제한이 없다. spec.md:12 준비는 로비 20초다.
- 매치 중 `loadout` 을 받으면 스타일(몸집·스탯·HP 배율, requirements.md:30)을 전투 중 바꾸거나 액세서리 재장착으로 쿨다운을 초기화할 수 있다.
- **수정안**: spec.md:53 에 「`loadout`·`ready` 는 로비/준비 단계에서만 받고, 카운트다운에 확정한다. 다른 단계에서는 조용히 버린다」. Rules 「장비 검증」(spec.md:24, test-quality.md:5 「직업 외 액세서리는 맨손」)은 그대로 둔다.

### F5 (체크 4) `throw{dir}` 정리 규칙이 「유한」까지만이다
- 스펙: spec.md:53 「Vector3 유한」, spec.md:45 「던지기 = 방향(이동 입력 또는 정면) 수평 24·상승 14」.
- 선례 Commands.luau:5-8 `finiteVector` 는 NaN·1e4 상한만 본다. 영벡터를 `.Unit` 하면 NaN 이 되고, 크기가 큰 벡터를 그대로 곱하면 던지기 속도가 커진다. test-quality.md:5 「입력 정리(NaN/범위)」에 영벡터·정규화가 없다.
- **수정안**: `Rules.sanitizeDirection(dir, facing)` — Y 제거, 크기 < 0.05 면 `facing`, 아니면 정규화. test-quality.md:5 에 영벡터·과대 크기 케이스 추가.

### F6 (C3) 아군 KO 패널티가 빠졌다
- 스펙: spec.md:42 「팀전에서도 아군이 맞는다」, spec.md:48 크레딧은 자멸 −1 만 정의. 아군을 KO 한 경우의 점수가 없다.
- 의도 원본 amp-arena/docs/GDD.md:296 「아군 KO 는 팀 점수 없이 KO −1」.
- **수정안**: spec.md:48 에 「아군 KO = 팀 점수 없음 · 개인 KO −1」 한 줄. 팀킬 반복(그리핑)의 최소 억제 장치다. 강퇴·투표는 범위 밖으로 두고 Roblox 신고·차단에 맡긴다고 적는다.

### F7 (체크 1·검증) 보안 조건이 게이트·테스트에 없다
- 스펙: spec.md:67 네이티브 게이트 목록에 경계 관련 항목이 없다. spec.md:66 `rules.spec.luau` 대상에 `Commands` 가 없다.
- 선례도 없다: archer-command/tools/verify.py:60-147 에 `Commands.validate` 배선 검사가 없고(RemoteEvent 개수만 64행), archer-command/tests/rules.spec.luau 에 Commands 테스트가 없다.
- `Commands` 는 Roblox API 없음(spec.md:32)이라 luau CLI 로 실행 가능하다.
- **수정안**: ① verify.py 게이트 — 서버 코드에 `OnServerEvent` 연결이 정확히 하나이고 그 본문이 `Commands.validate` 를 거쳐 디스패치한다 · Items Triggered 핸들러에 거리 검사가 있다. ② `rules.spec.luau` 에 Commands 단언 — 미지 name · enum 밖 값 · NaN Vector3 · 영벡터 · args 비테이블 · 버스트 초과 후 RATE · forget 뒤 버킷 리셋. ③ 회귀 주입 ≥ 12(spec.md:68)에 「validate 호출 제거」·「거리 검사 제거」 두 건 포함.

## 관찰 (조치 불요)
- spec.md:55 `Remotes.State` 가 FireAllClients 인데 「내 가드·쿨다운·탄」이 들어 있다. 전원 값이 전원에게 가는 모양이면 정보 노출이지만 가드는 이미 Attribute 로 복제되고(spec.md:56) 격투 게임에서 쿨다운 가시성은 수용 가능하다. 모양 정리는 implementation 차원.
- 자유 텍스트 입력이 없어 TextService 필터 의무가 없다. 채팅·엠블럼·닉네임이 후속으로 들어오면 그때 필터를 건다.
- 웹판은 방장 권위·릴레이(online-versus-lobby.md:93, GDD.md:345 「판정 신뢰는 클라이언트 보고」)였고 로블록스판은 서버 권위다. 신뢰 수준이 올라간 쪽이며, F1 은 그 안에서 남는 한계를 적으라는 것이다.

## 판정
REVISE — 7건, 전부 비차단. 스펙 결정이 문서·코드 표준을 위반하는 곳은 없고, 빠진 것은 ① 신뢰 경계 선언(F1) ② 빈도·거리·단계·방향 정리 규칙의 구체화(F2~F5) ③ 팀킬 패널티(F6) ④ 그 규칙들을 재는 게이트(F7)다.

VERDICT: REVISE
