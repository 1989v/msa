# Usecase review — REVISE (round 1)

읽기만 했다. 대상: `spec.md` · `planning/requirements.md` · `planning/test-quality.md` · `context/open-questions.yml` · `tasks.md`. 기준: `docs/research/2026-10-26-roblox-development/README.md` §0·§7, `roblox/AGENTS.md`, 선행 `roblox/archer-command/` 스펙·status, 웹 참고작 `amp-arena/docs/GDD.md`(의도 참고만). 코드 근거는 지금 있는 `roblox/amp-arena/src/shared/Config.luau`·`Accessories.luau`.

핵심 루프(로비 → 준비 20초 → 카운트다운 → 매치 → 결과 → 로비)와 전투 규칙은 충분히 구체적이다. 빠진 것은 **라운드 흐름의 가장자리**다 — 준비 단계에서 플레이어가 실제로 무엇을 고르는지, 매치가 어떻게 끝나고 누가 이기는지, 사람이 중간에 죽거나 나가면 어떻게 되는지. 전부 Studio 1인 + 봇 3 플레이(수용 기준)에서 첫 세 라운드 안에 부딪히는 지점이다.

## Findings

1. **Check 2·3 (주 흐름·사전조건) — 준비 단계의 선택지와 기본값이 없다.**
   `spec.md:12` 는 「준비 20초: 스타일·액세서리 선택」, `spec.md:53` 은 `loadout{style,accessory}` + `ready` 명령, `spec.md:55` 는 State 에 「준비 수」를 싣는다. 그런데 (a) `ready` 가 타이머를 당기는지(전원 준비 → 즉시 카운트다운?) 아니면 표시만인지, (b) 20초 안에 아무것도 고르지 않은 플레이어의 기본 장비, (c) 액세서리는 직업당 1(`spec.md:22`)이라 선택이 사실상 「직업 전용 1 또는 맨손」인데 맨손 선택지가 스펙에 없다 — 코드에는 이미 있다(`roblox/amp-arena/src/shared/Accessories.luau:9` `none = 맨손`), 검사 행도 「직업 외 액세서리는 맨손」을 전제한다(`planning/test-quality.md:5`). 이전 라운드 장비가 다음 라운드에 유지되는지도 없다.
   → `spec.md` 핵심 루프 아래 한 단락: 선택지 = 스타일 5 × {전용 액세서리, 맨손}. 미선택 기본 = 파이터+맨손(또는 직전 라운드 장비 유지). `ready` 는 「사람 전원 준비면 남은 시간을 3초로 당긴다」처럼 효과를 명시하거나, 효과가 없으면 명령 목록에서 뺀다.

2. **Check 2·4 (종료 흐름·AC) — 매치 종료 조건·승자·동점 규칙이 스펙에 없다.**
   `spec.md:12`·`requirements.md:27` 은 모드별 시간(3분·3분·2분)만 적고, `spec.md:24` 는 `Rules` 에 「모드 승자」가 있다고만 한다. 서바이벌의 「최후 1인/1팀 생존 시 조기 종료」, 시간 종료 시 동점 처리(개인: 데스 적은 순? 준 피해?), 팀전 아군 KO 의 점수(`spec.md:42` 「팀전에서도 아군이 맞는다」까지만), 자멸 −1(`spec.md:48`)이 순위에 어떻게 들어가는지가 없다. 코드는 이미 `POINTS = { ko = 100, damage = 1, win = 50 }` 로 점수제를 깔았는데(`Config.luau:36`) 스펙 어디에도 「점수」 정의가 없다. 검사 행은 「모드 승자·동점」을 단언한다고 하지만(`planning/test-quality.md:5`) 단언할 규칙이 스펙에 없으니 검사가 스스로 규칙을 정하게 된다. 웹 참고작의 의도는 `amp-arena/docs/GDD.md:288-296`(서바이벌 동점 = 남은 HP 비율, 데스매치 동점 = 데스 적은 순 → 준 피해, 아군 KO = KO −1).
   → 전투 규칙 절에 「모드와 승패」 표 한 개: 모드 | 종료 조건(시간·생존자) | 순위 키(1차·2차·3차) | 아군 KO·자멸 처리. `POINTS` 를 쓸 거면 점수 = KO×100 + 피해×1 + 승리 50 을 적고, 안 쓸 거면 코드에서 뺀다.

