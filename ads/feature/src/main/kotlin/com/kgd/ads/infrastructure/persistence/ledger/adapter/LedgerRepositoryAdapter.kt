package com.kgd.ads.infrastructure.persistence.ledger.adapter

import com.kgd.ads.application.ledger.port.LedgerPort
import com.kgd.ads.application.ledger.port.LedgerPosting
import com.kgd.ads.domain.ledger.model.LedgerAccountType
import com.kgd.ads.infrastructure.persistence.ledger.entity.LedgerAccountJpaEntity
import com.kgd.ads.infrastructure.persistence.ledger.entity.LedgerEntryJpaEntity
import com.kgd.ads.infrastructure.persistence.ledger.entity.LedgerTransactionJpaEntity
import com.kgd.ads.infrastructure.persistence.ledger.repository.LedgerAccountJpaRepository
import com.kgd.ads.infrastructure.persistence.ledger.repository.LedgerEntryJpaRepository
import com.kgd.ads.infrastructure.persistence.ledger.repository.LedgerTransactionJpaRepository
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Propagation
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDateTime

@Component
class LedgerRepositoryAdapter(
    private val accounts: LedgerAccountJpaRepository,
    private val transactions: LedgerTransactionJpaRepository,
    private val entries: LedgerEntryJpaRepository,
) : LedgerPort {

    override fun openWallet(advertiserId: Long, now: LocalDateTime) {
        accounts.save(LedgerAccountJpaEntity.walletOf(advertiserId, now))
    }

    override fun findWalletAccountId(advertiserId: Long): Long? = accounts.findByAdvertiserId(advertiserId)?.id

    override fun systemAccountId(type: LedgerAccountType): Long =
        accounts.findFirstByTypeAndAdvertiserIdIsNull(type)?.id ?: error("원장 계정 시드 누락: $type")

    override fun balanceOf(accountId: Long): Long =
        accounts.findById(accountId).orElseThrow { IllegalStateException("원장 계정 없음: $accountId") }.balanceMicros

    // MANDATORY — ads 트랜잭션 밖에서 부르면 잠금이 곧바로 풀리고 잔액 갱신이 커밋되지 않는다.
    // 조용히 사라지게 두지 않고 여기서 거절한다.
    @Transactional("adsTransactionManager", propagation = Propagation.MANDATORY)
    override fun post(posting: LedgerPosting): Long {
        val locked = accounts.lockAllByIdOrdered(posting.lines.map { it.accountId }.distinct())
            .associateBy { requireNotNull(it.id) }
        val tx = transactions.save(
            LedgerTransactionJpaEntity(
                type = posting.type,
                idempotencyKey = posting.idempotencyKey,
                actorMemberId = posting.actorMemberId,
                createdAt = posting.at,
            ),
        )
        val txId = requireNotNull(tx.id)
        posting.lines.forEach { line ->
            val account = locked[line.accountId] ?: error("원장 계정 없음: ${line.accountId}")
            account.apply(line.amountMicros, posting.at)
            entries.save(LedgerEntryJpaEntity(transactionId = txId, accountId = line.accountId, amountMicros = line.amountMicros, createdAt = posting.at))
        }
        return txId
    }
}
