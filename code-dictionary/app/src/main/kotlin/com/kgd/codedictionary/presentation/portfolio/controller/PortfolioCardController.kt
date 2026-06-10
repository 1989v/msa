package com.kgd.codedictionary.presentation.portfolio.controller

import com.kgd.codedictionary.application.portfolio.dto.PortfolioCardDetailDto
import com.kgd.codedictionary.application.portfolio.dto.PortfolioCardSummaryDto
import com.kgd.codedictionary.application.portfolio.service.PortfolioQueryService
import com.kgd.codedictionary.application.portfolio.service.PortfolioSort
import com.kgd.common.response.ApiResponse
import org.springframework.data.domain.Page
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/v1/portfolio")
class PortfolioCardController(
    private val portfolioQueryService: PortfolioQueryService,
) {

    @GetMapping("/cards")
    fun list(
        @RequestParam(required = false) sort: String?,
        @RequestParam(required = false) stack: String?,
        @RequestParam(required = false) q: String?,
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "50") size: Int,
    ): ApiResponse<Page<PortfolioCardSummaryDto>> {
        val stacks = stack?.split(",")?.filter { it.isNotBlank() } ?: emptyList()
        val result = portfolioQueryService.list(
            sort = PortfolioSort.parse(sort),
            stacks = stacks,
            q = q,
            page = page,
            size = size,
        )
        return ApiResponse.success(result)
    }

    @GetMapping("/cards/{id}")
    fun detail(@PathVariable id: Long): ApiResponse<PortfolioCardDetailDto> =
        ApiResponse.success(portfolioQueryService.findById(id))
}
