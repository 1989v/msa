# T02B-4b-2 · 이동 / 캐릭터 연결 진단

기존 Skybound 월드·이동 코어·저장 GLB를 연결한 PC·터치 입력 진단 fixture다.
다른 게임·외부 에셋을 사용하지 않으며 기존 원본 소스는 수정하지 않는다.

```sh
# 저장소 루트에서 실행. 기존 portal-fe/node_modules만 사용한다.
node docs/specs/2026-09-10-skybound/implementation/t02b/traversal/build.mjs
node --test docs/specs/2026-09-10-skybound/implementation/t02b/traversal/tests/animation.test.mjs
python3 -m http.server 8768 --directory docs/specs/2026-09-10-skybound
```

`http://127.0.0.1:8768/implementation/t02b/traversal/index.html`에서 시작한다.
빌드는 파일 위치 기준이므로 다른 cwd에서도 동작한다. Three.js 0.183.2,
esbuild 0.27.7을 재사용한다. 설치나 CDN 요청은 없다. 공유 UI 토큰은 CSS 번들에
포함하며 번들 JS/CSS는 gitignore 처리한다.

## 연결 계약

- `t01b/src/world.mjs`의 `createWorld(THREE)`를 렌더링한다.
- 첫 `continuous meadow`와 `walkable-looking…` mesh의 정점을 matrixWorld로
  변환하여 `t02a/src/terrain.mjs`에 전달한다. 분석식으로 지형을 재생성하지 않는다.
- `t02a/src/simulation.mjs`는 120Hz fixed step, 체크포인트 (0,35), 수면 Y=−18이다.
- T03A-3부터 이 fixture는 `flight:{enabled:true,volumes:[]}`를 선택한다. 새 기류는 배치하지 않는다.
- `character/assets/naru-lod0.glb`를 GLTFLoader로 읽는다. 기존 7개 클립 중
  idle/walk/run/jump/fall/land를 사용하고 검사 포즈는 이동에 사용하지 않는다.
- 캐릭터 root 위치는 snapshot의 feet 위치와 같다. +Z 정면을
  `atan2(velocity.x, velocity.z)`로 돌린다. respawn 시 초기 방향과 클립을 복구한다.
- idle/walking/running/rising/falling은 idle/walk/run/jump/fall로 대응한다.
  공중→접지 후 정지 상태는 land를 한 번 재생하고 idle로 돌아간다.
  착지와 동시에 움직이거나 착지 중 입력이 재개되면 보행이 우선한다.
- 클립 시간은 실제 처리한 physics tick 시간만큼 진행한다. root 궤적은
  시뮬레이션, 골반/팔다리 자세는 GLB 클립이 담당한다. 고급 전환 블렌딩은 없다.

## 조작 / 검증 API

처음에는 **일시정지**다. 시작 버튼을 누르면 canvas에 초점이 이동한다.
WASD 이동, Shift 달리기, Space 한 번 누르기 점프. 우클릭 드래그로 시야를
회전하고 휠로 3–8m 범위에서 거리를 조절한다. 초기 거리는 5.2m이며 기본 yaw=0에서
W는 −Z다. 회전 후 WASD는 현재 카메라 yaw를 따른다. 키 반복은 추가 점프를 생성하지 않는다.
blur/탭 숨김은 입력과 누적 시간을 비우고 정지하며 명시적으로 다시 시작한다.

`window.__SKYBOUND_TRAVERSAL__`:

