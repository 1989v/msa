package com.kgd.wishlist.presentation.wishlist.controller

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.common.response.ApiResponse
import com.kgd.wishlist.application.wishlist.usecase.ListWishlistTargetCountsUseCase
import com.kgd.wishlist.domain.model.WishlistTargetCount
import com.kgd.wishlist.domain.model.WishlistTargetType
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

/**
 * 찜 집계 — 클러스터 안 전용. 관광지 재색인(search-batch)이 하루 한 번 불러 색인 `savedCount` 에 싣는다.
 * 게이트웨이가 `/internal` 을 라우팅하지 않는다. 응답은 대상 키와 수뿐이다(회원 id·시각 없음).
 */
@RestController
class WishlistInternalController(
    private val listWishlistTargetCountsUseCase: ListWishlistTargetCountsUseCase,
) {
    /** [min] 기본값은 search `AttractionSaveSignal.SAVED_MIN`(3)과 같다 — 재색인은 그 상수를 늘 명시해 보낸다. */
    @GetMapping("/internal/wishlist/target-counts")
    fun targetCounts(
        @RequestParam type: String,
        @RequestParam(defaultValue = "3") min: Int,
    ): ApiResponse<List<WishlistTargetCount>> {
        val targetType = runCatching { WishlistTargetType.valueOf(type.uppercase()) }
            .getOrElse { throw BusinessException(ErrorCode.INVALID_INPUT, "지원하지 않는 찜 대상입니다: $type") }
        return ApiResponse.success(listWishlistTargetCountsUseCase.execute(ListWishlistTargetCountsUseCase.Query(targetType, min)))
    }
}
