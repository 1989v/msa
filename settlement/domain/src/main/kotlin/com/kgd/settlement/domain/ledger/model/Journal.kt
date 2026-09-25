package com.kgd.settlement.domain.ledger.model

import com.kgd.settlement.domain.ledger.exception.InvalidJournalException
import com.kgd.settlement.domain.ledger.exception.UnbalancedJournalException
import java.time.Instant

/** 분개 한 줄. 금액은 양수만 — 0원 줄은 분개 규칙이 만들지 않는다. 판매자 미지급금만 판매자 id 를 갖는다 */
data class JournalEntry(
    val account: Account,
    val side: EntrySide,
    val amount: Long,
    val sellerId: Long? = null,
) {
    init {
        if (amount <= 0) throw InvalidJournalException("분개 금액은 양수여야 합니다: $account $side $amount")
        if ((account == Account.SELLER_PAYABLE) != (sellerId != null)) {
            throw InvalidJournalException("판매자 미지급금만 판매자 id 를 갖는다: $account sellerId=$sellerId")
        }
    }

    fun reversed(): JournalEntry = copy(side = side.opposite())

    companion object {
        fun debit(account: Account, amount: Long, sellerId: Long? = null) = JournalEntry(account, EntrySide.DEBIT, amount, sellerId)
        fun credit(account: Account, amount: Long, sellerId: Long? = null) = JournalEntry(account, EntrySide.CREDIT, amount, sellerId)
    }
}

/**
 * 원장 거래 한 건. **차변 합 = 대변 합** 을 생성 시점에 강제한다 — 맞지 않는 거래는 객체로 존재할 수 없다.
 * 수정·삭제 메서드가 없다. 정정은 [reverse] 가 만드는 역분개 거래로만 한다.
 *
 * [sourceKey] 는 원천(주문·클레임·대사·정산서)의 자연 키다 — 같은 원천은 원장에 한 번만 들어간다.
 * 원천 이벤트 id([sourceEventId])는 추적용으로 함께 남긴다. 사람이 만든 거래(역분개)는 [actorId]·[reason] 을 갖는다.
 */
class Journal private constructor(
    val id: Long?,
    val type: JournalType,
    val sourceKey: String,
    val sourceEventId: String?,
    val orderId: Long?,
    val reversalOf: Long?,
    val occurredAt: Instant,
    val entries: List<JournalEntry>,
    val actorId: String?,
    val reason: String?,
) {
    val debitTotal: Long get() = entries.filter { it.side == EntrySide.DEBIT }.sumOf { it.amount }
    val creditTotal: Long get() = entries.filter { it.side == EntrySide.CREDIT }.sumOf { it.amount }

    /** 이 거래가 계정(과 판매자)에 남긴 순액 — 차변 +, 대변 − */
    fun netOf(account: Account, sellerId: Long? = null): Long =
        entries.filter { it.account == account && (sellerId == null || it.sellerId == sellerId) }
            .sumOf { if (it.side == EntrySide.DEBIT) it.amount else -it.amount }

    /**
     * 역분개 — 차·대를 뒤집은 새 거래. 원 거래는 그대로 남는다. 원천 키가 원 거래 id 에서 나와([reversalKey]) 한 거래는 한 번만 역분개된다.
     * 누가 왜 했는지([actorId]·[reason])를 거래에 남긴다.
     */
    fun reverse(actorId: String, reason: String, at: Instant): Journal {
        val originalId = id ?: throw InvalidJournalException("저장되지 않은 거래는 역분개할 수 없습니다: ${this.sourceKey}")
        if (type == JournalType.REVERSAL) throw InvalidJournalException("역분개 거래를 다시 역분개하지 않는다 — 원 거래를 새로 기록한다")
        if (actorId.isBlank()) throw InvalidJournalException("역분개 행위자가 비었다")
        if (reason.isBlank()) throw InvalidJournalException("역분개 사유를 적어 주세요")
        return record(
            JournalType.REVERSAL, reversalKey(originalId), null, orderId, at, entries.map(JournalEntry::reversed),
            reversalOf = originalId, actorId = actorId, reason = reason.trim(),
        )
    }

    fun withId(id: Long): Journal = Journal(id, type, sourceKey, sourceEventId, orderId, reversalOf, occurredAt, entries, actorId, reason)

    companion object {
        /** 원 거래 [journalId] 의 역분개 원천 키 — 유니크라 같은 거래의 역분개가 둘 생기지 않는다 */
        fun reversalKey(journalId: Long): String = "reversal:journal:$journalId"

        fun record(
            type: JournalType,
            sourceKey: String,
            sourceEventId: String?,
            orderId: Long?,
            occurredAt: Instant,
            entries: List<JournalEntry>,
            reversalOf: Long? = null,
            actorId: String? = null,
            reason: String? = null,
        ): Journal {
            if (sourceKey.isBlank()) throw InvalidJournalException("원천 키가 비었다")
            if (entries.none { it.side == EntrySide.DEBIT } || entries.none { it.side == EntrySide.CREDIT }) {
                throw InvalidJournalException("거래에는 차변과 대변이 모두 있어야 합니다: $sourceKey")
            }
            val journal = Journal(null, type, sourceKey, sourceEventId, orderId, reversalOf, occurredAt, entries.toList(), actorId, reason)
            if (journal.debitTotal != journal.creditTotal) {
                throw UnbalancedJournalException(journal.debitTotal, journal.creditTotal, sourceKey)
            }
            return journal
        }

        /** 저장소 복원 — 저장된 거래도 차·대 균형을 다시 확인한다(DB 를 손으로 고친 행이 조용히 섞이지 않게) */
        fun restore(
            id: Long,
            type: JournalType,
            sourceKey: String,
            sourceEventId: String?,
            orderId: Long?,
            reversalOf: Long?,
            occurredAt: Instant,
            entries: List<JournalEntry>,
            actorId: String? = null,
            reason: String? = null,
        ): Journal = record(type, sourceKey, sourceEventId, orderId, occurredAt, entries, reversalOf, actorId, reason).withId(id)
    }
}
