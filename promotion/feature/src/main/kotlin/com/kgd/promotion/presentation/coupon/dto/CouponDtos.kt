package com.kgd.promotion.presentation.coupon.dto

import com.kgd.promotion.application.coupon.usecase.ManageCouponDefinitionUseCase
import com.kgd.promotion.domain.coupon.model.CouponBearer
import com.kgd.promotion.domain.coupon.model.CouponType
import jakarta.validation.constraints.Min
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size
import java.time.Instant

/** 쿠폰 정의 만들기. 정액은 amount, 정률은 rateBp(1~10000) + maxDiscount. 판매자 부담이면 sellerId */
data class CreateCouponDefinitionRequest(
    @field:NotBlank @field:Size(max = 100)
    val name: String,
    val type: CouponType,
    val amount: Long? = null,
    val rateBp: Int? = null,
    val maxDiscount: Long? = null,
    @field:Min(0)
    val minOrderAmount: Long = 0,
    val validFrom: Instant,
    val validUntil: Instant,
    @field:Min(1)
    val issueLimit: Int,
    val bearer: CouponBearer = CouponBearer.PLATFORM,
    val sellerId: Long? = null,
) {
    fun toCommand(actorId: String) = ManageCouponDefinitionUseCase.Create(
        name, type, amount, rateBp, maxDiscount, minOrderAmount, validFrom, validUntil, issueLimit, bearer, sellerId, actorId,
    )
}
