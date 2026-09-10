# T01C · 장면 뷰어 카메라와 복구

2026-09-10. T01B 월드 기하·재질·조명은 유지하고 독립 장면 뷰어의 조작과 수명주기를 보강했다. 게임 이동/충돌 구현이나 최종 아트 판정은 이 결과에 포함하지 않는다.

## 구현

- 궤도 중심 `[0,19,-12]` 고정, pan 비활성화. 거리 60–260, polar 0.2–1.42 rad, azimuth −0.9–1.2 rad. 앞쪽 관찰 영역과 최소 높이 약 28을 유지해 주요 섬 지면/바다 아래 시점을 방지한다. 자유 비행이나 일반적인 지형 충돌 해결기는 아니다.
- 초기 가로 구도 `[43,33,67]` 유지. 세로에서는 가로 시야 폭을 확보하도록 거리 증가, 회전 시 상대 줌 보존 후 거리 범위 적용. 극단적으로 좁은 화면에서는 최대 거리 때문에 전체 장면이 들어오지 않을 수 있다.
- ‘처음 시점’은 현재 화면비 기준 카메라와 입력 관성을 함께 재설정한다. 드래그 회전, 휠/핀치 줌.
- canvas 실제 CSS 크기에 맞춰 projection과 drawing buffer 갱신. 모바일 판정은 coarse pointer 또는 userAgentData.mobile이며 DPR 상한은 모바일 1.5 / 데스크톱 2. 창 크기와 ResizeObserver 변경을 반영한다.
- WebGL 생성/렌더 실패 및 context loss에 안내와 ‘다시 시도’ 새로고침 버튼 제공. context loss 시 렌더 중단, restored 이벤트에서 컨트롤 재연결과 렌더 재개. 복구 후 실제 렌더 성공해야 ready/sceneReady가 true가 된다.
- 숨김 탭에서 animation loop 중단, 복귀 시 재개. 이는 장면 미리보기이며 추후 플레이의 명시적 재개 메뉴는 별도 구현한다. 중단 시간을 물 셰이더 시간에 더하지 않는다.
- prefers-reduced-motion을 초기/실시간 반영: 궤도 damping과 물 자동 움직임 중단. 수동 카메라 조작은 유지.
- 안정적인 `window.__SKYBOUND_VIEWER__` 객체에서 준비/오류/카메라/DPR/프레임 수/실행 상태/물 시간/탭 상태를 검증 가능하다.

## 이 작업자의 검증

- `node --test docs/specs/2026-09-10-skybound/implementation/t01b/tests/camera.test.mjs`: **4 tests, 4 pass, 0 fail**.
- `node --test docs/specs/2026-09-10-skybound/implementation/t01b/tests/*.test.mjs`: 기존 월드 검증 포함 **9 tests, 9 pass, 0 fail**.
- 검증 대상: DPR/잘못된 화면 크기, 1440×900·390×844·844×390 framing, 화면 방향 변경 시 상대 줌과 상하한, 결정적 reset 및 최소 카메라 높이.
- `node docs/specs/2026-09-10-skybound/implementation/t01b/build.mjs`: exit 0. Three.js 0.183.2 / esbuild 0.27.7. 146 meshes, 4,352 instances, 177,364 triangles, 9 terrain islands, externalAssets 0.
- 실제 브라우저 입력/화면 캡처/컨텍스트 복구 증거는 상위 작업자가 별도 기록한다. 위 pure tests는 GPU 또는 DOM 검증을 대체하지 않는다.
- 실제 모바일 기기 성능, FPS/p95, 장시간 메모리·발열은 **미측정**. 목표 성능 통과나 최종 게임 완성을 주장하지 않는다.

## 다음 입력

T01C 브라우저 검증 결과와 세 화면비 캡처를 확인한 후 T02A로 이동한다. 해당 단계는 별도의 공유 지형 정의와 게임 이동/충돌/낙하 복구가 필요하다. 현 뷰어의 제한된 궤도 범위를 플레이 카메라 충돌로 간주하면 안 된다.
