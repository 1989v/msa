# Architecture Review — AMP ARENA 로블록스 (2026-10-29)

리뷰 차원: architecture. 체크리스트: hns 0.15.1 `reviewers/architecture/checklist.md`.
기준 문서: `roblox/AGENTS.md`, `docs/research/2026-10-26-roblox-development/README.md` §0, 선행 프로젝트 `roblox/archer-command/`(읽기만). Kotlin/Spring 클린 아키텍처 규칙(`docs/conventions/package-structure.md`)은 JVM 서비스용이라 적용하지 않는다.

## Seed Discovery
- 스펙 폴더: `spec.md` · `planning/requirements.md` · `planning/test-quality.md` · `planning/initialization.md` · `planning/shaping-state.yml` · `context/open-questions.yml` · `tasks.md`.
- 표준: `roblox/AGENTS.md:5-13`, research README `§0`(`README.md:7-24`). `docs/standards/`·`docs/conventions/`·`.claude/rules/` 에 로블록스 항목 없음. `docs/product/glossary.md` 없음(용어집 미생성).
- KB(`HNS_KB_PATH`, 볼트 1989v): `wiki/index.md:370-372` 에 궁수 키우기 이식·재개발·피드백 raw 기록 3건. 개념 페이지 없음, 레포 문서와 충돌 없음.
- 코드: `roblox/amp-arena/src/shared/{Config,Styles,Accessories}.luau` 가 이미 있다(구현 착수). 선행 근거는 `roblox/archer-command/` 의 `Main.server.luau`·`Npc.luau`·`Commands.luau`·`Rules.luau`·`Config.luau`·`World.server.luau`·`tools/build.py`·`tools/verify.py`·`default.project.json`.

## 체크리스트 판정

| # | 항목 | 판정 | 근거 |
|---|---|---|---|
| L1 | 계층 책임 분리(shared 순수 / server 권위 / client 연출) | PASS | `spec.md:16-38` 모듈표, `spec.md:24` Rules 순수, `requirements.md:28` 서버 권위. `Config.luau:1-40` Roblox API 없음, `Styles.luau:3` 색을 CLI 용 `{r,g,b}` 표로 |
| L2 | 상향 의존 금지(client→server, shared→Roblox 서비스) | PASS | `spec.md:67` 게이트 2종. 선례 `archer-command/tools/verify.py:43-45` |
| L3 | 외부 연동은 포트 경유 | PASS | 클라이언트↔서버 경계는 Remotes 3개뿐(`spec.md:53-55`), 선례 `default.project.json:5` 와 같은 모양 |
| L4 | 모듈 경계 변경에 명시 근거 | REVISE | A1·A2 — 피해 진입점·KO 통지 방향·`throw` 소유가 미정 |
| L5 | 패턴 일관성(선행 프로젝트) | REVISE | A3·A4·A6 — Terrain 을 ServerStorage Clone 으로 옮기는 모순, 맵 기하 이중 원천, Rojo 파일 누락 |
| L6 | 순환 의존 없음 | REVISE | A5 — Combat↔Projectiles·Combat↔Items 양방향이 암시되는데 그래프와 게이트가 없다 |
| L7 | 권위 경계(트랜잭션 상당) | PASS(비고 A5) | `spec.md:40` 서버 Heartbeat, `spec.md:49` Humanoid.Health 서버 설정, `spec.md:55` State 4Hz. 틱 순서는 A5 에 포함 |
| D1 | 인터페이스 최소 | PASS(권고) | 모듈표는 책임만 적고 노출 함수는 안 적는다. Combat 은 register/intent/hit/update/hooks 다섯으로 닫을 수 있다 — A1 에서 요구 |
| D2 | 얕은 통과 모듈 없음 | PASS | `Commands`(`spec.md:32`)는 호출자가 Main 하나지만 스키마+버킷 상태를 가진 선례(`archer-command/src/server/Commands.luau:1-38`). 재론하지 않는다 |
| D3 | 정보 은닉 | PASS | 포즈 계약은 복제 Attribute 4개(`spec.md:56`)로 닫혀 있고 Poser 는 서버 모듈을 모른다(`spec.md:34`) |
| D4 | 가설 seam 없음 | PASS | 새 추상 인터페이스 없음. Rigs 의 플레이어 아바타/BlockRig 두 리그가 같은 Attribute 계약을 쓰므로 실재 seam(`spec.md:30`, `spec.md:34`) |
| D5 | 이름이 용어집에서 | PASS(비고) | 용어집 없음(lazy 생성 허용). 이름은 전부 도메인어(Combat·Moves·Styles·Accessories·Poses·Items·Projectiles·Bots·Rigs). `XxxService`/`Handler` 없음 |

