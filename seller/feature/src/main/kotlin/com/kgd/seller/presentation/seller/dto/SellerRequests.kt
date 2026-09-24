package com.kgd.seller.presentation.seller.dto

import com.kgd.seller.application.seller.usecase.ApplySellerUseCase
import com.kgd.seller.domain.seller.model.SettlementCycle
import jakarta.validation.constraints.Max
import jakarta.validation.constraints.Min
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.NotNull
import jakarta.validation.constraints.Size

data class ApplySellerRequest(
    @field:NotBlank @field:Size(max = 100) val businessName: String,
    @field:NotBlank @field:Size(max = 20) val businessRegistrationNo: String,
    @field:NotBlank @field:Size(max = 50) val representativeName: String,
    @field:NotBlank @field:Size(max = 50) val bankName: String,
    @field:NotBlank @field:Size(max = 30) val accountNumber: String,
    @field:NotNull @field:Min(0) val shippingFee: Long,
    @field:NotNull val settlementCycle: SettlementCycle,
) {
    fun toCommand(memberId: String) = ApplySellerUseCase.Command(
        memberId = memberId,
        businessName = businessName,
        businessRegistrationNo = businessRegistrationNo,
        representativeName = representativeName,
        bankName = bankName,
        accountNumber = accountNumber,
        shippingFee = shippingFee,
        settlementCycle = settlementCycle,
    )

    override fun toString(): String = "ApplySellerRequest(businessName=$businessName)"
}

data class ApproveSellerRequest(
    @field:NotNull @field:Min(0) @field:Max(10_000) val commissionRateBp: Int,
    @field:Size(max = 500) val reason: String? = null,
)

data class SellerReasonRequest(
    @field:NotBlank @field:Size(max = 500) val reason: String,
)

data class ReactivateSellerRequest(
    @field:Size(max = 500) val reason: String? = null,
)

data class ChangeCommissionRequest(
    @field:NotNull @field:Min(0) @field:Max(10_000) val commissionRateBp: Int,
    @field:NotBlank @field:Size(max = 500) val reason: String,
)