- `ready`, `error`, `paused`, `loadedFromGLB`, `snapshot`, `animation`, `animationTime`
- `characterPosition: {x,y,z}`, `characterYaw`, `terrainHeight`, `frames`
- `camera: {yaw,pitch,distance,dragging}`, `setCameraForTest({yaw?,pitch?,distance?})`
- `touch: {x,z,sprint,moveId,lookId,sprintId,jumpId,jumpPending}`: 각 입력 소유 ID는 미사용 시 null
- `gliding`, `sailVisible`, `gliderStats`, `flightEnabled`: 활공 규칙과 진단 돛 표시 상태
- `advanceForTest(dt, input={})`: 일시정지 상태에서만 같은 simulation→animation→render
  경로를 수동 실행한다. 자동 RAF와 섞으면 오류다. 최신 상태 요약을 반환한다.
  입력 `yaw`를 생략하면 현재 카메라 yaw를 쓰고, 명시하면 해당 값을 우선한다.
- `resetForTest()`: 일시정지, 새 simulation/animation 상태로 출발점 복구
- `pause()` / `resume()`: 자동 조작 실행 제어

카메라 pitch는 0.08–1.15rad로 제한한다. PC 드래그는 mouse 우클릭과 pointer capture만
사용하며 pointer lock은 사용하지 않는다. pointerup/cancel/lostcapture와 pause/blur에서
드래그를 해제한다. 우클릭 메뉴는 canvas에서만 막는다. 출발점 복귀는 카메라 기본값도
복구하고 화면 크기 변경은 현재 yaw/pitch/거리를 보존한다.

`ready=true`라도 `error`가 있으면 초기화 실패다. 수동 step도 코어의 dt 상한
0.25초를 따른다. 긴 진행은 작은 dt를 여러 번 전달해야 한다.

## 검사와 한계

순수 애니메이션 adapter 검사 **3/3 통과**: 상태 대응/점프 끝 유지,
착지 1회·이동 우선, respawn 초기화·입력 snapshot 불변. 빌드 성공을 확인했다.
실제 브라우저·이동·GLB 배치 검증 증거는 별도 traversal 보고서로 기록한다.

이 화면은 풀밭·길 높이와 물 아래 리스폰만 반영한다. 나무·바위·계단·유적·벽의
캡슐 충돌, 카메라 충돌, 경사면 발 IK, 발 미끄럼 보정은 없다. root가 지형 높이에
맞는다는 검사는 양발이 경사면에 완전히 붙는다는 의미가 아니다. PC 시야와 기본 터치
이동만 추가했으며 정식 키 설정, 게임 상태 머신은 후속 범위다. 모바일 성능과
아트 품질 PASS를 주장하지 않으며 이 fixture를 완성된 섬 탐험으로 취급하지 않는다.

T02C-1 순수 카메라 검사 3개는 회전/줌 범위, yaw와 이동 전방의 일치,
비정상 입력 거부·불변성을 확인한다. `node --test .../tests/camera.test.mjs`로 실행한다.
브라우저 우클릭·휠·방향 상대 이동과 취소 동작은 별도 PC 시야 검증 보고서에 기록한다.

## T02C-2 · 기본 터치 조작

왼쪽 `#touch-move` 스틱은 중심에서의 거리로 이동 강도를 정하고 대각선 크기를
1로 제한한다. canvas 오른쪽에서 시작한 별도 손가락은 시야를 회전한다.
`#touch-sprint`는 누른 동안 달리기, `#touch-jump`는 누르는 순간 한 번만 점프한다.
한 역할에 두 번째 손가락이 들어오거나 이미 소유된 ID를 다른 역할에 쓰면 무시한다.
좌우 입력은 동시에 유지할 수 있다. 멀티터치 확대와 활공은 포함하지 않는다.

pointerup/cancel/lostcapture는 해당 손가락만 해제하고, pause/blur/hidden/reset은
모든 소유권·누른 버튼·점프 대기와 capture를 비운다. 일시정지 중 게임 터치는 무시한다.
취소된 점프의 대기 pulse는 버리고, 정상적으로 빠르게 눌렀다 뗀 pulse는 다음 frame에 전달한다.
브라우저 스크롤 방지는 canvas와 터치 조작부의 `touch-action:none`으로 한정한다.
공유 토큰 색상을 쓰고 스틱은 112px, 버튼은 최소 44px이다. 가로·세로 화면에 배치한다.

