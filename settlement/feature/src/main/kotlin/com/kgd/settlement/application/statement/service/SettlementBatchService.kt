package com.kgd.settlement.application.statement.service

import com.kgd.common.exception.NotFoundException
import com.kgd.settlement.application.seller.port.SettlementSellerRepositoryPort
import com.kgd.settlement.application.statement.port.PayoutPort
import com.kgd.settlement.application.statement.port.SettlementItemRepositoryPort
import com.kgd.settlement.application.statement.port.StatementRepositoryPort
import com.kgd.settlement.application.statement.usecase.RetryPayoutUseCase
import com.kgd.settlement.application.statement.usecase.RunSettlementBatchUseCase
import com.kgd.settlement.domain.statement.exception.InvalidStatementStateException
import com.kgd.settlement.domain.statement.model.SettlementCycle
import com.kgd.settlement.domain.statement.model.SettlementPeriod
import com.kgd.settlement.domain.statement.model.SettlementStatement
import com.kgd.settlement.domain.statement.model.StatementStatus
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.stereotype.Service
import java.time.Clock

/**
 * 정산 배치(스펙 SR-9). 정산 대상이 남은 판매자마다 주기(주간 월~일 · 월간 달력 월, KST)가 닫힌 가장 최근 기간의 정산서를 만든다.
 * 지급액 > 0 → 모의 송금 → PAID + 지급 거래, ≤ 0 → CARRIED_OVER. 판매자 하나가 실패해도 나머지는 계속한다.
 *
 * 먼저 지난 배치가 확정만 하고 지급을 못 끝낸 정산서(CONFIRMED)를 다시 지급한다 — 송금 참조가 정산서마다 같아 두 번 보내지 않는다.
 */
@Service
class SettlementBatchService(
    private val items: SettlementItemRepositoryPort,
    private val statements: StatementRepositoryPort,
    private val sellers: SettlementSellerRepositoryPort,
    private val tx: StatementTransactionalService,
    private val payout: PayoutPort,
    @Qualifier("settlementClock") private val clock: Clock,
) : RunSettlementBatchUseCase, RetryPayoutUseCase {
    private val log = KotlinLogging.logger {}

    override fun run(): RunSettlementBatchUseCase.BatchResult {
        val now = clock.instant()
        val today = SettlementPeriod.kstDate(now)
        var opened = 0
        var paid = 0
        var carried = 0
        var failed = 0

        statements.findByStatus(StatementStatus.CONFIRMED).forEach { s ->
            runCatching { pay(s) }.onSuccess { paid++ }.onFailure { failed++; log.error(it) { "정산서 ${s.id} 지급 재시도 실패" } }
        }
        items.findPendingSellerIds().forEach { sellerId ->
            runCatching {
                val cycle = sellers.find(sellerId)?.cycle ?: SettlementCycle.DEFAULT
                val period = cycle.lastClosedPeriod(today)
                if (statements.existsBySellerAndPeriodStart(sellerId, period.start)) return@runCatching
                val statement = tx.open(sellerId, period, now) ?: return@runCatching
                opened++
                when (statement.status) {
                    StatementStatus.CONFIRMED -> pay(statement).also { paid++ }
                    StatementStatus.CARRIED_OVER -> carried++
                    else -> Unit
                }
            }.onFailure { failed++; log.error(it) { "판매자 $sellerId 정산 실패" } }
        }
        log.info { "정산 배치 $today: opened=$opened, paid=$paid, carriedOver=$carried, failed=$failed" }
        return RunSettlementBatchUseCase.BatchResult(opened, paid, carried, failed)
    }

    override fun retry(statementId: Long): SettlementStatement {
        val statement = statements.findById(statementId) ?: throw NotFoundException("정산서", statementId)
        if (statement.status != StatementStatus.CONFIRMED) throw InvalidStatementStateException(statement.status, "지급 재시도")
        return pay(statement)
    }

    private fun pay(statement: SettlementStatement): SettlementStatement {
        val id = requireNotNull(statement.id)
        val reference = payout.transfer(statement.sellerId, id, statement.payout)
        return tx.markPaid(id, reference, clock.instant())
    }
}
