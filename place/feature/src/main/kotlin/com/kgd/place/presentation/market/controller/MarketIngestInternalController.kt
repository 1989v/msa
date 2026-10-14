package com.kgd.place.presentation.market.controller

import com.kgd.common.response.ApiResponse
import com.kgd.place.application.market.usecase.IngestMarketUseCase
import com.kgd.place.application.market.usecase.QueryMarketUseCase
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

/** Like transit: cluster-only path, never exposed by the gateway. No public editing endpoint. */
@RestController
@RequestMapping("/internal/markets")
class MarketIngestInternalController(
    private val ingest: IngestMarketUseCase,
    private val query: QueryMarketUseCase,
) {
    @PutMapping
    fun put(@RequestBody command: IngestMarketUseCase.Command): ApiResponse<IngestMarketUseCase.Result> =
        ApiResponse.success(ingest.ingest(command))

    @GetMapping("/{contentId}")
    fun state(@PathVariable contentId: String): ApiResponse<QueryMarketUseCase.MarketResult?> =
        ApiResponse.success(query.find(contentId, true))
}
