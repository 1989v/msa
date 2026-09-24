package com.kgd.ads.presentation.advertiser.controller

import com.kgd.ads.application.advertiser.usecase.GetAdvertiserDashboardUseCase
import com.kgd.ads.application.advertiser.usecase.RegisterAdvertiserUseCase
import com.kgd.ads.application.ledger.usecase.TopUpUseCase
import com.kgd.ads.application.placement.usecase.GetAdCatalogUseCase
import com.kgd.ads.application.report.usecase.GetAdvertiserReportUseCase
import com.kgd.ads.presentation.advertiser.dto.RegisterAdvertiserRequest
import com.kgd.ads.presentation.advertiser.dto.RegisterAdvertiserResponse
import com.kgd.ads.presentation.advertiser.dto.TopUpRequest
import com.kgd.ads.presentation.advertiser.dto.TopUpResponse
import com.kgd.ads.presentation.support.RequestIdentity
import com.kgd.common.response.ApiResponse
import jakarta.validation.Valid
import org.springframework.format.annotation.DateTimeFormat
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.time.LocalDate

/**
 * 광고주 계정 — 등록·대시보드·충전·카탈로그·리포트. 신원은 게이트웨이가 넣은 `X-User-Id`(회원 id) 뿐이고,
 * 요청은 광고주 id 를 들고 오지 않는다 — 서버가 회원 id 로 찾는다.
 */
@RestController
@RequestMapping("/api/v1/ads/advertiser")
class AdvertiserController(
    private val register: RegisterAdvertiserUseCase,
    private val dashboard: GetAdvertiserDashboardUseCase,
    private val topUp: TopUpUseCase,
    private val catalog: GetAdCatalogUseCase,
    private val report: GetAdvertiserReportUseCase,
) {
    /** 이미 광고주면 그 광고주를 돌려준다(이름은 바꾸지 않는다). */
    @PostMapping("/register")
    fun register(
        @RequestHeader(RequestIdentity.USER_HEADER, required = false) userId: String?,
        @Valid @RequestBody request: RegisterAdvertiserRequest,
    ): ApiResponse<RegisterAdvertiserResponse> {
        val result = register.execute(RegisterAdvertiserUseCase.Command(RequestIdentity.member(userId), request.displayName))
        return ApiResponse.success(RegisterAdvertiserResponse(result.advertiserId))
    }

    @GetMapping("/me")
    fun me(
        @RequestHeader(RequestIdentity.USER_HEADER, required = false) userId: String?,
    ): ApiResponse<GetAdvertiserDashboardUseCase.Dashboard> =
        ApiResponse.success(dashboard.execute(RequestIdentity.member(userId)))

    @PostMapping("/top-ups")
    fun topUp(
        @RequestHeader(RequestIdentity.USER_HEADER, required = false) userId: String?,
        @Valid @RequestBody request: TopUpRequest,
    ): ApiResponse<TopUpResponse> {
        val memberId = RequestIdentity.member(userId)
        val result = topUp.execute(TopUpUseCase.Command(memberId, request.amountMicros, "$TOP_UP_KEY_PREFIX:$memberId:${request.idempotencyKey}"))
        return ApiResponse.success(TopUpResponse(result.transactionId, result.balanceMicros))
    }

    @GetMapping("/catalog")
    fun catalog(
        @RequestHeader(RequestIdentity.USER_HEADER, required = false) userId: String?,
    ): ApiResponse<GetAdCatalogUseCase.Catalog> {
        RequestIdentity.member(userId)
        return ApiResponse.success(catalog.execute())
    }

    @GetMapping("/reports")
    fun report(
        @RequestHeader(RequestIdentity.USER_HEADER, required = false) userId: String?,
        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) from: LocalDate,
        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) to: LocalDate,
    ): ApiResponse<List<GetAdvertiserReportUseCase.CampaignDay>> =
        ApiResponse.success(report.execute(RequestIdentity.member(userId), from, to))

    private companion object {
        // 원장 멱등 키는 전역 유일이다. 회원 id 를 앞에 붙여야 두 회원이 같은 키를 보내도 서로의 거래가 되지 않는다.
        const val TOP_UP_KEY_PREFIX = "TOPUP"
    }
}