### Deletion Test(새 모듈)
- `Moves` — 지우면 프레임 데이터가 Styles·Accessories 로 흩어지고 `axeKick` 처럼 두 스타일이 공유하는 무브(`Styles.luau:23`, `Styles.luau:35`)가 복제된다 → 값을 한다.
- `Projectiles` — 지우면 레이캐스트 스텝이 Combat 과 Items(폭탄) 로 흩어진다 → 값을 한다.
- `Poses` — 지우면 키프레임이 Poser 와 tests 로 흩어진다 → 값을 한다.
- `Rules` — 서버와 tests 가 같은 함수를 부른다(선례 `archer-command/src/shared/Rules.luau:2`) → 값을 한다.
- `Commands`·`Bots` — 호출자가 Main 하나로 모이지만 자기 상태(버킷·봇 의도)를 가진다. 선례와 같아 인라인을 요구하지 않는다.

## 이슈 (전부 비차단 · 구현 전에 스펙에 한 줄씩)

### A1. 피해 진입점이 하나가 아니고, Combat→Main 통지 방향이 없다 (L4·D1)
- 스펙: `Projectiles` 는 명중을 `Combat.hit` 으로 보낸다(`spec.md:29`). `Items` 는 폭발·상자 던지기 피해를 낸다(`spec.md:28`, `Config.luau:17` `bombDamage`·`crateThrowDamage`)지만 경로가 없다. KO 크레딧은 「3초 안 마지막 타격자」(`spec.md:48`, `Config.luau:13` `koCreditSeconds`)라 **모든** 피해가 한 함수를 지나야 성립한다.
- 스펙: 점수·KO 크레딧·리스폰은 Main(`spec.md:26`), 히트·피해·사망 감지는 Combat(`spec.md:27`). Main 은 Script 라 require 할 수 없으므로 Combat 이 Main 을 알 방법이 없다. 선례는 `Npc.hooks`(`archer-command/src/server/Npc.luau:11-24`)를 Main 이 채운다(`Main.server.luau:66-82`).
- 수정: 모듈표의 Combat 줄에 노출 함수를 적는다 — `register(model, loadout)`·`unregister`·`intent(id, kind, args)`·`hit(victim, attacker, move|source)`·`update(dt)`·`hooks{ko, ringout, damage}`. 「피해는 Items·Projectiles·Bots 포함 전부 `Combat.hit` 하나로 들어온다」와 「KO/링아웃/점수는 `Combat.hooks` 를 Main 이 채워 받는다」를 §전투 규칙에 한 줄씩. verify 에 `Humanoid.Health`·`TakeDamage` 쓰는 곳이 Combat 뿐인지 보는 게이트를 더한다.

