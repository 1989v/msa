# 실제 자산 출처

이 전면 재개발에는 Creator Store 다운로드, 유료 구매, Mesh/Texture/음악 asset ID, 외부 Script/SDK가 없다. 이전 Infinity Step 소스·맵·추출 좌표도 복사하지 않았다. 아래 표는 실제 포함한 리소스만 설명한다.

| 사용 자산 | 출처·권리/의존성 | 실제 역할과 위치 |
|---|---|---|
| Part / TrussPart / SpawnLocation | Roblox 엔진 내장 primitive. 외부 creator 의존성 없음 | 직접 작성한 geometry, 기본 Climbing용 서비스 사다리, 광장 spawn |
| Concrete / Brick / Metal / Glass / Neon / Wood / Asphalt / Cobblestone / DiamondPlate / SmoothPlastic | Roblox 내장 Material. [공식 재질 문서](https://create.roblox.com/docs/parts/materials) | 건물 외벽·창·탱크·태양전지·비계·도로·안내등. builder 게임 팔레트는 UI Theme와 분리 |
| ArrivalPlaza / CourtyardShop / CityBlock / CityRoof / FacadeTerrace / ResidentialRoof / SkyscraperCrown / ConstructionDeck / OrbitalRelay / EventHorizonLab / BlackHoleObservatory | 이번 작업에서 직접 작성한 모듈형 Model. `tools/build.py`가 원본 | 창과 출입구, 상가 차양, 실제 계단, 배수관, 옥상 환기/물탱크, 난간, 첨탑, 비계, 크레인, 태양전지와 통신 안테나, 관측소/블랙홀 |
| Terrain Rock / Water / Grass | Roblox 내장 Terrain/material, `Environment.server.luau`가 실행 시 FillBlock | 도시 바닥, 운하, 잔디 구역. 편집 중 XML에는 빈 Terrain이며 Play 시 생성 |
| Atmosphere / Sky / BloomEffect / PointLight | Roblox 엔진 내장 instance·기본 Sky. 외부 하늘 이미지 ID를 지정하지 않음 | 편집 화면에 담긴 석양/연무/빛 번짐/도시 가로등. 기본 Sky 실제 표시와 기본 리소스 가용성은 Studio 확인 필요 |
| Clouds | Roblox 엔진 내장, [공식 Clouds 문서](https://create.roblox.com/docs/environment/clouds) | 실행 시 Terrain 자식으로 생성. Lighting 자식이 아님 |
| Roblox 기본 아바타·PlayerModule·카메라·Humanoid 애니메이션 | Roblox 기본 캐릭터 시스템 | 그대로 사용. 커스텀 캐릭터 애셋/애니메이션 ID·입력 대체 모듈 없음 |
| GothamMedium / ScreenGui / native Core UI | Roblox 내장 font/UI | 작은 비클릭 진행 피드백과 명시적 부활 선택. `Theme.luau`는 root DESIGN.md 공통 의미 토큰 참조 |

파트 수는 제작 규모의 측정값일 뿐, 시각적 풍부함이나 플레이 품질의 증거가 아니다. 파일에 실제 건축 실루엣을 작성했으며 실제 Studio 화면·조명·재질 가독성은 미검증이다.

XML의 BasePart 크기 wire 이름 `size`, 모양 `shape`, packed color `Color3uint8`는 [rbx-dom upstream의 실제 직렬화 fixture](https://github.com/rojo-rbx/rbx-dom/blob/master/rbx_xml/src/tests/snapshots/rbx_xml__tests__baseplate-727-with-tags__encoded.snap)를 참고했다. rbx-dom 자체 코드는 프로젝트에 포함하지 않았다. XML CLI 구조 검사는 Studio import를 대신하지 않는다.
