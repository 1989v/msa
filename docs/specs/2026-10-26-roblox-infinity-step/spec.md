# Specification: Roblox Infinity Step — first course

## Goal
Create an editable Roblox climbing prototype that retains Infinity Step's charge-and-commit jumps, with optional paid revival to the last platform safely landed on before a fall.

## User Stories
- A player judges distance, holds jump for one of five strengths, releases, and lives with the trajectory until landing.
- A player who falls can continue freely or explicitly spend one revival ticket to return to the last platform before the fall.
- A purchaser retains an unused ticket through disconnects, receipt retries, and cancellation of a revival choice.

## Specific Requirements
### SR-1 Course and movement
- Three short, deterministic urban regions (alley, exterior, roof) with solid visible platforms, labeled regional entrances, a start spawn and a finish marker. All necessary jumps are reachable with the configured five strengths, without payment.
- Scale original movement by four Roblox studs per source unit: gravity 104, vertical launch speeds 30–64 and horizontal speeds 6–40; five linear steps. Use the source code's current 0.12-second charge steps, not older prose values; cap hold at 1.2 seconds.
- Input: WASD/default mobile stick plus Space/on-screen held jump. Charging slows walking. Charged flight locks horizontal direction until collision/landing; collisions never push through solid parts. Default Roblox jumping is disabled.
- Server validates charge start/release, duration, grounded state and finite direction; clients cannot name a jump strength or teleport target. Movement and region/fall transitions have server validation appropriate to this prototype; do not advertise competitive anti-cheat certification.
- Falling is not capped at a regional boundary. No automatic regional respawn. A void/death recovery goes to the ground start for free.

### SR-2 Last-platform revival
- Region and the last safe platform are established by stable landing on a known course platform, not height alone. Each platform has an authored stable ID and a safe return center resolved only by the server.
- Snapshot the last safe platform ID and departure height when a fall begins; offer a revival after a substantial height loss or death. Ground-only falls do not offer a meaningless paid revival.
- A fall keeps the original snapshot even after crossing/landing in lower regions. A successful new ascent, explicit dismissal, restart, character lifecycle transition or use handles the old offer explicitly; no stale offer may teleport a newly progressed character backwards.
- Dismissal suppresses further offers for the same uninterrupted fall; it cannot immediately reconstruct an offer from unchanged last-safe state. Lower landing does not silently retarget an existing offer.
- Death preserves the fall snapshot separately from character-bound UI/actions. After free ground spawning, issue a fresh character-bound offer from that snapshot; ordinary character transitions invalidate old requests. A voluntary restart/dismissal clears the uncommitted snapshot. Reserved delivery is a separate durable obligation.
- Show destination and balance. Use consumes one ticket exactly once, restores zero velocity, and places the avatar safely above the target. Dismissal/ordinary continuation costs nothing.

### SR-3 Purchases and persistence
- A repeatable Developer Product grants one revival ticket. Server `MarketplaceService.ProcessReceipt` handles all receipts once; durable grant and purchase-ID deduplication share one atomic DataStore update. Return `NotProcessedYet` on failure/unknown product/offline user. Never grant from a client purchase-finished callback.
- Receipt delivery grants inventory only; it never auto-teleports. Cancellation, delayed delivery, disconnect, no pending fall and duplicate delivery do not lose or double-grant a purchased ticket.
- Durable use atomically decrements a positive balance once using a server-generated operation ID. Serialize per-player requests and invalidate offers on character changes; failure leaves position unchanged. Snapshot-safe handling prevents a yielding persistence operation from teleporting a replacement character.
- Persist a pending revival delivery (operation ID, course version and authored platform ID) in the same atomic decrement. Resolve position from the server course, never a client CFrame. If a disconnect/server failure interrupts teleport or acknowledgement, recover that delivery on the next character/session without charging again. Clear it only after delivering safely; concurrent sessions cannot reserve a second use while a delivery is pending. Stored records are updated atomically without stale whole-record saves.
- Complete reserved delivery before controls/progress resume on spawn. If teleport succeeds but acknowledgement fails, keep the character safely frozen and retry automatically; reconnect recovers the same delivery. Receipt grants may interleave without being overwritten by acknowledgement. No second debit on retry.
- Purchases stay unavailable with product ID zero, failed data load, Studio mock storage, or unavailable product information. Prices are fetched from Roblox at runtime; no invented or hard-coded Robux price.
- Studio local mode provides explicit test tickets and labels them as test inventory. It cannot enable real purchases. Persistence errors are visible and never overwrite real records with default values.

