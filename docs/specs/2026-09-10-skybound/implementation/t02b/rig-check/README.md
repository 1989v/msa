# T02B-1 · 표준 GLB 리깅 왕복 진단

검증 결과: **표준 GLTFExporter → GLB → GLTFLoader에서 skin과 animation 보존 및 CPU 정점 변형 통과**.
최종 주인공 모델, 텍스처, 캐릭터 실루엣 품질을 검증한 결과는 아니다.

## 재현

저장소 루트에서 실행한다. 설치된 `portal-fe/node_modules/three`가 필요하며 추가 패키지는 설치하지 않는다.

```sh
node docs/specs/2026-09-10-skybound/implementation/t02b/rig-check/probe.mjs
node --test docs/specs/2026-09-10-skybound/implementation/t02b/rig-check/probe.test.mjs
```

2026-09-10, Node **v22.22.3** 실행 결과: `Exported diagnostic-rig.glb: 2604 bytes; Three.js r183`;
`tests 4`, `pass 4`, `fail 0`.

## 구성과 증거

- `probe.mjs`: 이 작업에서 직접 정의한 진단용 평면 스트립(6 정점, 4 삼각형), 두 bone,
  1초 quaternion 회전 clip. 관절 전용 정점과 50:50 혼합 가중치 정점을 모두 포함한다.
- `diagnostic-rig.glb`: 재현 명령으로 생성한 GLB 2 binary. 테스트는 저장된 파일과 새 export의 바이트 일치도 검사한다.
- `probe.test.mjs`: topology/joints/weights/inverse-bind 행렬과 clip/keyframe 보존을 검사한다.
  로드한 AnimationMixer를 0.5초 진행한 뒤 `SkinnedMesh.getVertexPosition`으로 실제 skinning된 정점을 읽는다.
  원본의 결과뿐 아니라 45도 회전과 가중치의 독립적인 수학식에 대조한다.
  고정 정점의 불변, 관절 정점 이동, 혼합 가중치 정점 이동을 각각 검사한다.

## 도구와 출처

- Three.js **0.183.2** (revision 183), 설치된 표준 `examples/jsm/exporters/GLTFExporter.js`와
  `examples/jsm/loaders/GLTFLoader.js`를 수정 없이 사용한다.
- 도구 출처: [mrdoob/three.js](https://github.com/mrdoob/three.js), MIT.
  설치본 라이선스: `portal-fe/node_modules/three/LICENSE`.
- 진단 메시/가중치/애니메이션 원본은 이 폴더의 `probe.mjs`이며 이 작업에서 직접 작성했다.
  외부 모델·텍스처·다른 게임 자산은 사용하지 않았다. T01A exporter도 사용하거나 확장하지 않았다.

## 제한 및 다음 단계

- Node native Blob를 사용하며, 이 binary 실험에 필요한 `FileReader.readAsArrayBuffer`와
  `onloadend`만 최소 호환 처리한다. 브라우저 FileReader 전체 polyfill이 아니다.
- 무텍스처 단일 메시/단일 재질/두 관절/한 clip에 한정한다. UV/atlas, 이미지 인코딩,
  복잡한 rig, morph, 여러 clip 전환, 압축, LOD 및 DCC 상호운용은 미검증이다.
- CPU skinning 수학 검증이다. 브라우저 GPU 렌더, 모바일 성능 및 원화 품질 통과를 주장하지 않는다.
- T02B-2에서 원화 기반 캐릭터 제작 방식과 텍스처 제작 도구를 별도로 결정한다.
  이 진단 스트립을 실제 캐릭터로 대체 사용하지 않는다.
