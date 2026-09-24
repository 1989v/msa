package com.kgd.seller.application.seller.usecase

/**
 * 지급용 정산 계좌 평문 — 계좌 복호화의 **유일한** 경로다. 지급(정산) 배치만 부른다.
 * 화면·어드민 조회는 마스킹 값만 쓰고 이 유스케이스를 쓰지 않는다.
 */
interface RevealPayoutAccountUseCase {
    fun execute(sellerId: Long): PayoutAccount

    data class PayoutAccount(val sellerId: Long, val bankName: String, val accountNumber: String) {
        override fun toString(): String = "PayoutAccount(sellerId=$sellerId, bankName=$bankName)"
    }
}