### SR-4 Delivery and experience
- Create sources under `roblox/infinity-step/`, independently from the browser games submodule. Include a project mapping and a dependency-light place builder or an equivalent verified packaging path.
- A `.rbxlx` place includes the exact checked-in scripts, services, a visible initial world/spawn and a usable camera. README explains opening and Play, controls, mock inventory, configuration, receipt verification, and publishing prerequisites.
- HUD shows region, current/best session height, five charge segments, ticket balance, and an explicit revival/continue choice. Touch targets are at least 44px with Roblox safe insets; keep movement controls clear. UI colors derive from root DESIGN.md tokens via a named Luau theme; no scattered hex literals.
- Verify gameplay logic, fall snapshots, single-use/deferred/duplicate purchases, persistence failures and artifact contents with executable checks. Studio physics, touch feel and real receipts require actual Roblox runtime checks and must be labeled unverified if unavailable.
- Automated execution uses the official Luau CLI against actual source modules with injected store/clock/delivery boundaries, not a parallel Python/JS reimplementation. Use `LUAU_BIN=/private/tmp/roblox-infinity-step-tools/luau python3 roblox/infinity-step/tools/verify.py`; the same verifier compiles all Luau with a sibling `luau-compile` and checks the generated XML. Runner provenance: official luau-lang/luau release 0.744.

## Existing Code to Leverage
- `portal-fe/public/games/_src/infinity-step/Assets/Scripts/Sim/Leap.cs`: actual five-level charge constants and reach equations; reference, not a Luau dependency.
- `portal-fe/public/games/_src/infinity-step/Assets/Scripts/Actors/Climber.cs`: control semantics.
- `docs/specs/2026-09-02-infinity-step-prd.md`: original identity and fall cost; optional paid revival is an intentional Roblox-only user-requested adaptation.
- Root `DESIGN.md`: semantic UI tokens.

## Out of Scope
Full original infinite tower, all seven regions, wall climbing, moving/breakable platforms, global rankings, trading/gifting, web account integration, production publication, live product creation, final price and real purchases. This is a standalone Roblox project, with no platform MSA schema or service changes.

## Open Questions
Destination resolved by explicit user answer: “떨어지기 직전 밟았던 발판으로 복귀”. Price and product ID are deferred release configuration. No unknowns block building the prototype.

## Amendment — 2026-10-26 User-selected destination
The user selected the last platform instead of the agent's earlier region-entrance default. SR-2 and the pending-delivery target in SR-3 reflect this explicit correction. The first-course scope and free continuation remain as authorized. The user also requested a reusable Roblox porting prompt and a Roblox development reference document; these are parent-authored documentation under `docs/research/2026-10-26-roblox-development/`.

## Local terminology
See `planning/glossary.md` for the standalone Roblox vocabulary and lifecycle distinctions; this introduces no cross-service bounded context.

## Sources
- https://create.roblox.com/docs/luau
- https://create.roblox.com/docs/production/monetization/developer-products
- https://create.roblox.com/docs/cloud-services/data-stores/player-data-purchasing

## 개정 — 2026-10-28 원작 재현 복원

사용자가 발판 9개짜리 결과물을 원작과 전혀 다르다고 지적했고 반복해서 작업 재개를 요청했다. 이전의 작은 고정 코스와 임의의 골목 시안은 재현 기준으로 사용하지 않는다. 다음 요구사항이 기존 SR-1의 규모·이동 범위와 Out of Scope 중 원작 게임 기능 제외를 대체한다. 영수증·유료 부활의 안전성과 판매 비활성화는 유지한다.

### 복원 기준

1. 원작은 `portal-fe/public/games/_src/infinity-step/Assets/Scripts/`와 공용 `unity/packages/com.kgd.webgame/Runtime/Play/`의 현재 코드다. 이미지 생성 시안이나 옛 기획 설명을 대신 쓰지 않는다. 원작 파일은 수정하지 않는다.
2. 가능하면 설치된 Unity 6000.5.9f1의 비대화형 일괄 실행을 이용해 **실제 Tower 생성 코드**에서 정상 고도 3000 이상까지의 기준 지형을 내보낸다. 별도 임시 프로젝트에서 수행하며 원작 프로젝트에 내보내기 스크립트나 캐시 변경을 넣지 않는다. 내보내기 도구·데이터·원본 해시·시드·난이도·생성 높이를 남긴다. 단순히 비슷한 계단을 다시 생성하지 않는다.
3. 내보내기 기준은 보통 난이도, 고정 명시 시드로 재현 가능한 맵이다. 웹의 매일 새 탑·세션 유지 기능과 기준 맵 스냅샷은 구분한다. 런타임 날짜별 생성이 아직 없으면 그대로 미지원이라고 명시하고 전체 동등 구현이라고 주장하지 않는다.
4. 로블록스에서 좌표·치수는 원작 1단위=4studs로 변환한다. 원작 지형 ID, 보장 경로, 벽·경사·움직임·붕괴·얼음 구분을 보존한다. 기존 9개 발판의 이름과 자리를 재현 기준으로 쓰지 않는다.
5. 화면은 원작 Pal/Biome의 밤 골목·고도별 색상과 배경 방향을 따른다. 바닥·시작 경로·등반 벽·발판 형태가 있어야 하며 시작 편집 카메라에서도 빈 공간의 동일한 발판 9개로 보이면 안 된다. 표시와 충돌이 어긋나는 경사·장식은 검증 대상으로 기록한다. 큰 월드의 객체 수와 생성/스트리밍 비용을 측정한다.