`node --test .../tests/touch.test.mjs`: 순수 소유권 검사 **4/4 통과**.
중복/추가 포인터 격리, 대각선/아날로그 강도, 개별 취소, 점프 pulse, 전체 초기화를
검증한다. 실제 멀티터치·취소·반응형 검수는 root의 별도 touch 보고서에 기록한다.

## T03A-3 · 작은 활공 데모 연결

Space 또는 같은 터치 액션으로 점프 후 공중에서 다시 눌러 돛을 펼치고 다시 눌러
접는다. Ground/coyote 점프와 접힌 상태의 임박한 착지 점프 버퍼가 우선한다.
기력은 이동 코어의 공유 값이며 활공 시 소비한다. T03B-1에서 출발점 앞 상승기류 하나를 연결했다.

`src/glider.mjs`는 Skybound 원화 보드와 돛 표식만 참고한 146 triangles / 7 meshes의
새 절차형 진단 모델이다. 기존 world palette의 ochre/slate/brass를 사용하며,
삼각 천·지지대·횡봉을 머리 위에 표시한다. snapshot.gliding일 때만 보이고 접기·착지·
리스폰·초기화에서 사라진다. 일시정지는 열려 있는 돛을 접지 않고 시간과 입력만 멈춘다.

캐릭터 GLB는 재생성하지 않았다. 애니메이션 bridge는 gliding 상태를 기존 `fall`
클립으로 임시 대응한다. T03A-4에서 양팔 접점은 아래 절차형 포즈로 보완했다.
**하체의 전용 활공 자세, 손가락 감싸기, 천의 접힘·물리와 전용 활공 아트는 아직
구현하지 않았다.** 이 돛은 최종 아트 PASS 결과가 아니다.

관련 단위 검사 5/5 통과: 기존 bridge 3개 + gliding 전환 1개 + 돛 예산/유한 정점/
인덱스/머리 위 경계 1개. 실제 입력·활공·접기·착지·일시정지·리스폰 표시는
root의 별도 glider 브라우저 보고서로 검증한다.

## T03A-4 · 손바닥 / 횡봉 접점

`src/flight-pose.mjs`가 GLB mixer 평가 뒤 양팔만 절차형으로 배치한다.
현재 본의 월드 위치에서 팔 길이를 읽고, 어깨→팔꿈치→손목 두 관절을 공유된
횡봉 목표점으로 푼다. 고정된 팔 회전각을 덮어쓰지 않는다. 횡봉은 도달 가능한
Y=1.72m로 낮췄으며 실제 횡봉 중심선의 X=±0.32m를 양손 목표로 사용한다.

손목을 목표에 맞춘 뒤 손바닥이 빗나가지 않도록 원본 모델의 palm/hand 좌표 차이
(손 본 기준 ±0.012, −0.033, 0.004m)를 사용한다. `gripErrors:{left,right}`는 이 실제
저작 손바닥 중심 앵커와 횡봉 목표의 월드 거리이며 손목 본 중심 오차가 아니다.
`flightPoseActive`는 활공 때만 true, `gripErrors`는 해제 상태에서 null이다.
다음 mixer 평가 전에 팔·손의 기존 회전값을 복구하여 접기/낙하/착지/초기화에서
자세가 남지 않는다. 일시정지에서는 현재 접점을 유지한다.

`tests/flight-pose.test.mjs`는 두 LOD × 세 yaw × 다섯 fall 시점에서 실제 변형된
palm mesh 정점 평균과 목표 간 거리가 5mm 미만인지 검증한다. 계산 앵커는 1µm 미만,
복구 후 quaternion은 적용 전 값과 완전히 일치한다. glider 경계/예산 검사와 함께
**2/2 통과**. 브라우저의 실제 로딩 GLB 접점과 터치 활공 검증은 별도 root 보고서에
기록한다. 이 결과는 손가락 그립·팔 주변 의상 관통·전체 매달림 아트의 승인과 다르다.


