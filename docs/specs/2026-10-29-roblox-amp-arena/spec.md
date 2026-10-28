<!-- source: roblox/amp-arena/src/server/Combat.luau, roblox/amp-arena/tools/verify.py -->

# AMP ARENA — 겟앰프드식 액세서리 난투의 로블록스 네이티브 구현

## 승인과 범위 (2026-10-29)
사용자 요청: 로블록스에 겟앰프드가 있는지 리서치하고, 겟앰프드를 로블록스로 구현한다. 웹 `amp-arena/` 는 참고만. 리서치 결과와 결정은 [requirements.md](planning/requirements.md). 자율 실행이라 선택지는 [open-questions.yml](context/open-questions.yml) 에 `assumed` 로 적었다.

범위: `roblox/amp-arena/` 신규. 스타일 5 · 액세서리 5 · 아이템 3 · 맵 2 · 모드 3 · 봇 · 라운드 루프 · HUD · 빌더 · 검증기 · 게이트 증명 · README/ASSETS/status.
`docs/standards/online-versus-lobby.md`(플랫폼 릴레이 게임의 방·코드·초대 표준)는 적용하지 않는다 — 로블록스는 서버 인스턴스가 곧 방이고 매치메이킹은 플랫폼이 한다.

## 용어 (정본 · Avoid)
| 용어 | 뜻 | 코드 | Avoid |
|---|---|---|---|
| 스타일 | 맨손 기본기·스탯·몸집·전용 액세서리를 정하는 다섯 유형 | `Styles.DEF[id]`, Attribute `Style` | 직업 |
| 액세서리 | 들면 약공·강공·기술이 통째로 바뀌는 장비. 스타일당 하나 | `Accessories.DEF[id]`, Attribute `Accessory` | 악세서리 |
| 맨손 | 액세서리 없음(`none`) — 스타일 기본기 | `"none"` | 무장 해제 |
| 장비 | 스타일 + 액세서리 선택 | `loadout{style, accessory}` | 로드아웃 |
| 사슬 | 약공(light)/강공(heavy) 연타 열. 후딜이 끝나야 다음 타 | `Rules.chainNext` | 콤보(확정) |
| 약공 · 강공 · 기술 | 입력 세 가지(M1 · R · 1, 터치 버튼 제목) | `intent.kind` | 키 이름 |
| 경타 · 강타 | 명중 효과. 경타 → 경직(hitstun), 강타 → 띄움(launch). 입력이 아니라 `Moves.effect` 가 가른다 | `effect = "hitstun" | "launch"` | — |
| 경직 · 띄움 · 다운 · 기상 | 피격 상태. 다운·기상은 무적 | `Fight` = hitstun/launched/down/getup | — |
| 가드 게이지 · 가드 크러시 | 막을 때마다 피해×4 소모, 0 이면 스턴 1.5초(크러시). 방패는 면역 | `Guard` Attribute, `Fight = "stun"` | — |
| 잡기 · 던지기 · 탈출 | 밀착 약공 = 잡기. 잡은 뒤 공격 = 던지기. 잡힌 쪽은 6연타 탈출 | `grab`/`throw` 무브, `held`/`grabbing` | — |
| 반격기 · 대시 공격 | 막은 직후 0.25초 안 공격 / 대시 직후 0.3초 안 약공 | `counter` / `tackle` | — |
| 링아웃 · KO 크레딧 · 자멸 | 루트 Y < fallY → KO. 3초 안 마지막 타격자가 크레딧, 없으면 자멸(−1) | `Rules.koCredit` | 낙사 |
| 라운드 · 매치 | 라운드 = 로비→카운트다운→매치→결과 한 바퀴. 매치 = 전투 단계. HUD 타이머는 현재 단계의 남은 시간 | `phase` | 판 |
| 방 | 서버 인스턴스(최대 8) | — | 로비(방 의미로) |
| 의도 · 명단 | 클라이언트 입력(intent) · 매치 참가자 표(roster) | `Combat.intent`, `State.roster` | — |
| 점수판 | 매치 중 명단 정렬(KO 순). 플랫폼 순위표는 범위 밖 | HUD 명단 | 순위표 |

