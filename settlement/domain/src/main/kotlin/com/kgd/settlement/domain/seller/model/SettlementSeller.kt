package com.kgd.settlement.domain.seller.model

import com.kgd.settlement.domain.statement.model.SettlementCycle
import java.time.Instant

/**
 * `seller.seller.*` 로 유지하는 판매자 읽기 모델 — 정산 주기와 판매자 포털 본인 확인(회원 id · ACTIVE)에 쓴다.
 * 계좌는 싣지 않는다: 모의 지급은 계좌가 필요 없고, 복호화는 seller 도메인의 지급 경로에서만 한다.
 */
data class SettlementSeller(
    val sellerId: Long,
    val memberId: String,
    val status: String,
    val cycle: SettlementCycle,
    val occurredAt: Instant,
) {
    val isActive: Boolean get() = status == ACTIVE

    /** 늦게 도착한 옛 이벤트는 새 상태를 덮지 않는다 */
    fun isNewerThan(other: SettlementSeller?): Boolean = other == null || occurredAt > other.occurredAt

    companion object {
        const val ACTIVE = "ACTIVE"
    }
}