## T03B-1 · 초원 상승기류 하나

출발점 `(0,35)`에서 전방으로 약 5m 이동하면 `(0,30)`의 반경 3m 기류에
들어간다. 금빛 지면 원과 흰색 상승 화살표로 위치·방향을 표시한다. 지상 또는
접힌 돛에는 상승력이 없으며, 점프 후 공중에서 같은 액션을 다시 눌러 펼친다.
활공 중 내부에서는 기존 SR-2 규칙의 상승 목표 4m/s와 공유 기력 회복을 사용한다.
기류 밖에서는 다시 활공 하강·소비로 전환한다.

`src/updraft.mjs`가 불변 `volume`을 만들고 viewer가 그 값을 그대로
`createSimulation({flight:{enabled:true,volumes:[updraft.volume]}})`에 전달한다.
시뮬레이션은 기존 계약대로 이 정의를 복제하여 보관한다. 바닥은 실제 초원 삼각형
adapter의 반경 내 0.5m 격자 표본 최저 높이보다 0.2m 아래, 천장은 중심 지면 +12m다.
이는 완벽한 지형 최소값 계산이 아닌 이 작은 초원 fixture의 경사 여유다.
바닥·천장 원은 정확한 물리 반경/높이를 표시하고 금빛 원은 별도로 실제 지면 +0.035m를 따른다.
반경과 minY는 포함, maxY는 제외한다. 새로운 섬·경로·물리 규칙을 추가하지 않았다.

world palette `cloud`/`brass`만 사용한 진단 표시다. 화살표 48개를 하나의
InstancedMesh(384 triangles)로 그리고 경계/지면에 LineSegments 2개를 쓴다.
프레임 갱신에는 기존 행렬과 인스턴스 버퍼를 재사용한다. 절대 시간
`snapshot.tick * MOVEMENT.step`만으로 위치를 계산하므로 pause/카메라 조작은
기류를 진행시키지 않고 reset은 초기 입자 배치로 돌아간다. 리스폰은 기존 전역
시뮬레이션 tick을 유지하므로 환경 입자 위상도 이어진다.

`window.__SKYBOUND_TRAVERSAL__.updraft`와 수동 advance 반환값에
`{volume,inside,active,time,stats}`를 제공한다. inside는 현재 발 위치의 기하 포함,
active는 inside + 펼친 돛 + 실제 snapshot.windSpeed > 0이다.
경계 통과 한 tick에는 이전 위치에서 샘플한 windSpeed와 현재 inside가 다를 수 있다.

검증 명령(저장된 의존성 사용, 설치 없음):

```sh
node --test docs/specs/2026-09-10-skybound/implementation/t02b/traversal/tests/*.test.mjs
node docs/specs/2026-09-10-skybound/implementation/t02b/traversal/build.mjs
```

단위 검사 **16/16 통과**: 새 3개는 실제 표시 경계/지면 높이, 비공유 원본 변경 격리,
물리 규칙과의 경계 일치, 여러 시점 모든 화살표 정점의 원기둥 내부 배치,
같은 시간/초기화 재현 및 버퍼 유지 여부를 확인한다. 브라우저 진입·상승·회복·이탈과
화면 가독성은 root의 별도 보고서에 기록한다. 이 표시는 최종 기류 아트 승인이나
모바일 성능 보증이 아니다.


## T03B-2a · 중간 착지대 하나

상승기류 동쪽 `(8,30)`에 4m × 4m의 작은 분필빛 돌 착지대를 추가했다.
윗면은 기류 중심 실제 지면 +5m이며 float32 렌더 정점으로 확정한 `topY`를 사용한다.
기류 안에서 착지대보다 약 4m 높이까지 오른 뒤 동쪽으로 활공하면 기본 기력으로
도달할 수 있다. 원래 출발점 체크포인트를 유지하며 자동 체크포인트는 만들지 않는다.