3. **Check 5 (에지) — 서바이벌에서 사람이 먼저 죽으면 관전 없이 최대 2분을 로비 발판에서 기다린다.**
   `spec.md:49` 「서바이벌은 관전 없이 로비 발판에서 대기」 + `spec.md:14` 「4 미만이면 봇이 채운다」 + `Config.luau:24,34`(서바이벌 120초, fillTo 4). 수용 기준인 Studio 1인 플레이(`planning/test-quality.md:10`)에서 세 번째 라운드가 서바이벌이고, 사용자가 먼저 KO 되면 봇 3이 끝낼 때까지 아무것도 못 본다. 첫 판부터 어려워야 한다는 원칙(`requirements.md:19`)과 맞물려 이 경우는 흔하다.
   → 종료 조건에 「사람 생존자 0 이면 즉시 결과」 또는 「봇만 남으면 즉시 결과」를 넣는다. 아니면 관전(범위 밖, `requirements.md:39`)을 서바이벌 한정으로 최소 허용한다. 둘 중 하나를 스펙이 골라야 한다.

4. **Check 2·5 (대체·예외 흐름) — 매치 중 퇴장·늦은 입장·팀 배정 규칙이 없다.**
   `spec.md:14` 는 늦은 입장만(「다음 라운드 참가」) 적고, `Players.PlayerRemoving` 경로가 전혀 없다: 서바이벌 중 나간 사람은 생존자 수에서 빠지는가, 나간 사람이 KO 크레딧 대상(3초 안 마지막 타격자, `spec.md:48`)이면 누구에게 가는가, 늦게 들어온 사람이 있으면 다음 라운드 봇 수를 다시 세는가(fillTo 4, `Config.luau:34`). 팀 DM 의 팀 배정도 없다 — `spec.md:26` 「팀」 한 단어, `Config.luau:38` 레드/블루 정의뿐. 웹판은 방장이 정했는데(`GDD.md:296`) Roblox 서버=방에는 방장이 없다. Studio 1인 + 봇 3 이면 2v2 로 사람+봇 vs 봇 2 인지 명시가 필요하다.
   → 핵심 루프 절에 세 줄: 퇴장 = 명단·팀에서 제거, 진행 중 매치는 남은 인원으로 계속(서바이벌 생존자 재계산), 크레딧 대상이 없으면 자멸 처리. 라운드 시작 시 봇 수 = max(0, 4 − 사람 수). 팀 = 라운드 시작 시 KO 순(또는 입장 순) 번갈아 배정, 봇도 같은 규칙.

5. **Check 3·5 (사후조건·라운드 전환) — 결과 → 로비 전환의 정리 순서가 없다.**
   `spec.md:63` 「맵은 매치마다 Workspace 로 Clone, 끝나면 Destroy」 + `spec.md:12` 「결과 10초 → 로비」. 플레이어를 로비로 옮기기 전에 맵을 지우면 서 있던 캐릭터가 fallY 아래로 떨어져 **매치가 끝난 뒤 링아웃 KO** 가 난다(`spec.md:48` 규칙이 단계를 가리지 않는다). 같은 시점에 들고 있던 폭탄(`spec.md:28`)·HELD/Weld 상태(`spec.md:45`)·날아가는 투사체(`spec.md:29`)가 어떻게 정리되는지, 결과 단계에서 입력을 받는지, 로비로 돌아올 때 KO/데스/가드 게이지·쿨다운이 초기화되는지가 없다.
   → 라운드 단계 전이표(로비·카운트다운·매치·결과 — 게이트가 「라운드 단계 4」를 세므로 `spec.md:67`)에 단계별 「입력 허용 / 판정 허용 / 진입 시 하는 일」 세 칸. 결과 진입 = 판정 정지 → 상태 리셋 → 로비 스폰으로 이동 → 맵 Destroy 순서를 적는다.

