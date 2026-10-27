# 궁수 키우기 / Roblox · 시작 분지

웹 게임 「궁수 키우기」(`portal-fe/public/games/marine-command/`, Three.js 2D 탑다운 부대 성장 RPG)의 시작 분지를 Roblox 로 옮긴 독립 프로젝트. 규칙·수치·리듬은 원작 코드 그대로이고, 조작·화면·배경·에셋은 Roblox 에 맞게 새로 설계했다(`docs/research/2026-10-26-roblox-development/README.md` §0). 명세는 `docs/specs/2026-10-28-roblox-archer-command/`.

## 열어서 놀기

1. Roblox Studio 에서 File → Open from File 로 `dist/ArcherCommand.rbxlx` 를 연다.
2. Game Settings 에서 Max Players 를 **2** 로 둔다(.rbxlx 에는 담기지 않는 설정).
3. Play. 첫 화면에서 「원정 시작」. Studio 에서는 저장이 메모리(TEST)다.
4. 활잡이 1명·목수 0·금화 0. 8초 뒤 동쪽 전초기지 쪽에서 정찰 좀비 80마리가 본진으로 온다. 걷기는 WASD/터치 스틱, 사격은 자동. 오른쪽 세로열 버튼으로 고용소·훈련장·병력·목수·방어탑·도감. 적을 클릭/탭하면 능력치와 「피해 1까지 방업 n 더」가 뜬다.
5. 원작 안내 순서: 공업 3·방업 2 → 500G 목수 → 채집 → 700G 활잡이 → 220G 탑·주둔 → 활잡이 3 합성 → 영웅 Q/E(무장 → 지면 탭).

**원작 현재 밸런스는 서서 쏘기만 하면 23~29초에 죽는다**(원작 측정 `verifications/original-bot.md`). 이식판도 같다 — 치료사(녹색 고리) 주변에서 움직이며 싸우고, 금화가 모이는 대로 방업을 올린다. 쉬워졌다면 이식 오류다.

## 구조

| 경로 | 내용 |
|---|---|
| `src/shared/Balance.luau` | 원작 수치 전부 (px ÷ 8 = 스터드) |
| `src/shared/Grid.luau` | 분지 격자 54×52 (RECTS/SITES 한 줄 한 사각형 — 빌더가 같은 줄을 읽는다), A*·LOS·흐름장·건설 판정 |
| `src/shared/Campaign.luau` | 사냥터·거점·전초기지·웨이브 대기열·행렬 방출 (Sim 내부) |
| `src/shared/Sim.luau` | 30Hz 순수 시뮬레이션: 명령·경제·전투·목수·탑·영웅·리더 검사·저장 |
| `src/shared/Packet.luau` | 10Hz 액터 buffer 패킷 |
| `src/shared/Theme.luau` | `marine-command/DESIGN.md` 토큰 |
| `src/server/Main.server.luau` | 세션·협동 수락·틱·리더 되돌림·탑 모델·저장 |
| `src/server/{Save,Commands,Ingress}.luau` | 호스트 키 UpdateAsync 저장 · 명령 스키마 · 토큰 버킷 |
| `src/client/{Camera,Actors,Hud}.client.luau` | 탑다운 카메라 · 클라이언트 액터 렌더 · HUD/패널/입력 |
| `tools/build_place.py` | 결정적 .rbxlx 빌더 (표준 라이브러리만) |
| `tools/verify.py` · `tools/dump_grid.luau` · `tests/run.luau` | 검증 |

## Roblox 에서 바꾼 것

- 플레이어 아바타가 자기 원정대의 선두 활잡이다. 걷기는 Roblox 조작이고 고용 병력이 뒤따른다. 서버가 틱마다 위치를 검사해 벽·절벽·순간이동은 되돌린다. 점프 없음.
- 적·동료·목수·투사체는 클라이언트가 그린다(서버 10Hz 패킷). 서버 Workspace 에는 지형·탑·캐릭터만 있다.
- 리더가 죽으면 다른 전투 병력이 이어받고, 없으면 「리더 없음」(관전 + 고용). 자동 고용 없음.
- 협동은 2인, 호스트 수락 뒤에만. 저장은 호스트 계정 키 하나. 손님 저장 없음.
- 길 위 무리는 분지 안에 없다(원작 조건). 안개 없음. 동쪽 원정로는 문으로 막혀 있다(다음 단계).

## 재생성·검증

```sh
python3 roblox/archer-command/tools/build_place.py
LUAU_BIN=/private/tmp/roblox-infinity-step-tools/luau python3 roblox/archer-command/tools/verify.py
```

검증기는 공식 `luau`·`luau-compile`·`luau-analyze`(0.744)가 필요하다. 실제 Sim 모듈을 두 프로세스에서 실행해 해시를 비교하고, 모든 Luau 를 컴파일하고, 미지 전역·require 허용 목록을 검사하고, 빌더 결정성과 스크립트 정확 포함을 확인하고, 실행한 Grid.luau 덤프와 XML 파트를 2,808 셀 전수 대조하고, 원작 소스 해시가 바뀌면 오라클을 STALE 로 찍는다. **Studio 실행·물리·터치·2인·DataStore 는 검증하지 않는다** — 출력의 `UNVERIFIED` 줄이 그 목록이다.
