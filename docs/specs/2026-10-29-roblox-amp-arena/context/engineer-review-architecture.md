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

VERDICT: REVISE