6. **Check 4·6 (AC 추적·검사 매핑) — 수용 시나리오가 순환 순서에 기대는데 순환 규칙이 스펙에 없고, 보존 재미 1번이 시나리오에 없다.**
   e2e 행(`planning/test-quality.md:10`)은 「콜로세움 FFA 첫 60초 → 스카이독에서 던지기 링아웃」이다. 이 순서는 `Config.luau:26,32` 의 MODE_ORDER/MAP_ORDER 가 우연히 보장하지만 스펙은 「맵×모드」(`spec.md:12`)·「맵·모드 순환」(`requirements.md:27`)이라고만 적어 모드 3 × 맵 2 가 어떻게 짝지어 도는지(라운드 2 가 스카이독 팀 DM 인지) 모른다. 그리고 `requirements.md:16` 이 첫째로 보존한다는 「액세서리 하나가 기술을 통째로 바꾼다」가 유닛(`test-quality.md:5-6`)에만 있고 사용자가 보는 시나리오에는 없다.
   → 스펙에 순환 식 한 줄(라운드 n: 모드 = MODE_ORDER[(n−1) mod 3 + 1], 맵 = MAP_ORDER[(n−1) mod 2 + 1] → 1 콜로세움·개인 DM, 2 스카이독·팀 DM, 3 콜로세움·서바이벌 …). e2e 행에 「준비 단계에서 액세서리 ↔ 맨손을 바꾸면 약공 사슬·기술이 달라진다」를 추가. 터치·게임패드·8인은 지금처럼 UNVERIFIED(`spec.md:69`)로 두되 e2e 행에 「제외」를 적어 수용 범위가 조용히 넓어지지 않게 한다.

7. **Check 1 (액터·표준 적용 범위) — 온라인 대전 로비 표준과의 관계를 한 줄로 못 박아야 한다.**
   `docs/standards/online-versus-lobby.md:4-6` 은 「사람과 붙는 온라인 대전 게임 전부 … 게임마다 다시 설계하지 않는다」이고 `:34` 는 「매치 중 입장은 없다」인데 `spec.md:14` 는 「매치 중 입장은 다음 라운드 참가」다. 표준의 다섯 진입로·방장·릴레이(`online-versus-lobby.md:16-17`, §5)는 웹 릴레이 전제라 Roblox 서버=방(입장은 플랫폼이 한다)에는 맞지 않고, 로블록스 원칙(`roblox/AGENTS.md:5`, `docs/research/2026-10-26-roblox-development/README.md:20` 「저장·네트워크 … 다시 설계」)이 더 최신·사용자 확정이다. 충돌 자체는 판단거리가 아니지만 **적용 제외를 적지 않으면** 다음 리뷰어가 같은 표준을 들고 BLOCK 을 건다.
   → `spec.md` 「승인과 범위」에 한 줄: 「`online-versus-lobby.md` 는 웹 릴레이 게임 표준이라 적용하지 않는다 — Roblox 는 서버가 방이고 입장·초대는 플랫폼이 한다. 보존하는 것은 대기실 문구 정신(준비·자동 시작)뿐」.

## Covered

