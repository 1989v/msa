# 인피니티 스탭 — Roblox Native Rebuild

기존 Roblox 구현을 폐기하고 새로 작성한 편집 가능한 로컬 place입니다. 핵심은 도시에서 블랙홀 관측소까지 오르는 도약·등반과 추락 위험입니다. 기본 Roblox 캐릭터, 카메라, 이동과 기기별 점프 입력을 그대로 씁니다. **Studio import·실제 캐릭터 물리·기기 조작·화면은 아직 검증하지 않았습니다.** 컴퓨터 사용이 거절된 상태라 Studio/브라우저/UI 자동화를 수행하지 않았습니다.

## 열기와 소스

- 로컬 산출물: [dist/InfinityStep.rbxlx](dist/InfinityStep.rbxlx). Studio에서 파일을 열고 Play 합니다. 로그인·업로드·게시·상품 구매는 이 작업에 포함하지 않았습니다.
- 월드 정본: [tools/build.py](tools/build.py). Python 표준 라이브러리만 사용하며 네트워크 다운로드 없이 place를 결정적으로 생성합니다. GUI에서 편집한 월드는 재빌드 시 덮어쓰므로 지속할 수정은 빌더에 반영합니다.
- Luau: `src/shared` 순수 규칙/Theme, `src/server` 게임/저장 경계/환경, `src/client` 피드백만.
- [default.project.json](default.project.json)은 선택적 Rojo **스크립트 매핑**입니다. 생성된 place를 먼저 연 뒤 사용합니다. 매핑만으로 건축 월드를 만들지 않습니다. 빌더와 같은 `ReplicatedStorage.InfinityStep`, `ServerScriptService.InfinityStepServer`, `StarterPlayer.StarterPlayerScripts` 구조입니다. 이 세션에서 Rojo 실행은 하지 않았습니다.
- [ASSETS.md](ASSETS.md)에 실제 내장 리소스와 직접 만든 Model 출처를 기록했습니다. Creator Store 외부 에셋은 사용하지 않았습니다.

## 플레이 규칙과 플랫폼 각색

기본 이동으로 방향을 잡고 평소의 Roblox 점프로 뜁니다. 착지 후 잠깐 안정되면 힘이 자동으로 차오릅니다. 충전 시간을 기다리면 더 높이 도약할 수 있습니다. 원작의 버튼 홀드/해제를 **착지 후 자동 충전→기본 점프로 소비**로 바꿨으며 별도의 Jump/Run/Grab 버튼, 고정 키 안내, 커스텀 카메라는 없습니다. 기본 점프 상태를 끄지 않으며 JumpPower는 항상 52–76의 양수입니다. 서버는 힘만 미리 설정하고 기본 점프에 추가 impulse를 주지 않습니다.

사다리는 실제 TrussPart이며 Humanoid의 기본 Climbing으로 오릅니다. 등반 체력이 소진되면 떨어지고 잠시 사다리 재진입이 막힙니다. 지면에서 체력이 회복됩니다. 사다리에서 기본 점프로 이탈할 수 있으며 별도의 잡기 조작이 없습니다. 충전과 체력 피드백은 클릭할 수 없는 작은 상단 패널에만 표시합니다. 기본 터치 스틱/점프 버튼과 카메라 영역을 대체하지 않습니다.

| 구역 | 공간과 읽을 동선 |
|---|---|
| 도시 광장 | 상가·가로등·정원·도로가 있는 출발 공간에서 낮은 건물 지붕으로 |
| 외벽 골목 | 좁아진 테라스, 배수관과 서비스 사다리를 따라 상승 |
| 주거 옥상 | 넓은 지붕, 물탱크·환기 설비와 후면 난간 사이로 |
| 마천루 | 깊게 내려가는 외벽·창문 띠, 첨탑과 옥상 외곽 |
| 공사장 | 비계 기둥·목재 데크·크레인과 열린 하부 |
| 성층권 | 공중 통신 구조·태양전지·서비스 트러스 |
| 블랙홀 | 궤도 관측 구조와 빛의 고리 앞 마지막 관측 데크 |

7구역의 경로는 42개 상승 전이이며 원작 좌표/개수를 복제하지 않은 축약 코스입니다. 최종 착지면의 높이는 약 274 studs입니다. 지붕은 5–9 studs 단위로 높아지며, 계산상 24전이는 기본 힘으로, 나머지 18전이는 충전 후 안전 내부면까지 도달합니다. 이는 중력/점프/걷기 속도와 XML 실제 크기를 사용한 탄도 검사 결과이며 실제 아바타 충돌·달리기·네트워크 지연을 검증한 결과는 아닙니다. 사다리는 다른 이동 선택지를 제공합니다. 정상 도달 시 완료 피드백이 표시됩니다.

편집 화면에 건물·창·문·계단·배관·난간·물탱크·크레인·우주 구조, Sky/Atmosphere/조명을 포함합니다. Terrain 바닥/물/잔디와 Terrain 하위 Clouds, 장식 충돌 그룹은 **Play 시** 생성합니다. 장식은 충돌·쿼리를 끄며 진행면은 유지합니다. Streaming은 켜져 있고 NativeWorld Model은 Persistent라 추락 시에도 경로를 유지합니다. 전체 월드 복제를 유지하는 대신 규모를 제한한 첫 코스이며 실제 메모리/기기 성능은 미측정입니다.

## 저장과 부활