`src/platform.mjs`의 보이는 윗면 BufferGeometry 두 삼각형을 `createTerrain`에
직접 전달한다. 장식 돌/금빛 원은 충돌하지 않는다. world palette chalk/chalkShade/brass를
사용한 임시 절차형 표식이며 최종 섬 아트가 아니다.

이 adapter의 `heightAt(x,z)`는 기존 풀밭/길만 조회한다. 선택적
`supportHeightAt(x,z,previousFeetY)`는 이전 발 높이 +1e-8 이하인 윗면만 포함하여
가장 높은 지지면을 반환한다. simulation의 이동/착지 및 임박한 착지 버퍼 조회가
이 선택적 메서드를 사용한다. 기존 adapter에는 기존 heightAt 동작이 유지된다.
아래에서 걷거나 상승할 때 윗면이 수평 이동을 막거나 위로 순간이동시키지 않는다.
하강할 때 이전 발 위치에서 지지면을 지나면 착지하며, 윗면 보행 중에는 지지를 유지하고
가장자리 밖으로 나가면 떨어진다. 실제 벽/천장/입체 바위 충돌은 추가하지 않았다.

체크포인트 검증은 계속 `heightAt`을 사용하므로 pad 아래 좌표를 넘겨도 풀밭 안전점이다.
착지대 체크포인트 지정은 지원하지 않는다. `state.platform`과 advance 반환값은
`{center,bounds,topY,landed,everLanded}`를 제공한다. 착지하면
`simulation.progress.firstAerialLanding=true`를 기존 진행 값과 합쳐 저장한다.
물에 떨어진 뒤 리스폰해도 기록은 유지되며 fixture 전체 reset은 기록도 초기화한다.

```sh
node --test docs/specs/2026-09-10-skybound/implementation/t02b/traversal/tests/*.test.mjs docs/specs/2026-09-10-skybound/implementation/t02a/tests/*.test.mjs docs/specs/2026-09-10-skybound/implementation/t03a/tests/*.test.mjs
node docs/specs/2026-09-10-skybound/implementation/t02b/traversal/build.mjs
```

**45/45 통과**, 빌드 통과. 새 3개 검사는 실제 렌더 top 좌표/충돌 일치, 아래 통행과
기존 체크포인트, 상승 통과/하강 착지/보행 지지/가장자리 추락, 공유 기력으로 기류→착지대
도달 및 돛 닫힘, 물 리스폰 기록 보존을 확인한다. 실제 원본 초원 경로와 화면 가독성은
root의 브라우저 QA로 별도 기록한다. 두 번째 착지대·전체 탐험 경로는 이번 범위가 아니다.

## T03B-2b · 두 번째 착지대와 경로 완료

두 번째 착지대는 (14,30), 첫 착지대보다2m 낮고 폭4m다. 합성 supportHeightAt은 두 상판 모두 지지하며 원래 heightAt/체크포인트는 초원 기준이다.
`route.mjs`의 순수 updateRoute가 첫 착지 → 두 번째 착지 순서를 기록한다. 두 번째에 먼저 도착해도 완료되지 않는다. 진행은 기존 progress와 병합하며 물 리스폰에서 보존하고 전체reset에서 지운다.
`state.route={first,second,complete,stage}`, `state.destination={center,bounds,topY,landed}`를 노출한다. 기존 state.platform은 첫 발판이다. 완료 시 두 번째 표식이 커지고 색이 바뀌며 '경로 완료' 안내가 나온다.
전체 관련검사48/48, 실제 초원 경로 브라우저14/14 통과. 기본 기력으로 기류→첫 발판→점프/활공→둘째 발판 도달 및 재시도를 확인했다. 이는 이동 진단 경로이며 게임 전체의 퀘스트/엔딩 완료가 아니다.
