package com.kgd.settlement.application.seller.usecase

import com.kgd.settlement.domain.seller.model.SettlementSeller

/** `seller.seller.*` → 정산 주기·본인 확인용 판매자 읽기 모델. 옛 이벤트는 새 상태를 덮지 않는다 */
interface SyncSettlementSellerUseCase {
    fun sync(seller: SettlementSeller)
}
