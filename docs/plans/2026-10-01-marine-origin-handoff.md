# 활잡이 원정 기본판 — 다음 구현 모델에게
**이번 세션은 계획·이미지까지만 완료했다. 사용자가 다음 세션에서 구현 모델을 바꿔 이어갈 예정이다.**

## 먼저 읽을 것
1. 최신 사용자 요구와 root AGENTS.
2. [설계 인덱스](../specs/2026-10-01-marine-origin/README.md)
3. [기능 사양](../specs/2026-10-01-marine-origin/spec.md), [경제·병력](../specs/2026-10-01-marine-origin/planning/gameplay.md), [맵·시야](../specs/2026-10-01-marine-origin/planning/world.md).
4. [플랫폼 계약](../specs/2026-10-01-marine-origin/planning/platform.md), [아트 시안](../specs/2026-10-01-marine-origin/design/README.md), [구현 작업 순서](../specs/2026-10-01-marine-origin/tasks.md).

## 유지할 의도
마린키우기의 사냥 → 목수 고용 → 자동 경제 → 벙커형 거점 → 공방업·증원·3기 합성 → 지역 공략.
활잡이 1기·목수 0기·금화 0으로 시작한다. 좀비·흡혈귀 외형으로 바꾸고 원작의 게임방식을 따른다.
장비 파밍 등 새 성장 시스템은 기본판 검증 뒤 다음 버전에서 추가한다.
일반 캐릭터는 desktop 기본 32 CSS px, 영웅도 같은 체격이다. 확대된 디자인 보드를 실전 크기로 사용하지 않는다.

## 다음 실행 지시
T0 → T1부터 한 그룹씩 구현한다. 이전 프로토타입의 가격·환전·승급 규칙을 복사하지 않는다.
먼저 활잡이·목수·지형·주둔 탑으로 한 구간을 만들고 실제 움직임을 시안과 비교한다. 전체 아트 제작은 그 다음이다.
기존 실행 코드 위치는 portal-fe/public/games/marine-command/ 이다. 이 코드는 이번 요구와 다른 이전 프로토타입이다.
구현 전에 games 서브모듈의 branch/status와 msa의 dirty 상태를 확인한다. 다른 작업이 많으므로 일괄 git add를 하지 않는다.
docs/specs/2026-09-30-marine-command 는 이전 작업 이력이며, 최신 설계는 2026-10-01-marine-origin 폴더다.

## 플랫폼 계약의 핵심
- GameRelay를 사용한다. 전체 봉투 4096자·초당40메시지 제한을 지켜야 한다.
- 호스트 권위와 표시 전용 delta를 분리한다. 복구에는 검증된 완전 checkpoint만 사용한다.
- 새로운 relay seat와 저장된 campaignOwner는 다를 수 있다. 매핑과 controller 권한을 따로 둔다.
- 두 저장 슬롯 전체는 서버 64KiB, 클라이언트 목표 60KiB 이하이다. 서버 저장에는 playable 카탈로그가 필요하다.
- GameAuth/PlatformAdapter를 사용한다. 닉네임은 인증 수단이 아니며 클라우드 저장 실패를 성공으로 표시하면 안 된다.
- 온라인 소유권·중복 명령·호스트 이탈·이어하기는 실제 2개 브라우저로 검증한다.
- 이전 frontline-expedition-v1 저장 키는 그대로 보존하고 새 규칙으로 몰래 변환하지 않는다.

## 남은 확인과 검증
사용자는 **원본 지도 확인 후 맵 구현**을 선택했다. **지도 사이즈·규모는 더 커도 된다**고 명시했다. 근사 재구성 허용 여부를 다시 묻지 말고, 원본의 연결·진행 구조 확인 후 확대 설계한다.
블로그 첨부 SCM의 정상 추출과 96×96 타일 크기는 확인했다. SE 리메이크이며 영상과 동일한 판인지는 미확인이다. [원본 조사 결과](../specs/2026-10-01-marine-origin/planning/original-map-findings.md)를 읽는다. world.md의 기존 임의 좌표·지역 연결은 보류 상태다.
새 시안 4장과 가격·시간·2인 협동은 설계 제안이다. 기존 시안의 미술 톤만 사용자가 명시적으로 승인했다.
PNG는 컨셉 보드이며 런타임용 투명 스프라이트가 아니다. 애니메이션·실제 지형·네트워크는 다음 구현 범위다.
6차원 문서 리뷰는 보완 후 SHIP. 이 판정은 구현·밸런스·브라우저 검증을 통과했다는 뜻이 아니다.
배포·마이그레이션 실행·공개는 별도 승인 후 진행한다. 이번 작업에서는 런타임을 변경하지 않았다.

<!-- source: portal-fe/public/games/marine-command/js/sim.js -->
<!-- source: portal-fe/public/games/lib/relay.js -->
<!-- source: portal-fe/public/games/lib/platform.js -->
