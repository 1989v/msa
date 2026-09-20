# WINDWAKE JOURNEYS · 바람뜰의 모험

엔진·외부 에셋·빌드 과정 없이 만든 독자적인 3인칭 오픈월드 액션 어드벤처입니다. 기존 240×240m 모험을 중앙에 남기고 **1,920×1,920m(면적 64배)**로 확장했습니다. 외곽 8지역에서 웨이포인트를 점화하고 수호자를 공략하며, 내 마을에서는 작물을 재배하고 밤의 습격을 막습니다.

- **성장:** 세 갈래 스킬트리 18노드, 햇살 화살·바람 질주·치유의 꽃·대지 울림, 장착 슬롯 2개. 기본 울림·3연격·패링·낙하 공격과 연계합니다.
- **월드:** 중앙 모험 + 외곽 8바이옴, 외곽 보스 8개 + 최종 수호자, 웨이포인트 8개와 마을 귀환. 추가 보물·탐험 시련·재생 자원 터가 있습니다.
- **전투:** 일반 적 12유형, 지역 보스 4계열의 공격 패턴·2단계 전환·소환. 공격 예고, 피격·회피·사선·높이 판정이 있습니다.
- **마을과 여정:** 내 마을 외에 지역 마을 8곳, 주민 24명, 건물 48채. 16개 의뢰 단계를 진행하며 상인·여관을 이용하고 도시 동맹을 맺습니다.
- **던전:** 별도 실내 공간 4곳, 총 27개 방. 전투·문양 순서·스위치·돌과 압력판·높은 발판·보물·수호자를 거쳐 기능이 있는 유물을 얻습니다.
- **유물:** 8종 중 2개를 장착해 전투·이동·농사·방어를 조합합니다. 도시 동맹은 내 마을 방어탑과 귀환 회복약을 강화합니다.
- **생활:** 작물 4종, 건물 8종, 씨앗 거래·채집·수리·마을 성장 3단계. 첫 집과 첫 수확을 마치면 해질녘 2차례 습격을 방어합니다. 멀리 있을 때 침공은 귀환을 기다립니다.

64배는 **탐험 가능한 면적**의 비율입니다. 제작된 콘텐츠나 플레이 시간이 64배라는 뜻은 아닙니다. 멀티플레이·서버 동기화 없이 브라우저별로 저장하는 싱글플레이 게임입니다.

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
| 장착 기술 1 / 2 | 숫자 1 / 2 |
| 스킬트리 / 마을 건설·농사 / 유물 장착 | T / B / I |
| 공격 직전 패링 | F |
| 상호작용 / 회복약 | E / H |
| 시점 회전 / 확대·축소 | 마우스 오른쪽 드래그 / 휠 |
| 키보드 시점 회전 | 방향키 |
| 지도와 여정 / 일시정지 | M / Escape |

터치에서는 왼쪽 조이스틱과 오른쪽 액션 버튼을 사용합니다. 화면 오른쪽의 빈 공간을 쓸어 시점을 바꿉니다. 메뉴와 탭 전환은 게임을 멈추고 눌린 입력을 해제합니다.

## 마을과 변경

지도 M의 마을 버튼으로 귀환하거나 남서쪽으로 걸어가세요. B에서 설계도와 빈 칸을 선택하고 건설을 확정합니다. 가까운 밭에서 E를 누르면 씨앗 심기 → 물주기 → 수확을 진행합니다. 순무는 물을 준 뒤 게임 시간 45초에 익으며, 메뉴를 열면 시간이 멈춥니다. 수확한 씨앗으로 다시 심고 식량으로 다른 씨앗을 교환할 수 있습니다.

작은 집과 첫 수확 뒤부터 밤의 침공을 예고합니다. 방어탑과 울타리를 배치하고 직접 싸워 봉화를 지키세요. 패배해도 기술·작물·재료는 남고 봉화는 무료로 복구할 수 있습니다. 수확과 방어로 명성을 쌓고 마을을 3단계로 키우세요.

외곽 지역은 중앙 남쪽 길에서 갈라지는 길을 따라 걸어서 접근할 수 있습니다. 발견한 웨이포인트 곁에서 E로 점화해야 빠른 이동할 수 있습니다. 네 지역 수호자 격파와 마을 3단계를 달성하면 북쪽 끝의 최종 수호자가 열립니다. 기존 하늘섬 엔딩과 확장 엔딩은 각각 완료 후 자유 탐험을 계속할 수 있습니다.

## 지역 마을과 던전

외곽 등대를 점화한 뒤 가까운 마을로 걸어가 주민 옆에서 E로 대화하세요. 안내인에게 의뢰를 받고 목적지를 탐험한 뒤 **다시 안내인에게 돌아와 보고**하면 보상을 받습니다. 상인마다 식량·재료·씨앗·원정 회복약 등 서비스가 다르며 별꽃 관측촌에서는 결정을 지불해 기술을 초기화할 수 있습니다. 여관에서는 무료로 회복합니다. M에서 의뢰를 추적하고 I에서 유물의 획득처와 효과를 확인하세요.

