# Engineer Review — domain (2026-10-29)

대상: `docs/specs/2026-10-29-roblox-amp-arena/spec.md` + `planning/requirements.md` · `planning/test-quality.md` · `context/open-questions.yml` · `tasks.md`
체크리스트: `hns/0.15.1/skills/spec-review/reviewers/domain/checklist.md`

## Seed Discovery
| 단계 | 본 것 | 결과 |
|---|---|---|
| 1 스펙 | spec.md 70줄, requirements/test-quality/open-questions/tasks/initialization/shaping-state | 읽음 |
| 2 같은 폴더 | `context/` 에 open-questions.yml 뿐. tasks.md 5줄 | 읽음 |
| 3 표준·관례 | `docs/product/glossary.md` **없음**(glob: mission·tech-stack·game-expansion-research·branding-ideation 뿐). `docs/context-map.md:16-33` BC 16개에 게임·로블록스 항목 없음. `roblox/` 아래 `용어|glossary` 0건. `roblox/AGENTS.md`, `docs/research/2026-10-26-roblox-development/README.md` §0, `docs/standards/online-versus-lobby.md` | 아래 판정에 반영 |
| 4 코드 근거 | `roblox/amp-arena/` 리뷰 시점 비어 있음. 형제 프로젝트 `roblox/archer-command/src/{shared,server}` 모듈 어휘, 웹 참고작 `amp-arena/shared/src/{styles,accessories}.ts`, `amp-arena/docs/GDD.md` | 아래 인용 |

## 체크리스트 판정

| # | 항목 | 판정 | 근거 |
|---|---|---|---|
| 1 | 바운디드 컨텍스트 경계 | REVISE(경미) | 아래 D7 |
| 2 | 용어집 존재 | REVISE | `docs/product/glossary.md` 없음, `docs/context-map.md:16-33` 에 이 게임 없음, `roblox/**` 용어 문서 0건 → 체크리스트 규칙 「Missing glossary → REVISE」. 아래 D1 |
| 3 | 스펙 어휘가 용어집에 정의됨 | REVISE | 스펙이 만든 도메인 명사 20여 개가 어디에도 정의돼 있지 않다. 아래 D1 |
| 4 | Avoid 동의어 미사용 | REVISE | Avoid 목록 자체가 없다. 대신 스펙 폴더 안에서 같은 개념이 두 표기로 갈린다. 아래 D2 |
| 5 | 기존 코드와 유비쿼터스 언어 일치 | REVISE | 모듈 어휘는 형제 프로젝트와 일치(통과). 액세서리·스타일 식별자는 미확정. 아래 D3 |
| 6 | 애그리거트 불변식 명시·강제 가능 | REVISE | 파이터 상태 머신은 명시(`spec.md:27,41-47`). 장비·모드 승자·피해 진입점은 빠져 있다. 아래 D4·D5·D6 |
| 7 | 도메인 이벤트 소유 범위 | SHIP | `Remotes.Fx`·`Remotes.State` 는 서버 모듈이 소유 상태에서 낸다(`spec.md:54-55`). KO 는 엔진 `Humanoid.Died`(`spec.md:49`) |
| 8 | 애그리거트 간 직접 참조 없음 | SHIP | 단일 프로세스 안 모듈 호출(`Projectiles → Combat.hit`, `spec.md:29`)이고 의존 방향은 게이트가 잰다(`spec.md:67` 「클라이언트가 서버 모듈 불참조」). 클라이언트는 복제 Attribute 만 읽는다(`spec.md:56`) |
| 9 | VO / Entity 분류 | SHIP | `shared/` 의 Styles·Moves·Accessories·Poses 는 불변 데이터(VO), `server/` 의 Combat(파이터)·Items·Projectiles·Main(라운드)은 상태 보유(Entity) — `spec.md:16-32` 의 배치가 곧 분류다 |

### 통과한 것 (근거)
- 모듈 어휘가 형제 로블록스 프로젝트와 1:1 이다 — `Config`·`Rules`(순수 규칙, `roblox/archer-command/src/shared/Rules.luau:2`)·`Commands`(모양 검사 + 토큰 버킷, `roblox/archer-command/src/server/Commands.luau:2,20-21`)·`Rigs`·`Theme`·`tools/{build,verify}.py`·`tests/rules.spec.luau` ↔ `spec.md:19-38`. 새 게임이 이 이름을 그대로 쓰므로 다음 사람이 두 프로젝트를 같은 지도로 읽는다.
- 파이터 상태 머신 상태 11개와 전이 조건이 한 곳에 있다(`spec.md:27`, 전이 `spec.md:41-47`). 가드 게이지 0~100·HELD ≤ 2초·양손 잡기 불가·이동 잠금 상태 집합·무적 구간이 전부 수치로 적혀 있어 `Rules` 단위 테스트가 그대로 나온다.
- 외부 서비스 참조가 없다. 저장·진행·순위표는 명시적으로 후속(`requirements.md:36`, `open-questions.yml:25`).