## 식별자와 표시명 (assumed — 사용자 취향으로 바꿀 수 있다)
| 스타일 id | 표시명 | 액세서리 id | 표시명 | 성격 |
|---|---|---|---|---|
| fighter | 파이터 | rocket | 부스터 | 로켓 글러브 — 긴 펀치, 로켓 펀치 투사체 |
| grappler | 그래플러 | shield | 월 | 방패 — 밀치기, 가드 각 150°, 크러시 면역 |
| speedster | 스피드스타 | pistols | 더블탭 | 쌍권총 — 근접 후려치기 + 2연발, 백롤 난사 |
| heavy | 헤비 | greatsword | 브레이커 | 대검 — 호 120° 베기, 내려찍기 충격파, 잡기 불가 |
| martial | 마셜 | spear | 스파이크 | 장창 — 리치 6.5 찌르기, 돌진 관통 |
표시명은 사용자의 웹 참고작이 쓰던 고유명(사용자 자산)이고 상용 게임 이름은 쓰지 않는다.

## 핵심 루프
```
로비(대기 발판, 준비 20초: 스타일·액세서리 선택) → 카운트다운 3 → 매치(맵×모드) → 결과 10초 → 로비
```
서버 하나가 방이다(최대 8). 플레이어 4 미만이면 봇이 채운다. 매치 중 입장은 다음 라운드 참가(로비 대기).

## 모듈 (디렉토리 == Rojo 트리(`default.project.json`) == rbxlx 배치)
| 경로 | 역할 | Roblox API |
|---|---|---|
| `src/shared/Config.luau` | 수치 한 곳: 이동·전투 상수·가드·잡기·아이템·매치·봇·한도 | 없음(CLI) |
| `src/shared/Styles.luau` | 스타일 5: 약공/강공 사슬·기술·스탯 증감·몸집·액세서리 1 | 없음 |
| `src/shared/Moves.luau` | 무브 프레임 데이터(초): startup/active/recovery/damage/reach/radius/arc/effect/push/launch/multiHit/superArmor/guardBreak/moveSpeed · 투사체 스펙 · 잡기 무브 | 없음 |
| `src/shared/Accessories.luau` | 액세서리 5: 사슬·기술·쿨다운·제약(잡기 불가·이동 배율) · 손 부착 오프셋 | 없음 |
| `src/shared/Poses.luau` | 무브·상태별 절차 포즈 키프레임(6 논리 관절: root·neck·rs·ls·rh·lh, 각도 deg + root 오프셋) + `sample(id, phase)` | 없음 |
| `src/shared/Rules.luau` | 순수 규칙: 피해·가드·사슬 다음 타·잡기 성립·히트 기하·링아웃·모드 승자·입력 정리·장비 검증 | 없음 |
| `src/shared/Theme.luau` | 색·서체 | Color3 |
| `src/server/Main.server.luau` | 라운드 루프·플레이어 등록·장비 명령·팀·스폰·점수·KO 크레딧·리스폰·State 송신 | Players·Heartbeat |
| `src/server/Combat.luau` | 파이터 상태 머신(idle/attack/guard/hitstun/launched/down/getup/held/grabbing/throw/dead)·입력 의도·히트 판정·피해·넉백·슈퍼아머·가드 게이지·쿨다운·대시 | Humanoid·LinearVelocity·Weld·Attributes |
| `src/server/Items.luau` | 상자·하트·폭탄: 배치·파괴·드랍·ProximityPrompt 줍기·던지기·폭발·재생성 | ProximityPrompt·Debris |
| `src/server/Projectiles.luau` | 쌍권총 탄·로켓 펀치: 서버 스텝 레이캐스트, 명중 → Combat.hit | Raycast |
| `src/server/Rigs.luau` | 플레이어 캐릭터 설정(R6 확인·체력·이름표·팀 Highlight·몸집)·액세서리 모델 부착·봇 리그(BlockRig)·봇 애니 | Players·Weld·Animator |
| `src/server/Bots.luau` | 봇 의도 생성: 표적 선택·접근·사슬·가드·대시·줍기·절벽 회피(앞 발판 레이캐스트) | Raycast |
| `src/server/Commands.luau` | 명령 모양 검사·토큰 버킷 | 없음 |
| `src/client/Input.client.luau` | ContextActionService 바인딩(약공·강공·가드·기술·대시·던지기), 터치 버튼 제목, 게임패드, 조준 보조(정면 ±35°), `Command:FireServer` | CAS·UIS |
| `src/client/Poser.client.luau` | 태그 `Fighter` 전부: Attribute(`Fight`·`Move`·`MoveAt`·`FightAt`) → `Poses.sample` → `Motor6D.Transform` (Stepped). R6/R15 매핑 | RunService.Stepped |
| `src/client/Effects.client.luau` | Fx: 타격 스파크·피해 숫자·가드 불꽃·KO 폭발·투사체·폭발·링아웃·히트스톱·카메라 흔들림(`Humanoid.CameraOffset`)·소리 | Debris·Tween |
| `src/client/Hud.client.luau` | 내 체력·가드·액세서리·쿨다운·탄 / 타이머·모드·맵 / 명단(8) / KO 피드 / 로비 장비 패널 / 결과 / 순위 버튼 | ScreenGui |
| `tools/build.py` | 결정적 .rbxlx: 서비스·Lighting·로비·맵 2(ServerStorage.Maps)·액세서리 템플릿 5·BlockRig·아이템 템플릿·Remotes·StarterPlayer(R6, 줌 8~20)·Players.CharacterAutoLoads false | - |
| `default.project.json` | Rojo 트리(`AmpArena`, Remotes 3). 검증기가 빌더 배치와 대조 | - |

