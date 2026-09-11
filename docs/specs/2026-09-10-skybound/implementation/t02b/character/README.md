# 나루 캐릭터 스튜디오 · T02B-3

Skybound의 `art-direction.md`와 `assets/character-props-board.png`를 참고한
자체 제작 캐릭터의 독립 진단 화면이다. 다른 게임 에셋은 사용하지 않는다.
콘셉트 이미지를 화면 배경으로 표시하지 않는다.

## 빌드 / 실행

저장소 루트에서 기존 `portal-fe/node_modules` 의 의존성을 사용한다.

```sh
node docs/specs/2026-09-10-skybound/implementation/t02b/character/build.mjs
python3 -m http.server 8768 --bind 127.0.0.1 --directory docs/specs/2026-09-10-skybound
```

`http://127.0.0.1:8768/implementation/t02b/character/index.html`을 연다.
빌드 스크립트는 자신의 파일 위치를 기준으로 경로를 해석하므로 다른 작업
디렉터리에서도 실행할 수 있다. 빌드 결과 `viewer.bundle.js`와
`viewer.bundle.css`는 Git에서 제외한다. CSS 번들에 root `DESIGN.md`가 지정한
공유 `packages/design-system/src/tokens.css`를 포함하므로 서버가 저장소의
다른 경로를 공개할 필요가 없다. UI는 공유 light 토큰, 폰트, 간격을 사용한다.

사용 버전: Three.js **0.183.2**, esbuild **0.27.7**. 별도 CDN/새 의존성 없음.

## 제작 / 표시 경로

1. `src/atlas.mjs`가 결정적인 1024×1024 Canvas atlas를 만든다.
2. `src/model.mjs`의 `createCharacter(THREE, { lod, texture })`가 LOD 0/1을 만든다.
3. 표준 Three.js `GLTFExporter`가 atlas와 skin, animation을 포함한 binary GLB를 생성한다.
4. `GLTFLoader.parseAsync`로 각 GLB를 다시 읽는다.
5. **다시 읽은 모델만** 스튜디오에 추가한다. 직접 만든 메시는 렌더링하지 않는다.

좌표는 Y-up, +Z가 정면, 발바닥 Y≈0이다. 방향 버튼, 드래그/확대,
LOD 선택, `rig-inspection` 중간 포즈, `idle` 재생과 자동 회전을 제공한다.
기본은 정지 상태이며 재생/자동 회전은 명시적인 버튼 조작 후에만 시작한다.
DPR은 2로 제한한다. 입력/리사이즈/모션 변화가 있을 때만 렌더링한다.
`얼굴·상체 확대`는 Y=1.25–1.70m 부근을 사선으로 가까이 보여준다.
확대 보기에서는 카메라 최소 거리를 0.55m로 낮추며, 전신 방향 버튼이나
초기화를 선택하면 기존 전신 구도와 최소 거리 2.2m로 돌아간다.

## 검증 / 저장 인터페이스

`window.__SKYBOUND_CHARACTER__`:

- `ready`, `error`, `loadedFromGLB`, `threeRevision`
- `stats[0|1]`: 삼각형/정점/본/재질 수, 파일 바이트, 클립 이름 등
- `glbBase64[0|1]`, `atlasBase64`: data URI 접두사가 없는 Base64
- `lod`, `view`, `pose`, `animated`, `rotating`, `frame`
- `modelBounds`, `renderedBounds`: 월드 경계와 canvas 내 픽셀 경계
- `setView('front'|'back'|'side'|'threequarter'|'detail')`, `setLOD(0|1)`,
  `setPose(boolean)`, `renderNow()`

`ready=true`에서도 `error`가 있으면 실패다. 저장 대상은
`assets/naru-lod0.glb`, `assets/naru-lod1.glb`, `assets/naru-atlas.png`다.
저장 GLB는 브라우저 훅에서 추출한 실제 export 바이트이며 페이지 실행 시에는
소스에서 다시 export/load하여 최신 구현을 확인한다.

빌드 성공을 확인했다. 브라우저/GLB 구조/이미지 검증 증거는
`../../../verifications/`의 T02B-3 보고서를 참조한다. 보고서가 없으면 해당
검증은 미실행이다. 이 fixture는 게임 입력·이동·충돌·전투에 연결하지 않으며,
실제 플레이 카메라에서의 품질과 모든 움직임의 관통 검사는 아직 검증하지 않는다.
