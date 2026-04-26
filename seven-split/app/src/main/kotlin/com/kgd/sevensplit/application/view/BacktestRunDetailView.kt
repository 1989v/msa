package com.kgd.sevensplit.application.view

/**
 * BacktestRunDetailView — 백테스트 실행 상세 (목록 + 슬롯 + 주문).
 *
 * Phase 1 대시보드 상세 조회에서 사용. 이벤트 타임라인은 별도 endpoint 로 분리할 수 있도록
 * 여기에는 포함하지 않는다 (필요 시 `BacktestRunResultView` 참조).
 */
data class BacktestRunDetailView(
    val summary: BacktestRunSummaryView,
    val slots: List<SlotView>,
    val orders: List<OrderView>
)
