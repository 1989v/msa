package com.kgd.sevensplit.application.exception

/**
 * Phase 1 (백테스트 MVP) 범위 밖의 기능을 호출했을 때 발생하는 예외.
 *
 * ## 적용 대상
 * - 실매매 긴급 청산 (`ExecuteLiquidationUseCase`) — Phase 3 에서 실구현.
 * - 실시간 WebSocket / Telegram 알림 / 실매매 주문 집행 등 Phase 2/3 경로.
 *
 * ## 분류
 * - `RuntimeException` 계열 — `BusinessException` 이 아니라 "미구현" 은 사용자 입력 오류와 구분되어야 한다.
 * - Presentation 레이어가 별도 `501 Not Implemented` 로 매핑할 수 있도록 일반 런타임 예외로 둔다.
 */
class NotImplementedInPhase1Exception(feature: String) :
    RuntimeException("Not implemented in Phase 1: $feature")