밀바람·메아리·안개가지·서리별 마을 근처에 실제 던전 입구가 있습니다. E로 입장한 후 방과 복도를 직접 이동합니다. 비문의 단서를 읽고 문양이나 스위치는 가까이에서 E, 돌은 뒤에 서서 Q로 움직입니다. 돌이 잘못 놓이면 방의 복원 장치로 무료 초기화할 수 있습니다. 높은 발판은 기본 점프만으로 넘을 수 있습니다. 선택 보물방도 찾아보세요.

입구의 귀환문으로 언제든 나갈 수 있습니다. 사망·새로고침 시 같은 던전의 안전한 입구에서 이어지며 처치·퍼즐·보상 기록은 유지됩니다. 실내에 있는 동안 내 마을의 작물 시간과 침공은 멈춥니다. 던전 수호자는 기존 하늘섬 엔딩과 별개이며, 클리어 후에도 다른 지역을 계속 탐험할 수 있습니다.

마을은 각 지역의 작은 기능성 거점이며 집 48채의 개별 실내나 주민 일과 시뮬레이션까지 구현한 것은 아닙니다. 던전은 재입장이 가능한 네 개의 고정 설계 공간이고 첫 보상은 한 번만 지급됩니다.

## 중앙 모험 안내

- **돌의 봉인:** 돌 뒤에서 울림을 사용해 금빛 압력판으로 밀어 넣습니다. 제단의 E는 돌을 제자리로 돌려놓습니다.
- **숲의 봉인:** 제단에 새겨진 성장의 이야기를 읽고 세 돌에 순서대로 울림을 새깁니다. 틀려도 다시 도전할 수 있습니다.
- **하늘의 봉인:** 천문대 남서쪽의 낮은 발판부터 점프로 올라갑니다. 기본 점프만으로 도달할 수 있습니다.
- 첫 봉인은 **바람돛**, 다음 봉인들은 **기력 확장**, 세 번째는 **울림 강화와 중앙 상승기류**를 줍니다.
- 모닥불에서 쉬면 회복약이 보충됩니다. 적과 보물에서 모은 결정으로 최대 체력과 검을 강화할 수 있습니다.
- 방패 적은 울림·측면 공격·패링으로 공략합니다. 수호자는 울림 세 번 또는 패링으로 큰 빈틈을 만들 수 있습니다. 원형 파동은 점프, 내려찍기와 발사체는 거리와 회피로 피합니다.
- 기본 3연격과 낙하 공격은 피해만 주며 적을 경직시키거나 밀어내지 않습니다. 적의 공격 예고가 이어지므로 회피·패링으로 대응하고, 울림·스킬로 경직을 만들어 공격을 연결하세요.
- 사망하면 모닥불에서 다시 시작합니다. 획득한 봉인·보물·강화는 유지됩니다. 물에 빠지면 마지막 안전한 발판으로 돌아가며 체력을 잃습니다.

## 구조

| 파일 | 역할 |
|---|---|
| `world.mjs` | 결정론적 청크 지형·지역·경로·공간 충돌 조회 |
| `combat.mjs` | 신규 적과 지역 수호자의 상태 기반 패턴 |
| `progression.mjs` | 스킬트리·성장·장착·저장 검증 |
| `village.mjs` | 작물·건물·경제·침공·복원 |
| `dungeons.mjs` | 독립 실내 지형·문·퍼즐·전투·보상 진행 |
| `settlements.mjs` / `relics.mjs` | 주민·의뢰·상점·동맹·유물 효과와 저장 검증 |
| `journey-ui.mjs` | 주민 대화·의뢰 추적·유물 장착 |
| `frontier-ui.mjs` | 스킬트리·마을 배치·지역 기록 |
| `sim.mjs` | 브라우저에 의존하지 않는 60Hz 물리·전투·퍼즐·진행·저장 검증 |
| `render.mjs` | 직접 작성한 WebGL 렌더러, 절차적 메시, 카메라, 공격 예고와 이펙트 |
| `audio.mjs` | Web Audio 합성 효과음·바람·오리지널 배경 선율 |
| `input.mjs` | 고주사율에서도 입력을 잃지 않는 누적 입력 버퍼 |
| `main.mjs` | 고정 스텝 루프, 실제 입력, UI, 저장, 테스트 API |

높이는 Y축, 북쪽은 +Z입니다. 물리와 전투는 1/60초 고정 스텝으로 계산합니다. 장식과 소리는 게임 상태를 변경하지 않습니다. 이펙트 100개, 드롭 120개, 투사체 60개, 적 64개, 사운드 보이스 28개로 컬렉션을 제한합니다.

