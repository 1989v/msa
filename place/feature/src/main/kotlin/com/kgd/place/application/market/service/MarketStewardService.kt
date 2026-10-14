package com.kgd.place.application.market.service

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.place.application.market.port.MarketEditorPort
import com.kgd.place.application.market.port.MarketStewardPort
import com.kgd.place.application.market.usecase.*
import com.kgd.place.domain.market.model.*
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDateTime

@Service
class MarketStewardService(private val stewards: MarketStewardPort, private val editor: MarketEditorPort) : MarketStewardUseCase {
    private val log = KotlinLogging.logger {}
    private fun member(id: Long) { require(id > 0) }
    private fun lock(marketId: Long) {
        if (editor.lockMarket(marketId) == null) throw BusinessException(ErrorCode.NOT_FOUND)
    }

    @Transactional(transactionManager = "placeTransactionManager")
    override fun apply(memberId: Long, marketId: Long, request: MarketStewardUseCase.Application): MarketSteward {
        member(memberId)
        require(request.orgName.isNotBlank() && request.orgName.length <= 300)
        require(request.contact.isNotBlank() && request.contact.length <= 500)
        // The existing market row serializes even first applications (there is no grant row to lock yet).
        lock(marketId)
        val previous = stewards.find(marketId, memberId)
        if (previous != null && previous.status != MarketStewardStatus.REJECTED)
            throw MarketEditConflict("An application or grant already exists; suspended grants require admin restoration")
        return stewards.save(MarketSteward(marketId, memberId, request.orgName.trim(), request.contact.trim(),
            id = previous?.id, createdAt = previous?.createdAt ?: LocalDateTime.now()))
    }

    override fun current(memberId: Long, marketId: Long): MarketSteward? {
        member(memberId)
        if (editor.findMarket(marketId) == null) throw BusinessException(ErrorCode.NOT_FOUND)
        return stewards.find(marketId, memberId)
    }

    override fun list(memberId: Long, status: MarketStewardStatus?, page: Int, size: Int): EditMarketUseCase.Page<MarketSteward> {
        member(memberId); require(page in 0..100_000 && size in 1..100)
        val (items, total) = stewards.list(status, page, size)
        return EditMarketUseCase.Page(items, total, page, size)
    }

    @Transactional(transactionManager = "placeTransactionManager")
    override fun decide(memberId: Long, id: Long, action: MarketStewardUseCase.Action): MarketSteward {
        member(memberId)
        val marketId = stewards.marketIdById(id) ?: throw BusinessException(ErrorCode.NOT_FOUND)
        lock(marketId)
        // A locking current read avoids both stale managed entities and REPEATABLE_READ snapshots.
        val row = stewards.lockById(id) ?: throw BusinessException(ErrorCode.NOT_FOUND)
        val result = row.transition(action.name, memberId)
        log.info { "Market steward decision: id=$id action=$action admin=$memberId" }
        return stewards.save(result)
    }

    override fun actor(memberId: Long, marketId: Long): MarketEditorActor {
        member(memberId)
        val row = stewards.find(marketId, memberId)
        if (row?.canEdit(marketId, memberId) != true) throw BusinessException(ErrorCode.FORBIDDEN)
        return MarketEditorActor(MarketActorKind.STEWARD, memberId, setOf(marketId))
    }
}
