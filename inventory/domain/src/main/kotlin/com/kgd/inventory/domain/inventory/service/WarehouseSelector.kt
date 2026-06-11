package com.kgd.inventory.domain.inventory.service

import com.kgd.inventory.domain.inventory.model.Inventory

/**
 * 주문 이벤트 기반 재고 예약 시 창고를 자동 선택하는 도메인 정책.
 *
 * 선택 규칙:
 * 1. 요청 수량을 단일 창고에서 전부 충족할 수 있는 창고만 후보로 한다 (분할 출고 미지원).
 * 2. 가용 재고가 가장 많은 창고를 선택한다 — 창고 간 재고 소진 속도를 평준화.
 * 3. 동률이면 낮은 warehouseId 를 선택한다 — 재처리/멀티 인스턴스 환경에서 결정성 보장.
 */
object WarehouseSelector {

    fun select(candidates: List<Inventory>, qty: Int): Inventory? =
        candidates
            .filter { it.getAvailableQty() >= qty }
            .sortedWith(compareByDescending<Inventory> { it.getAvailableQty() }.thenBy { it.warehouseId })
            .firstOrNull()
}