## Findings (전부 비차단)

### D1. 용어집이 없고 스펙이 도메인 명사를 20여 개 새로 만든다 (체크 2·3)
- 근거: `docs/product/glossary.md` 없음. `docs/context-map.md:16-33` 는 커머스 BC 16개만 가리킨다. `roblox/` 아래 용어 문서 0건.
- 스펙이 정의 없이 쓰는 명사: 스타일·액세서리·맨손·사슬·약공/강공/기술·경타/강타·띄움·경직·다운/기상·가드 게이지·크러시(`spec.md:44` 「방패는 크러시 면역」— 「가드 크러시」라는 말은 한 번도 안 나온다)·잡기/던지기/탈출·슈퍼아머·반격기·대시 공격·링아웃·KO 크레딧·자멸·무적·장비·의도·명단·라운드/매치/로비·방(=서버)·봇·무브·투사체·점프대·`fallY`.
- 특히 **라운드 vs 매치**: `spec.md:12` 는 전투 단계를 「매치」라 부르고, `spec.md:14,26,55,67` 은 로비→카운트다운→매치→결과 한 바퀴를 「라운드」라 부른다. 그래서 「라운드 단계 4」(`spec.md:67`) 의 한 단계가 「매치」다. 정의가 없으면 HUD 「타이머」(`spec.md:36`)가 어느 것을 재는지 구현자가 정한다.
- **경타/강타 vs 약공/강공**: 앞은 명중 효과(`spec.md:43` 경타→HITSTUN, 강타→LAUNCHED), 뒤는 입력(`spec.md:41`). 강공 입력이 곧 강타가 아니고 `Moves` 의 `launch` 플래그(`spec.md:21`)가 가른다 — 이 관계가 어디에도 적혀 있지 않다.
- 수정안: 커머스 `context-map.md` 에 이 게임을 넣지 않는다(팀 리드 확인: 무관). 대신 **`spec.md` 에 「용어」 표 한 절**을 둔다 — `용어 | 뜻 | 코드 식별자 | Avoid`. 최소 행: 스타일(≠직업) · 액세서리(≠악세서리) · 맨손 · 사슬 · 약공/강공/기술(입력) · 경타/강타(명중 효과, `launch` 로 가름) · 가드 게이지/가드 크러시 · 라운드(4단계 한 바퀴)/매치(전투 단계) · 방(=서버 인스턴스) · 장비(loadout) · 의도(intent) · 명단(roster) · KO 크레딧/자멸. `/hns:glossary` 는 Kotlin 애그리거트 추출용이라 Luau 폴더에 돌려도 얻는 게 없다 — 표를 손으로 쓴다. 구현 뒤 README 「용어」절로 옮겨도 된다(README 는 `tasks.md:9` 에 이미 있다).

### D2. 같은 개념이 스펙 폴더 안에서 두 표기로 갈린다 (체크 4)
- **액세서리 / 악세서리**: `spec.md` 12회·`requirements.md` 7회가 「액세서리」, `requirements.md:39` 만 「악세서리 16종 전체 · KO 악세서리 드랍」. 웹 GDD 는 전부 「악세서리」(`amp-arena/docs/GDD.md:16,24,179`)라 거기서 딸려 온 표기다.
- **스타일 / 직업**: `spec.md` 는 「스타일」만 쓰고 모듈도 `Styles.luau`(`spec.md:20`). 그런데 `requirements.md:16` 「맨손 스타일(직업)별」, `requirements.md:31` 「액세서리 5(직업당 1)」, `open-questions.yml:12` 「직업당 1」, `test-quality.md:5` 「직업 외 액세서리는 맨손」, `test-quality.md:6` 「액세서리 배타(직업당 1)」. 테스트 시나리오가 「직업」으로 적혀 있으면 테스트 이름이 코드(`Style`)와 어긋난 채 태어난다.
- 수정안: 정본 **액세서리 · 스타일**, Avoid **악세서리 · 직업**. 위 여섯 자리를 고치고 D1 표의 Avoid 열에 올린다. (용어집의 Avoid 행이 없어 BLOCK 규칙은 적용하지 않는다.)

