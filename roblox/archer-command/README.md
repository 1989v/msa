# 궁수 키우기 / Roblox · 시작 분지 (네이티브 재개발)

웹 게임 「궁수 키우기」(`portal-fe/public/games/marine-command/`)의 **컨셉과 구성만** 가져와 Roblox 방식으로 다시 만든 독립 프로젝트. 활잡이 하나로 시작해 사냥·채집 수입으로 원정대를 키우고, 탑을 세우고, 영웅을 합성해 거점·전초기지를 공략하는 동안 본진으로 웨이브가 온다. 1차 이식(웹을 그대로 옮긴 판)은 폐기했고 git 이력(커밋 c3fe0df59)에만 있다. 명세는 `docs/specs/2026-10-28-roblox-archer-native/`, 조사 근거는 `docs/research/2026-10-26-roblox-development/reference-analysis.md`.

## 열어서 놀기

1. Roblox Studio 에서 File → Open from File 로 `dist/ArcherCommand.rbxlx` 를 연다.
2. Game Settings → Players 에서 Max Players 를 **2** 로 둔다(.rbxlx 에는 담기지 않는다).
3. Play. 첫 화면 「새 원정」. Studio 에서 DataStore 가 막혀 있으면 저장은 메모리(이 Play 안에서만)다.
4. 걷기·점프·카메라는 Roblox 기본이다. 우상단 「시점 · 내려보기」가 쿼터뷰(거리 32)로 바꾼다. 그 아래 미니맵(본진·치료사·사냥터·거점·전초기지·출구 고정 표시, 아군 파랑·적 빨강·보스 큰 빨강·탑 노랑·내 위치와 방향). 사격은 가까운 적에게 자동.
5. 하단 핫바 두 줄. 윗줄 고용(관리 패널) · 공업 · 방업 · 방어탑(지면 탭). 아랫줄 스킬: 화살비(지면 탭, 하늘에서 18발) · 질주(4초 가속) · 집결(반경 16 치료 + 6초 사격 속도) · 일제 사격(영웅, 지면 탭). 쿨다운은 버튼 아래 초로. 관리 패널은 고용(활잡이·장궁수·목수) · 용병(방패 용병: 근접, 적이 먼저 노림 · 석궁 용병) · 공방업 · 병종 강화(같은 병종 셋 → 한 단계 위: 활잡이→정예→영웅, 장궁수→명궁, 방패→중갑). 본진의 고용소·훈련장 ProximityPrompt 가 같은 패널을 연다.
6. 방어탑은 자리를 잡으면 20초 안에 스스로 올라가고(목수가 붙으면 더 빠름) 완성되면 발리스타가 자동 사격한다. 가까이 가면 「주둔 / 철수」로 원거리 병력을 올려 더 쏜다.
7. 적을 클릭/탭하면 체력·피해·「피해 1까지 방업 n 더」·특성(바위 투척·폭발·철갑)이 뜬다. 적은 일곱 종류: 좀비·질주 좀비(빠르고 약함)·역병 좀비(침 원거리)·폭발 좀비(닿으면 반경 폭발)·철갑 좀비(화살 피해 −4)·박쥐·거구 좀비(중간 보스, 900 체력, 바위 투척 반경 피해, 5 웨이브마다).
8. 진행 안내는 토스트로 나오고 핫바의 눌러야 할 버튼이 깜빡인다: 군자금 300 으로 공업 둘·방업 하나 → 동쪽 사냥터 → 목수(500) → 활잡이(700) → 탑(220)·주둔 → 활잡이 3 합성 → 일제 사격으로 북쪽 언덕 거점.
9. 치료사는 본진 북동쪽 제단에 서 있는 NPC 다(이름표 「치료사 · 곁에 서면 빨리 낫는다」, 초록 광원·고리). 고리 안에서는 초당 20 회복.

