package com.kgd.seller.application.seller.usecase

import com.kgd.seller.domain.seller.model.SettlementCycle

/** 입점 신청 — 로그인 회원 1인 1판매자(ACTIVE·PENDING·SUSPENDED 기준). 수수료율은 승인 때 정한다. */
interface ApplySellerUseCase {
    fun execute(command: Command): SellerView

    data class Command(
        val memberId: String,
        val businessName: String,
        val businessRegistrationNo: String,
        val representativeName: String,
        val bankName: String,
        val accountNumber: String,
        val shippingFee: Long,
        val settlementCycle: SettlementCycle,
    ) {
        override fun toString(): String = "Command(memberId=$memberId, businessName=$businessName)"
    }
}