### D3. 액세서리 5·스타일 5 의 식별자와 표시명이 미확정 (체크 5)
- 근거: `spec.md:22` 「액세서리 5」, `requirements.md:31` 「대검(헤비)·장창(마셜)·쌍권총(스피드스타)·방패(그래플러)·로켓 글러브(파이터)」 — 보통명사뿐이다. 웹 참고작은 고유 표시명을 갖는다: 브레이커·스파이크·더블탭·월·부스터(`amp-arena/shared/src/accessories.ts:28-34`, `GDD.md:200-204`), 스타일 id 는 `fighter/grappler/speedster/heavy/martial`(`styles.ts:33-61`).
- `requirements.md:43` 은 「코드·수치·UI 는 옮기지 않는다」고 했지만 **이름**은 어느 쪽인지 말하지 않는다. 그대로 두면 `Accessories.luau` 의 id · HUD 장비 패널(`spec.md:36`) · README · `Remotes.State` 명단의 `액세서리` 필드(`spec.md:55`)가 각자 다른 이름을 고른다.
- 수정안: `spec.md` 에 표 하나 — `id | 표시명 | 스타일`. 예: `greatsword | 대검 | heavy` … (보통명사로 갈지 새 고유명을 붙일지는 사용자 취향이니 `open-questions.yml` 에 assumed 로 적고 진행). 식별자는 `Config`·`Styles`·`Accessories`·HUD·검증기가 같은 문자열을 쓴다.

### D4. 장비(loadout) 불변식이 spec.md 에 없다 (체크 6)
- 근거: 「액세서리는 자기 스타일 전용, 남의 것은 맨손」은 `requirements.md:31` 괄호와 `test-quality.md:5-6` 에만 있다. `spec.md:20` 「액세서리 1」, `spec.md:24` 「장비 검증」, `spec.md:53` `loadout{style,accessory}` 는 규칙을 가리킬 뿐 내용이 없다.
- 빠진 결정 셋: ① 스타일과 맞지 않는 액세서리가 오면 **거부**인가 **맨손으로 정리**인가(`spec.md:53` 검사는 「문자열 enum」까지만) ② `loadout` 을 **로비 단계에서만** 받는가 — 「매치 중 교체 불가」는 `GDD.md:216` 과 로비 표준 §2 에 있고 스펙에는 없다. 없으면 매치 중 `loadout` 으로 액세서리를 바꾸는 경로가 열린다 ③ 봇의 장비 규칙(무작위? 맨손 비율?).
- 수정안: 전투 규칙 또는 네트워크 절에 한 줄 — 「`loadout` 은 라운드 단계 `lobby` 에서만 받고, `Rules.sanitizeLoadout(style, accessory)` 가 스타일 전용이 아닌 액세서리를 `none` 으로 **정리**한다(거부 아님). 서버와 `rules.spec.luau` 가 같은 함수를 부른다. 봇은 자기 스타일 액세서리를 2/3 확률로 든다」. 테스트 `test-quality.md:5` 「직업 외 액세서리는 맨손」이 그제야 스펙에 근거를 갖는다.

### D5. 모드 승자·동점·아군 KO·팀 배정 규칙이 없다 (체크 6)
- 근거: `spec.md:24` 는 `Rules` 가 「모드 승자」를 계산한다고 하고 `test-quality.md:5` 는 「모드 승자·동점」을 critical 테스트로 둔다. 그런데 승리 조건과 동점 처리는 `spec.md` 어디에도 없다. `requirements.md:27` 은 「개인 DM 3분 / 팀 DM 3분 / 서바이벌 2분」 시간뿐이다.
- 같은 구멍: `spec.md:42` 「팀전에서도 아군이 맞는다」 + `spec.md:48` 「자멸 −1」까지는 있는데 **아군 KO 의 점수 처리**가 없다. 팀 DM 의 **팀 배정 규칙**(입장 순 교대? 봇 포함 균형?)도 없다 — 웹은 방장이 정했고(`GDD.md:296`) 여기엔 방장이 없다(`spec.md:14` 서버 = 방). 「준비 20초」(`spec.md:12`)와 `ready` 명령·「준비 수」(`spec.md:53,55`)의 관계 — 전원 준비면 20초를 줄이는가 — 도 없다.
- `requirements.md:43` 이 GDD 에서 「의도만」 가져온다고 했으므로 구현자가 `GDD.md:288-296` 을 규칙 원본으로 인용할 수 없다. 스펙에 적어야 한다.
- 수정안: `spec.md` 에 모드 표 — `모드 | 목숨 | 승리 | 동점 | 아군 KO`. 예: 개인 DM 무한/시간 내 KO 최다/데스 적은 순→준 피해 ; 팀 DM 무한/팀 KO 합/팀 데스→팀 피해 ; 서바이벌 1/최후 1인(팀 없음)/남은 HP 비율. 아군 KO = 개인 KO −1, 팀 점수 없음. 팀 배정 = 명단 순서 교대(봇 포함), 라운드마다 재배정 없음. 준비 전원이면 카운트다운으로 바로.