**서버 require 그래프(비순환, 검증기가 잰다)**: `Main → Commands·Rigs·Combat·Items·Projectiles·Bots` / `Items → Combat·Rigs` / `Projectiles → Combat` / `Bots → Combat·Items·Rigs` / `Combat → (shared 만)`. Combat 이 위로 부를 일(투사체 발사·아이템 투척·상자 판정·KO 통지·연출)은 전부 `Combat.hooks` 로 Main 이 꽂는다. Heartbeat 는 Main 하나, 순서 `Combat.update → Items.update → Projectiles.update → Bots.update → State(4Hz)`.
**피해 진입점은 하나**: `Humanoid.Health` 를 쓰는 곳은 `Combat.applyHit`(피해, 가드·무적·슈퍼아머·연속 히트·KO 크레딧 포함)·`Combat.heal`(회복)·`Combat.ko` 뿐이고 Rigs 는 초기값만 채운다. 투사체·폭탄·던지기·상자는 전부 `applyHit` 를 부른다(검증기 게이트).
**결정은 Rules, 적용은 Combat**: 사슬·잡기 성립·히트 기하·가드·연타 탈출·반격/대시 공격 창·띄움 착지·봇 걸음·봇 수·아군 KO·장비 단계는 `Rules` 의 순수 함수가 결정하고 Combat/Main/Bots 는 Roblox 인스턴스에 적용만 한다. 상태 머신의 전이 자체는 Combat 에 있다(Studio 확인 대상).
| `tools/verify.py` | luau 규칙 검사 + 컴파일·미지 전역·의존 방향 + 빌더 + 네이티브 게이트 | - |

