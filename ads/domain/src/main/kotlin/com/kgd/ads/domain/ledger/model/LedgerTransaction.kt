package com.kgd.ads.domain.ledger.model

import com.kgd.ads.domain.ledger.policy.RevenueSplit
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter

/**
 * 원장 거래. **분개 합이 0 이 아닌 거래는 만들 수 없다** — 생성자를 닫고 모든 팩토리가 같은 검사를 거친다.
 *
 * - `TOPUP`: 충전 원천 → 지갑
 * - `SETTLEMENT`: 지갑 → 퍼블리셔 미지급 + 네트워크 수수료
 * - `REVERSAL`: `SETTLEMENT` 하나를 전액, 부호만 바꿔 되돌린다. 지갑이 늘기만 하므로 음수 불가와 부딪히지 않는다
 */
class LedgerTransaction private constructor(
    val id: Long?,
    val type: LedgerTransactionType,
    val idempotencyKey: String,
    val entries: List<LedgerEntry>,
    val reversedTransactionId: Long?,
    val actorMemberId: Long?,
    val createdAt: LocalDateTime,
) {
    init {
        require(idempotencyKey.isNotBlank() && idempotencyKey.length <= MAX_IDEMPOTENCY_KEY_LENGTH) {
            "멱등 키는 1~${MAX_IDEMPOTENCY_KEY_LENGTH}자여야 합니다"
        }
        require(entries.size >= 2) { "분개는 두 줄 이상이어야 합니다" }
        require(entries.sumOf { it.amountMicros } == 0L) { "분개 합이 0 이 아닙니다: $entries" }
        require((type == LedgerTransactionType.REVERSAL) == (reversedTransactionId != null)) {
            "원 거래 참조는 REVERSAL 에만 있습니다"
        }
    }

    companion object {
        const val MAX_IDEMPOTENCY_KEY_LENGTH = 128
        private val HOUR_KEY: DateTimeFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH")

        /** 정산 멱등 키 — (캠페인, KST 시각)당 하나. 재실행이 같은 키를 만들어 두 번 청구되지 않는다. */
        fun settlementKey(campaignId: Long, hourKst: LocalDateTime): String = "SETTLE:$campaignId:${hourKst.format(HOUR_KEY)}"

        fun topUp(
            idempotencyKey: String,
            sourceAccountId: Long,
            walletAccountId: Long,
            amountMicros: Long,
            actorMemberId: Long,
            at: LocalDateTime,
        ): LedgerTransaction {
            require(amountMicros > 0) { "충전액은 0 보다 커야 합니다" }
            return LedgerTransaction(
                id = null,
                type = LedgerTransactionType.TOPUP,
                idempotencyKey = idempotencyKey,
                entries = listOf(LedgerEntry(sourceAccountId, -amountMicros), LedgerEntry(walletAccountId, amountMicros)),
                reversedTransactionId = null,
                actorMemberId = actorMemberId,
                createdAt = at,
            )
        }

        /** 한 (캠페인, 시각)의 청구. 몫이 0 인 쪽은 분개를 만들지 않는다(청구 1 마이크로면 퍼블리셔 몫 0). */
        fun settlement(
            campaignId: Long,
            hourKst: LocalDateTime,
            walletAccountId: Long,
            publisherAccountId: Long,
            networkAccountId: Long,
            split: RevenueSplit,
            at: LocalDateTime,
        ): LedgerTransaction {
            require(split.chargeMicros > 0) { "청구액 0 은 거래를 만들지 않습니다" }
            val entries = buildList {
                add(LedgerEntry(walletAccountId, -split.chargeMicros))
                if (split.publisherShareMicros != 0L) add(LedgerEntry(publisherAccountId, split.publisherShareMicros))
                if (split.networkFeeMicros != 0L) add(LedgerEntry(networkAccountId, split.networkFeeMicros))
            }
            return LedgerTransaction(
                id = null,
                type = LedgerTransactionType.SETTLEMENT,
                idempotencyKey = settlementKey(campaignId, hourKst),
                entries = entries,
                reversedTransactionId = null,
                actorMemberId = null,
                createdAt = at,
            )
        }

        fun reversalOf(original: LedgerTransaction, actorMemberId: Long, at: LocalDateTime): LedgerTransaction {
            require(original.type == LedgerTransactionType.SETTLEMENT) { "역분개는 SETTLEMENT 만 됩니다: ${original.type}" }
            val originalId = requireNotNull(original.id) { "저장되지 않은 거래는 역분개할 수 없습니다" }
            return LedgerTransaction(
                id = null,
                type = LedgerTransactionType.REVERSAL,
                idempotencyKey = "REVERSE:$originalId",
                entries = original.entries.map { LedgerEntry(it.accountId, -it.amountMicros) },
                reversedTransactionId = originalId,
                actorMemberId = actorMemberId,
                createdAt = at,
            )
        }

        fun restore(
            id: Long,
            type: LedgerTransactionType,
            idempotencyKey: String,
            entries: List<LedgerEntry>,
            reversedTransactionId: Long?,
            actorMemberId: Long?,
            createdAt: LocalDateTime,
        ): LedgerTransaction = LedgerTransaction(id, type, idempotencyKey, entries, reversedTransactionId, actorMemberId, createdAt)
    }
}