### A2. `throw` 와 「들고 있는 아이템」의 소유 모듈이 둘로 갈린다 (L4)
- 스펙: Remotes.Command 에 `throw{dir}` 가 있고(`spec.md:53`) Input 이 「던지기」를 바인딩한다(`spec.md:33`). Combat 은 잡기 던지기 상태 `throw` 를 가진다(`spec.md:27`). Items 는 폭탄 「던지기」를 가진다(`spec.md:28`). 요구사항은 폭탄을 「들고 공격 키로 던짐」이라 한다(`requirements.md:32`). Config 에도 `GRAB.throwSpeedH/V`(`Config.luau:11`)와 `ITEMS.throwSpeedH/V`(`Config.luau:17`)가 따로 있다.
- 결과: 같은 명령이 잡기 상태냐 소지 상태냐에 따라 다른 모듈로 가야 하는데 분기 주인이 없다. 소지 중 피격(hitstun)·다운 시 폭탄을 떨어뜨리는 규칙도 파이터 상태를 아는 쪽만 할 수 있다.
- 수정(택일, 스펙에 명시): ① 「들고 있음」은 파이터 상태라 Combat 이 소유하고(`held = {kind, model}`), `throw` 는 Combat 이 받아 잡기면 던지기, 소지면 `Items.launch(model, dir)` 를 부른다. Items 는 월드 객체(배치·프롬프트·폭발·재생성)만 안다. ② `throw` 명령을 없애고 요구사항대로 소지 중 `light` = 던지기로 통일한다. ①을 권한다 — 입력 하나에 의미 하나.

### A3. 「Terrain 모래 바닥」을 ServerStorage 모델로 Clone/Destroy 할 수 없다 (L5)
- 스펙: 콜로세움 바닥은 Terrain Sand(`spec.md:60`). 맵은 `ServerStorage.Maps` 에 두고 매치마다 Workspace 로 Clone, 끝나면 Destroy(`spec.md:63`). Terrain 은 Workspace 의 단일 인스턴스라 Model 하위에 담기지도 Clone 되지도 않는다.
- 선례: 빌더는 Terrain 을 파일에 담지 않고(`archer-command/tools/build.py:3`) `World.server.luau` 가 기동 때 채운다(`World.server.luau:2-5`).
- 현재 스펙엔 맵 전환 때 Terrain 을 채우고 지우는 모듈이 없다. 스카이독으로 바뀔 때 콜로세움 모래가 남는다.
- 수정(택일): ① 콜로세움 바닥을 `Part`(Material Sand) 로 두어 Terrain 을 쓰지 않는다 — 가장 단순. ② `src/server/Maps.luau` 를 두고 `load(id)` = Clone + `Terrain:FillCylinder`, `unload()` = Destroy + `Terrain:Clear()` 를 한 곳에서 한다. ②를 고르면 A4 의 마커 읽기도 이 모듈이 맡아 Deletion Test 를 통과한다(호출자 Main·Items·Combat 셋).

### A4. 맵 기하의 원천이 빌더와 서버 둘이 된다 (L5)
- 코드: `Config.MAPS` 는 label·fallY·ringout·clock 뿐이다(`Config.luau:28-32`). 스펙의 반지름 60·벽 9·스폰 반지름 45·단상·상자 6/4·발판 5·점프대 3(`spec.md:60-61`)은 빌더만 안다. 그런데 서버는 스폰 위치(`spec.md:26`), 상자 재생성 위치(`spec.md:28`), 점프대(`spec.md:61`)를 알아야 한다.
- 선례: `build.py:26-33` `read_config` 가 `Config.luau` 의 SITES/BOWL/HILL 을 읽어 한 곳만 고치면 된다.
- 수정(택일, 스펙에 명시): ① 빌더가 맵 모델 안에 태그 붙은 마커(`Spawn`·`CrateSpawn`·`Pad`)를 넣고 서버는 CollectionService 로 읽는다. Config 는 fallY 만 유지(지금 그대로). ② 선례처럼 `Config.MAPS.<id>` 에 반지름·스폰·상자 좌표를 넣고 build.py 가 정규식으로 읽는다. ①을 권한다 — 런타임이 자기가 Clone 한 모델을 읽으니 좌표가 두 파일에 안 생긴다. verify 에 「맵 모델마다 Spawn 8·CrateSpawn ≥ 1」을 더하면 게이트가 산출물을 본다.

