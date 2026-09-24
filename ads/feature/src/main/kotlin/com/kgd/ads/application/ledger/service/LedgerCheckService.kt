package com.kgd.ads.application.ledger.service

import com.kgd.ads.application.ledger.port.LedgerPort
import com.kgd.ads.application.ledger.usecase.CheckLedgerUseCase
import com.kgd.ads.application.settlement.port.SettlementMetricsPort
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.stereotype.Service
import java.time.Clock
import java.time.LocalDateTime

/**
 * 전체 분개 합 검사. 거래는 팩토리가 합 0 을 강제하므로 합이 어긋났다면 누가 DB 를 직접 고쳤거나
 * 분개 저장 경로에 결함이 있는 것이다 — 고치지 않고 알리기만 한다.
 */
@Service
class LedgerCheckService(
    private val ledgerPort: LedgerPort,
    private val metrics: SettlementMetricsPort,
    @Qualifier("adsClock") private val clock: Clock,
) : CheckLedgerUseCase {

    private val log = KotlinLogging.logger {}

    override fun check(): CheckLedgerUseCase.Result {
        val imbalance = ledgerPort.sumAllEntries()
        metrics.recordLedgerImbalance(imbalance)
        if (imbalance != 0L) {
            log.error { "광고 원장 불균형: 전체 분개 합=$imbalance 마이크로 (0 이어야 한다)" }
        } else {
            log.info { "광고 원장 검사: 분개 합 0" }
        }
        return CheckLedgerUseCase.Result(imbalance, LocalDateTime.now(clock))
    }
}
