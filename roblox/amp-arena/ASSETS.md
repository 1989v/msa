# 실제 자산 출처

Creator Store 다운로드는 **Roblox 공식 소유(creator id 1) 모델만** 썼다(제3자 무료 모델은 비로그인 401 — `docs/research/2026-10-26-roblox-development/reference-analysis.md`). 유료 구매·업로드·외부 스크립트·SDK·업로드 애니메이션 없음. 파일별 sha256 과 출처 URL 은 `assets/roblox/provenance.json`, 빌더가 스크립트를 제거한 뒤 내장한다. 파일 9종은 `roblox/archer-command/assets/roblox/` 의 같은 다운로드본을 복사했다.

| 자산 | 출처 | 역할 |
|---|---|---|
| Torch 56447717(Fire 포함) | Roblox 공식 모델 | 로비·콜로세움 횃불 |
| Castle Rampart 41324931 · Castle Wall 56448754 · Castle Wall Corner 56448738 | Roblox 공식 모델 | 콜로세움 관중석 위 성곽(현재 Rampart 12) |
| Fence 56449052 · Flowers 56448980 · Tree Large/Medium/Small 56449188/56449156/56449132 | Roblox 공식 모델 | 콜로세움 바깥 울타리·나무 |
| Part / WedgePart, 내장 재질(Sand·Cobblestone·Concrete·Marble·Slate·DiamondPlate·Metal·Wood·WoodPlanks·Neon·Glass·Grass) | Roblox 엔진 내장 | 바닥·벽·기둥·단상·발판·컨테이너·크레인·액세서리 5·상자·하트·폭탄·BlockRig |
| Atmosphere · BloomEffect · SunRaysEffect · ColorCorrectionEffect · Future 조명 · ForceField · Highlight · ProximityPrompt · LinearVelocity | Roblox 엔진 내장 | 환경·스폰 무적 표시·팀 외곽선·줍기·넉백 |
| `rbxasset://textures/particles/{sparkles,smoke}_main.dds` · `rbxasset://sounds/{action_jump_land,impact_explosion_03,volume_slider,action_swim}` · `rbxasset://textures/face.png` | Studio 동봉 리소스 | 타격·폭발·소리·봇 얼굴 |
| R6 애니메이션 180435571(idle)·180426354(walk) | Roblox 기본 애니메이션 | 봇 걷기·대기(플레이어는 자기 Animate) |
| 서체 Bangers · GothamBold · Gotham | Roblox 내장 | 제목·HUD |
| 플레이어 아바타(R6) | Roblox 아바타 체계 | 자기 옷·얼굴·모자 그대로, 스타일 몸집(`Model:ScaleTo`)과 액세서리 Weld 만 덧붙인다 |

공격·피격·다운 동작은 애니메이션 에셋이 아니라 `src/shared/Poses.luau` 의 절차 포즈(`Motor6D.Transform`)다. 모델 수·파트 수는 제작 규모일 뿐 시각 품질의 증거가 아니다.