### A5. 서버 모듈 require 그래프와 틱 순서가 없다 (L6·L7)
- 스펙이 암시하는 간선: Projectiles→Combat(`spec.md:29`), Bots→Combat 의도(`spec.md:31`, `spec.md:50`), Combat→Rigs(Weld·ScaleTo, `spec.md:27`·`spec.md:30`). 여기에 Combat 이 투사체를 쏘면 Combat→Projectiles, 폭탄 피해가 Combat 으로 가면 Items→Combat, Combat 이 소지 폭탄을 던지면 Combat→Items 가 생겨 **두 쌍이 양방향**이 된다. Roblox 는 ModuleScript 순환 require 를 런타임 오류로 끊는다.
- 선례 그래프는 DAG 다: Main→{Npc,Campaign,Towers,Save,Commands,Rigs}, Towers→Npc, Campaign→Npc, Npc→Rigs (`archer-command/src/server/*.luau` require 줄). 게이트는 shared/client 만 본다(`verify.py:43-45`) — 이 프로젝트는 서버 모듈이 6개라 서버 그래프 게이트가 필요하다.
- 틱: `spec.md:40` 은 「서버 Heartbeat」만 말한다. 모듈마다 Heartbeat 를 따로 걸면 Bots 의도→Combat.update→Projectiles 명중의 상대 순서가 정의되지 않는다. 선례는 Main 하나가 `Npc.update(dt); Campaign.update(dt)` 순서로 부른다(`Main.server.luau:281-284`).
- 수정: 모듈표 아래에 그래프 한 줄 — `Main → Commands·Rigs·Combat·Items·Projectiles·Bots / Projectiles·Items·Bots → Combat / Combat → Rigs`. Combat 이 위로 부를 일(투사체 발사·아이템 투척·KO 통지)은 전부 `Combat.hooks` 로 Main 이 꽂는다(A1·A2 와 같은 장치). Heartbeat 는 Main 하나, 순서 `Bots → Combat → Projectiles → Items → State`. verify 에 「server 모듈의 `require(script.Parent.X)` 그래프가 비순환이고 `Main` 을 require 하는 모듈이 없다」 게이트를 더하고 회귀 주입 목록(`spec.md:68`)에 넣는다.

### A6. 「디렉토리 == Rojo 트리」인데 Rojo 프로젝트 파일이 산출물 목록에 없다 (L5, 사소)
- 스펙: `spec.md:16` 모듈표 제목이 Rojo 트리를 약속하지만 표(`spec.md:17-38`)와 `tasks.md:5-9` 에 `default.project.json` 이 없다. 선례는 `archer-command/default.project.json:1-9`(ReplicatedStorage.<Name>{shared, Remotes 3}, ServerScriptService.<Name>, StarterPlayerScripts).
- 수정: 모듈표에 `default.project.json` 한 줄(트리 이름 `AmpArena`, Remotes 3). 빌더의 서비스 배치가 이 파일과 같은지 verify 가 대조하면 「디렉토리 == 트리 == rbxlx」 주장이 검사된다.

## 차원 밖(기록만, 판정에 안 넣음)
- `Config.PLAYER.lightRange = 0`(`Config.luau:7`)은 선례의 「플레이어 PointLight ≥ 20」 게이트(`verify.py:91-93`)와 다르다. 낮 조명 아레나라면 타당하지만 네이티브 게이트 목록(`spec.md:67`)에 그 이유가 없다 — test-strategy 차원.

## 결론
계층 분리·서버 권위·Remotes 3·shared 순수성·네이티브 게이트는 선례와 같은 모양이고, 새 모듈 다섯은 Deletion Test 를 통과한다. 남은 것은 서버 모듈 사이의 **경계 소유와 방향**이다: 피해 진입점 하나(A1), `throw` 소유(A2), Terrain 생명주기(A3), 맵 기하 원천(A4), require DAG 와 틱 순서(A5). 전부 스펙에 한 줄씩 적으면 풀리고 사람 판단이 필요한 것은 없다. A3·A5 는 태스크 2·4 착수 전에 정해야 한다 — 코드가 생긴 뒤 바꾸면 Combat 전체를 돌려야 한다.

Round 1 판정: REVISE

---

## Round 2 (2026-10-29, 스펙 개정 + 구현 완료 후)

근거: 개정 `spec.md`, `roblox/amp-arena/src/{shared,server,client}`, `tools/build.py`·`tools/verify.py`, `default.project.json`, `tests/rules.spec.luau`, 검증기 출력 `/tmp/amp_verify.txt`(PASS 37 · FAIL 0), `verifications/gate-proof.md`(회귀 주입 24/24 RED). `roblox/archer-command` 는 선례 대조용으로 읽기만 했다.

