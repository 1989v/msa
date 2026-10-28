<!-- source: roblox/amp-arena/src/shared/Config.luau, roblox/amp-arena/tools/verify.py -->

# 요구사항 — 겟앰프드식 액세서리 난투를 로블록스 네이티브로

## 0. 리서치 결과 (2026-10-29)
| 조사 | 방법 | 결과 |
|---|---|---|
| 로블록스에 겟앰프드가 있는가 | `apis.roblox.com/search-api/omni-search` 로 `getamped` · `get amped` · `겟앰프드` · `rumble fighter` · `splash fighters` 5회 | 관련 체험 0건(전부 무관한 FPS·브롤러). 공식·팬 리메이크 없음 |
| DevForum 언급 | `devforum.roblox.com/search.json` 3회 | `getamped` 0건, `rumble fighter` 는 「Smash Bros + Rumble Fighter 에서 영감」을 적은 구인 글 1건뿐 |
| 웹 검색 | WebSearch 6회 | 겟앰프드 로블록스판 없음. VCGamers 가 **Baddies**(펀치 PvP 브롤러, 아이템 줍기)를 「겟앰프드가 영감일 것」이라 추정한 의견 기사 1건(개발자 발언 아님) |
| 장르 유사작(참고 대상) | 검색 결과 | **Item Asylum**(리스폰마다 근접·원거리·기타 3슬롯 무작위 무기, R6 브롤러), **The Strongest Battlegrounds**(R6, M1 콤보·1~4 기술·F 가드·Q 대시, 동접 5만), Baddies(아이템 줍기·스톰프) |

결론: 겟앰프드(액세서리 하나로 기술이 통째로 바뀌는 8인 아레나 난투)를 로블록스로 만든 것은 없다. 로블록스 브롤러 관용구(R6 리그 · M1 콤보 · 숫자 키 기술 · F 가드 · Q 대시 · 라운드 루프 · ProximityPrompt 줍기)는 확립돼 있으므로 그 위에 겟앰프드의 구성을 얹는다.

## 1. 보존하는 핵심 재미와 구성 (겟앰프드 원작 분석)
- **액세서리 하나**가 기본 공격·기술을 통째로 바꾼다. 맨손 스타일별 기본기 + 액세서리 전용 기술.
- 3단 약공 · 강공(띄움) · 대시 공격 · 공중 공격 · 가드(게이지·크러시) · 잡기/던지기/탈출 · 경직·다운·기상 · **링아웃**(발판 맵) · 상자/하트/폭탄.
- 8인 방, 개인/팀 데스매치·서바이벌, 2~3분 매치, 결과 → 다시.
- 첫 판부터 어렵다: 맞는 쪽이 대응할 창은 있지만 쉬지 않는다.

