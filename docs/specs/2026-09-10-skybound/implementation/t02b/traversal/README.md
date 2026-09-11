# T02B-4b-2 · 이동 / 캐릭터 연결 진단

기존 Skybound 월드·이동 코어·저장 GLB를 연결한 PC 진단 fixture다.
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
- `advanceForTest(dt, input={})`: 일시정지 상태에서만 같은 simulation→animation→render
  경로를 수동 실행한다. 자동 RAF와 섞으면 오류다. 최신 상태 요약을 반환한다.
  입력 `yaw`를 생략하면 현재 카메라 yaw를 쓰고, 명시하면 해당 값을 우선한다.
- `resetForTest()`: 일시정지, 새 simulation/animation 상태로 출발점 복구
- `pause()` / `resume()`: 자동 조작 실행 제어

카메라 pitch는 0.08–1.15rad로 제한한다. 드래그는 mouse 우클릭과 pointer capture만
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
맞는다는 검사는 양발이 경사면에 완전히 붙는다는 의미가 아니다. T02C-1 PC 시야만
추가했으며 터치 조작, 정식 키 설정, 게임 상태 머신은 후속 범위다. 모바일 성능과
아트 품질 PASS를 주장하지 않으며 이 fixture를 완성된 섬 탐험으로 취급하지 않는다.

T02C-1 순수 카메라 검사 3개는 회전/줌 범위, yaw와 이동 전방의 일치,
비정상 입력 거부·불변성을 확인한다. `node --test .../tests/camera.test.mjs`로 실행한다.
브라우저 우클릭·휠·방향 상대 이동과 취소 동작은 별도 PC 시야 검증 보고서에 기록한다.
