package com.kgd.quant.presentation.controller

import com.kgd.common.response.ApiResponse
import com.kgd.quant.application.live.CancelLiveOrderUseCase
import com.kgd.quant.application.live.KillSwitchService
import com.kgd.quant.application.live.LiveModeService
import com.kgd.quant.application.live.RiskLimitService
import com.kgd.quant.application.live.TwoFactorService
import com.kgd.quant.application.port.persistence.AuditEventRepositoryPort
import com.kgd.quant.application.port.persistence.LiveOrderRecordRepositoryPort
import com.kgd.quant.application.port.security.TwoFactorTokenStorePort
import com.kgd.quant.domain.common.OrderId
import com.kgd.quant.domain.common.StrategyId
import com.kgd.quant.domain.common.TenantId
import com.kgd.quant.domain.credential.Exchange
import com.kgd.quant.domain.live.LiveTradingMode
import com.kgd.quant.domain.live.RiskLimit
import com.kgd.quant.presentation.dto.AuditLogItem
import com.kgd.quant.presentation.dto.CancelOrderResponse
import com.kgd.quant.presentation.dto.KillSwitchSnapshotResponse
import com.kgd.quant.presentation.dto.KillSwitchToggleRequest
import com.kgd.quant.presentation.dto.LiveModeStateResponse
import com.kgd.quant.presentation.dto.LiveModeToggleRequest
import com.kgd.quant.presentation.dto.OrderHistoryItem
import com.kgd.quant.presentation.dto.RiskLimitResponse
import com.kgd.quant.presentation.dto.RiskLimitUpdateRequest
import com.kgd.quant.presentation.dto.TwoFactorRegisterResponse
import com.kgd.quant.presentation.dto.TwoFactorVerifyRequest
import com.kgd.quant.presentation.dto.TwoFactorVerifyResponse
import com.kgd.quant.presentation.resolver.TenantHeader
import kotlinx.coroutines.runBlocking
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.time.Instant

/**
 * Phase 3 실매매 컨트롤러 묶음 (ADR-0037 / TG-P3-34, L6 wire-up).
 */

@RestController
@RequestMapping("/api/v1/2fa")
class TwoFactorController(
    private val twoFactorService: TwoFactorService,
) {

    @PostMapping("/register")
    fun register(@TenantHeader tenantId: TenantId): ResponseEntity<ApiResponse<TwoFactorRegisterResponse>> = runBlocking {
        val userId = tenantId.toUserId()
        val result = twoFactorService.register(tenantId, userId)
        ResponseEntity.ok(
            ApiResponse.success(
                TwoFactorRegisterResponse(
                    qrCodeOtpAuthUri = result.otpAuthUri,
                    backupCodes = result.backupCodes,
                ),
            ),
        )
    }

    @PostMapping("/verify")
    fun verify(
        @TenantHeader tenantId: TenantId,
        @RequestBody body: TwoFactorVerifyRequest,
    ): ResponseEntity<ApiResponse<TwoFactorVerifyResponse>> = runBlocking {
        val userId = tenantId.toUserId()
        when (val r = twoFactorService.verify(tenantId, userId, body.totp)) {
            is TwoFactorService.VerificationResult.Verified ->
                ResponseEntity.ok(
                    ApiResponse.success(TwoFactorVerifyResponse(r.tokenHash, r.expiresInSeconds)),
                )
            TwoFactorService.VerificationResult.RateLimited ->
                ResponseEntity.status(429)
                    .body(ApiResponse.error<TwoFactorVerifyResponse>("RATE_LIMITED", "too many 2FA attempts"))
            TwoFactorService.VerificationResult.NotRegistered ->
                ResponseEntity.status(404)
                    .body(ApiResponse.error<TwoFactorVerifyResponse>("NOT_REGISTERED", "2FA not registered"))
            TwoFactorService.VerificationResult.Failed ->
                ResponseEntity.status(401)
                    .body(ApiResponse.error<TwoFactorVerifyResponse>("INVALID_OTP", "invalid TOTP or backup code"))
        }
    }
}

@RestController
@RequestMapping("/api/v1/live-mode")
class LiveModeController(
    private val liveModeService: LiveModeService,
) {
    @GetMapping
    fun current(@TenantHeader tenantId: TenantId): ResponseEntity<ApiResponse<LiveModeStateResponse>> = runBlocking {
        val state = liveModeService.current(tenantId)
        ResponseEntity.ok(ApiResponse.success(state.toResponse()))
    }

    @PutMapping
    fun toggle(
        @TenantHeader tenantId: TenantId,
        @RequestBody body: LiveModeToggleRequest,
    ): ResponseEntity<ApiResponse<LiveModeStateResponse>> = runBlocking {
        val userId = tenantId.toUserId()
        val result = if (body.enabled) {
            liveModeService.enable(tenantId, userId, body.twoFaTokenHash)
        } else {
            liveModeService.disable(tenantId, userId, body.twoFaTokenHash)
        }
        when (result) {
            is LiveModeService.ToggleResult.Ok ->
                ResponseEntity.ok(ApiResponse.success(result.state.toResponse()))
            LiveModeService.ToggleResult.TwoFaRequired ->
                ResponseEntity.status(401).body(
                    ApiResponse.error<LiveModeStateResponse>("TWO_FA_REQUIRED", "2FA token invalid or already used"),
                )
        }
    }
}