- 액터·목표: 플레이어(Studio 의 개발자 본인) · 봇(같은 상태 머신에 의도만, `spec.md:50`) · 서버 권위(`requirements.md:28`). 1인 + 봇 3 이 기본 시나리오라는 점은 `spec.md:14`·`Config.luau:34` 가 일치한다.
- 주 흐름의 전투 부분은 상태별 입력 수용(`spec.md:41`), 피격 분기(경타/강타/가드/잡기, `:42-45`), 이동 잠금(`:46`), 링아웃·KO·리스폰(`:48-49`)까지 조건이 수치로 적혀 있다.
- 기술적 예외는 있다: dt 상한 0.1(`spec.md:40`), 명령 검사·조용한 거부(`spec.md:53`, `requirements.md:47`), 아바타·애니·소리 실패 시 BlockRig·무음(`requirements.md:49`), 봇 절벽 멈춤(`spec.md:50`, 웹판 자멸 36% 교훈 `GDD.md:228`).
- 검사 매핑: 유닛(luau CLI) ↔ 공유 모듈, 컴포넌트(python) ↔ 빌더·네이티브 게이트, e2e ↔ 사용자 Studio 플레이로 갈라져 있고 회귀 주입 ≥ 12 RED(`spec.md:68`) 조건이 선행 `archer-command`(`docs/specs/2026-10-28-roblox-archer-native/status.md:85`) 과 같은 모양이다. UNVERIFIED 목록(`spec.md:69`)은 README §7 의 구분과 맞는다.

## 수정 뒤 기대

Finding 1·2·4·5 는 `spec.md` 에 표 두 개(모드와 승패 · 라운드 단계 전이)와 단락 하나(준비·퇴장·팀 배정)로 닫힌다. Finding 3 은 선택 하나. Finding 6·7 은 각 한 줄. 구현이 `Config.luau`·`Accessories.luau` 까지 진행됐으니 코드가 이미 정한 것(맨손·POINTS·MODE_ORDER)을 스펙이 따라 적는 쪽이 빠르다.

Round 1 VERDICT: REVISE

## Round 2 (2026-10-29) — REVISE

읽기만 했다. 1차 이슈 7건을 개정된 `spec.md` 와 구현(`roblox/amp-arena/src/server/Main.server.luau`·`Combat.luau`·`Items.luau`·`src/shared/Rules.luau`·`Config.luau`·`tests/rules.spec.luau`·`README.md`)으로 대조했다. 1차 이슈는 전부 스펙에 반영됐고 5건은 코드와도 일치한다. 남은 것은 **스펙이 새로 적은 문장과 코드가 어긋나는 두 곳**이다 — 둘 다 1차가 요구한 가장자리(퇴장·승자)이고 수정 방향이 자명하므로 REVISE.

### 1차 이슈 해소 대조