새 DataStore 이름은 `InfinityStepNative_v1`입니다. 예전 Roblox 저장 형식과 마이그레이션하지 않으며 이전 배포/실판매가 없다는 전제입니다. 현재 위치와 최고 기록을 분리합니다. 서버가 확인한 실제 안정 착지면만 이어하기 대상으로 저장하고, 공중·미등록 바닥·사망 상태는 시작점으로 저장합니다. 최고 기록은 별도 고수위로 합치므로 추락 직전 도달한 최고가 current=0 저장에 묻히지 않습니다. 최고 기록 자체로 무료 정상 복귀를 하지 않습니다. 서버 소유권 토큰, 120초 lease, 증가하는 스냅샷 순서로 이전 서버의 저장을 거부합니다. 정상 종료 시 lease를 해제하며 비정상 종료 시 최대 lease 대기가 생길 수 있습니다. 저장 실패/소유권 충돌은 새 데이터로 덮지 않고 재시도하며 저장 기능을 잠급니다.

추락 중 마지막 안정 착지면으로 돌아갈지 선택합니다. 「그대로 계속하기」를 선택한 동일 추락 회차에는 사망해도 다시 묻지 않습니다. 같은 지붕을 포함해 새 안정 착지를 하면 다음 회차가 됩니다. 사망하면 일반 캐릭터는 출발점으로 돌아오며 부활 선택은 별도로 유지됩니다. 소비할 때 **부활권 차감+대상 기록을 한 트랜잭션으로 예약**한 뒤 이동하고, 대상에 실제 안정 착지했을 때 예약을 완료합니다. 이동 실패/사망/연결 종료가 끼어도 pending 대상은 남아 다음 접속에서 이어서 전달합니다. 응답을 잃은 동일 예약 재시도는 추가 차감하지 않습니다. 영수증 ID 중복은 저장 원장으로 거부합니다.

`PRODUCT_ID=0`으로 실제 판매는 꺼져 있습니다. 구매 창이나 가격도 없고 실영수증은 `NotProcessedYet`입니다. Studio에서만 메모리 저장소에 테스트권 3개를 생성하며 실판매 잔액과 분리됩니다. 서버가 종료되면 Studio 테스트 데이터는 사라집니다. 라이브는 기본 재고 0입니다. 상품 연결 전에는 실제 구매 기능이 없습니다. 영수증 원장은 자동 축약하지 않으며 실판매 연결 전 보관/크기 정책과 실제 서비스 테스트가 별도로 필요합니다.

일반 캐릭터 물리는 Roblox의 클라이언트 네트워크 소유를 따릅니다. 서버는 중복 공중 점프·불가능한 큰 상승 진행·부활 좌표 입력을 제한하지만 경쟁 랭킹용 완전한 물리 치트 방어를 인증한 상태는 아닙니다.

## CLI 검사

```sh
python3 roblox/infinity-step/tools/build.py
python3 roblox/infinity-step/tools/verify.py
/private/tmp/roblox-infinity-step-tools/luau roblox/infinity-step/tests/rules.spec.luau roblox/infinity-step/tests/store.spec.luau
/private/tmp/roblox-infinity-step-tools/luau-analyze roblox/infinity-step/src/shared/Rules.luau roblox/infinity-step/src/server/StoreCore.luau roblox/infinity-step/tests/*.luau
/private/tmp/roblox-infinity-step-tools/luau-compile --null roblox/infinity-step/src/shared/*.luau roblox/infinity-step/src/server/*.luau roblox/infinity-step/src/client/*.luau roblox/infinity-step/tests/*.luau
```

CLI 설치 경로는 현재 머신의 공식 Luau 바이너리입니다. 다른 머신에서는 해당 명령 경로를 설치 위치로 바꿉니다. 빌더만 실행할 때는 Python 3만 필요합니다.

- Rules 41개 검사는 충전/안정 착지/중복 점프 판단/체력/경로/거절 회차/고수위 보존/lease/영수증/예약/재접속 전달을 검사합니다. 이 파일의 transaction helper는 복사 격리된 규칙 모형입니다.
- StoreCore 17개 검사는 **실제로 사용하는 순수 StoreCore.update 함수**에 주입한 DataStore 모양 backend로 pcall 실패, 취소 롤백, UpdateAsync 콜백 재실행, 중복 영수증, 응답 손실 뒤 예약 재시도, 세션 경합/후속 서버 복구를 검사합니다. 엔진 전용 `Store.luau`의 Roblox DataStoreService나 실제 UpdateAsync 요청을 실행한 검사는 아닙니다.
- XML은 실제 roof 크기·충돌·탄도/착지 내부 여유, 7개 소스의 정확한 포함, 기본 입력/카메라 유지, Terrain/Clouds 배치, 자원 예산과 바이트 단위 결정성을 검사합니다. 전체 Luau는 구문 컴파일했고 순수 모듈/테스트는 analyze를 수행합니다. Roblox 엔진 타입 정의가 없는 analyze를 엔진 API 검증으로 보고하지 않습니다.
- 실제 엔진 후속 검사는 [Studio 확인표](../../docs/specs/2026-10-28-roblox-native-rebuild/studio-checks.md)에서 진행합니다. 승인 전 UI 도구는 사용하지 않습니다. **현재 결과물은 코드·로컬 패키지 작성과 CLI 검증 단계이며 플레이 완료 인증이 아닙니다.**