CPU 청크 캐시 최대 96개, GPU 상주 청크 최대 64개(일반 시야 49개), 초기 9개 이후 프레임당 새 청크 2개를 생성하며 이탈한 GPU 버퍼를 해제합니다. 구 버전 저장은 자동으로 확장 버전에 이관됩니다.

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

입력은 `moveX`, `moveZ`, `cameraYaw`, `sprint`, `jump`, `attack`, `dodge`, `parry`, `skill`, `interact`, `heal`, `skill1`, `skill2`입니다. `step(N, input)`은 같은 **눌림 상태**를 N틱 반복하므로 버튼 동작은 한 번만 발생합니다. 다시 누르려면 중간에 해제 상태를 전달합니다. `step(N,input,{render:false})`는 대량 검증 시 렌더링만 생략하며 `render()`로 다시 그립니다.

테스트 편의용 `teleport(x,y,z)`, `spawnEnemy(type,x,z,y)`, `defeatEnemy(id)`, `grant(kind,value)`, `respawn()`, 저장 형식 `save()/load(data)`, `camera()/setCamera()`, `metrics()/resetMetrics()`, `events()/input()/ui()`도 제공합니다. **아래 전체 경로 검증은 이동·행동 입력만 사용하며 순간이동·보상 주입·적 삭제를 사용하지 않습니다.**

정상 플레이 API로 `town(action,payload)`, `equipRelic(id,slot)`, `track(id)`, `enterDungeon(id)`, `exitDungeon()`, `dungeon(action,payload)`, `learn(id)`, `equip(id,slot)`, `village(action,payload)`, `travel(id)`, `ability(slot)`도 제공합니다. 이 명령들은 위치·자원·선행 조건을 실제 플레이와 동일하게 검증합니다.

## 검증

```sh
node --test windwake/tests/*.test.mjs
node windwake/tests/routes.mjs quarry forest ruins journey optional
node windwake/tests/frontier-routes.mjs
node windwake/tests/frontier-routes.mjs adventure
node windwake/tests/town-routes.mjs adventure
node windwake/tests/town-routes.mjs continuous
node windwake/tests/dungeon-routes.mjs
```

실제 Chrome 검증은 정적 서버가 실행 중인 상태에서 저장소의 Chrome 프로필 관리 스크립트를 사용합니다(macOS Chrome, Node 22 이상):

```sh
node windwake/tests/browser.mjs input routes optional
node windwake/tests/frontier-browser.mjs smoke
node windwake/tests/frontier-browser.mjs journeys
node windwake/tests/frontier-browser.mjs adventure
node windwake/tests/frontier-browser.mjs stress
node windwake/tests/journey-ui-browser.mjs
node windwake/tests/journey-browser.mjs adventures
node windwake/tests/journey-browser.mjs continuous
node windwake/tests/journey-browser.mjs stress
```

자체 테스트 프로필만 실행하고 종료합니다. 키보드·마우스·멀티터치, 점프·전투·콤보·카메라, 일시정지, 각 성소를 첫 목적지로 해결하기, 세 봉인부터 보스까지의 경로, 엔딩 후 자유 탐험과 새로고침 저장 복원을 검증합니다.

상세 결과와 반복 개선 기록: [검증 보고서](../docs/specs/2026-09-20-windwake-journeys/verifications/final-verification.md). 성능 측정은 Chrome SwiftShader 소프트웨어 WebGL 환경이며 실제 GPU/모바일 기기의 속도를 보장하지 않습니다. 터치는 Chrome 에뮬레이션으로 검증했습니다.

## 배포

`windwake/`가 원본입니다. `node windwake/publish.mjs`는 실행 파일 16개와 SHA-256 릴리스 메타데이터만 `portal-fe/public/games/windwake/`에 복사합니다. 테스트·문서는 배포하지 않으며 변환이나 번들 빌드는 없습니다.

games 서브모듈 커밋을 먼저 push하고, 부모 저장소에서 해당 포인터와 서버 설정을 커밋하여 main에 push합니다. 기존 `images` 워크플로가 `portal-fe` 이미지만 빌드하고 OCI 매니페스트를 갱신하면 Argo CD가 반영합니다. Nginx는 `.mjs`를 `text/javascript`로 서빙하며 없는 모듈은 404를 반환합니다.

배포 후 검증:

```sh
node windwake/tests/deployed.mjs https://game.1989v.com/games/windwake/index.html
```

실제 응답의 파일 해시·MIME·404, Chrome 시작·키보드 이동·점프·정상 입력 경로의 보스 엔딩·콘솔 오류를 확인합니다. 자동 경로 스크립트는 검증 클라이언트가 주입하며 공개 서버에 테스트 코드를 올리지 않습니다.
