# 실제 자산 출처

Creator Store 다운로드는 **Roblox 공식 소유(creator id 1) 모델만** 썼다. 제3자 무료 모델은 비로그인 다운로드가 401 이고 런타임 로드에도 Studio 설정이 필요해 쓰지 않았다(조사: `docs/research/2026-10-26-roblox-development/reference-analysis.md`). 유료 구매·업로드·외부 스크립트·SDK 없음. 파일별 sha256 과 출처 URL 은 `assets/roblox/provenance.json`, 빌더가 스크립트를 제거한 뒤 내장한다.

| 자산 | 출처 | 역할 |
|---|---|---|
| Zombie 93601062 (R6 리그, CharacterMesh, 신음 소리) | Roblox 공식 모델, 2012, XML. 스크립트 3개 제거 | 좀비·역병(녹색)·거구(ScaleTo 1.45) 템플릿 |
| Bat 167116921 (Motor6D 날개) | Roblox 공식 모델 | 박쥐 템플릿(클라이언트가 날개를 흔든다) |
| Skeleton 63933118 (뼈 더미) | Roblox 공식 모델 | 사냥터·거점 장식 |
| Oak Tree 18717544 · Tree Large/Medium/Small 56449188/56449156/56449132 · Autumn Tree 56449099 | Roblox 공식 모델 | 숲·흩어진 나무 |
| Fence 56449052 · Torch 56447717(Fire 포함) · Well 56447829 · Flowers 56448980 | Roblox 공식 모델 | 본진·길가 |
| Castle Wall 56448754 · Castle Wall Corner 56448738 · Castle Rampart 41324931 · Wood Bridge 56448952 | Roblox 공식 모델 | 전초기지 성벽·다리 |
| Part / WedgePart / SpawnLocation, 내장 재질(Grass·LeafyGrass·Rock·Mud·Cobblestone·Slate·Basalt·CrackedLava·WoodPlanks·Wood·Fabric·Neon…) | Roblox 엔진 내장 | 목책·천막·오두막·치료사 제단·탑·문·동굴·BlockRig·활 |
| Terrain FillBlock/FillBall/FillCylinder · Clouds(Terrain 자식) · Atmosphere · BloomEffect · ColorCorrectionEffect · Future 조명 | Roblox 엔진 내장 | 분지 지형·밤 환경 |
| `rbxasset://textures/particles/{sparkles,smoke}_main.dds` · `rbxasset://sounds/{action_swim,action_jump_land,impact_explosion_03,volume_slider}` | Studio 동봉 리소스 | 화살 섬광·명중·근접·웨이브·금화 효과 |
| 화살 명중 소리 3963012401 | Roblox 제작 Weapons Kit 의 ID(재생 여부 Studio 확인) | 명중 |
| R6 애니메이션 180435571(idle)·180426354(walk) · R15 는 플레이어 Animate 스크립트에서 읽음 | Roblox 기본 애니메이션 | NPC 걷기·대기 |
| `Players:CreateHumanoidModelFromDescriptionAsync` 기본 아바타 | Roblox 아바타 체계 | 아군 리그(네트워크 필요, 실패 시 BlockRig) |
| 서체 GrenzeGotisch · Gotham | Roblox 내장 | 제목·HUD |

Roblox 공식 모델에는 활·치료사·마을·망루가 없어 활·탑·제단·오두막은 파트로 직접 만들었다. 모델 수·파트 수는 제작 규모일 뿐 시각 품질의 증거가 아니다.
