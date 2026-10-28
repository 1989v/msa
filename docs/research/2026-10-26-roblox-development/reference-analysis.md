# 로블록스 에셋 조달 경로와 인기 게임 구현 패턴 (2026-10-28 조사)

「궁수 키우기」 로블록스판 1차(커밋 c3fe0df59)가 웹 원작을 그대로 옮긴 느낌이라는 지적(카메라가 너무 멀다 · 캐릭터 주변 밝힘 없음 · 화살이 안 보임)을 받고, 재개발 전에 **실제 로블록스 에셋 경로**와 **공개된 인기 게임 소스**를 조사한 기록이다. 「확인」은 실제 호출·파일 열람으로 본 것, 「추정」은 그렇지 않은 것이다. 원시 데이터(검색 JSON·다운로드 rbxm·creator-docs 원문)는 세션 스크래치패드에만 있고 레포에 넣지 않았다.

## 1. 에셋 조달 — 무엇을 어디서 가져올 수 있는가

| 경로 | 확인 결과 | 쓸 수 있는 곳 |
|---|---|---|
| Creator Store 검색 API `apis.roblox.com/toolbox-service/v1/marketplace/10?keyword=…` | 비로그인 200. `creatorTargetId=1&creatorType=User` 로 **Roblox 공식 소유 모델만** 필터(총 940건). 상세 API `items/details?assetIds=` 가 `isEndorsed`·`isFree`·`scriptCount`·instanceCounts(meshPart/tool/animation) 를 준다 | 빌더가 다운로드 전에 스크립트 유무를 판정 |
| 모델 다운로드 `assetdelivery.roblox.com/v1/asset/?id=` | **Roblox 소유 모델만 비로그인 200**. 제3자 무료 모델 8건은 전부 `401 Authentication required` | 오프라인 .rbxlx 빌더에 넣을 수 있는 외부 에셋 = Roblox 공식 모델뿐 |
| 받은 파일 포맷 | 2014년 이전 Roblox 모델은 XML(`<roblox version="4">`) 이라 `<Item>` 을 .rbxlx 에 그대로 붙일 수 있다. 2019년 이후(Drooling Zombie·Synty 팩·Forest Pack·Crossbow) 는 바이너리(`<roblox!`) | 바이너리는 변환 도구(rbx-dom `rbx_util`, Lune) 또는 런타임 로드 |
| 런타임 `InsertService:LoadAsset` | 공식 문서: 제작자 소유 / 소유자 공유 / **Roblox 소유** 만. 제3자 무료 모델은 `AssetService:LoadAssetAsync` + Studio 「Allow Loading Third Party Assets」 토글이 필요하고 결과 Model 은 Sandboxed | Roblox 소유 팩은 서버 시작 시 설정 없이 로드 가능 |
| 적·아군 캐릭터 | `Players:CreateHumanoidModelFromDescriptionAsync(desc, rigType, Enum.AssetTypeVerification.Always)` 가 현행(비Async 는 Deprecated). 무료 Roblox 번들: Squad Ghouls Drop Dead Tedd(341, 좀비 얼굴·Rthro 애니 포함), Knights of Redcliff Paladin(338, 기사 갑옷), Rthro Animation Package(356), Medieval Hood of Mystery(617605556) | 좀비·기사·후드 궁수를 아바타 체계로 생성 |
| 애니메이션 | Zombie 팩은 500 Robux 지만 공식 문서(animation/using)가 ID 를 공개: Run 616163682 · Walk 616168032 · Idle 616158929 · Fall 616157476. Knight: Run 657564596 · Walk 657552124 · Idle 657595757. 전부 Roblox 소유 | Roblox 소유 규칙으로 로드 가능(추정 — Studio 재생 확인 필요) |
| 내장 리소스(Studio 동봉, `rbxasset://`) | 사운드 11종(`sounds/impact_explosion_03.mp3` 등), 파티클 텍스처(`textures/particles/fire_main.dds`·`smoke_main.dds`·`sparkles_main.dds`), 판타지 서체(GrenzeGotisch·Creepster·Fondamento), 기본 Sky `textures/sky/sky512_*` | ID 없이 바로 사용 |
| Terrain | `Terrain:FillBlock/FillBall/FillCylinder/FillWedge/FillRegion` + 재질 Grass·LeafyGrass·Rock·Basalt·Mud·Ground·Cobblestone·WoodPlanks·Water | 분지·절벽·개울·길 |