### 1차 이슈 해소 확인

| # | 판정 | 스펙 | 코드 · 게이트 |
|---|---|---|---|
| A1 피해 진입점·KO 통지 방향 | **해소** | `spec.md:71` hooks 로 Main 이 꽂음, `spec.md:72` Health 쓰기는 Combat 셋뿐 | `Combat.luau:14-20` hooks 5종, `Combat.luau:121-126` `hurt` 가 유일한 피해 쓰기, `Combat.luau:397`(ko)·`450`(heal). 폭탄 `Items.luau:96`·투사체 `Projectiles.luau:56`·잡기 던지기 `Combat.luau:183` 모두 `applyHit`/`hurt`. Main 이 `hooks.ko` 를 채움 `Main.server.luau:244-261`. 게이트 `verify.py:63-65`, 증명 H(`gate-proof.md:18`) |
| A2 `throw` 소유 | **부분 해소 → R1** | `spec.md:87` 소지는 Combat 소유, 약공=던지기, `throw` 는 별칭 | `Combat.luau:302-304` throw→light, `F.item` 이면 `itemThrow`; `Combat.luau:332` → `hooks.throwItem` → `Main.server.luau:37` → `Items.throwHeld`(`Items.luau:145-158`). 던지기 경로는 맞다. **드랍 경로는 깨져 있다**(R1) |
| A3 Terrain → Part | **해소** | `spec.md:123` Part Sand + 이유 | `build.py:236-237` Desert·Floor Part(Sand). 서버·빌더에 `Terrain` 없음(클라이언트 `Effects.client.luau:28` 의 Attachment 부모로만 씀) |
| A4 맵 기하 단일 원천 | **해소**(비고 P3) | `spec.md:126` 마커 폴더·FallY·Label, Config 는 fallY·clock·표시명 | `build.py:233,272-283`(콜로세움) `290,314-320`(스카이독) Spawns/CrateSpots/Pads; 서버 `Main.server.luau:43-62` Spawns+Team, `Items.luau:197-200` CrateSpots/Pads; `Config.luau:28-31` 좌표 없음; `build.py:29-35` read_config. 게이트 `verify.py:104-112`, 증명 P |
| A5 require DAG · 틱 순서 | **해소** | `spec.md:71` 그래프 + Heartbeat 하나 + 순서 | `Combat.luau:6-11` shared 만, `Items.luau:9-10`, `Projectiles.luau:7`, `Bots.luau:6-8`, `Main.server.luau:12-17`, `Rigs.luau:7-11`. 틱 `Main.server.luau:323`. 게이트 `verify.py:46-62`(DAG·Combat 최하위·Heartbeat 1·순서 문자열), 증명 J. 검증기 출력 4-5행 |
| A6 Rojo 파일 | **해소**(비고 P4) | `spec.md:69` | `default.project.json:1-9`, 게이트 `verify.py:72-74` |

### 남은 이슈 (비차단 · Studio 열기 전에 고친다)

