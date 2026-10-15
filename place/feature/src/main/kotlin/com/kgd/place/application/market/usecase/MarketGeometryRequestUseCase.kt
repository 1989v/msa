package com.kgd.place.application.market.usecase

import com.kgd.place.domain.market.model.*

interface MarketGeometryRequestUseCase {
    data class Submission(val kind: GeometryRequestKind, val geometry: List<List<Double>>? = null, val description: String)
    data class Submitted(val id: Long, val status: GeometryRequestStatus)
    data class Decision(val action: GeometryRequestAction, val reason: String = "")
    fun submit(memberId: Long, marketId: Long, input: Submission): Submitted
    fun forMarket(memberId: Long, marketId: Long): List<MarketGeometryRequest>
    fun list(memberId: Long, status: GeometryRequestStatus?): List<MarketGeometryRequest>
    fun decide(memberId: Long, id: Long, input: Decision): MarketGeometryRequest
}