@RestController
@RequestMapping("/api/v1/risk-limit")
class RiskLimitController(
    private val riskLimitService: RiskLimitService,
    private val tokenStore: TwoFactorTokenStorePort,
) {
    @GetMapping
    fun current(@TenantHeader tenantId: TenantId): ResponseEntity<ApiResponse<RiskLimitResponse>> = runBlocking {
        val userId = tenantId.toUserId()
        val limit = riskLimitService.limitOrDefault(tenantId, userId, Instant.now())
        ResponseEntity.ok(ApiResponse.success(limit.toResponse()))
    }

    @PutMapping
    fun update(
        @TenantHeader tenantId: TenantId,
        @RequestBody body: RiskLimitUpdateRequest,
    ): ResponseEntity<ApiResponse<RiskLimitResponse>> = runBlocking {
        val userId = tenantId.toUserId()
        if (!tokenStore.redeem(userId, body.twoFaTokenHash)) {
            return@runBlocking ResponseEntity.status(401).body(
                ApiResponse.error<RiskLimitResponse>("TWO_FA_REQUIRED", "2FA token invalid"),
            )
        }
        val now = Instant.now()
        val updated = RiskLimit(
            tenantId = tenantId,
            dailyLossLimitKrw = body.dailyLossLimitKrw,
            dailyVolumeLimitKrw = body.dailyVolumeLimitKrw,
            singleOrderMaxKrw = body.singleOrderMaxKrw,
            updatedAt = now,
            updatedBy = userId,
        )
        riskLimitService.update(updated)
        ResponseEntity.ok(ApiResponse.success(updated.toResponse()))
    }

    private fun RiskLimit.toResponse() = RiskLimitResponse(
        dailyLossLimitKrw = dailyLossLimitKrw,
        dailyVolumeLimitKrw = dailyVolumeLimitKrw,
        singleOrderMaxKrw = singleOrderMaxKrw,
        updatedAt = updatedAt,
    )
}

@RestController
@RequestMapping("/api/v1/kill-switch")
class KillSwitchController(
    private val killSwitchService: KillSwitchService,
    private val tokenStore: TwoFactorTokenStorePort,
) {
    @GetMapping
    fun snapshot(
        @TenantHeader tenantId: TenantId,
        @RequestParam strategyId: String,
    ): ResponseEntity<ApiResponse<KillSwitchSnapshotResponse>> = runBlocking {
        val sId = StrategyId.of(strategyId)
        val snap = killSwitchService.snapshot(tenantId, sId)
        ResponseEntity.ok(
            ApiResponse.success(KillSwitchSnapshotResponse(snap.global, snap.tenant, snap.strategy)),
        )
    }

    @PutMapping("/tenant")
    fun toggleTenant(
        @TenantHeader tenantId: TenantId,
        @RequestBody body: KillSwitchToggleRequest,
    ): ResponseEntity<ApiResponse<Map<String, Boolean>>> = runBlocking {
        val userId = tenantId.toUserId()
        if (!body.enabled) {
            val token = body.twoFaTokenHash
                ?: return@runBlocking ResponseEntity.status(401).body(
                    ApiResponse.error<Map<String, Boolean>>("TWO_FA_REQUIRED", "kill-switch off requires 2FA"),
                )
            if (!tokenStore.redeem(userId, token)) {
                return@runBlocking ResponseEntity.status(401).body(
                    ApiResponse.error<Map<String, Boolean>>("TWO_FA_REQUIRED", "2FA token invalid"),
                )
            }
        }
        killSwitchService.toggleTenant(tenantId, body.enabled, userId, body.reason)
        ResponseEntity.ok(ApiResponse.success(mapOf("enabled" to body.enabled)))
    }

    @PutMapping("/strategy/{id}")
    fun toggleStrategy(
        @TenantHeader tenantId: TenantId,
        @PathVariable id: String,
        @RequestBody body: KillSwitchToggleRequest,
    ): ResponseEntity<ApiResponse<Map<String, Boolean>>> = runBlocking {
        val userId = tenantId.toUserId()
        val sId = StrategyId.of(id)
        if (!body.enabled) {
            val token = body.twoFaTokenHash ?: return@runBlocking ResponseEntity.status(401)
                .body(ApiResponse.error<Map<String, Boolean>>("TWO_FA_REQUIRED", "kill-switch off requires 2FA"))
            if (!tokenStore.redeem(userId, token)) {
                return@runBlocking ResponseEntity.status(401)
                    .body(ApiResponse.error<Map<String, Boolean>>("TWO_FA_REQUIRED", "2FA token invalid"))
            }
        }
        killSwitchService.toggleStrategy(sId, body.enabled, userId, body.reason)
        ResponseEntity.ok(ApiResponse.success(mapOf("enabled" to body.enabled)))
    }
}

