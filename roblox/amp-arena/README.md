# AMP ARENA / Roblox — 액세서리 하나로 기술이 통째로 바뀌는 8인 아레나 난투

겟앰프드식 난투(스타일 × 액세서리 × 사슬·가드·잡기·다운·링아웃·아이템·라운드)를 로블록스 방식으로 처음부터 만든 독립 프로젝트. 웹 참고작 `amp-arena/`(AMP ARENA)의 코드·수치·UI 는 옮기지 않았고 의도만 가져왔다. 명세는 `docs/specs/2026-10-29-roblox-amp-arena/`, 로블록스에 겟앰프드가 있는지 조사한 결과는 그 폴더의 `planning/requirements.md` §0.

## 열어서 놀기

1. Roblox Studio 에서 File → Open from File 로 `dist/AmpArena.rbxlx` 를 연다.
2. Game Settings → Players 에서 Max Players 를 **8** 로 둔다(.rbxlx 에는 담기지 않는다). Avatar 는 파일이 R6 로 두었다.
3. Play. 로비 발판에서 장비 패널 — 스타일 다섯 중 하나, 「맨손 → ○○ 들기」로 전용 액세서리, 「준비」. 혼자면 봇 3이 채운다(`Config.BOTS.fillTo`).
4. 카운트다운 3 → 콜로세움 개인 데스매치 3분. 이동·점프·카메라는 Roblox 기본이다.
5. 조작(혼자 플레이 기준, 왼손 WASD·오른손 공격키): 약공 Z · 강공 X · 가드 C(홀드) · 기술 V · 대시 Shift · 점프 Space · 폭탄은 가까이 가서 F(ProximityPrompt), 들고 있으면 약공이 던지기. 마우스는 오른쪽 드래그 카메라만(쉬프트락 토글은 꺼 두었다 — Shift 가 대시). 터치는 같은 이름의 버튼, 게임패드는 X·Y·L2·B·R1·D패드 아래.
6. 밀착(중심 거리 ≤ 스타일 잡기 범위 3.0~3.9)해서 약공을 누르면 잡기, 잡은 뒤 공격으로 던진다. 가드로 막은 직후 공격은 반격기, 대시 직후 약공은 태클. 공중에서 약공은 공중 공격, 강공은 급강하.
7. 결과 10초 → 로비. 모드는 개인 DM → 팀 DM(레드/블루 외곽선) → 서바이벌 순환, 4라운드부터 스카이독(발판 밖은 링아웃).

밸런스 값은 `src/shared/Config.luau`·`Moves.luau` 두 파일이고 전부 첫 추정값이다.

## 구조

