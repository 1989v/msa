# WINDWAKE · 바람의 잔향

엔진·외부 에셋·빌드 과정 없이 만든 오리지널 3인칭 액션 어드벤처입니다. 약 240×240m의 연결된 세계에서 세 성소를 원하는 순서로 해결하고, 바람돛과 상승기류를 이용해 하늘섬의 수호자에게 도전합니다. 엔딩 뒤에도 남은 보물과 지역을 탐험할 수 있습니다.

## 실행

공개 주소: **https://game.1989v.com/games/windwake/index.html**

저장소 루트에서:

```sh
python3 -m http.server 8787 --bind 127.0.0.1 --directory windwake
```

Chrome에서 **http://127.0.0.1:8787/** 를 엽니다. `file://` 대신 HTTP를 사용해야 ES 모듈이 로드됩니다. 실행에는 HTML/CSS/JS 파일만 필요하며 서버 API, 패키지 설치, CDN 요청은 없습니다. 진행은 브라우저 localStorage에 저장됩니다.

## 조작

| 동작 | 입력 |
|---|---|
| 카메라 기준 이동 / 달리기 | WASD / Shift |
| 점프 / 공중에서 바람돛 열고 닫기 | Space |
| 3연격 / 공중 내려찍기 | 마우스 왼쪽 클릭 또는 J |
| 회피, 짧은 무적 | K |
| 울림: 적 경직, 방패 깨기, 돌 밀기 | Q |
| 공격 직전 패링 | F |
| 상호작용 / 회복약 | E / H |
| 시점 회전 / 확대·축소 | 마우스 오른쪽 드래그 / 휠 |
| 키보드 시점 회전 | 방향키 |
| 지도와 여정 / 일시정지 | M / Escape |

터치에서는 왼쪽 조이스틱과 오른쪽 액션 버튼을 사용합니다. 화면 오른쪽의 빈 공간을 쓸어 시점을 바꿉니다. 메뉴와 탭 전환은 게임을 멈추고 눌린 입력을 해제합니다.

## 여행 안내

- **돌의 봉인:** 돌 뒤에서 울림을 사용해 금빛 압력판으로 밀어 넣습니다. 제단의 E는 돌을 제자리로 돌려놓습니다.
- **숲의 봉인:** 제단에 새겨진 성장의 이야기를 읽고 세 돌에 순서대로 울림을 새깁니다. 틀려도 다시 도전할 수 있습니다.
- **하늘의 봉인:** 천문대 남서쪽의 낮은 발판부터 점프로 올라갑니다. 기본 점프만으로 도달할 수 있습니다.
- 첫 봉인은 **바람돛**, 다음 봉인들은 **기력 확장**, 세 번째는 **울림 강화와 중앙 상승기류**를 줍니다.
- 모닥불에서 쉬면 회복약이 보충됩니다. 적과 보물에서 모은 결정으로 최대 체력과 검을 강화할 수 있습니다.
- 방패 적은 울림·측면 공격·패링으로 공략합니다. 수호자는 울림 세 번 또는 패링으로 큰 빈틈을 만들 수 있습니다. 원형 파동은 점프, 내려찍기와 발사체는 거리와 회피로 피합니다.
- 사망하면 모닥불에서 다시 시작합니다. 획득한 봉인·보물·강화는 유지됩니다. 물에 빠지면 마지막 안전한 발판으로 돌아가며 체력을 잃습니다.

## 구조

| 파일 | 역할 |
|---|---|
| `world.mjs` | 고정 지형, 충돌체, 지역, 성소, 적 배치와 절차적 장식 |
| `sim.mjs` | 브라우저에 의존하지 않는 60Hz 물리·전투·퍼즐·진행·저장 검증 |
| `render.mjs` | 직접 작성한 WebGL 렌더러, 절차적 메시, 카메라, 공격 예고와 이펙트 |
| `audio.mjs` | Web Audio 합성 효과음·바람·오리지널 배경 선율 |
| `input.mjs` | 고주사율에서도 입력을 잃지 않는 누적 입력 버퍼 |
| `main.mjs` | 고정 스텝 루프, 실제 입력, UI, 저장, 테스트 API |

높이는 Y축, 북쪽은 +Z입니다. 물리와 전투는 1/60초 고정 스텝으로 계산합니다. 장식과 소리는 게임 상태를 변경하지 않습니다. 이펙트 100개, 드롭 120개, 투사체 60개, 적 64개, 사운드 보이스 28개로 컬렉션을 제한합니다.

