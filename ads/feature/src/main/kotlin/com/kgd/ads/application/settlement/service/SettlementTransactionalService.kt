package com.kgd.ads.application.settlement.service

import com.kgd.ads.application.ledger.port.LedgerPort
import com.kgd.ads.application.settlement.dto.CampaignHourSpend
import com.kgd.ads.application.settlement.dto.SettlementRecord
import com.kgd.ads.application.settlement.port.SettlementPort
import com.kgd.ads.domain.ledger.model.LedgerAccountType
import com.kgd.ads.domain.ledger.model.LedgerTransaction
import com.kgd.ads.domain.ledger.policy.RevenueSplit
import com.kgd.ads.domain.ledger.policy.SettlementCalculator
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Isolation
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDateTime

/**
 * (캠페인, 시각) 하나의 정산 — 짧은 트랜잭션 하나.
 *
 * 원장 계정(지갑·퍼블리셔 미지급·수수료)을 먼저 잠그고 나서 정산 기록 유무와 청구 누계를 읽는다. 같은 광고주의
 * 정산·충전이 잠금에서 줄을 서므로, 두 정산이 같은 일예산 여유를 함께 쓰지 못한다. READ COMMITTED 라야
 * 잠금을 기다린 뒤의 읽기가 앞 트랜잭션의 커밋을 본다.
 */
@Service
class SettlementTransactionalService(
    private val ledgerPort: LedgerPort,
    private val settlementPort: SettlementPort,
) {
    private val log = KotlinLogging.logger {}

    /** @return 기록한 정산. 이미 정산된 (캠페인, 시각)이면 null */
    @Transactional("adsTransactionManager", isolation = Isolation.READ_COMMITTED)
    fun settle(item: CampaignHourSpend, now: LocalDateTime): SettlementRecord? {
        val wallet = ledgerPort.findWalletAccountId(item.advertiserId) ?: error("지갑 없는 광고주: advertiserId=${item.advertiserId}")
        val publisher = ledgerPort.systemAccountId(LedgerAccountType.PUBLISHER_PAYABLE)
        val network = ledgerPort.systemAccountId(LedgerAccountType.NETWORK_REVENUE)
        val balances = ledgerPort.lockAccounts(listOf(wallet, publisher, network))
        if (settlementPort.exists(item.campaignId, item.hourKst)) return null

        val budget = settlementPort.budgetOf(item.campaignId)
        val dayStart = item.hourKst.toLocalDate().atStartOfDay()
        val charge = SettlementCalculator.charge(
            hourSpendMicros = item.spendMicros,
            dailyBudgetMicros = budget.dailyBudgetMicros,
            chargedTodayMicros = settlementPort.chargedBetween(item.campaignId, dayStart, dayStart.plusDays(1)),
            totalBudgetMicros = budget.totalBudgetMicros,
            chargedTotalMicros = settlementPort.chargedTotal(item.campaignId),
            walletBalanceMicros = balances.getValue(wallet),
        )
        val transactionId = if (charge > 0) {
            ledgerPort.post(
                LedgerTransaction.settlement(
                    campaignId = item.campaignId,
                    hourKst = item.hourKst,
                    walletAccountId = wallet,
                    publisherAccountId = publisher,
                    networkAccountId = network,
                    split = RevenueSplit.of(charge),
                    at = now,
                ),
            )
        } else {
            null
        }
        val record = SettlementRecord(item.campaignId, item.advertiserId, item.hourKst, item.spendMicros, charge, transactionId, now)
        settlementPort.record(record)
        log.info {
            "광고 정산: campaignId=${item.campaignId} hour=${item.hourKst} spendMicros=${item.spendMicros} " +
                "chargedMicros=$charge txId=$transactionId"
        }
        return record
    }
}
