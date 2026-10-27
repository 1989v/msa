# Roblox 개발과 기존 게임 이식

확인일: 2026-10-26. 이 문서는 개발 참고 자료이며, 현재 게임의 실행 절차는 [인피니티 스탭 프로젝트](../../../roblox/infinity-step/README.md), 확정 요구사항은 [첫 구현 명세](../../specs/2026-10-26-roblox-infinity-step/spec.md)가 정본이다. 다른 게임에 사용할 [이식 프롬프트](porting-prompt.md)도 함께 제공한다.

Studio 설치 이후 계정에 올리는 순서는 [업로드 방법](uploading.md)에 정리했다.

## 1. 무엇을 옮기는가

기존 HTML/JavaScript/Unity 게임은 규칙·수치·콘텐츠를 분석한 뒤 Roblox 환경에 맞게 구현한다. 이번 프로젝트는 원작의 5단 충전 점프와 추락 비용을 보존하고, 사용자 요청에 따라 마지막 발판으로 돌아가는 유료 부활권을 추가한다. 원작의 빌드 파일을 Roblox 실행 파일로 단순 변환하는 작업은 아니다.

Roblox Studio는 월드 편집·스크립트·테스트를 다루는 개발 도구이고, 스크립트 언어는 Lua 5.1에서 파생된 Luau다. Luau에는 점진적 타입 기능이 있다. [Luau 공식 문서](https://create.roblox.com/docs/luau)

Roblox에서 경험(experience)은 플레이어에게 제공하는 게임 단위이며 여러 place를 포함할 수 있다. 첫 인피니티 스탭은 작은 코스 하나를 담는 place부터 구성한다. [프로젝트 개요](https://create.roblox.com/docs/projects)

## 2. 코드와 월드를 어디에 두는가

Roblox는 서비스별 용도가 정해진 데이터 모델을 사용한다. 파일 이름만으로 실행 위치를 결정하지 말고, 스크립트 종류와 실제 배치를 함께 확인한다. [데이터 모델](https://create.roblox.com/docs/projects/data-model), [스크립트 종류와 위치](https://create.roblox.com/docs/scripting/locations)

| 위치 | 역할 | 인피니티 스탭 예 |
|---|---|---|
| Workspace | 화면에 보이는 3D 월드와 물리 객체 | 발판, 건물, 시작점, 도착점 |
| Lighting | 조명과 환경 설정 | 도시 코스의 분위기와 가시성 |
| ReplicatedStorage | 서버와 클라이언트가 공유할 객체 | 공유 설정, 점프 정의, RemoteEvent |
| ServerScriptService | 서버 전용 Script/ModuleScript | 진행 판정, 부활권 저장, 영수증 처리 |
| ServerStorage | 클라이언트에 복제하지 않을 리소스 | 서버 전용 템플릿이 필요할 때 |
| StarterPlayerScripts | 입장 시 시작되는 플레이어 클라이언트 코드 | 입력과 카메라, HUD 연결 |
| StarterGui | 플레이어 UI의 시작 구성 | 높이·충전 표시, 부활 선택 화면 |

공유 저장소에 있는 코드는 플레이어에게 복제될 수 있다. 비밀 키나 서버 전용 결제 처리를 공유 모듈에 섞지 않는다. [접근 제어와 복제](https://create.roblox.com/docs/scripting/security/access-control)

## 3. 클라이언트와 서버의 역할

이 프로젝트에서는 클라이언트가 이동 방향·점프 누름·버튼 선택을 전달하고, 서버가 유효한 점프인지, 어느 발판에 착지했는지, 부활권을 쓸 수 있는지를 판단한다. HUD는 서버가 확인한 보유량과 복귀 대상을 표시한다.

RemoteEvent는 응답을 기다리지 않는 단방향 통신에 사용한다. 요청을 받았다는 이유만으로 실행하지 말고 타입·수치 범위·현재 상태·빈도를 검증한다. 예를 들어 클라이언트는 “부활 사용”을 요청할 수 있지만 임의의 복귀 좌표나 부활권 개수를 지정할 수 없다. 서버 쪽 제한도 필요하다. [RemoteEvent](https://create.roblox.com/docs/scripting/events/remote), [클라이언트와 서버 경계 보호](https://create.roblox.com/docs/scripting/security/client-server-boundary)

캐릭터 물리에는 네트워크 소유권도 영향을 준다. “서버에서 요청 검증”과 “모든 물리 치트 방어 완료”는 별도 검증 항목으로 취급한다. 이 첫 구현은 경쟁 랭킹용 치트 방어를 인증한 상태가 아니다. [서버 감지의 역할](https://create.roblox.com/docs/scripting/security/server-side-detection)

## 4. 원작의 조작감을 옮기는 순서

다음은 이 저장소에서 적용하는 이식 절차다.

1. 원작의 실제 이동·중력·차지 상수를 읽는다. 옛 기획 설명과 현재 코드가 다른지 확인한다.
2. 원작 단위를 studs와 초 기준으로 환산한다. 중력과 속도를 함께 맞춘다.
3. 같은 상수를 이동과 코스 도달 가능성 검사에서 사용한다.
4. PC 입력으로 점프·착지·추락을 먼저 확인한다.
5. 터치 스틱과 누르고 놓는 버튼으로 같은 행동을 구현한다.
6. 짧은 코스를 Studio에서 직접 플레이하고, 충돌·지연·시야·터치 난도를 조정한다.

사용자의 2026-10-28 정정에 따라, 인피니티 스탭은 충전 등반·매달림·벽 등반·스태미나·추락과 재도전, 도시에서 블랙홀까지의 구간 구성과 이어하기라는 아이디어를 유지한다. 맵 배치·발판 수·높이는 로블록스 기본 부품과 물리·성능·조작에 맞게 재구성한다. 원본 좌표나 개수의 일치는 목표가 아니다. 전역 랭킹·날짜별 새 맵·무한 확장 등 실제 지원 여부는 현재 [프로젝트 README](../../../roblox/infinity-step/README.md)를 기준으로 확인한다. 부활권 복귀 위치는 사용자가 선택한 **추락 직전 마지막 발판**이며, 구역 입구로 대체하지 않는다.

## 5. 저장과 결제

DataStore는 서버에서 유지할 플레이어 데이터에 사용한다. 여러 서버에서 같은 키를 갱신할 수 있는 상황에서는 `UpdateAsync`로 최신 값을 바탕으로 변경하고, 실패를 처리한다. 갱신 콜백 안에서는 대기하는 작업을 실행할 수 없다. [DataStore 공식 문서](https://create.roblox.com/docs/cloud-services/data-stores)

반복 구매하는 소모품은 Developer Product가 맞는다. 이번 부활권은 구매 시 인벤토리 1개를 받고, 추락 뒤 사용을 선택하면 1개를 소비하는 상품이다. 서버의 `ProcessReceipt`로 지급하며, 클라이언트의 구매창 종료 알림을 지급 근거로 쓰지 않는다. [Developer Products](https://create.roblox.com/docs/production/monetization/developer-products)

인벤토리는 다음 네 상태를 분리한다.

| 상태 | 처리 |
|---|---|
| 결제 영수증 도착 | 영수증 ID를 확인해 한 번만 지급 |
| 추락 후 선택 제시 | 보유량과 복귀 발판 표시, 아직 차감하지 않음 |
| 사용 예약 | 잔액 차감과 전달 대기 기록을 한 원자적 갱신에 저장 |
| 안전한 복귀 완료 | 해당 전달 기록을 확인 후 정리 |

접속 종료·재시도·여러 서버의 경쟁으로 같은 영수증을 두 번 지급하거나 이미 차감한 부활을 잃지 않게 해야 한다. 구매 저장의 원자성과 동시 세션 처리 배경은 [플레이어 데이터와 구매 시스템](https://create.roblox.com/docs/cloud-services/data-stores/player-data-purchasing)을 참고한다. 이 문서의 샘플 코드도 프로젝트 검증 없이 그대로 운영에 사용하지 않는다.

상품 가격은 실제 상품 정보를 조회해 표시한다. 지역별 가격 설정을 사용하면 플레이어에게 보이는 가격이 달라질 수 있으므로 임의 숫자를 UI에 고정하지 않는다. [가격과 지역 설정](https://create.roblox.com/docs/production/monetization/regional-pricing)

현재 첫 구현은 상품 ID·가격·실제 판매를 연결하기 전의 단계다. Studio 테스트용 부활권과 실판매 잔액은 구분하며, 가격이 정해졌다고 가정하지 않는다.

## 6. 소스 관리와 결과물

현재 프로젝트는 편집 가능한 Luau와 재현 가능한 place 생성 경로를 함께 제공한다. `.rbxlx`는 Studio에서 열 대상이고, 검증과 재생성 방법은 게임 README에 둔다. 원작은 그대로 보존한다.

외부 에디터를 사용할 때 공식 Script Sync는 Studio와 디스크의 스크립트를 동기화한다. 코드 외 전체 프로젝트 구조까지 파일 기준으로 관리하려면 Rojo 같은 도구도 선택지다. Script Sync는 일반 월드 객체 전체를 동기화하는 기능이 아니므로 원본 관리 범위를 구분한다. [Script Sync](https://create.roblox.com/docs/scripting/sync), [외부 도구](https://create.roblox.com/docs/projects/external-tools)

## 7. 무엇을 검증했는지 구분하기

| 검사 | 알 수 있는 것 | 별도로 확인할 것 |
|---|---|---|
| Luau 단위·컴포넌트 테스트 | 규칙·상태 전이·저장 실패 처리 | 엔진 물리와 실제 Roblox 서비스 |
| Luau 구문 컴파일 | 스크립트 파싱과 컴파일 가능 여부 | Roblox API 호출의 실제 실행 성공 |
| XML·패키징 검사 | 파일 구조·소스 포함·재생성 일치 | Studio에서 열린 화면과 플레이 |
| Studio 클라이언트/서버 테스트 | 실제 캐릭터·충돌·통신 동작 | 실제 기기 체감과 운영 환경 |
| Device Simulator·기기 플레이 | 화면 크기·입력·버튼 배치 | 실제 기기의 성능·지연 |
| 별도 상품 테스트 | 실제 영수증·저장·재접속 복구 | 공개 전 설정과 운영 모니터링 |

Studio는 클라이언트와 서버 시뮬레이션을 구분해 검사할 수 있고, Device Simulator는 화면과 입력을 확인하는 데 사용한다. 단위 테스트 통과만으로 모바일 게임이 잘 된다고 결론 내리지 않는다. [Studio 테스트 모드](https://create.roblox.com/docs/studio/testing-modes), [Device Simulator](https://create.roblox.com/docs/studio/device-simulator)

이 저장소에서는 Studio·브라우저 등 computer use 전에 앱·목적·행동·상태 변경·완료 조건에 대한 명시 승인이 필요하다. 파일 생성이나 CLI 검증이 이 승인에 해당하지는 않는다.

## 8. 첫 게임의 다음 단계

로컬 실행 파일은 `roblox/infinity-step/dist/InfinityStep.rbxlx`다. Studio의 File → Open from File로 연 뒤 Play를 누른다. WASD 또는 터치 스틱으로 방향을 잡고 Space 또는 화면 점프 버튼을 눌렀다 놓는다. Studio의 부활권은 실제 결제와 분리된 테스트용이다. 자세한 조작과 검증 명령은 [게임 README](../../../roblox/infinity-step/README.md)에 있다.

로컬 결과물을 Studio에서 열어 코스를 직접 플레이한 뒤 조작감을 수정한다. 이후 비공개 테스트용 경험과 상품을 설정하고 저장·영수증을 검증한다. 공개 여부, 경험 소유 계정/그룹, 상품 가격, 상품 ID는 그 단계에서 결정한다. 공개 자격과 설정은 바뀔 수 있으므로 실제 공개 직전에 [공식 프로젝트 문서](https://create.roblox.com/docs/projects)를 다시 확인한다.

다음 게임을 고를 때는 원작의 핵심 루프가 짧은 구간으로 성립하는지, 모바일 입력을 자연스럽게 옮길 수 있는지, 멀티플레이와 저장이 첫날부터 필요한지를 비교한다. 첫 게임에서 만든 프로젝트 구조·테스트 방식은 재사용하되, 등반 게임의 부활 규칙을 다른 장르에 자동으로 적용하지 않는다.