### Roblox 공식 소유 모델 중 이 게임에 맞는 후보
| id | 이름 | 스크립트 | 포맷 | 용도 |
|---|---|---|---|---|
| 187789986 · 3924238625 | Drooling Zombie (R15 · Rthro, NPC Kit) | 2 · 4 | 바이너리 | 좀비 외형(스크립트 제거 후) |
| 6432306802 | Forest Pack (Endorsed, MeshPart 83) | 13 | 바이너리 | 숲·바위 |
| 6933438443 | Synty Nature Pack (MeshPart 200) | 0 | 바이너리 | 나무·바위·풀 |
| 6933790012 | Synty Dungeon Pack: Weapons & Props (MeshPart 234) | 0 | 바이너리 | 활·화살·상자·횃불(내용은 변환 뒤 확인) |
| 6934081776 | Synty Dungeon Pack: Skeletons & Bones | 0 | 바이너리 | 해골 적 |
| 18717544 · 56449188/156/132 | Oak Tree · Tree Large/Medium/Small | 0 | XML | 숲 |
| 56449052 · 56447717 · 56447829 | Fence · Torch · Well | 0 | XML | 본진 |
| 56448754 · 56448738 · 41324931 · 56448952 | Castle Wall · Corner · Rampart · Wood Bridge | 0 | XML(추정) | 거점·다리 |
| 167116921 | Bat | 0 | 미확인 | 박쥐 적 |
| 4842204072 | Crossbow (Weapons Kit) | 6 + WeaponsSystem 의존 | 바이너리 | 참고만. 화살 메시 MeshId 2493118549 / Texture 2493025364 는 Roblox 소유라 직접 사용 가능 |

Roblox 공식 모델에 archer·bow·healer·village·watchtower·tent 는 0건이다. 스크립트 0개인 무료 활 모델은 검색 60건 중 없었다. 활·화살·탑·천막은 Part/MeshPart 로 직접 만든다.

## 2. 인기 게임 구현 패턴 — 세 결함의 처방 근거

### 카메라 (너무 멀다)
| 출처 | 값 |
|---|---|
| Roblox 기본 3인칭(PlayerModule BaseCamera `DEFAULT_DISTANCE`, ZoomController `ZOOM_DEFAULT`) | 거리 12.5 스터드, 피치 ±80°, FOV 70 |
| Zombie Strike(오픈소스 협동 좀비 슈터) GameCameraScript | Scriptable, 뒤 10 / 옆 3 / 위 1, 중심 루트+2, FOV 70, `Camera.Focus` 매 프레임 갱신 |
| 공식 Weapons Kit ShoulderCamera | 오프셋 (2.25, 2.25, 10.5), 피치 ±75° |
| 공식 아이소메트릭 튜토리얼(control-the-users-camera) | 루트 + (24,24,24) → 거리 ≈41.6, 피치 ≈35°. 더 납작하게 보려면 FOV 20 + 거리 ≈111 |
| 1차 구현 | 피치 62°, 거리 96~150 → 공식 아이소메트릭 예제의 2.3~3.6배 |

Scriptable 카메라는 `Camera.Focus` 를 매 프레임 갱신해야 한다(공식: 디테일·조명이 focus 거리에 따라 달라진다). 1차 구현은 갱신했지만 거리 자체가 멀어 캐릭터 주변 광원이 화면에서 작게 보였다. 기본 카메라를 쓸 때는 `CameraMinZoomDistance/CameraMaxZoomDistance` 로 범위만 제한한다.

### 캐릭터 주변 밝힘
- 로컬 광원 Range 상한은 2025-09-23 부터 120 스터드(그 전 60). Brightness 를 올려도 Range 밖은 안 밝는다.
- 실게임 패턴: 캐릭터 몸통 파트에 PointLight(Range 10, Brightness 1.4, Shadows 끔). 공식 모닥불 튜토리얼: Range 48, Brightness 2, Color (255,179,73).
- 밤 환경: `Lighting.Ambient` 기본 (0,0,0), `OutdoorAmbient` 기본 (127,127,127), `ExposureCompensation` −5~5(1 = 노출 2배). Atmosphere Density 0.272 권장, 0.39 면 원경이 가려진다. `Lighting.Technology` 는 스크립트로 못 바꾸고 `LightingStyle`(Soft/Realistic) + `PrioritizeLightingQuality` 로 대체됐다.
- Zombie Strike 는 캠페인별 Lighting 프리셋(속성 + Atmosphere/Sky)을 ServerStorage 에 두고 시작 시 복사한다. 좀비는 전 파트 `CastShadow=false`.

### 투사체 (안 보인다)
- 공식 Weapons Kit(Battle Royale 과 같은 시스템): 투사체 Part 는 0.05³ 투명이고 보이는 것은 ① 뒤따르는 Beam 두 장(Width 0.25, LightEmission 1, LightInfluence 0, FaceCamera, Segments 50) ② SpecialMesh 화살(`ShouldMovePart=true`) ③ 명중 시 연기 파티클 + HitSound. 머즐 플래시는 Beam 을 0.03초 켠다. BulletSpeed 1000, 석궁 GravityFactor 1.
- Zombie Strike: 히트스캔이지만 시각은 머즐→명중점 Beam 을 0.2초에 걸쳐 지우고, 머즐 `FlashEmitter:Emit(1)`, 피격 대상에 피·스파크 이미터.
- 분담(둘 다 공통): **쏜 클라이언트가 즉시 로컬 연출 + FireServer**, 서버는 검증 후 다른 클라이언트에 전파, 각 클라이언트가 자기 화면에서 연출을 다시 돌린다. FastCast 도 코스메틱 탄환을 `LengthChanged` 마다 이동시키고 `CastTerminating` 에서 지운다.
- Trail: Lifetime 기본 2초, LightInfluence 0 이면 밤에도 보인다.
- 1차 구현: 0.12×0.12 Neon 막대 하나, Trail·섬광·명중 파티클 없음, 서버 패킷이 온 뒤에만 그림.