#### R1. KO·퇴장 때 든 폭탄이 떨어지지 않는다 — Combat 이 `F.item` 을 지운 **뒤에** Main 에 알린다 (A2 잔여, L4)
- 스펙: `spec.md:87` 「죽거나 나가면 그 자리에 떨어진다」, `spec.md:103` 「`Combat.leave` 가 … 들고 있던 폭탄은 떨어진다」.
- 코드: `Combat.luau:383-389` `cleanup(F)` 가 `F.item = nil`(388). `Combat.ko` 는 `cleanup(V)`(393) **다음에** `Combat.hooks.ko`(400)를 부른다. Main 의 ko 훅은 `Main.server.luau:256` `if V.item then Items.dropHeld(V) end` — 이미 nil 이라 한 번도 안 탄다. `Combat.leave`(`Combat.luau:428-433`)도 cleanup 뿐이고, 퇴장(`Main.server.luau:271-276`)·사람 리스폰(`Main.server.luau:123`)·봇 리스폰(`Main.server.luau:329`) 어디에도 `Items.dropHeld` 가 없다. Items 쪽 `rec.holder`(`Items.luau:112`)와 손 Weld `AmpCarry`(`Items.luau:118`)는 그대로 남는다.
- 결과: 폭탄이 죽은/나간 캐릭터 손에 붙은 채 모델과 함께 사라지거나(Massless·CanCollide false, `Items.luau:117`) 바닥을 뚫고 떨어진다. 신관(`Items.luau:114`)은 돌고 있어 어디선가 터지고, `rec.thrower` 가 죽은 F 라 피해·KO 크레딧이 그에게 간다(`Items.luau:90,96`). `Items.nearest` 는 holder 있는 폭탄을 건너뛰어 봇도 못 줍는다(`Items.luau:173`). `Items.clear`(`Items.luau:203`)는 매치 끝에만 돈다.
- 원인: A2 를 「Combat 소유」로 정했는데 **놓는 동작**(unweld·레코드 정리)은 Items 에 있고 Combat 에 그 방향의 훅이 없다. 그래서 Combat 이 자기 필드만 지우고 Items 는 모른다.
- 수정: `Combat.hooks.dropItem = function() end` 를 추가하고 `cleanup` 이 `F.item = nil` 전에 `if F.item then Combat.hooks.dropItem(F) end` 를 부른다(던지기와 같은 장치: `Combat.luau:19,332`). Main 은 `Combat.hooks.dropItem = Items.dropHeld` 한 줄로 꽂고 `Main.server.luau:256` 을 지운다. 게이트: verify 에 「`cleanup` 본문에 `hooks.dropItem` 호출이 `F.item = nil` 보다 앞」 문자열 검사를 더하고, 훅 호출을 지운 회귀로 RED 를 본다. 스펙 `spec.md:71` hooks 목록에 `dropItem` 을 적는다.

#### R2. `Commands.luau` 의 `require("../shared/Config")` 는 파일 경로라 Rojo 트리·rbxlx 에서 풀리지 않는다 (L2·L5, 신규)
- 스펙: `spec.md:47` 「디렉토리 == Rojo 트리 == rbxlx 배치」, `spec.md:63`·`spec.md:130` Commands 는 Roblox API 없이 CLI 검사.
- 코드: `Commands.luau:4` `require("../shared/Config")`. 트리는 `default.project.json:5-6` 가 `src/shared` → `ReplicatedStorage.AmpArena`, `src/server` → `ServerScriptService.AmpArena` 로 놓고 빌더도 같다(`build.py:448-451`, `456-459`). 두 폴더는 트리에서 형제가 아니고 `ServerScriptService` 아래에 `shared` 가 없다 — `..` 가 어디로 풀리든 `ReplicatedStorage` 에 닿지 않는다. 이 경로는 `src/server/../shared/Config.luau` 라는 **파일 배치**에서만 맞고, 그 배치로 부르는 곳은 CLI 테스트(`tests/rules.spec.luau:124`)뿐이다. `Main.server.luau:17` 이 기동 때 require 하므로 실패하면 서버 스크립트 전체가 서지 않는다.
- 선례: `archer-command/src/server/Commands.luau:10-11` 은 `game:GetService("ReplicatedStorage")…` + `require(Shared.Config)` 로 트리를 통해 푼다(CLI 테스트에는 안 넣었다, `archer-command/tests/rules.spec.luau:3-4`). 이 프로젝트는 Commands 를 CLI 테스트에 넣으면서 게이트(`verify.py:42-44`)가 Commands 의 `game:GetService` 를 막게 했고, 그 결과 경로가 파일 기준으로 바뀌었다 — **게이트가 트리와 어긋난 경로를 통과시킨다**. `Rules.luau:3` 의 `./Config` 는 같은 폴더라 트리에서도 풀린다(선례 `archer-command/src/shared/Rules.luau:3` 이 Studio 에서 돈 것이 증거).
- 수정(택일): ① Commands 가 Config 를 require 하지 않는다 — `Commands.configure(limits)` 를 두고 Main(`Main.server.luau:17` 다음)과 테스트(`rules.spec.luau:124` 다음)가 `Config.LIMITS` 를 넘긴다. Commands 는 모듈 의존 0 이 되어 CLI 와 트리에서 같은 코드가 돈다. ② Commands 를 `src/shared` 로 옮기고 `./Config` 로 부른다(클라이언트에 복제돼도 비밀은 없다). ①을 권한다 — 서버 모듈이 서버 폴더에 남고 `spec.md:71` 그래프도 그대로다. 게이트: verify 에 「`src/server/*.luau` 의 문자열 require 는 없거나 `./` 로 시작한다(`../` 금지)」를 더하고 `../` 를 넣은 회귀로 RED 를 본다. 이 게이트는 P4 와 같은 자리에서 「디렉토리 == 트리」를 실제로 재는 첫 검사가 된다.