## 2. 로블록스식으로 새로 설계하는 것
| 영역 | 결정 |
|---|---|
| 리그·아바타 | **R6**(Game Settings `GameSettingsAvatar` R6). 플레이어는 자기 아바타(옷·얼굴·모자 유지). 공격·피격·다운 포즈는 `Motor6D.Transform` 을 `RunService.Stepped` 에서 쓰는 **절차 포즈**(업로드 애니메이션 없음, Roblox 소유 애니메이션에 격투 동작이 없다). R15 는 같은 6관절 매핑으로 대비 |
| 조작 | M1 약공 · M2 강공 · F 가드(홀드) · Q 대시 · 1 액세서리 기술 · E 줍기(ProximityPrompt)/던지기. 터치는 ContextActionService 버튼(제목은 「약공·강공·가드·기술·대시」 — 키 이름 없음), 게임패드 매핑. 이동·점프·카메라는 Roblox 기본 |
| 카메라 | Roblox 기본 3인칭(줌 8~20), Scriptable 없음. KO 시 흔들림은 `Humanoid.CameraOffset` |
| 방·매치 | 서버 = 방. 로비(대기 발판) → 준비 20초(스타일·액세서리 선택) → 카운트다운 3초 → 매치(개인 DM 3분 / 팀 DM 3분 / 서바이벌 2분) → 결과 10초 → 로비. 맵·모드 순환 |
| 판정 | 서버 권위(Heartbeat 상태 머신). 클라이언트는 입력 의도·조준 보조(정면 ±35° 가장 가까운 적을 향해 돈다)·연출. 넉백은 서버가 넣는 `LinearVelocity`(소유 클라이언트가 시뮬). 잡기는 Weld, 띄움은 LinearVelocity + 착지(`FloorMaterial`) 로 DOWN |
| 체력 | `Humanoid.Health`. KO → `Humanoid.Died`. 데스매치 3초 리스폰(`LoadCharacter`), 서바이벌 1목숨. 링아웃: 루트 Y < 맵 `fallY` |
| 스타일 5 | 파이터·그래플러·스피드스타·헤비·마셜 — 맨손 사슬·강공·기술·스탯·몸집(`Model:ScaleTo`)이 다르다 |
| 액세서리 5(스타일당 1) | 대검(헤비)·장창(마셜)·쌍권총(스피드스타)·방패(그래플러)·로켓 글러브(파이터). 전부 Part 로 만든 모델, 손에 Weld. 기술 1종씩. 쌍권총·로켓 글러브는 서버 투사체 |
| 아이템 | 상자(2타 파괴 → 하트 30% / 폭탄 20%) · 하트(+30) · 폭탄(ProximityPrompt 줍기, 3초 뒤 폭발, 들고 공격 키로 던짐). 30초 재생성 |
| 맵 2 | 콜로세움(지름 120 스터드 원형, 벽, 기둥 4, 단상 2, 낙사 없음 — 입문) · 스카이독(발판 5, 간격, 낙사 — 던지기·태클로 링아웃). Terrain·재질·Lighting·Atmosphere 로 공간 구성, Roblox 소유 XML 모델(기둥·횃불 등)은 있으면 사용 |
| 봇 | 플레이어가 4명 미만이면 연습 봇이 채운다(R6 BlockRig, 같은 Combat 상태 머신, 접근·사슬·가끔 가드·줍기). Studio 혼자서도 전투를 본다 |
| 수치 | 스터드·초. 원작 웹(미터·60틱)은 의도 파악용. 걷기 14 · 대시 버스트 · 리치 4~6.5 · 반지름 1.6~2.4 · 체력 100 기준 |
| 저장·진행 | 없음(이번 범위 밖). 순위·경험치·상점은 후속 |

## 3. 범위 밖 (이번에 안 한다)
액세서리 16종 전체 · 드럼통 · KO 액세서리 드랍 · 옥상/얼음 호수 · 관전 · 채팅(Roblox 기본 채팅이 있다) · 경험치/레벨/상점/엠블럼 · DataStore · 공개/업로드 · Developer Product.

## 4. 재사용 · 참고
- 빌더·검증기·게이트 증명 방식은 `roblox/archer-command/tools/{build,verify}.py` 의 구조를 따른다(복사 아님 — 이 게임의 네이티브 조건을 잰다). 그 폴더는 다른 세션이 작업 중이라 손대지 않는다.
- 웹 `amp-arena/docs/GDD.md` 는 **의도**(사슬 압박·경직 < 후딜+발동·호/반지름이 KO 비를 움직인다·봇 자멸 함정)만 가져온다. 코드·수치·UI 는 옮기지 않는다.
- 겟앰프드·럼블 파이터·스플래시 파이터즈 이름은 게임 안팎에 쓰지 않는다(amp-arena 때 사용자 지시).

## 5. 실패 의미 · 관측
- 명령은 타입·유한수·빈도를 검사하고 거부는 조용히 버린다(토스트 없음 — 입력 스팸이 UI 를 채우지 않게).
- 서버 Fx 이벤트(hit·ko·guard·pickup·explode·ringout)가 연출의 단일 원천. 디버깅은 캐릭터 Attribute(`Fight`·`Move`·`MoveAt`) 를 Studio 속성창에서 본다.
- 아바타 생성·애니메이션 ID·소리 ID 는 네트워크·Studio 의존 — 실패해도 게임이 돈다(BlockRig·무음).

## 6. 검증 (hns 규칙: 검사는 대상 산출물을 본다)
- `tests/rules.spec.luau` 가 실제 `Config`·`Styles`·`Moves`·`Accessories`·`Rules`·`Poses` 를 luau CLI 로 실행.
- `tools/verify.py` 네이티브 게이트: 기본 카메라(Scriptable 0) · R6 설정 · 절차 포즈가 Stepped 에서 Transform 을 쓴다 · 키 이름 안내 없음 · 줍기는 ProximityPrompt · 넉백은 LinearVelocity · 체력은 Humanoid.Health · 라운드 루프 상태 · 맵 2 · 액세서리 템플릿 5 · 봇 상한 · 조명 프리셋 · 에셋 provenance.
- 회귀 주입으로 빨간불을 본 뒤에만 게이트를 「켰다」고 한다.
- Studio 실행·물리·포즈 생김새·터치·8인은 UNVERIFIED 로 남긴다.