프레임 시간이 지속적으로 길어지면 3D 장면의 내부 해상도를 자동 조절합니다. UI 글자와 조작 버튼은 원래 해상도를 유지합니다. 일시정지 메뉴의 ‘화면 선명도 우선’으로 이 조절을 끌 수 있습니다.

## 결정론적 API

개발자 콘솔의 `window.WINDWAKE`:

```js
WINDWAKE.reset(123);                      // 초기화하고 수동 스텝 모드
WINDWAKE.step(60, { moveZ: 1 });           // 북쪽으로 1초
WINDWAKE.step(1, { jump: true });
WINDWAKE.step(30, {});                     // 상승 / 낙하
WINDWAKE.step(1, { attack: true });
WINDWAKE.step(1, {});                      // 버튼 해제
WINDWAKE.step(1, { skill: true });
const checkpoint = WINDWAKE.snapshot();
WINDWAKE.restore(checkpoint);              // 입력 이력을 포함한 정확한 복원
WINDWAKE.state();                         // 격리된 전체 상태 사본
WINDWAKE.setManual(false);                // 실제 키보드/터치와 RAF로 복귀
```

입력은 `moveX`, `moveZ`, `cameraYaw`, `sprint`, `jump`, `attack`, `dodge`, `parry`, `skill`, `interact`, `heal`입니다. `step(N, input)`은 같은 **눌림 상태**를 N틱 반복하므로 버튼 동작은 한 번만 발생합니다. 다시 누르려면 중간에 해제 상태를 전달합니다. `step(N,input,{render:false})`는 대량 검증 시 렌더링만 생략하며 `render()`로 다시 그립니다.

테스트 편의용 `teleport(x,y,z)`, `spawnEnemy(type,x,z,y)`, `defeatEnemy(id)`, `grant(kind,value)`, `respawn()`, 저장 형식 `save()/load(data)`, `camera()/setCamera()`, `metrics()/resetMetrics()`, `events()/input()/ui()`도 제공합니다. **아래 전체 경로 검증은 이동·행동 입력만 사용하며 순간이동·보상 주입·적 삭제를 사용하지 않습니다.**

## 검증

```sh
node --test windwake/tests/*.test.mjs
node windwake/tests/routes.mjs quarry forest ruins journey optional
```

실제 Chrome 검증은 정적 서버가 실행 중인 상태에서 저장소의 Chrome 프로필 관리 스크립트를 사용합니다(macOS Chrome, Node 22 이상):

```sh
node windwake/tests/browser.mjs input routes optional
```

자체 테스트 프로필만 실행하고 종료합니다. 키보드·마우스·멀티터치, 점프·전투·콤보·카메라, 일시정지, 각 성소를 첫 목적지로 해결하기, 세 봉인부터 보스까지의 경로, 엔딩 후 자유 탐험과 새로고침 저장 복원을 검증합니다.

상세 결과와 반복 개선 기록: [검증 보고서](../docs/specs/2026-09-18-windwake/verifications/final-verification.md). 성능 측정은 Chrome SwiftShader 소프트웨어 WebGL 환경이며 실제 GPU/모바일 기기의 속도를 보장하지 않습니다. 터치는 Chrome 에뮬레이션으로 검증했습니다.

## 배포

`windwake/`가 원본입니다. `node windwake/publish.mjs`는 실행 파일 8개와 SHA-256 릴리스 메타데이터만 `portal-fe/public/games/windwake/`에 복사합니다. 테스트·문서는 배포하지 않으며 변환이나 번들 빌드는 없습니다.

games 서브모듈 커밋을 먼저 push하고, 부모 저장소에서 해당 포인터와 서버 설정을 커밋하여 main에 push합니다. 기존 `images` 워크플로가 `portal-fe` 이미지만 빌드하고 OCI 매니페스트를 갱신하면 Argo CD가 반영합니다. Nginx는 `.mjs`를 `text/javascript`로 서빙하며 없는 모듈은 404를 반환합니다.

배포 후 검증:

```sh
node windwake/tests/deployed.mjs https://game.1989v.com/games/windwake/index.html
```

실제 응답의 파일 해시·MIME·404, Chrome 시작·키보드 이동·점프·정상 입력 경로의 보스 엔딩·콘솔 오류를 확인합니다. 자동 경로 스크립트는 검증 클라이언트가 주입하며 공개 서버에 테스트 코드를 올리지 않습니다.
