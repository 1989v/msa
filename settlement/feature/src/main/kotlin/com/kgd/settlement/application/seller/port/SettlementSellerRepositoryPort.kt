package com.kgd.settlement.application.seller.port

import com.kgd.settlement.domain.seller.model.SettlementSeller

interface SettlementSellerRepositoryPort {
    fun find(sellerId: Long): SettlementSeller?

    /** 회원의 ACTIVE 판매자 — 반려 뒤 재신청으로 한 회원에 판매자 행이 여럿일 수 있다 */
    fun findActiveByMemberId(memberId: String): SettlementSeller?

    fun save(seller: SettlementSeller)
}
