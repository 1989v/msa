package com.kgd.settlement.application

import com.kgd.settlement.application.ledger.port.AccountBalance
import com.kgd.settlement.application.ledger.port.JournalRepositoryPort
import com.kgd.settlement.application.ledger.service.LedgerService
import com.kgd.settlement.application.seller.port.SettlementSellerRepositoryPort
import com.kgd.settlement.application.seller.service.SettlementSellerService
import com.kgd.settlement.application.statement.port.PayoutPort
import com.kgd.settlement.application.statement.port.RefundedItemRepositoryPort
import com.kgd.settlement.application.statement.port.SettlementItemRepositoryPort
import com.kgd.settlement.application.statement.port.StatementRepositoryPort
import com.kgd.settlement.application.statement.service.SettlementBatchService
import com.kgd.settlement.application.statement.service.SettlementItemService
import com.kgd.settlement.application.statement.service.StatementQueryService
import com.kgd.settlement.application.statement.service.StatementTransactionalService
import com.kgd.settlement.domain.ledger.model.Account
import com.kgd.settlement.domain.ledger.model.EntrySide
import com.kgd.settlement.domain.ledger.model.Journal
import com.kgd.settlement.domain.seller.model.SettlementSeller
import com.kgd.settlement.domain.statement.model.SettlementItem
import com.kgd.settlement.domain.statement.model.SettlementStatement
import com.kgd.settlement.domain.statement.model.StatementStatus
import java.time.Clock
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.ZoneOffset

/** 메모리 원장 — 추가만 받는다. 판정은 저장된 거래(도메인 객체)의 분개에서 한다 */
class InMemoryJournals : JournalRepositoryPort {
    val journals = mutableListOf<Journal>()

    override fun existsBySourceKey(sourceKey: String) = journals.any { it.sourceKey == sourceKey }

    override fun findById(id: Long) = journals.firstOrNull { it.id == id }

    override fun findBySourceKey(sourceKey: String) = journals.firstOrNull { it.sourceKey == sourceKey }

    override fun append(journal: Journal): Journal {
        check(!existsBySourceKey(journal.sourceKey)) { "유니크 위반: ${journal.sourceKey}" }
        return journal.withId(journals.size + 1L).also { journals += it }
    }

    override fun sumByAccount(): List<AccountBalance> = journals.flatMap { it.entries }.groupBy { it.account }.map { (a, es) ->
        AccountBalance(a, es.filter { it.side == EntrySide.DEBIT }.sumOf { it.amount }, es.filter { it.side == EntrySide.CREDIT }.sumOf { it.amount })
    }

    override fun sellerPayableBalances(): Map<Long, Long> =
        journals.flatMap { it.entries }.filter { it.account == Account.SELLER_PAYABLE }
            .groupBy { requireNotNull(it.sellerId) }
            .mapValues { (_, es) -> es.sumOf { if (it.side == EntrySide.CREDIT) it.amount else -it.amount } }
}

class InMemoryItems : SettlementItemRepositoryPort {
    val items = linkedMapOf<String, SettlementItem>()
    val assignedTo = mutableMapOf<String, Long>()

    override fun existsByKey(key: String) = key in items
    override fun save(item: SettlementItem) {
        check(item.key !in items) { "유니크 위반: ${item.key}" }
        items[item.key] = item
    }
    override fun findPending(sellerId: Long, before: Instant) =
        items.values.filter { it.sellerId == sellerId && it.confirmedAt < before && it.key !in assignedTo }
    override fun findPendingSellerIds() = items.values.filter { it.key !in assignedTo }.map { it.sellerId }.distinct()
    override fun assign(keys: Collection<String>, statementId: Long) {
        check(keys.none { it in assignedTo }) { "이미 묶인 항목" }
        keys.forEach { assignedTo[it] = statementId }
    }
}

class InMemoryRefunded : RefundedItemRepositoryPort {
    val keys = mutableMapOf<String, Long>()
    override fun markRefunded(keys: Collection<String>, claimId: Long, at: Instant) = keys.forEach { this.keys.putIfAbsent(it, claimId) }
    override fun findRefundedKeys(keys: Collection<String>) = keys.filter { it in this.keys }.toSet()
}

class InMemoryStatements : StatementRepositoryPort {
    val rows = linkedMapOf<Long, SettlementStatement>()

    override fun save(statement: SettlementStatement): SettlementStatement {
        val saved = statement.id?.let { statement } ?: run {
            check(!existsBySellerAndPeriodStart(statement.sellerId, statement.period.start)) { "유니크 위반: 판매자·기간" }
            statement.withId(rows.size + 1L)
        }
        rows[requireNotNull(saved.id)] = saved
        return saved
    }
    override fun findById(id: Long) = rows[id]
    override fun existsBySellerAndPeriodStart(sellerId: Long, periodStart: LocalDate) =
        rows.values.any { it.sellerId == sellerId && it.period.start == periodStart }
    override fun findByStatus(status: StatementStatus) = rows.values.filter { it.status == status }
    override fun findBySeller(sellerId: Long) = rows.values.filter { it.sellerId == sellerId }.reversed()
    override fun search(status: StatementStatus?, sellerId: Long?, limit: Int) =
        rows.values.filter { (status == null || it.status == status) && (sellerId == null || it.sellerId == sellerId) }.reversed().take(limit)
}

class InMemorySellers : SettlementSellerRepositoryPort {
    val rows = mutableMapOf<Long, SettlementSeller>()
    override fun find(sellerId: Long) = rows[sellerId]
    override fun findActiveByMemberId(memberId: String) = rows.values.singleOrNull { it.memberId == memberId && it.isActive }
    override fun save(seller: SettlementSeller) {
        rows[seller.sellerId] = seller
    }
}

/** 모의 송금 — 호출을 기록한다. [failNext] 면 한 번 실패한다(송금 장애) */
class RecordingPayout : PayoutPort {
    val calls = mutableListOf<Triple<Long, Long, Long>>()
    var failNext = false
    override fun transfer(sellerId: Long, statementId: Long, amount: Long): String {
        if (failNext) {
            failNext = false
            error("송금 실패(모의)")
        }
        calls += Triple(sellerId, statementId, amount)
        return "MOCK-PAYOUT-$sellerId-$statementId"
    }
}

class MutableClock(var now: Instant) : Clock() {
    override fun getZone(): ZoneId = ZoneOffset.UTC
    override fun withZone(zone: ZoneId?): Clock = this
    override fun instant(): Instant = now
}

/** 서비스를 실제 조립 그대로 — 포트만 메모리 */
class SettlementHarness(now: Instant) {
    val clock = MutableClock(now)
    val journals = InMemoryJournals()
    val items = InMemoryItems()
    val refunded = InMemoryRefunded()
    val statements = InMemoryStatements()
    val sellers = InMemorySellers()
    val payout = RecordingPayout()

    val ledger = LedgerService(journals, refunded, clock)
    val register = SettlementItemService(items)
    val tx = StatementTransactionalService(items, refunded, statements, journals)
    val batch = SettlementBatchService(items, statements, sellers, tx, payout, clock)
    val queries = StatementQueryService(statements, sellers)
    val sellerSync = SettlementSellerService(sellers)

    /** 판매자 미지급금 잔액 — 원장 거래의 분개에서 */
    fun payableOf(sellerId: Long): Long = -journals.journals.sumOf { it.netOf(Account.SELLER_PAYABLE, sellerId) }
}