## 전투 규칙 (서버 Heartbeat, dt 상한 0.1)
- 입력 의도: `light`·`heavy`·`special`·`guard(on/off)`·`dash`·`throw`. 서버가 상태별로 받는다. 약공/강공 사슬은 「후딜이 끝나야 다음 타」, 약공 사슬 중 강공 → 강공 사슬 피니시. 밀착(잡기 거리·정면 60°)에서 약공 = 잡기 우선. 가드 직후 0.25초 안 공격 = 반격기. 대시 직후 0.3초 안 약공 = 대시 공격.
- 히트 판정(지속 구간, 틱당 한 번, 같은 상대 1회 또는 multiHit 간격): 공격자 루트 + 정면×reach 의 평면 원(radius) 와 상대 루트 거리 ≤ radius + bodyRadius, 정면 각 ≤ arc/2. 가드 중 정면 180° 는 피해 0·게이지 −피해×4; 가드 무시/뒤는 그대로. 팀전에서도 아군이 맞는다(원작 소감).
- 피해 = 내림(기본 × 근력배율 × 방어배율). 경타 → HITSTUN(경직 시간) + 밀림 LinearVelocity 0.12초. 강타 → LAUNCHED(LinearVelocity 수평·상승 0.2초) → 착지(FloorMaterial ≠ Air) → DOWN 0.8초(무적) → GETUP 0.4초(무적). 같은 공격자 연속 4히트째부터 넉백 ×1.5.
- 가드 게이지 100, 풀면 초당 20 회복, 0 → STUN 1.5초. 방패는 크러시 면역.
- 잡기: 상대가 idle/walk/guard/hitstun, 거리 ≤ grabRange, 정면 60°. HELD 최대 2초, 피격자 약공 6회 연타로 탈출. 던지기 = 방향(이동 입력 또는 정면) 수평 24·상승 14 스터드/s, 착지 DOWN, 15 피해. 양손 액세서리(대검)는 잡기 불가.
- 이동 잠금: attack(후딜 포함)·hitstun·held·down·getup·dead → `WalkSpeed 0`·`JumpPower 0`·`AutoRotate false`. 가드 중 WalkSpeed 0. 그 외 스타일 배율 × 액세서리 배율.
- 대시: `Q` → 0.22초 LinearVelocity 정면 46 스터드/s, 쿨다운 0.9초, 공중 대시는 스피드스타만 1회.
- 링아웃: 루트 Y < 맵 fallY → KO(크레딧 = 3초 안 마지막 타격자, 없으면 자멸 −1). `FallenPartsDestroyHeight` 는 fallY 보다 100 아래(검증기 게이트).
- 아군 KO(팀전): 팀 점수 없음 · 가해자 개인 KO −1(그리핑 최소 억제). 강퇴·투표는 범위 밖(Roblox 신고·차단).
- 장비: `loadout` 은 로비 단계에서만 받는다(`Rules.loadoutPhaseOpen`). 스타일 전용이 아닌 액세서리는 거부가 아니라 맨손으로 **정리**한다(`Rules.sanitizeLoadout`). 기본 장비 파이터·맨손. 봇은 무작위 스타일 + 전용 액세서리를 2/3 확률로 든다.
- 아이템 소지는 파이터 상태다(`F.item`, Combat 소유). 들고 있을 때 약공 = 던지기(`itemThrow` 무브 → `Combat.hooks.throwItem` → `Items.throwHeld`). `throw` 의도는 약공의 별칭(봇·게임패드용). 죽거나 나가면 그 자리에 떨어진다. Items 는 월드 객체(배치·프롬프트·폭발·재생성)만 안다.
- 잡힌 쪽 연타는 0.08초 간격으로만 센다(버스트 입력이 탈출 시간을 줄이지 못하게).

## 모드 · 승패 · 팀
| 모드 | 목숨 | 승리 | 동점 | 아군 KO | 길이 |
|---|---|---|---|---|---|
| 개인 데스매치 | 무한(3초 리스폰, 무적 2초) | KO 최다 | 데스 적은 순 → 준 피해 | — | 3분 |
| 팀 데스매치 | 무한 | 팀 KO 합 | 팀 데스 → 팀 피해 | 팀 점수 없음, 개인 −1 | 3분 |
| 서바이벌 | 1 | 최후 1인 | 시간 종료 시 KO 순 | — | 2분 |
- 순위(개인·팀 안): KO ↓ → 데스 ↑ → 피해 ↓ (`Rules.rank`, `Rules.teamTotals`).
- 팀 배정: 카운트다운 때 참가자(사람+봇) id 정렬 순으로 번갈아(`Rules.assignTeams`). 라운드 안 재배정 없음.
- 순환: 라운드 n 의 모드 = `MODE_ORDER[(n−1) % 3]`, 맵 = `MAP_ORDER[⌊(n−1)/3⌋ % 2]` — 6라운드 안에 모든 조합(`Rules.nextRotation`).
- 준비: 로비 20초. 사람 전원이 「준비」면 1초 뒤 카운트다운. 사람이 0명이면 로비가 계속된다.