| # | 1차 요구 | 스펙 | 코드 | 판정 |
|---|---|---|---|---|
| 1 | 준비 선택지·기본값·`ready` 효과 | `spec.md:16`(맨손 용어)·`:86`(기본 파이터·맨손, 로비에서만)·`:99`(전원 준비 → 1초 뒤, 사람 0 이면 로비 유지) | `Main.server.luau:265`(기본 장비)·`:287-293`(전원 준비 → `phaseEnds = min(…, now+1)`)·`:316`(사람 0 → 로비 연장)·`Hud.client.luau:163`(준비/준비 취소 토글)·`README.md:9` | 해소. 「직전 라운드 장비 유지」만 스펙에 없다 — 코드는 유지한다(`Main.server.luau:236` 이 `e.loadout` 을 건드리지 않음). 아래 소항목 |
| 2 | 모드·승패·동점·아군 KO 표, `POINTS` 거취 | `spec.md:90-96` 표 + 순위 키 | `Rules.luau:159-181`(KO↓→데스↑→피해↓, 팀 합산)·`:193-198`(시간·최후 1인)·`Main.server.luau:253-254`(아군 KO −1, 링아웃 자멸 −1)·`tests/rules.spec.luau:94-98` | 표는 해소. **서바이벌 시간 종료 승자가 코드와 다르다** → Finding A. `POINTS` 는 스펙에 없는데 코드에 남아 있다 → 소항목 |
| 3 | 서바이벌 먼저 KO 시 대기 | `spec.md:104` 「3초 뒤 로비 발판, 최대 2분 대기, OQ6」 + `open-questions.yml:26-30` | `Main.server.luau:258-260`(사람은 서바이벌에서도 3초 뒤 리스폰 예약)·`:324-327`(`alive=false` 로 `respawnHuman`)·`:106-111`(alive 아니면 로비 스폰) | 해소(알려진 한계로 결정). 스펙이 선택했으므로 더 묻지 않는다 |
| 4 | 퇴장·늦은 입장·팀 배정·봇 재계산 | `spec.md:97`(팀 번갈아)·`:102`(늦은 입장 `joined=false`)·`:103`(퇴장 정리 + 폭탄 드랍) | `Main.server.luau:271-276`(PlayerRemoving → `Combat.leave`)·`:106`(`joined` 로 아레나/로비 분기)·`:192-193`(라운드마다 `botsNeeded`)·`:198-200`+`Rules.luau:200-204`(id 정렬 번갈아)·`tests:99` | 팀·입장·봇 수는 해소. **퇴장·KO 시 폭탄 드랍이 코드에 없다** → Finding B |
| 5 | 결과 → 로비 정리 순서 | `spec.md:105` 순서 7단계 | `Main.server.luau:233-241` 이 같은 순서(봇 제거 → 아이템·투사체 → 파이터 해제 → 아레나 Destroy → 조명 → 로비 → LoadCharacter). 결과 단계는 `Combat.update` 를 돌리지 않고(`:322-334`) 입력도 `match` 에서만 받는다(`:295,299`) | 해소. 맵 Destroy 전에 파이터를 해제하므로 결과 뒤 링아웃 KO 는 나지 않는다 |
| 6 | 순환 식·보존 재미 1번 시나리오·수용 범위 | `spec.md:98`(순환 식)·`:134-139`(시나리오 5개, 2번이 액세서리 교체) | `Rules.luau:211-215`·`tests:102-105`(6라운드 전 조합)·`README.md:13` | 해소. `planning/test-quality.md:12` e2e 행은 아직 1차 문장 그대로 — 소항목 |
| 7 | 로비 표준 비적용 문장 | `spec.md:9` | — | 해소 |

### Findings

**A. Check 2·4 (종료 흐름·AC) — 서바이벌 시간 종료 승자: 스펙은 「KO 순」, 코드는 「명단 순서상 첫 생존자」.**
`spec.md:95` 「서바이벌 … 승리 최후 1인 · 동점 시간 종료 시 KO 순」. 코드는 `Main.server.luau:220-222` 가 종료 사유를 보지 않고 `Rules.survivalWinner(list)` 를 부르고, `Rules.luau:188-191` 은 명단을 돌다 **처음 만나는 `alive`** 를 돌려준다. 명단 순서는 `Main.server.luau:157-172`(사람 해시 순 → 봇 해시 순)라 시간 종료 시 생존자가 둘 이상이면 승자 별(`Hud.client.luau:192,196` 「승리」)이 KO 와 무관하게 붙는다. 2분 안에 봇 셋을 다 못 보낸 사람 플레이어(수용 시나리오 5, `spec.md:139`)가 바로 이 경우다. 검사는 생존자 1 경우만 단언한다(`tests/rules.spec.luau:96,98`).
→ `endMatch` 에서 `reason == "time"` 이면 생존자만 추려 `Rules.rank` 의 1위를 승자로(또는 `Rules.survivalWinner` 가 생존자 중 KO↓→피해↓ 1위를 돌려주게) 고치고, `tests/rules.spec.luau` 에 「생존 2 · 시간 종료 → KO 많은 쪽」 단언 한 줄. 스펙 `spec.md:95` 는 「**생존자 중** KO 순 → 피해」로 범위를 적는다(죽은 사람이 KO 로 생존자를 이기지 않게).

