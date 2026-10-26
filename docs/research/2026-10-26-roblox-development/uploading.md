# Roblox 업로드 방법 — 인피니티 스탭

확인일: 2026-10-26. 메뉴와 공개 자격은 변경될 수 있으므로 [공식 업로드 문서](https://create.roblox.com/docs/production/publishing/publish-games-and-places)를 기준으로 확인한다. **로컬 실행 → 비공개 업로드 → 플랫폼 플레이 확인 → 공개 설정 → 판매 설정** 순서로 진행한다.

## 1. Studio 설치와 로그인

[공식 설치 안내](https://create.roblox.com/docs/studio/setup)에서 macOS용 Studio를 설치하고 본인의 Roblox 계정으로 로그인한다. 이 Mac은 Apple Silicon이므로 arm64 앱을 사용한다. 로그인·추가 인증은 계정 소유자가 직접 완료한다.

로컬 게임 파일: `roblox/infinity-step/dist/InfinityStep.rbxlx`.

Studio의 File → Open from File로 열고 Play를 누른다. 메뉴의 실제 표기는 설치 버전에 따라 달라질 수 있다.

## 2. 먼저 로컬에서 확인

- 시작 위치·캐릭터·발판·HUD가 보이는지 확인한다.
- WASD/스틱 이동과 Space/화면 버튼의 충전 점프를 검사한다.
- 첫 코스를 끝까지 오른다. 아래 발판 착지와 지상 추락을 확인한다.
- 테스트 부활권으로 추락 직전 발판 복귀와 무료 계속하기를 검사한다.
- Output의 오류를 확인하고 작은 가로 화면의 터치 배치도 검사한다.

Studio 모드는 테스트 부활권 3개를 사용한다. 실제 결제나 실제 구매 잔액을 검증하는 모드는 아니다. [현재 실행·검증 안내](../../../roblox/infinity-step/README.md)

## 3. 계정에 최초 업로드

처음 올릴 때는 File → Publish를 선택하고 게임 이름·설명·장르를 입력해 저장한다. 다른 게임으로 잘못 덮어쓰지 않도록 신규 게임과 소유 계정을 확인한다. 최초 업로드와 전체 사용자 공개는 구분한다. 신규 게임의 기본 접근 대상은 제작자와 권한이 있는 협업자다. [최초 업로드 절차](https://create.roblox.com/docs/production/publishing/publish-games-and-places)

설정 초안:

| 항목 | 제안 |
|---|---|
| 이름 | Infinity Step — Prototype |
| 설명 | 힘을 모아 점프하고 도시의 발판을 오르는 등반 게임입니다. 공중에서는 방향을 바꿀 수 없습니다. 떨어져도 무료로 계속할 수 있으며, 부활권을 사용하면 추락 직전 발판으로 돌아갑니다. 현재 첫 코스 테스트 버전입니다. |
| 소유자 | 로그인한 본인 계정 또는 사용자가 지정한 그룹 |
| 초기 접근 | 제작자·권한이 있는 테스트 사용자만 |
| 유료 상품 | 연결 전. 판매 비활성화 |

업로드 후 Universe ID, 시작 Place ID, Creator Hub URL, 게임 URL을 기록한다. 기존 게임 업데이트와 다른 게임으로 복사하는 Publish As를 구분한다.

## 4. 플랫폼에서 비공개 테스트

접근 권한을 부여한 테스트 계정으로 Roblox 앱에서 실행한다. Studio와 다른 실제 서버 저장·재접속·네트워크 지연을 확인한다. 테스트 사용자 초대는 공개 배포와 별도로 설정할 수 있다. [테스터·접근 범위](https://create.roblox.com/docs/production/publishing/publish-games-and-places)

현재 코드는 Studio 밖에서 DataStore를 사용한다. 상품 ID가 0이므로 실제 판매는 꺼져 있으며, Studio의 무료 테스트 부활권이 라이브 잔액으로 복사되지는 않는다. 비공개 테스트에서는 기본 이동과 무료 진행부터 확인하고, 상품은 별도 설정 후 검사한다.

## 5. 전체 공개

공개 전에 콘텐츠 설문과 대상 연령·공개 자격을 확인한다. 현재 공식 문서는 Creator Hub의 Publish settings → Manage Audience에서 접근 범위를 설정하도록 안내한다. 계정 상태와 대상 연령에 따른 조건이 있으므로 화면에 표시된 요건을 확인하고 공개를 결정한다. 요금이나 구독 선택이 나타나면 자동 결제하지 않는다. [공개 및 대상 사용자 설정](https://create.roblox.com/docs/production/publishing/publish-games-and-places)

## 6. 부활권 상품 연결

Creator Hub의 게임에서 Monetization → Developer Products로 이동해 반복 구매 상품을 만든다. 상품은 **부활권 1개 지급**으로 설정하고 사용자가 정한 가격과 상품 ID를 기록한다. [Developer Products 공식 안내](https://create.roblox.com/docs/production/monetization/developer-products)

`roblox/infinity-step/src/server/Main.server.luau`의 상품 ID를 연결한 뒤 place를 재생성하고 검증·업로드한다. 이 변경은 소스와 생성된 place가 함께 반영되어야 한다. 가격 표시는 상품 정보 조회 결과를 사용한다.

별도 테스트로 영수증 지급, 같은 영수증 재시도, 취소, 늦은 지급, 재접속, 사용 중 단절을 확인한다. 구매 완료는 부활권 지급이며, 실제 부활은 별도 선택이다. 실제 결제 테스트와 판매 활성화는 명시적인 승인 후 진행한다.

## 이 세션의 승인 범위

사용자는 처음에 Studio 설치·로그인 화면 확인·게임 파일 열기·Play/오류 확인·업로드 양식 준비에 필요한 화면 조작을 승인했다. 실제 도구가 `Computer Use was not approved to use Roblox Studio`로 접근을 거절했고, 사용자는 이후 **“설치까지만 마무리하고 내가 실행”**을 선택했다. 따라서 설치까지만 완료했으며 이후 화면 조작은 중단했다. 업로드 제출·전체 공개·상품 생성/판매·결제를 수행하지 않았다. 다음 세션의 화면 조작은 새로 범위를 확인해야 한다.

## 이 Mac의 설치 결과

- 설치 경로: `/Applications/RobloxStudio.app`
- 버전: `0.744.0.7441077`, Apple Silicon arm64
- 다운로드: Roblox 공식 `setup.rbxcdn.com`의 앱 패키지. 공식 버전 API로 현재 패키지 식별자를 확인했다.
- 서명: Roblox Corporation, Team ID `2CFABCH843`. 설치 전후 `codesign --verify --deep --strict` 성공(exit 0).
- 앱 설치 용량: 약 1.1 GB.
- 사용자가 직접 실행할 것: Studio 로그인 → `roblox/infinity-step/dist/InfinityStep.rbxlx` 열기 → Play.
- 실제 화면·물리·모바일 조작·결제는 이번 설치 작업에서 검증하지 않았다.
