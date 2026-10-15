package com.kgd.place.application.market.service

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.place.application.market.port.*
import com.kgd.place.application.market.usecase.RejudgeMarketUseCase
import com.kgd.place.domain.market.model.*
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class MarketRejudgeService(
    private val editor: MarketEditorPort,
    private val query: MarketQueryPort,
    private val geometry: MarketGeometryQueryPort,
    private val save: MarketJudgmentSavePort,
) : RejudgeMarketUseCase {
    @Transactional(transactionManager = "placeTransactionManager")
    override fun rejudge(marketId: Long): Int {
        require(marketId > 0)
        editor.lockMarket(marketId) ?: throw BusinessException(ErrorCode.NOT_FOUND)
        val boundary = geometry.findBoundary(marketId)
        val paths = geometry.findPaths(marketId)
        val rules = geometry.findRoadRules(marketId)
        val stores = query.findStores(marketId).filter { it.source != MarketStoreSource.MANUAL }
        val overrides = query.findOverrides(stores.map { requireNotNull(it.id) }).groupBy { it.storeId }
        return stores.count { store ->
            val judgment = MarketStoreJudge.judge(store, boundary, paths, rules, overrides[store.id].orEmpty())
            val changed = store.judgedMembership != judgment.membership || store.judgedBy != judgment.judgedBy ||
                store.pathId != judgment.pathId || store.needsReview != judgment.needsReview
            if (changed) save.saveJudgment(marketId, requireNotNull(store.id), judgment)
            changed
        }
    }
}