@RestController
@RequestMapping("/api/v1/admin/kill-switch")
class GlobalKillSwitchController(
    private val killSwitchService: KillSwitchService,
    private val tokenStore: TwoFactorTokenStorePort,
) {
    @PutMapping("/global")
    fun toggleGlobal(
        @TenantHeader adminId: TenantId,
        @RequestBody body: KillSwitchToggleRequest,
    ): ResponseEntity<ApiResponse<Map<String, Boolean>>> = runBlocking {
        val userId = adminId.toUserId()
        val token = body.twoFaTokenHash ?: return@runBlocking ResponseEntity.status(401)
            .body(ApiResponse.error<Map<String, Boolean>>("TWO_FA_REQUIRED", "global kill-switch requires 2FA"))
        if (!tokenStore.redeem(userId, token)) {
            return@runBlocking ResponseEntity.status(401)
                .body(ApiResponse.error<Map<String, Boolean>>("TWO_FA_REQUIRED", "2FA token invalid"))
        }
        killSwitchService.toggleGlobal(body.enabled, userId, body.reason)
        ResponseEntity.ok(ApiResponse.success(mapOf("global" to body.enabled)))
    }
}

@RestController
@RequestMapping("/api/v1/orders")
class LiveOrderController(
    private val orderRepo: LiveOrderRecordRepositoryPort,
    private val cancelUseCase: CancelLiveOrderUseCase,
) {
    @GetMapping
    fun list(
        @TenantHeader tenantId: TenantId,
    ): ResponseEntity<ApiResponse<List<OrderHistoryItem>>> {
        // 페이징 조회는 후속 (LiveOrderRecordRepositoryPort.findByTenantPage). placeholder empty.
        return ResponseEntity.ok(ApiResponse.success(emptyList()))
    }

    @PostMapping("/{id}/cancel")
    fun cancel(
        @TenantHeader tenantId: TenantId,
        @PathVariable id: String,
        @RequestParam(required = false, defaultValue = "BITHUMB") exchange: String,
    ): ResponseEntity<ApiResponse<CancelOrderResponse>> = runBlocking {
        val orderId = OrderId.of(id)
        val updated = cancelUseCase.execute(
            tenantId = tenantId,
            orderId = orderId,
            exchange = Exchange.valueOf(exchange.uppercase()),
        )
        ResponseEntity.ok(
            ApiResponse.success(
                CancelOrderResponse(
                    orderId = updated.id.value.toString(),
                    cancelledAt = updated.cancelledAt ?: Instant.now(),
                ),
            ),
        )
    }
}

@RestController
@RequestMapping("/api/v1/audit-log")
class AuditLogController(
    private val auditRepo: AuditEventRepositoryPort,
) {
    @GetMapping
    fun list(
        @TenantHeader tenantId: TenantId,
        @RequestParam(required = false, defaultValue = "100") limit: Int,
    ): ResponseEntity<ApiResponse<List<AuditLogItem>>> = runBlocking {
        val events = auditRepo.loadAscending(tenantId, limit.coerceIn(1, 1000))
        ResponseEntity.ok(
            ApiResponse.success(events.map {
                AuditLogItem(
                    eventType = it.eventType.name,
                    occurredAt = it.occurredAt,
                    payload = it.payloadCanonical,
                    currentHash = it.currentHash,
                )
            }),
        )
    }
}

private fun TenantId.toUserId(): Long = value.hashCode().toLong()

private fun LiveTradingMode.toResponse(): LiveModeStateResponse = when (this) {
    is LiveTradingMode.Disabled -> LiveModeStateResponse(
        mode = "DISABLED",
        activatedAt = null,
        suspendReason = null,
        suspendedAt = null,
    )
    is LiveTradingMode.Enabled -> LiveModeStateResponse(
        mode = "ENABLED",
        activatedAt = activatedAt,
        suspendReason = null,
        suspendedAt = null,
    )
    is LiveTradingMode.Suspended -> LiveModeStateResponse(
        mode = "SUSPENDED",
        activatedAt = null,
        suspendReason = reason.name,
        suspendedAt = suspendedAt,
    )
}
