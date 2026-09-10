# T02B-2 · 1K 텍스처 GLB 왕복 진단

이 폴더는 텍스처 제작·내보내기 경로의 작은 진단이다. 최종 주인공 아트가 아니다.
직접 작성한 Canvas 2D 아틀라스를 표준 Three.js `GLTFExporter`로 PNG를 내장한 GLB에
저장하고, 표준 `GLTFLoader`와 실제 브라우저 이미지 디코더로 다시 읽는다.

## 재현과 결과

저장소 루트에서 설치된 라이브러리를 이용해 번들한다. 추가 패키지 설치는 없다.

```sh
node docs/specs/2026-09-10-skybound/implementation/t02b/texture-check/build.mjs
python3 -m http.server 8768 --bind 127.0.0.1 --directory docs/specs/2026-09-10-skybound
```

브라우저에서 <http://127.0.0.1:8768/implementation/t02b/texture-check/index.html>을 연다.
페이지의 JSON에는 각 검사의 성공/실패가 표시된다. 브라우저 테스트 본체는 `probe.mjs`의
`run()`이며 Node 가짜 DOM, FileReader shim 또는 custom exporter를 사용하지 않는다.

자동 수집기는 `window.__SKYBOUND_TEXTURE_CHECK__`의 `ready`를 기다린다.
성공 시 `passed`, `checks`, `glbBase64`, `pngBase64`를 제공하고, 실패 시 `error`와
그때까지 수행한 `checks`를 제공한다. `pngBase64`는 GLB bufferView에서 추출한 PNG이다.
spec 기준 `verifications/check-texture.mjs` 수집기를 사용한다. 수집 결과는 spec의
`verifications/t02b-2-browser.json`, 생성 파일은 이 폴더의 `diagnostic-texture.glb`와
`diagnostic-atlas.png`에 보관한다. 실행 결과는 이 JSON을 근거로 판단한다.

## 검사 범위

- 1,024×1,024 자체 4색 아틀라스. 비대칭 사분면과 중간 RGB 값으로 상하 반전과 색 변환을 검출한다.
- GLB v2 header 및 JSON/BIN 구성, 단일 `image/png` bufferView와 이미지/버퍼 외부 URI 부재.
- PNG signature/IHDR 크기 및 브라우저 디코딩 후 원본과 **전체 1,048,576 RGBA 픽셀** 비교.
- 로더의 이미지 요청이 내장 blob URL인지 검사하고, 재로드된 이미지 전체 픽셀도 다시 비교.
- basecolor의 `SRGBColorSpace`, `flipY=false`, 6개 정점 UV 보존.
- `transformUv`를 거친 네 내부 UV 샘플의 사분면 색을 확인하여 glTF V=0 이미지 상단 규칙 검증.
- T02B-1과 같은 두 bone/혼합 skinWeight/회전 clip 보존, 0.5초 시점 CPU 정점 변형의 원본 일치.

`flipY=false`는 입력부터 명시한다. 이 결과를 다른 flipY 설정의 자동 변환 지원으로 해석하지 않는다.

## 원본 관리와 도구 출처

- 원본은 `probe.mjs`의 `makeAtlas()`와 `createFixture()`다. 새로 작성한 진단 이미지이며 외부 이미지,
  다른 게임 코드·아트·모델은 사용하지 않았다. rig 정의는 바로 옆 T02B-1 자체 진단을 복사했다.
- `diagnostic-atlas.png`와 `diagnostic-texture.glb`는 원본 코드에서 실제 브라우저로 생성하는 파생물이다.
  원본 수정 후 재빌드·브라우저 검사·파생물 및 결과 JSON 저장을 함께 수행한다.
- Three.js **0.183.2**, [mrdoob/three.js](https://github.com/mrdoob/three.js), MIT.
  설치본 `portal-fe/node_modules/three/LICENSE`; 표준 exporter/loader는 수정 없이 사용.
- esbuild **0.27.7**, [evanw/esbuild](https://github.com/evanw/esbuild), MIT.
  설치본 `portal-fe/node_modules/esbuild/LICENSE.md`; `probe.bundle.js`는 git에서 제외한 재현 번들.
- 브라우저 Canvas 2D/Blob/createImageBitmap/FileReader를 실제 사용한다. 이미지 생성 API, 유료 도구,
  DCC 설치는 이 기술 진단에 필요하지 않다. 최종 아트 제작에 추가 도구가 필요한지는 별도 판단한다.

## 한계와 다음 작은 단위

파일 경로와 CPU 변형의 검사이며 GPU 렌더/조명 아래 실제 색상, 원화 수준, UV 이음새 품질,
실제 캐릭터 토폴로지·복잡한 rig·다중 clip·모바일 성능·DCC 상호운용은 미검증이다.
Q05의 기술 경로 근거로 사용할 수 있으나 실제 모델 품질 검증을 대신하지 않는다.
다음 단위에서 원화에 맞춘 실제 캐릭터 형태와 UV/리깅을 제작하고 실루엣을 비교한다.

## 이번 실행 증거 · 2026-09-10

메인 에이전트가 실제 Headless Chrome 152에서 직접 실행: **12 passed / 0 failed**, 런타임 오류 0.
GLB 27,892 bytes, 내장 PNG 24,764 bytes. GPU 렌더를 수행한 검사는 아니다.

전용 프로필이 실행 중일 때 저장소 루트에서 자동 수집:

```sh
node docs/specs/2026-09-10-skybound/verifications/check-texture.mjs 9403 http://127.0.0.1:8768/implementation/t02b/texture-check/index.html
```

전용 브라우저 기동/종료는 `CLAUDE_SCRATCHPAD=/private/tmp/skybound-validation`을 지정한
`scripts/cdp-chrome.sh start skybound-prop --gl` / `stop skybound-prop`만 사용한다.