## 흐름의 가장자리
- 늦은 입장: 매치 중 들어온 사람은 로비 발판에서 기다리고 다음 라운드부터 참가(`joined=false`).
- 퇴장: `Combat.leave` 가 잡기 Weld·속도·PlatformStand 를 정리하고 명단에서 뺀다. 들고 있던 폭탄은 떨어진다.
- 서바이벌에서 먼저 KO: 3초 뒤 로비 발판에 세운다(관전 기능 없음 — 최대 2분 대기, 알려진 한계 OQ6).
- 결과 → 로비 정리 순서: 봇 제거 → 아이템·투사체 정리 → 파이터 등록 해제 → 아레나 Destroy → 조명 복귀 → 로비 단계 → 사람 전원 LoadCharacter(로비 스폰).
- 로비에서 죽으면(난간 밖) 2초 뒤 다시 세운다.

## 신뢰 경계 (치트 방어 범위)
- 서버가 갖는 것: 명령 모양·빈도(`Commands`, 버스트 30 · 초당 20 회복)·상태 머신·판정·피해·HP·점수·팀·아이템·장비 단계·줍기 거리 재확인.
- 소유 클라이언트를 믿는 것: 캐릭터 위치·정면·속도·착지(`FloorMaterial`)·`WalkSpeed 0` 준수·넉백 LinearVelocity 시뮬.
- 막지 않는 것: 스피드·텔레포트·비행·넉백 무시·경직 중 이동. 저장·순위가 없어(범위 밖) 수용하고, 공개·순위 도입 전에 재검토한다(README 「검증하지 않는 것」에도 적는다).
- KO: `Humanoid.Health = 0` → Died. 데스매치 3초 뒤 `LoadCharacter` + 무적 2초(반투명). 서바이벌은 관전 없이 로비 발판에서 대기.
- 봇: 같은 상태 머신에 의도만 넣는다. 절벽 앞 2.5 스터드 지지면 없으면 멈춤(웹판 자멸 36% 교훈).

## 네트워크
- `Remotes.Command`(C→S): `(name, args)` — `loadout{style,accessory}`·`ready`·`intent{kind}`·`guard{on}`·`throw{dir}`. 검사: 문자열 enum·Vector3 유한·초당 20.
- `Remotes.Fx`(S→C all): `hit(pos, amount, victimModel, kind)`·`guard(pos)`·`ko(pos, victimName, attackerName)`·`ringout(pos)`·`projectile(from, to, kind, travel)`·`explode(pos, radius)`·`pickup(model)`·`countdown(n)`·`result(table)`.
- `Remotes.State`(S→C all, 4Hz): 라운드 단계·남은 시간·모드·맵·명단(이름·팀·HP·KO·데스·스타일·액세서리·봇 여부)·내 가드·쿨다운·탄·준비 수.
- 캐릭터 Attribute(복제): `Fight`·`FightAt`·`Move`·`MoveAt`·`Style`·`Accessory`·`Team`·`Guard`(0~100)·`Invuln`.

## 월드 (빌더)
- 로비: 아레나 위 하늘 발판(60×60, 난간, 스폰 8, 대형 안내판 「준비」 타이머는 HUD).
- 콜로세움: 모래 바닥(Part, Sand 재질 — Terrain 은 Workspace 단일 객체라 맵 모델에 담을 수 없다) 반지름 60, 돌벽 높이 9(36조각), 관중석 벽·3단 티어·성곽 모델 12, 기둥 4(반지름 2.4), 단상 2(12×12×4.5), 상자 6, 스폰 8(반지름 45, 동 1팀·서 2팀), 횃불 6·울타리·나무. 낙사 없음. 해질녘 조명(17.5).
- 스카이독: 중앙 72×48, 동서 24×24(+6), 남북 18×30, 간격 9, 상자 4, 스폰 8, fallY −40, 구름 위 낮 조명. 점프대 3(터치 → 상승 속도).
- 액세서리 템플릿 5(Part 조립, PrimaryPart=Handle), BlockRig(R6, Motor6D 6), 아이템 템플릿(Crate·Heart·Bomb) — ServerStorage.
- 맵은 ServerStorage.Maps 에 두고 매치마다 Workspace 로 Clone, 끝나면 Destroy. **맵 기하의 원천은 맵 모델 하나**: 빌더가 `Spawns`(Team NumberValue)·`CrateSpots`·`Pads` 폴더와 `FallY`·`Label` 값을 넣고 서버는 Clone 한 모델을 읽는다. Config.MAPS 는 fallY·clock·표시명만 갖고 빌더가 그것을 읽어 넣는다(좌표가 두 파일에 생기지 않는다).

