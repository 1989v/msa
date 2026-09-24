package com.kgd.settlement.application.statement.port

import com.kgd.settlement.domain.statement.model.SettlementItem
import com.kgd.settlement.domain.statement.model.SettlementStatement
import com.kgd.settlement.domain.statement.model.StatementStatus
import java.time.Instant
import java.time.LocalDate

/** 정산 대상 항목(구매 확정 라인·배송비). 항목 키는 유니크 — 같은 확정 이벤트가 두 번 와도 한 건 */
interface SettlementItemRepositoryPort {
    fun existsByKey(key: String): Boolean

    fun save(item: SettlementItem)

    /** 아직 어느 정산서에도 들어가지 않은 이 판매자의 항목 중 [before] 전에 확정된 것 */
    fun findPending(sellerId: Long, before: Instant): List<SettlementItem>

    fun findPendingSellerIds(): List<Long>

    /** 항목을 정산서에 묶는다. 이미 묶인 항목이 있으면(동시 배치) 예외 — 트랜잭션째 되돌린다 */
    fun assign(keys: Collection<String>, statementId: Long)
}

/** 환불된 라인·배송비 키 — 정산서에서 거른다 */
interface RefundedItemRepositoryPort {
    /** 이미 있는 키는 건너뛴다(멱등) */
    fun markRefunded(keys: Collection<String>, claimId: Long, at: Instant)

    fun findRefundedKeys(keys: Collection<String>): Set<String>
}

interface StatementRepositoryPort {
    /** 새 정산서는 줄까지 저장하고, 있는 정산서는 상태·시각만 갱신한다(줄은 감사 기록이라 바꾸지 않는다) */
    fun save(statement: SettlementStatement): SettlementStatement

    fun findById(id: Long): SettlementStatement?

    fun existsBySellerAndPeriodStart(sellerId: Long, periodStart: LocalDate): Boolean

    fun findByStatus(status: StatementStatus): List<SettlementStatement>

    fun findBySeller(sellerId: Long): List<SettlementStatement>

    /** 어드민 목록 — 최근 것부터 [limit] 건 */
    fun search(status: StatementStatus?, sellerId: Long?, limit: Int): List<SettlementStatement>
}

/** 판매자 송금. 모의 구현은 계좌 없이 판매자 id 로 송금 기록만 남긴다. 같은 정산서는 같은 참조를 돌려준다(멱등) */
interface PayoutPort {
    fun transfer(sellerId: Long, statementId: Long, amount: Long): String
}
