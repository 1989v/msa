# T01A · 유적 소품 제작 경로 실험

상태: **기술 경로 검증 완료 / 최종 아트 품질 아님** · 2026-09-10

## 산출물

- [실험 뷰어](index.html): 실제 GLB를 로드하는 회전/확대 미리보기.
- [모델](assets/wind-shrine.glb): 독창적 바람 유적 소품, 정적 GLB 2.0.
- [생성 코드](src/model.mjs), [제한된 정적 exporter](src/export-glb.mjs),
  [빌드](build.mjs), [검증 테스트](tests/export.test.mjs).
- [데스크톱 캡처](../../verifications/t01a-desktop.png),
  [세로 캡처](../../verifications/t01a-portrait.png),
  [가로 캡처](../../verifications/t01a-landscape.png).

기존 게임의 코드/아트/모델은 읽거나 복사하지 않았다. 캐릭터·소품 원화
보드를 참고해 새 기하를 작성했다. 게임 기능은 이 실험에 포함하지 않는다.

## 선택한 제작 경로

Blender 실행 파일/앱은 확인되지 않았다. 새 도구를 설치하지 않고 설치된
Node 22.22.3 / Three.js 0.183.2 / esbuild 0.27.7을 사용했다.

**명시적 Three.js 기하 → 정적 GLB export → GLTFLoader 재로드 → WebGL 렌더**.
스크립트는 포털 package.json을 기준으로 의존성을 찾는다. 경로 자체에 사용자
홈 디렉터리나 CDN을 박지 않았다. 내보내는 하위집합은 정적 삼각형 메시,
법선, vertex color, PBR 색/거칠기/금속성뿐이다. 텍스처·리깅·애니메이션·다중
재질 geometry는 지원하지 않는다. 이를 범용 모델링 파이프라인으로 주장하지 않는다.

정적 환경 소품의 실행 가능성은 확인했다. 캐릭터/텍스처가 들어가는 단계는
표준 GLTFExporter 또는 모델링 도구 경로를 별도로 검증해야 한다.

| 항목 | 결과 |
|---|---|
| 삼각형 | 9,624 |
| 정점 | 27,791 |
| 메시 / 재질 | 95 / 6 |
| GLB 파일 | 1,197,140 bytes |
| 뷰어 번들 | 610,417 bytes |

## 재현

레포 루트에서:

```bash
node docs/specs/2026-09-10-skybound/implementation/t01a/build.mjs
node --test docs/specs/2026-09-10-skybound/implementation/t01a/tests/export.test.mjs
python3 -m http.server 8768 --bind 127.0.0.1 --directory docs/specs/2026-09-10-skybound
```

브라우저 주소: `http://127.0.0.1:8768/implementation/t01a/index.html`.
HTML을 file://로 직접 열지 않는다. 서버가 종료됐다면 마지막 명령으로 다시 시작한다.

## 검증 근거

```text
build: viewer.js
triangles: 9624 / materials: 6 / bytes: 1197140
# tests 5
# pass 5
# fail 0
```

테스트는 결정적 생성/파일 일치, GLB buffer·accessor 경계/유한 값,
GLTFLoader로 재로드한 실제 꼭짓점 경계/재질, 비유한 입력 거부,
서로 다른 비백색 소재 보존을 검사한다.

브라우저: 프로젝트 전용 격리 headless Chrome + software WebGL.
1280×900, 390×844, 844×390에서 모두 `loadedFromGLB: true`, `ready: true`,
런타임 오류 0, 가로 overflow 없음. 자동 회전 버튼 토글과 구도 버튼 호출 확인.
실제 손가락 드래그/핀치와 실기기 성능은 검증하지 않았다.
[원시 결과](../../verifications/t01a-browser.json)를 보존했다.

## 발견·수정한 문제

1. CSS의 공백 구분 HSL 문자열은 설치된 Three.Color 파서에서 흰색으로
   남았다. 모델 색은 명시적 setHSL과 SRGBColorSpace, 뷰어 광원은 지원되는
   구문으로 고쳤다. 여섯 소재가 서로 다른 비백색 값인 회귀 테스트를 추가했다.
2. 회전된 로컬 AABB는 실제 꼭짓점보다 크게 잡힌다. export 전/후 검사에서
   `setFromObject(..., true)`로 실제 꼭짓점을 비교했다. 허용 오차를 늘리지
   않았고 측정 차이는 약 1.24e-7이었다.

## 남은 품질 차이와 다음 작업

- 원화의 자연스러운 침식·미세 석재 질감·비대칭 파손보다 단순하다.
- 95개 메시를 그대로 반복하면 draw call 비용이 커진다. 환경 확장 전 재질별
  병합/인스턴싱을 검토하고 화면 품질과 비용을 함께 측정해야 한다.
- 그림자와 일반 PBR 조명만 확인했다. 최종 환경광/텍스처/LOD/충돌 형상은 없다.
- 흰 석재·슬레이트·황동 구분과 기본 실루엣은 확인했으나 **원화 품질 통과
  판정은 내리지 않았다**. T01B에서 대표 절벽 장면과 함께 개선한다.

창작 에이전트는 테스트 작성 후 워크스페이스 크레딧 부족으로 중단됐다.
메인 에이전트는 새 아트를 만들지 않고 파서/테스트 오류 수정, 재검증, 저장만
마무리했다. 추가 클린룸 제작은 크레딧 복구 후 T01B부터 진행한다.