## 검사
1. `tests/rules.spec.luau` — Config/Styles/Moves/Accessories/Rules/Poses 실제 실행(≥ 40 단언).
2. 구조 게이트(`tools/verify.py`): 컴파일·미지 전역·공유 모듈+Commands 무 Roblox API·벡터 메서드 없음(`{X,Y,Z}` 성분 셈만)·클라이언트가 서버 모듈 불참조·**서버 require 그래프 비순환(Combat 최하위)**·Heartbeat 하나와 틱 순서·**Health 쓰기는 Combat(+Rigs 초기값)뿐**·OnServerEvent 하나와 Commands.validate 배선·줍기 서버 거리 재확인·결정 함수가 Rules 에 있고 서버가 부름·Rojo 트리 대조·빌더 결정성·스크립트 정확 포함·서비스·Remotes 3·맵 2(스폰 8·팀 양쪽·상자·점프대·FallY)·`FallenPartsDestroyHeight ≤ min fallY − 100`·템플릿 5·아이템 3·BlockRig Motor6D 6 · **네이티브 게이트**: CameraType 0 · StarterPlayer R6(`GameSettingsAvatar` 0)·줌 8~20 · Poser 가 `RunService.Stepped` + `Motor6D.Transform` · 서버가 스폰 소유(CharacterAutoLoads false) · 키 이름 안내 문자열 없음 · ContextActionService 터치 버튼 제목 · 줍기는 ProximityPrompt(클라이언트 E 바인딩 없음) · 넉백 LinearVelocity 하나 재사용 · Health 는 Humanoid · GetServerTimeNow 시계 · 착지 Air 선행 관측 · 라운드 단계 4 · 봇 ≤ 7·파이터 ≤ 8·투사체 ≤ 40 · 봇 절벽 탐침 · Guard 속성 정수 변화 시만 · 아바타 유지(ScaleTo·이름표·Highlight) · 조명 프리셋 2 · 에셋 provenance ≥ 5(공집합 통과 없음).
3. 회귀 주입 24 건 전부 RED(주입→게이트 대응표) → `verifications/gate-proof.md`.
4. UNVERIFIED: Studio Play·포즈 생김새·LinearVelocity 넉백 체감·Weld 잡기·터치 버튼 배치·8인·R15 매핑·소리 ID·치트 방어(신뢰 경계 절).

## 수용 시나리오 (사용자 Studio)
1. 열기 → 로비 발판 → 장비 패널에서 헤비 + 브레이커 → 준비 → 카운트다운 3 → 콜로세움 개인 DM, 봇 3.
2. 맨손이던 사슬(해머 2단)이 브레이커를 들자 대검 베기 2단·가로베기·내려찍기로 **통째로 바뀐다**(보존 재미 1번). 기술(1)로 점프 내려찍기 충격파.
3. 잽 사슬이 봇에게 맞아 경직·밀림이 보이고, 강공 피니시에 봇이 떠서 다운·기상한다. 가드(F)로 막으면 파란 불꽃, 계속 막으면 크러시.
4. 밀착 약공으로 잡고 공격으로 던진다. 상자를 2타에 부수고 폭탄을 E 로 주워 공격으로 던져 터뜨린다.
5. 3분 뒤 결과판 → 10초 → 로비. 다음 라운드 팀 DM(레드/블루 외곽선), 그다음 서바이벌, 4라운드부터 스카이독 — 던지기·태클로 링아웃.
