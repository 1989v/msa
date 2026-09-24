package com.kgd.settlement.application.statement.service

import com.kgd.common.exception.ForbiddenException
import com.kgd.common.exception.NotFoundException
import com.kgd.settlement.application.seller.port.SettlementSellerRepositoryPort
import com.kgd.settlement.application.statement.port.StatementRepositoryPort
import com.kgd.settlement.application.statement.usecase.GetStatementsUseCase
import com.kgd.settlement.domain.statement.model.SettlementStatement
import com.kgd.settlement.domain.statement.model.StatementStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/** 정산서 조회. 판매자는 매 요청 회원 id → ACTIVE 판매자 행으로 본인을 정한다(정지 즉시 차단, 토큰 만료를 기다리지 않음) */
@Service
class StatementQueryService(
    private val statements: StatementRepositoryPort,
    private val sellers: SettlementSellerRepositoryPort,
) : GetStatementsUseCase {

    @Transactional("settlementTransactionManager", readOnly = true)
    override fun forSeller(memberId: String): List<SettlementStatement> = statements.findBySeller(activeSellerId(memberId))

    @Transactional("settlementTransactionManager", readOnly = true)
    override fun forSellerDetail(memberId: String, statementId: Long): SettlementStatement {
        val sellerId = activeSellerId(memberId)
        return statements.findById(statementId)?.takeIf { it.sellerId == sellerId } ?: throw NotFoundException("정산서", statementId)
    }

    @Transactional("settlementTransactionManager", readOnly = true)
    override fun search(status: StatementStatus?, sellerId: Long?): List<SettlementStatement> = statements.search(status, sellerId, LIST_LIMIT)

    @Transactional("settlementTransactionManager", readOnly = true)
    override fun detail(statementId: Long): SettlementStatement =
        statements.findById(statementId) ?: throw NotFoundException("정산서", statementId)

    private fun activeSellerId(memberId: String): Long =
        sellers.findActiveByMemberId(memberId)?.sellerId ?: throw ForbiddenException("승인된(ACTIVE) 판매자만 정산서를 볼 수 있습니다")

    companion object {
        const val LIST_LIMIT = 200
    }
}