### 적 NPC
- Zombie Strike: ServerStorage 모델 Clone, Humanoid 기반, 스폰 시 전 파트 `SetNetworkOwner(nil)`, 불필요 HumanoidState 10개 비활성. 추적은 패스파인딩 없이 `Humanoid:MoveTo(target.Position, targetPart)` 를 MoveToFinished 마다 재발행. 공격은 애니메이션 KeyframeReached → 시선 검사 → TakeDamage. 체력바는 Head 의 BillboardGui. 애니메이션은 클라이언트가 CollectionService 태그로 훅해 속도별 idle/walk/run. 사망은 클라이언트 0.5초 페이드.
- 다수 NPC(DevForum): 서버는 테이블만, 10 Heartbeat 마다 위치 묶음, 클라이언트 보간. "Humanoid 는 500마리에 비효율", 타워 디펜스류는 AlignPosition/AlignOrientation.
- Highlight 는 클라이언트당 255개, `Enabled=false` 도 슬롯을 먹으니 삭제한다.
- 피해 숫자(Weapons Kit DamageBillboardHandler): BillboardGui AlwaysOnTop, ExtentsOffsetWorldSpace (0,18,0), x 지터.

### HUD (모바일)
- 공식 Thumb zones: 두 엄지 기준, 하단 모서리에서 먼 버튼 금지, 「기본 점프 버튼에 상대 배치」. 기본 점프 버튼은 짧은 축 ≤500px 이면 72px·우하단 인셋 64/64, 그 외 120px·인셋 100/112. 동적 조이스틱은 화면 왼쪽 40% 폭 × 아래 2/3.
- Weapons Kit GUI: 소형 Fire 72px @ (1,−95,1,−90), Aim 44px @ (1,−25,1,−148). Zombie Strike: 모바일 버튼은 TouchEnabled 일 때만, 체력 비네트로 피격 피드백.

### 소리
- Weapons Kit(Roblox 제작): 발사 3821792787, 화살 명중 3963012401, 총알 명중 1489924400. 공식 튜토리얼: Equip 282906960, Activate 130113322. 2022 오디오 비공개화 이후 재생 가능 여부는 Studio 에서 확인(미확인).
- 패턴: 폴더에서 무작위 1개 Clone → Play → TimeLength 후 Debris.

## 3. 근거
- Zombie Strike: `github.com/Kampfkarren/zombie-strike` — `src/mission/StarterPlayer/StarterPlayerScripts/GameCameraScript/init.client.lua`, `src/mission/ServerScriptService/Lighting.server.lua`, `src/shared/ReplicatedStorage/RuddevModules/Effects/Shoot.lua`, `src/mission/ServerScriptService/Zombies/Zombie.lua`, `ZombieAnimate.client.lua`, `KillEnemyEffect.client.lua`, `Nametag.lua`, `MobileButtons.client.lua`
- Weapons Kit: https://create.roblox.com/docs/resources/weapons-kit (미러 `github.com/Aerodymier/roblox-endorsed-weapons-fork` — `Libraries/ShoulderCamera.lua`, `WeaponTypes/BulletWeapon.lua`, `Assets/Effects/Shots/Arrow.rbxmx`)
- PlayerModule 원본: `github.com/MaximumADHD/Roblox-Client-Tracker` (roblox 브랜치) `CameraModule/BaseCamera.lua`, `ZoomController.lua`, `ControlModule/TouchJump.lua`, `DynamicThumbstick.lua`
- 공식 문서: Camera.FieldOfView · CameraMax/MinZoomDistance · workspace/camera(Focus) · control-the-users-camera · Light.Brightness · Lighting · Atmosphere · Trail · Beam · Highlight · effects/light-sources · ui/position-and-size(Thumb zones) · InsertService · AssetService · Players.CreateHumanoidModelFromDescriptionAsync · HumanoidDescription · animation/using
- Light Range 120: https://devforum.roblox.com/t/extended-light-ranges-doubling-the-limit-to-120/3954367
- 클라이언트 렌더링: https://devforum.roblox.com/t/tower-defense-smooth-enemy-movement/2571665
- FastCast: https://etithespir.it/FastCastAPIDocs/ · SimplePath: `github.com/00xima/SimplePath`

## 4. 확인 못 한 것
- 바이너리 rbxm → XML 변환 실측(rbx_util 빌드·Lune 실행)은 이 세션의 권한 분류기가 막아 하지 못했다. 다운로드한 rbxm 은 스크래치패드에만 있다.
- Zombie Strike 좀비 리그 종류·사운드 ID 는 rbxm 바이너리 안이라 못 봤다.
- 「탑다운 인기 게임」의 실제 카메라 수치는 공개 소스가 없어 공식 아이소메트릭 예제와 3인칭 두 사례로 범위를 잡았다.
- Weapons Kit 사운드 ID 와 Zombie 애니메이션 ID 가 지금도 재생되는지는 Studio 에서 봐야 한다.