첫 웨이브는 75초 뒤 좀비 6마리. 분지 동·남동·북동·북 가장자리 네 입구에서 흩어져 들어오고 개체마다 속도·목적지가 다르다. 밸런스 값은 전부 `src/shared/Config.luau` 한 파일이고 한 판 플레이 뒤 두 번째 추정값이다.

## 구조

| 경로 | 내용 |
|---|---|
| `src/shared/Config.luau` | 수치·배치 한 곳(빌더가 SITES/BOWL/HILL 을 읽는다) |
| `src/shared/Rules.luau` | 순수 규칙: 가격·고용 상한·강화·합성·피해·웨이브 구성·탑 배치·저장 정리 |
| `src/shared/Theme.luau` | 화면 색(원작 DESIGN.md 토큰) |
| `src/server/World.server.luau` | Terrain 분지(풀·바위 테두리·언덕·자갈길·구름) — 실행 시 채운다 |
| `src/server/Rigs.luau` | 리그: 아군은 HumanoidDescription 아바타(R15, 실패 시 BlockRig R6), 적은 Roblox 소유 Zombie/Bat 모델. 활 부착, 캐릭터 광원, 애니메이션 |
| `src/server/Npc.luau` | 아군 추종·사격·근접 용병, 목수 채집·건설·수리, 적 추적·공격(Humanoid:MoveTo 재발행), 거구 바위·폭발 좀비·철갑, 박쥐 비행, 주둔, 탑 발리스타, 스킬(화살비·집결·일제 사격) |
| `src/server/Campaign.luau` | 사냥터 보충 · 거점 소탕/역습/보충 · 전초기지 · 웨이브 대기열 |
| `src/server/Towers.luau` | 탑 자리·건설 진행·완성·주둔 토글·수리·파괴 |
| `src/server/Main.server.luau` | 세션(로비/원정/패배)·명령·금화·본진·치료사·안내·저장 |
| `src/server/Save.luau` · `Commands.luau` | 호스트 키 UpdateAsync · 명령 모양 검사와 빈도 제한 |
| `src/client/Camera.client.luau` | 기본 카메라 + 쿼터뷰 전환 |
| `src/client/Effects.client.luau` | 화살(Trail·섬광·명중 파티클·소리)·피해 숫자·사망 페이드·배너·박쥐 날개·좀비 신음 |
| `src/client/Hud.client.luau` | 상단 정보·미니맵·핫바 두 줄(관리/스킬)·관리 패널(고용·용병·강화·병종 강화)·지면 지정·적 카드·로비·패배·토스트 |
| `assets/roblox/*.rbxmx` + `provenance.json` | Roblox 공식 소유 XML 모델 16종과 출처·해시 |
| `tools/build.py` · `tools/verify.py` · `tests/rules.spec.luau` | 결정적 빌더 · 검증기 · 규칙 검사 |

## 재생성·검증

```sh
python3 roblox/archer-command/tools/build.py
LUAU_BIN=/private/tmp/roblox-infinity-step-tools/luau python3 roblox/archer-command/tools/verify.py
```

검증기는 실제 `Config`·`Rules` 를 luau CLI 로 실행하고, 전 Luau 컴파일·미지 전역·의존 방향, 빌더 결정성과 스크립트 정확 포함, 에셋 출처(creator id 1)·해시·스크립트 제거, 그리고 **네이티브 조건**(기본 카메라가 기본값이고 Scriptable 은 전환 함수 안에만 · 카메라 거리 범위 · 캐릭터 PointLight · 화살 Trail/파티클/소리 · 키 안내 문자열 없음 · Humanoid 리그 템플릿 · 동시 적 90 상한 · 점프 기본값 · 밤 조명 프리셋 · 공격 모션 · 무리 산개 · 치료사 NPC · 강화 먼저 · 탑 자립 · 미니맵 · 용병/병종 강화 · 스킬 · 적 종류 · 거구 보스)을 검사한다. **Studio 실행·물리·애니메이션·소리·터치·2인·DataStore 는 검증하지 않는다** — 출력의 `UNVERIFIED` 줄이 그 목록이다.
