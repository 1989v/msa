<!-- source: admin/frontend/src/pages/games/PlatformReleasesPanel.tsx, game/feature/src/main/kotlin/com/kgd/game/presentation/admin/controller/GamePlatformReleaseAdminController.kt, portal-fe/src/pages/games/GamePlatformLinks.tsx -->

# 게임별 Roblox 링크 등록

1. 관리자에서 게임 관리로 들어가 대상 게임을 편집한다.
2. **플랫폼 버전 → Roblox**의 **게임 주소 / 시작 Place ID**에 게시된 게임 페이지 주소나 시작 Place ID를 입력한다.
3. 표시된 정규 주소가 해당 게임인지 확인한다. Universe ID·Creator Hub 관리 주소·본인 인증·초대 주소는 입력 대상이 아니다. 게임 주소의 쿼리/fragment는 제거한 주소를 사용한다.
4. 출시 상태를 **베타** 또는 **정식**으로 지정한다.
5. Roblox에서 일반 사용자가 실제로 접근할 수 있음을 확인하고 접근 범위를 **누구나**로 지정한다. 초대 전용인 동안은 그대로 **초대 전용**을 유지한다.
6. **플랫폼 버전 저장**을 누른다. 아래 웹게임 저장 버튼과 별개다.

웹게임 자체가 공개 상태이며 플랫폼이 베타/정식·누구나이고 ID가 유효하면, 목록 카드에 Roblox 배지가 표시되고 상세의 웹 플레이 아래에 **로블록스 버전으로 즐기기** 링크가 나타난다. 외부 링크는 새 탭에서 열고 웹 플레이 세션을 시작하지 않는다.

초안·중단·초대 전용 또는 주소 미등록이면 링크와 빈 영역이 모두 숨겨진다. 노출을 내리려면 출시 상태를 **중단**으로 저장한다. 잘못 등록한 ID는 초안/중단 상태에서 비울 수 있다.

새 게임을 Roblox로 옮긴 후에도 같은 절차로 추가한다. 게임별 코드 수정이나 웹화면 재배포는 필요하지 않다. Roblox의 연령/지역/계정 제한은 해당 플랫폼에서 적용된다.

현재 인피니티 스탭의 실제 게시 Place ID는 아직 확인되지 않았다. 이번 기능 배포에서 임의 링크나 테스트 ID를 운영 데이터로 등록하지 않는다.
