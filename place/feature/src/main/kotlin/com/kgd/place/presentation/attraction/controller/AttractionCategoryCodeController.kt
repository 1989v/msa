package com.kgd.place.presentation.attraction.controller

import com.kgd.common.response.ApiResponse
import com.kgd.place.application.attraction.usecase.SyncAttractionCategoryCodesUseCase
import jakarta.validation.Valid
import jakarta.validation.constraints.NotEmpty
import jakarta.validation.constraints.Size
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

/**
 * 분류체계 코드표 — 읽기는 열려 있고 쓰기는 `/internal` 이다.
 *
 * 읽는 쪽이 search 라 `/api` 로 연다(서비스 간은 API 호출만, DB 공유 금지). 표가 수백 행이라
 * 페이징이 없고, 호출자가 기동 시 한 번 받아 들고 있는 것을 전제로 한다.
 */
@RestController
class AttractionCategoryCodeController(
    private val syncCategoryCodes: SyncAttractionCategoryCodesUseCase,
) {

    @GetMapping("/api/places/attractions/category-codes")
    fun list(@RequestParam(required = false) lang: String?): ApiResponse<List<SyncAttractionCategoryCodesUseCase.View>> =
        ApiResponse.success(syncCategoryCodes.findAll(lang))

    @PutMapping("/internal/attractions/category-codes")
    fun upsert(@Valid @RequestBody request: UpsertCategoryCodesRequest): ApiResponse<SyncAttractionCategoryCodesUseCase.Applied> =
        ApiResponse.success(syncCategoryCodes.upsert(request.items.map { it.toItem() }))
}

data class UpsertCategoryCodesRequest(
    @field:NotEmpty(message = "items 는 비어있을 수 없습니다")
    @field:Size(max = 2000, message = "한 번에 2000건까지")
    val items: List<Item>,
) {
    data class Item(
        val lang: String,
        val code: String,
        val depth: Int,
        val name: String,
        val parentCode: String? = null,
    ) {
        fun toItem() = SyncAttractionCategoryCodesUseCase.Item(lang, code, depth, name, parentCode)
    }
}
