package com.kgd.place.application.market.service

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.place.application.market.port.*
import com.kgd.place.application.market.usecase.*
import com.kgd.place.domain.market.model.*
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class MarketGeometryRequestService(
    private val requests: MarketGeometryRequestPort,
    private val stewards: MarketStewardUseCase,
    private val grants: MarketStewardPort,
    private val markets: MarketEditorPort,
) : MarketGeometryRequestUseCase {
    private val log = KotlinLogging.logger {}

    @Transactional(transactionManager = "placeTransactionManager")
    override fun submit(memberId: Long, marketId: Long, input: MarketGeometryRequestUseCase.Submission): MarketGeometryRequestUseCase.Submitted {
        // First read is a current market lock, shared with suspension; do not cache a grant before acquiring it.
        if (markets.lockMarket(marketId) == null) throw BusinessException(ErrorCode.FORBIDDEN)
        stewards.actor(memberId, marketId)
        val grantId = grants.find(marketId, memberId)?.id ?: throw BusinessException(ErrorCode.FORBIDDEN)
        val grant = grants.lockById(grantId) ?: throw BusinessException(ErrorCode.FORBIDDEN)
        if (!grant.canEdit(marketId, memberId)) throw BusinessException(ErrorCode.FORBIDDEN)
        val saved = requests.save(MarketGeometryRequest(marketId, grantId, memberId, input.kind, input.geometry, input.description.trim()))
        return MarketGeometryRequestUseCase.Submitted(requireNotNull(saved.id), saved.status)
    }

    override fun forMarket(memberId: Long, marketId: Long): List<MarketGeometryRequest> {
        stewards.actor(memberId, marketId)
        return requests.listForMarket(marketId)
    }

    override fun list(memberId: Long, status: GeometryRequestStatus?): List<MarketGeometryRequest> {
        require(memberId > 0)
        return requests.list(status)
    }

    @Transactional(transactionManager = "placeTransactionManager")
    override fun decide(memberId: Long, id: Long, input: MarketGeometryRequestUseCase.Decision): MarketGeometryRequest {
        require(memberId > 0 && input.reason.isNotBlank() && input.reason.length <= 2000)
        val row = requests.lockById(id) ?: throw BusinessException(ErrorCode.NOT_FOUND)
        val decided = requests.save(row.decide(input.action, memberId, input.reason))
        log.info { "Market geometry request decision: id=$id action=${input.action} admin=$memberId" }
        return decided
    }
}
