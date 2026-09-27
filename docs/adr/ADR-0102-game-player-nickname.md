<!-- source: game/domain/src/main/kotlin/com/kgd/game/domain/profile/model/GameNickname.kt, game/feature/src/main/kotlin/com/kgd/game/application/profile/service/GamePlayerProfileService.kt, game/feature/src/main/kotlin/com/kgd/game/infrastructure/persistence/play/adapter/GameScoreRepositoryAdapter.kt, gateway/src/main/kotlin/com/kgd/gateway/filter/AuthenticationGatewayFilter.kt, portal-fe/src/game-profile/GameProfileHost.tsx -->

# ADR-0102: 게임 계정의 전역 고유 닉네임

- 상태: 수용 (2026-09-27 사용자 요청 및 게스트 계정 선택)
- 관련: ADR-0059, ADR-0084, ADR-0087

## 문제
랭킹 소유권이 요청 nickname에 묶여 있어 타인이 같은 이름으로 기록을 갱신할 수 있고 회원별 단일 이름이 보장되지 않는다.

## 결정
게임 DB가 UUID player profile을 소유한다. member_id 또는 서버 발급 guest token hash 중 하나로 인증하며 nickname 정규화 key를 DB UNIQUE로 강제한다. guest token은 HttpOnly host-only SameSite=Lax cookie, DB에는 hash만 저장한다. 로그인 계정이 아직 프로필이 없으면 명시 저장에서 guest profile을 원자적으로 귀속할 수 있다.

기존 두 점수 표는 소유권을 증명하지 못하므로 읽기 전용 legacy로 보존한다. 신규 두 점수 표는 game/track/board/player(+daily date) 유일 키를 쓴다. 공개 조회는 legacy와 함께 제공하되 구분하고 내 기록은 UUID로 판단한다. 현재 닉네임은 profile에서 조회한다. member 서비스 DB를 공유하지 않는다.

프로필과 점수 라우트는 게스트를 허용하되 제공된 회원 인증 실패를 익명으로 바꾸지 않는다. 해당 라우트에서 기존 Bearer와 portal_access_token cookie를 동일 JWT/blacklist 검증으로 처리하고 쓰기 Origin을 확인한다. 전역 JWT 인증 전환은 범위 밖이다.

## 결과
게스트는 쿠키를 지우면 기존 계정 소유권을 잃는다. UI가 이를 안내한다. 다른 기기 동기화는 로그인 후 가능하다. 과거 기록은 삭제하거나 임의 승계하지 않는다. ADR-0084의 점수 진위 신뢰 모델은 유지되며 본 결정은 계정 소유권만 바꾼다.

## 검증
세부 수용 기준·테스트는 ../specs/2026-09-27-game-nickname/spec.md 참조. 운영 migration/배포는 별도 승인 후 수행한다.

동시성 검증에서 MySQL REPEATABLE_READ의 잠금 전 snapshot 문제가 재현되어, 프로필/점수 쓰기는 READ_COMMITTED와 프로필 행 잠금을 함께 사용한다.