### 이동·카메라·진행

- 걷기 5.5, 달리기 8.6, 달려서 도약 수평 +18%, 차지 중 이동 35%, 낙하 종단 속도40의 원작 단위를 일관되게 환산한다. 5단 차지와 1.2초 자동 도약은 유지한다.
- 차지 도약 중에는 방향을 고정하지만 걸어서 떨어진 낙하는 원작의 조향 규칙을 따른다. 벽 충돌·매달림·끌어올리기·벽 등반과 스태미나100, 초당 소모11, 매달림 비용12를 현재 Climber/Tuning 코드와 대조한다.
- 원작 58도 시야각, 시작 경로를 향한 방향, 위·아래를 살필 수 있는 궤도 카메라와 장애물 회피를 반영한다. 원작 조작 C(점프)·X(잡기/놓기)·Z(달리기)를 지원하고 Space 등 로블록스 편의 키는 함께 제공할 수 있다.
- 고도·최고 고도·낙하 횟수·구간 이름·차지·필요할 때의 스태미나를 한글로 표시한다. 매달림 후 점프/놓기 안내와 정상 도달 상태를 제공한다.
- 움직이는/무너지는/미끄러운 지형과 바람·중력 변화는 원작 구간 데이터에 맞춰 연결한다. 구현되지 않은 규칙을 화면 이름만 바꿔 지원한다고 쓰지 않는다.
- 저장은 현재 진행과 기록을 보존하는 기능이다. 종료/재접속을 무료 추락 되돌리기로 만들지 않는다. 유료 부활은 여전히 추락 직전 마지막 안정 착지 발판으로 명시적 선택 시에만 수행한다.

### 검증과 완료 표현

- 실제 원작 코드에서 얻은 독립 지형/물리 기준 데이터와 구현 결과를 비교한다. 코드 문자열 존재 검사나 별도 언어의 모형을 실제 게임 검증으로 대체하지 않는다.
- 기존 영수증·단일 차감·전달 복구 검사는 유지한다. 맵 ID/버전 변경으로 이미 예약한 부활이 유실되지 않게 영향 여부를 확인한다.
- 로블록스 파일을 재생성하고 모든 스크립트의 구문·알 수 없는 전역 변수·포함 소스·지형 데이터를 검사한다. 기존 9개 발판 개수 고정 검사는 원작 데이터 기반 검사로 교체하되 보장 경로 연결 검증은 약화하지 않는다.
- 비대화형 Unity 실행은 원작 코드 평가 증거이며 웹 직접 플레이의 대체 증거가 아니다. 컴퓨터 사용 도구의 명시적 거절을 다른 경로로 우회하지 않는다.
- 실제 스튜디오 시작·이동·점프·추락·매달림·부활·원작과의 화면 비교가 통과하기 전에는 **플레이 검증 완료/이식 완료**라고 보고하지 않는다. 소스 기준 복원 결과와 남은 실제 실행 확인을 분리한다.

### 작업 소유권

부모 세션이 이 기준과 결정·검증 기록을 관리한다. `gpt-6.1-sol` 구현 담당자 한 명이 `roblox/infinity-step/`만 소유하고 원작/다른 작업자의 변경을 보존한다. 기존 원작의 내보내기 실행과 로블록스 구현에 필요한 임시 파일은 독립 임시 경로를 사용한다. 새 시안·다른 게임 기획·실제 판매·업로드·공개는 이번 복원 작업에 넣지 않는다.

### 2026-10-28 구현 발견: Unity 라이선스와 소스 호스트 대안

독립 임시 Unity 프로젝트의 실제 실행이 유효한 에디터 라이선스 부재로 종료 코드198을 반환했다. 이 제한을 우회하지 않는다. 부모는 대안으로 **원본 C# 생성·기하 로직을 독립 C# 호스트에서 컴파일하고 필요한 수학 타입 어댑터를 제공하는 방법**을 승인했다. 렌더링·아트 의존부를 호스트용 사본에서 제외할 수 있지만 지형 생성 알고리즘을 다른 간이 생성기로 바꾸지 않는다.

원본 파일 해시, 제외한 렌더 부분, 수학 어댑터, 호스트/컴파일러 버전과 재현 명령을 기록한다. 이 출력은 원본 알고리즘을 평가한 자료이나 실제 Unity 엔진의 출력 또는 부동소수점 단위까지 같은 맵으로 인증한 결과는 아니다. 첫 발판·고도 구간·원작 규칙·경로해를 별도 점검하고 해당 한계를 실행 안내에 명시한다.