### 권고 (판정에 안 넣음)
- **P1 (D3)** Items 가 Combat 내부 상태를 직접 쓴다 — `Items.luau:54,56` 이 `F.hitSet["crate:"…]` 를 쓰는데 그 표는 Combat 이 무브마다 비우는 것(`Combat.luau:84`)이라 Items 가 Combat 의 리셋 시점을 안다. `Items.luau:119,147,150,163` 은 `F.item` 을 직접 쓰고 바로 뒤에 `Combat.setItem` 도 부른다(이중 쓰기). 세터를 쓰거나 세터를 지운다 — 둘 중 하나만.
- **P2 (D4)** `Items.hooks.fighterOf`(`Items.luau:14`)는 Main 이 `Combat.byModel` 로 꽂는 통과 훅(`Main.server.luau:39`)인데 Items 는 이미 Combat 을 require 한다(`Items.luau:10`). 1 어댑터 가설 seam — 지우고 `Combat.byModel` 을 직접 부른다.
- **P3 (A4 비고)** 빌더가 맵에 넣는 `FallY`(`build.py:233,290`)를 서버는 읽지 않고 Config 에서 읽는다(`Main.server.luau:186`). 원천은 Config 하나(빌더가 복사)라 이중 원천은 아니지만 `spec.md:126` 「서버는 Clone 한 모델을 읽는다」와 다르고, 게이트(`verify.py:110-111`)가 아무도 안 읽는 값을 지킨다. `arena.FallY.Value` 를 읽거나 값·게이트를 뺀다.
- **P4 (A6 비고)** Rojo 대조 게이트(`verify.py:72-74`)는 JSON 만 읽는다. 「빌더가 내는 트리와 같다」는 문구가 성립하려면 XML 의 `ReplicatedStorage.AmpArena`·`ServerScriptService.AmpArena` 자식 이름을 `src/shared`·`src/server` 스템과 맞춰 봐야 한다(`verify.py:89-94` 는 스크립트 존재만 본다).

### 차원 밖(기록만)
- `Items.luau:19` `CRATE_MOVE` 는 아무 데서도 안 쓴다(상자 던지기는 스펙에 없다, `spec.md:59,138`). `Config.luau:29-30` `ringout` 은 서버가 읽지 않는다 — implementation 차원.

### 결론
1차 이슈 6건 중 5건(A1·A3·A4·A5·A6)은 스펙·코드·게이트·회귀 증명까지 닫혔다. A2 는 던지기 방향은 맞지만 **놓기 방향**이 빠져 KO·퇴장 드랍이 실제로 안 된다(R1). 새로 본 R2 는 CLI 테스트 가능성을 위해 넣은 파일 경로 require 가 Rojo 트리와 어긋나는 것으로, Studio 에서 서버가 기동하지 않을 수 있다 — 스펙 결정을 바꿀 일은 없고 수정은 기계적이라 BLOCK 이 아니지만 Studio 수용 시나리오(`spec.md:134-139`) 전에 반드시 고쳐야 한다. 둘 다 `Combat.hooks` 장치와 verify 게이트 한 줄씩으로 닫히고 회귀 주입 RED 를 같이 남긴다.

VERDICT: REVISE
