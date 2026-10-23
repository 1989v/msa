package com.kgd.ranking.presentation.controller

import com.kgd.common.response.ApiResponse
import com.kgd.ranking.application.cafe.dto.*
import com.kgd.ranking.application.cafe.usecase.GetCafeDrinksUseCase
import com.kgd.ranking.application.cafe.usecase.SyncCafeDrinksUseCase
import org.springframework.web.bind.annotation.*
import java.math.BigDecimal
import com.kgd.ranking.domain.cafe.model.CaffeineStatus
import org.springframework.http.HttpStatus
import org.springframework.web.server.ResponseStatusException

@RestController
@RequestMapping("/api/v1/ranking/cafe")
class CafeDrinkController(private val getCafeDrinks: GetCafeDrinksUseCase) {
    @GetMapping("/drinks")
    fun drinks(
        @RequestParam(required = false) q: String?,
        @RequestParam(required = false) brand: List<String>?,
        @RequestParam(required = false) group: List<String>?,
        @RequestParam(required = false) temperature: String?,
        @RequestParam(required = false) maxSugar: BigDecimal?,
        @RequestParam(required = false) maxCaffeine: BigDecimal?,
        @RequestParam(required = false) caffeine: String?,
        @RequestParam(defaultValue = "sugar") sort: String,
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "20") size: Int,
        @RequestParam(defaultValue = "serving") basis: String,
        @RequestParam(required = false) caffeineStatus: List<CaffeineStatus>?,
        @RequestParam(defaultValue = "asc") direction: String,
        @RequestParam(required = false) maxKcal: BigDecimal?,
        @RequestParam(required = false) sizeLabel: String?,
        @RequestParam(defaultValue = "false") grouped: Boolean = false,
    ): ApiResponse<CafeDrinkPage> {
        val query = try {
            CafeDrinkQuery(q, brand.orEmpty(), group?.singleOrNull(), temperature, maxSugar, maxCaffeine, caffeine, sort, page, size, basis, caffeineStatus.orEmpty(), direction, maxKcal, sizeLabel, groups = group.orEmpty())
        } catch (_: IllegalArgumentException) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid cafe filters")
        }
        return ApiResponse.success(if (grouped) getCafeDrinks.grouped(query) else getCafeDrinks.execute(query))
    }
    @GetMapping("/drinks/{drinkKey}")
    fun drink(@PathVariable drinkKey: String): ApiResponse<CafeDrinkResponse> = ApiResponse.success(
        getCafeDrinks.find(drinkKey) ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "Drink not found"),
    )
    @GetMapping("/drink-names")
    fun names(@RequestParam(defaultValue = "") q: String): ApiResponse<List<CafeDrinkNameCount>> = ApiResponse.success(getCafeDrinks.names(q))
    @GetMapping("/drink-names/compare")
    fun compare(@RequestParam name: String, @RequestParam(defaultValue = "sugar") sort: String,
        @RequestParam(defaultValue = "serving") basis: String, @RequestParam(defaultValue = "asc") direction: String,
        @RequestParam(required = false) brand: List<String>?, @RequestParam(required = false) temperature: String?,
        @RequestParam(required = false) caffeineStatus: List<CaffeineStatus>?,
        @RequestParam(required = false) maxSugar: BigDecimal?, @RequestParam(required = false) maxCaffeine: BigDecimal?,
        @RequestParam(required = false) caffeine: String?, @RequestParam(required = false) group: List<String>?,
        @RequestParam(required = false) maxKcal: BigDecimal? = null, @RequestParam(required = false) sizeLabel: String? = null,
    ): ApiResponse<List<CafeDrinkBrandVariants>> = try {
        ApiResponse.success(getCafeDrinks.compare(name, CafeDrinkQuery(sort = sort, basis = basis, direction = direction,
            brands = brand.orEmpty(), temperature = temperature, caffeineStatus = caffeineStatus.orEmpty(), maxSugar = maxSugar, maxCaffeine = maxCaffeine, caffeine = caffeine, groups = group.orEmpty(), maxKcal = maxKcal, sizeLabel = sizeLabel)))
    } catch (_: IllegalArgumentException) { throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid cafe filters") }
    @GetMapping("/groups")
    fun groups(): ApiResponse<List<CafeGroupCount>> = ApiResponse.success(getCafeDrinks.groups())
    @GetMapping("/brands")
    fun brands(): ApiResponse<List<CafeBrandCount>> = ApiResponse.success(getCafeDrinks.brands())
}

/** Collector only. Gateway exposes the public ranking prefix, never this internal route. */
@RestController
@RequestMapping("/internal/ranking/cafe")
class CafeDrinkInternalController(private val syncCafeDrinks: com.kgd.ranking.application.admin.usecase.CafeAdminIngestUseCase) {
    @PostMapping("/drinks/bulk")
    fun bulk(@RequestBody request: CafeDrinkBulkRequest): ApiResponse<CafeDrinkBulkResult> =
        try { ApiResponse.success(syncCafeDrinks.sync(request)) }
        catch (_: IllegalArgumentException) { throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid cafe bulk") }
}