## 최우선 개정 — 2026-10-28 게임 구성·아이디어를 유지한 로블록스 최적화

사용자 원문: **“완전 발판 개수까지 동일할게아니라 컨셉을 유지하며 로블록스 구성에 최적화하면서 옮기라는거야. 게임 구성과 아이디어를 유지한채”**.

앞 개정의 원본 좌표/개수/정상 높이/경로 일치 요구는 이를 구현 완료 기준으로 오해하게 했으므로 이번 개정이 대체한다. 원본 추출 자료는 게임의 구성과 의도를 이해하는 참고·진단 자료로 보존하되 기본 빌드나 런타임의 필수 의존으로 쓰지 않는다. 원작과 구성이 다른 임의의 작은 게임이나 시안을 만드는 방향도 채택하지 않는다.

### 유지하는 게임 정체성

- 충전량과 방향을 정하고 점프하여 도시에서 우주·블랙홀까지 높이 오르는 도전.
- 달리기·공중 방향 고정·걸어서 떨어진 낙하 조향, 매달림·벽 등반·스태미나의 선택.
- 실수하면 아래 구조물이나 지면까지 떨어지고, 다시 경로를 찾아 도전하는 긴장감.
- 뒷골목 → 외벽 → 옥상 → 마천루 → 공사장 → 성층권 → 블랙홀의 구간 진행과 위험/장치 변화.
- 현재 진행 이어하기·최고 기록·낙하/정상 피드백, 사용자가 선택한 마지막 안정 발판 부활권.

### 로블록스에 맞춰 재구성하는 것

1. **맵과 규모:** 발판 좌표·개수·총 높이는 새로 설계한다. 넓게 방향을 바꾸며 오르는 공간감, 다음 착지면과 위 목표의 가독성, 위험 변화가 기준이다. 동일한 발판의 직선 계단이나 좁은 골목 한 장면으로 전체 게임을 축소하지 않는다.
2. **네이티브 지형:** Part/Wedge/Truss 등 로블록스 기본 덩이·재질·충돌을 활용한다. 원본 경사를 복제하기 위한 격자 타일 월드는 기본 빌드에서 제외한다. 램프·빔·비계·테라스 등 엔진에 자연스러운 구조로 각색하고 표시/충돌을 일치시킨다.
3. **구간 구성:** 시작은 실제 지면과 도시 구조물, 이어지는 외벽/옥상, 위쪽은 마천루·공사장·상공·우주로 읽혀야 한다. 구간 이름만 바꾸고 같은 빈 발판을 반복해서는 안 된다. 움직이는/무너지는/미끄러운 구조물과 잡을 수 있는 벽을 진행 속에서 사용한다.
4. **경로와 예산:** 정상까지 대략150~250개 주경로점은 초기 설계 가이드일 뿐 고정 개수 합격선이 아니다. 생성되는 네이티브 지형·장식 부품은 가급적1500개 이내로 관리하고 실제 개수/파일 크기/스트리밍 전략을 보고한다. 새 경로의 도달 가능성과 착지 여유를 검사한다.
5. **생성과 스트리밍:** 순수 Luau의 결정적 생성기 또는 작은 네이티브 청크를 사용한다. 로블록스가 지원하는 스트리밍을 활용하되 추락 중 서버 충돌 지형을 임의로 지우지 않는다. 동일한 설정/시드에서 경로 ID와 위치가 재현되어야 한다.
6. **조작과 표현:** 원작 수치는 초기 조작 기준으로 사용하되 로블록스 캐릭터·물리·입력·카메라에 맞춘 조정은 허용한다. 원작과 같은 숫자라는 이유만으로 조작감이 재현됐다고 쓰지 않는다. 화면 안내와 새 실행 문서는 한글로 제공한다.
7. **이어하기와 한계:** 날짜별 탑, 정상 이후 무한 확장 등을 아직 지원하지 않는다면 각각 명시한다. 저장된 시드·지형 ID가 달라졌는데 다른 발판으로 몰래 이어주거나 유료 복귀 권리를 잃게 하지 않는다. 상품 ID0과 실판매 비활성화를 유지한다.

### 이번 결과물의 검증 기준

원본 지형1901개 또는 LinkArc795개와의 일치가 아니라, **개념을 유지한 새 로블록스 맵의 연결·구간·조작·진행·부활 안전성**을 검사한다. 원본 C# 자료와 그 전용 SDK 도구는 선택적 참고 도구이며 일반 파일 생성에 필요하지 않아야 한다. 실제 스튜디오 플레이·화면·터치 확인은 여전히 별도다. 도구 접근 거절 상태에서는 완료로 표시하지 않는다.