**B. Check 2·5 (예외 흐름) — 「죽거나 나가면 폭탄은 그 자리에 떨어진다」가 두 경로 모두에서 실행되지 않는다.**
`spec.md:87` 「죽거나 나가면 그 자리에 떨어진다」, `spec.md:103` 「퇴장: … 들고 있던 폭탄은 떨어진다」. 코드: (KO) `Combat.luau:393` 이 `cleanup(V)` 로 `F.item = nil`(`:388`) 을 먼저 하고 `:400` 에서 `hooks.ko` 를 부르므로, `Main.server.luau:256` 의 `if V.item then Items.dropHeld(V)` 는 항상 거짓이다. (퇴장) `Main.server.luau:274` 는 `Items.dropHeld` 없이 `Combat.leave` 만 부르고 `Combat.luau:428-433` 도 아이템을 `nil` 로만 둔다. 결과: 폭탄 레코드의 `holder` 가 죽은/나간 파이터를 가리킨 채 남고(`Items.luau:112`), 파트는 `CanCollide=false` 그대로(`:117`) 바닥을 뚫고 떨어지며, 줍기(`:108` `rec.holder` 검사)·봇 탐색(`:173`)에서 빠진다. 신관이 줍는 순간 시작되므로(`:114`) 최대 3초 뒤 어디선가 터지는 것으로 끝나긴 한다(`:215`) — 드랍만 되지 않는다. 드랍이 실제로 도는 경로는 `toLobby` 의 `Items.clear`(`Items.luau:203`)뿐이다.
→ `Combat.ko` 에서 `hooks.ko` 를 `cleanup` 앞에 부르거나(또는 `cleanup` 이 `F.item` 을 건드리지 않고 Main 이 떨군 뒤 지우게), `PlayerRemoving` 에서 `Combat.leave` 전에 `Items.dropHeld(e.F)`. 스펙은 그대로. 이 경로는 Studio 에서만 보이므로 UNVERIFIED 목록(`spec.md:132`)에 「KO·퇴장 시 폭탄 드랍 위치」를 한 항목 더한다.

### 남은 소항목 (문구·정리 수준, 판정에 넣지 않음)

- `spec.md:86` 에 「장비는 라운드를 넘어 유지된다(바꾸지 않으면 직전 장비)」 한 구 — 코드가 이미 그렇게 동작한다(`Main.server.luau:236,265`).
- `Config.luau:36` `POINTS` + `Rules.luau:157` `score` + `tests/rules.spec.luau:101` 은 서버·클라이언트 어디서도 쓰지 않는다(grep 결과 세 곳뿐). 스펙 표(`spec.md:90-96`)가 점수제를 채택하지 않았으니 셋을 지운다(YAGNI).
- `planning/test-quality.md:12` e2e 행을 `spec.md:134-139` 시나리오와 맞춘다(액세서리 교체가 사슬을 바꾸는 장면 + 터치·게임패드·8인 제외).
- 수용 시나리오 4(`spec.md:138`) 「상자를 부수고 폭탄을 주워」는 드랍이 확률(`Config.luau:16` 폭탄 20%·하트 30%)이라 한 상자로 재현되지 않는다 — 「상자 6개 중 폭탄이 나올 때까지」 같은 전제 한 구.

### Covered (round 2 에서 새로 확인)

- 사람 0명 로비 유지(`spec.md:99` ↔ `Main.server.luau:316`), 로비 사망 2초 재세움(`spec.md:106` ↔ `:114-117`), 카운트다운 중 고정(`:93,211`), 매치 통계 리셋(`:192,211`), 가드·쿨다운은 `Combat.register` 로 새로 만들어진다(`Combat.luau:404-427`).
- 나간 공격자의 KO 크레딧: `Main.server.luau:250-254` 에서 `Combat.get` 이 nil 이면 가산 없음, 링아웃이면 자멸 −1. 스펙 `spec.md:25` 와 모순 없음.
- 검증기 게이트가 라운드 단계 4 와 아레나 Destroy·조명 복귀를 센다(`tools/verify.py:173-175`).

VERDICT: REVISE