### D6. 피해·회복이 Humanoid.Health 를 쓰는 진입점이 하나인지 명시되지 않았다 (체크 6, 강제 가능성)
- 근거: HP 의 단일 원천은 `Humanoid.Health`(`spec.md:49,67`). 피해원은 무브 명중(Combat), 투사체(「명중 → Combat.hit」, `spec.md:29`), 던지기 15(`spec.md:45`), **폭탄 폭발**(`spec.md:28` Items 가 「폭발」까지 맡는다 — Combat.hit 를 거치는지 말이 없다), **하트 +30**(Items). 무적(DOWN·GETUP·리스폰 2초)·가드·슈퍼아머·4히트 넉백·KO 크레딧 3초는 전부 Combat.hit 안의 규칙이라, 폭탄이 `Humanoid:TakeDamage` 를 직접 부르면 **무적 중에도 맞고 크레딧도 안 붙는다**.
- 형제 프로젝트가 보여 주는 실제 모양: 규칙 없이 두면 피해 쓰기가 한 파일 안에서도 세 군데로 퍼진다 — `roblox/archer-command/src/server/Npc.luau:91,259,288`.
- 수정안: 전투 규칙 절에 한 줄 — 「`Humanoid.Health` 를 쓰는 곳은 `Combat.hit`(피해)·`Combat.heal`(회복) 둘뿐. Items 의 폭탄·하트, Projectiles, 던지기는 이 둘을 부른다」. 그리고 `verify.py` 네이티브 게이트(`spec.md:67`)에 grep 항목 하나 — `Health\s*=|TakeDamage` 가 `Combat.luau` 밖 서버 파일에 있으면 RED. 회귀 주입 12건(`spec.md:68`)에 이 항목을 포함한다. 사용자 하네스 규칙(「grep 으로 참/거짓이 나오는 규칙은 게이트로」)과 같은 방향이다.

### D7. 경계 선언 두 가지 (체크 1, 경미)
- **로비 표준 적용 여부**: `docs/standards/online-versus-lobby.md:4-6` 은 「사람과 붙는 온라인 대전 게임 전부」에 다섯 진입로·방장·코드 방을 요구한다. 이 스펙은 「서버 하나가 방」(`spec.md:14`)이라 방장·코드 방·빠른 대전이 없고 그래야 맞다(로블록스 매치메이킹은 플랫폼이 한다). 그런데 스펙이 그 표준을 **언급하지 않아** 다른 리뷰어·구현자가 적용 대상으로 읽을 수 있다. 수정안: 「승인과 범위」에 한 줄 — 「`online-versus-lobby.md` 는 플랫폼 릴레이 게임 표준이라 적용하지 않는다(로블록스 서버 = 방)」.
- **HUD 「순위 버튼」**(`spec.md:36`): 순위표는 후속(`requirements.md:36`)인데 버튼이 있다. 매치 내 점수판(명단 정렬)이면 「점수판」이라 쓰고 D1 표에 올린다. 플랫폼 순위표면 범위 밖이니 지운다.

## 하지 않은 것
- 다른 차원(architecture·implementation·security·test-strategy·usecase)은 보지 않았다. `Config` 「수치 한 곳」(`spec.md:19`)과 `Moves`·`Accessories` 가 수치를 따로 갖는 것은 구조 문제라 architecture 몫으로 남긴다.
- `roblox/amp-arena/` 코드가 리뷰 시점에 없어 skillsets 의 코드 대조(aggregate-invariant-trace 3·4단계, drift-scan 2단계)는 형제 프로젝트·웹 참고작으로 대신했다.

## 요약
비차단 7건. 용어집 부재와 표기 드리프트(D1~D3)는 표 두 개로 닫히고, 불변식 누락(D4~D6)은 각각 한두 줄과 게이트 한 항목이다. 스펙 결정과 코드가 충돌하는 BLOCK 근거는 없다.

VERDICT: REVISE