| 경로 | 내용 |
|---|---|
| `src/shared/Config.luau` | 수치 한 곳(이동·가드·잡기·피격·아이템·매치·모드·맵·봇·한도) |
| `src/shared/Styles.luau` · `Accessories.luau` · `Moves.luau` | 스타일 5 · 액세서리 5(스타일당 1) · 무브 60여 개 프레임 데이터(초·스터드)와 투사체 스펙 |
| `src/shared/Poses.luau` | 절차 포즈 — 무브별 windup/strike 템플릿(다섯 스타일이 서로 공유하지 않는다)·상태 포즈(가드·경직·띄움·다운·기상·잡힘·스턴)·스타일별 상체 대기 자세·휘두르는 부위 표(궤적). 업로드 애니메이션 없음 |
| `src/shared/Rules.luau` | 순수 규칙: 스탯·피해·장비 정리·사슬·히트 기하·가드·잡기·링아웃·순위·팀·순환·전투 결정(탈출·창·착지·봇 걸음·봇 수·아군 KO) |
| `src/shared/Theme.luau` | 화면 색·서체 |
| `src/server/Main.server.luau` | 라운드 루프(로비→카운트다운→매치→결과)·플레이어·봇 채움·팀·스폰·KO 점수·리스폰·State 4Hz. Heartbeat 하나 |
| `src/server/Combat.luau` | 파이터 상태 머신·입력 의도·판정·피해·넉백(LinearVelocity)·잡기(Weld)·KO. 피해 진입점은 `applyHit` 하나 |
| `src/server/Items.luau` · `Projectiles.luau` · `Bots.luau` | 상자/하트/폭탄/점프대 · 서버 투사체 · 봇 의도(절벽 탐침) |
| `src/server/Rigs.luau` · `Commands.luau` | 아바타 설정(몸집·액세서리 Weld·이름표·팀 외곽선)·봇 리그 · 명령 모양 검사·토큰 버킷 |
| `src/client/Input.client.luau` | ContextActionService 바인딩(터치 버튼·게임패드)·조준 보조 |
| `src/client/Poser.client.luau` | 태그 Fighter 전부의 Attribute → `Motor6D.Transform`(Stepped). idle 은 스타일 대기 자세(상체만, 다리는 기본 걷기), 판정 구간엔 부위 Trail. R6 기본, R15 매핑 |
| `src/client/Effects.client.luau` · `Hud.client.luau` | 연출(스파크·피해 숫자·KO·투사체·폭발·소리·CameraOffset 흔들림)·이름표 체력 · HUD(내 상태·타이머·명단·피드·장비 패널·결과) |
| `tools/build.py` · `tools/verify.py` · `tests/rules.spec.luau` · `default.project.json` | 결정적 빌더 · 검증기 · 규칙 검사(1063 단언) · Rojo 트리 |
| `tools/smoke.py` · `tests/roblox-shim.luau` · `tests/combat.smoke.luau` | 서버 `Combat`·`Bots` 본문을 Roblox 대역(쉼) 위에서 luau CLI 로 실행하는 스모크(31건: 타격·사슬·대시·가드·잡기/던지기·띄움→다운→기상·봇 접근·링아웃·KO 크레딧). 쉼은 위치+LookVector 물리뿐이라 Studio 검증이 아니다 |
| `assets/roblox/*.rbxmx` + `provenance.json` | Roblox 공식 소유 XML 모델 9종(횃불·성곽·울타리·나무·꽃)과 출처·해시 |

## 재생성·검증

```sh
python3 roblox/amp-arena/tools/build.py
LUAU_BIN=/private/tmp/roblox-infinity-step-tools/luau python3 roblox/amp-arena/tools/verify.py   # 규칙 검사 + 스모크 + 게이트 41
LUAU_BIN=/private/tmp/roblox-infinity-step-tools/luau python3 roblox/amp-arena/tools/smoke.py    # 스모크만
```

검증기는 실제 `Config`·`Styles`·`Moves`·`Accessories`·`Rules`·`Poses`·`Commands` 를 luau CLI 로 실행하고, 전 Luau 컴파일·미지 전역·공유 모듈의 Roblox API/벡터 메서드 금지·서버 require 그래프 비순환·Heartbeat 하나·Health 쓰기 단일·validate 배선·줍기 거리 재확인·빌더 결정성과 스크립트 정확 포함·맵 2·템플릿·BlockRig·에셋 출처, 그리고 **네이티브 조건**(기본 카메라 유지 · R6 · Stepped 절차 포즈 · 서버 스폰 소유 · 키 안내 없음 · 터치 버튼 · ProximityPrompt 줍기 · LinearVelocity 하나 · Humanoid.Health · GetServerTimeNow · 착지 Air 선행 · 라운드 4단계 · 상한 · 봇 절벽 탐침 · 조명 프리셋)을 검사한다. 회귀 주입 증명은 `docs/specs/2026-10-29-roblox-amp-arena/verifications/gate-proof.md`.

## 검증하지 않는 것

Studio 실행·물리·포즈 생김새(R6 관절 축 부호)·넉백 체감·두 플레이어 사이 Weld 잡기·터치 배치·8인·R15·소리 ID 는 검증기 출력의 `UNVERIFIED` 줄이다. **치트 방어**: 서버가 명령·상태·판정·점수를 갖지만 위치·정면·착지·`WalkSpeed 0` 준수는 소유 클라이언트를 믿는다 — 스피드·텔레포트·넉백 무시는 막지 않는다(저장·순위가 없어 수용, 공개 전 재검토).
