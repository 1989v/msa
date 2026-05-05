package com.kgd.quant.presentation.controller

import com.kgd.common.response.ApiResponse
import com.kgd.quant.application.live.KillSwitchService
import com.kgd.quant.application.live.RiskLimitService
import com.kgd.quant.application.port.persistence.LiveOrderRecordRepositoryPort
import com.kgd.quant.application.port.persistence.AuditEventRepositoryPort
import com.kgd.quant.application.port.security.TwoFactorTokenStorePort
import com.kgd.quant.domain.common.StrategyId
import com.kgd.quant.domain.common.TenantId
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
import java.security.MessageDigest
import java.time.Instant
import java.util.UUID

/**
 * Phase 3 실매매 컨트롤러 묶음 (ADR-0037 / TG-P3-34).
 *
 * 12 엔드포인트:
 * - POST /api/v1/2fa/register      — 2FA 시드 발급 (QR + 백업 코드)
 * - POST /api/v1/2fa/verify        — TOTP 검증 → 토큰 hash 발급
 * - PUT  /api/v1/live-mode         — live-trading 활성/비활성 (2FA 토큰 redeem)
 * - GET  /api/v1/live-mode         — 현재 상태
 * - GET  /api/v1/risk-limit        — 한도 조회
 * - PUT  /api/v1/risk-limit        — 한도 변경 (2FA)
 * - PUT  /api/v1/kill-switch/tenant
 * - PUT  /api/v1/kill-switch/strategy/{id}
 * - GET  /api/v1/kill-switch       — 현재 snapshot
 * - GET  /api/v1/orders            — 페이징
 * - POST /api/v1/orders/{id}/cancel — 사용자 수동 취소
 * - GET  /api/v1/audit-log         — 본인 chain
 *
 * 2FA register / cancel-order / orders 의 실 wire-up 은 후속 task (TwoFactorService 미구현).
 */

@RestController
@RequestMapping("/api/v1/2fa")
class TwoFactorController {

    @PostMapping("/register")
    fun register(@TenantHeader tenantId: TenantId): ResponseEntity<ApiResponse<TwoFactorRegisterResponse>> {
        // TwoFactorService 미구현 — placeholder QR/백업코드.
        val placeholder = TwoFactorRegisterResponse(
            qrCodeOtpAuthUri = "otpauth://totp/quant:${tenantId.value}?secret=PLACEHOLDER&issuer=quant",
            backupCodes = (1..8).map { "BACKUP-PLACEHOLDER-$it" },
        )
        return ResponseEntity.ok(ApiResponse.success(placeholder))
    }

    @PostMapping("/verify")
    fun verify(
        @TenantHeader tenantId: TenantId,
        @RequestBody body: TwoFactorVerifyRequest,
    ): ResponseEntity<ApiResponse<TwoFactorVerifyResponse>> {
        // 실 검증은 TwoFactorService.verify() — 본 placeholder 는 tokenHash 만 발급.
        val tokenHash = MessageDigest.getInstance("SHA-256")
            .digest("${tenantId.value}|${body.totp}|${System.nanoTime()}".toByteArray())
            .joinToString("") { "%02x".format(it) }
        return ResponseEntity.ok(
            ApiResponse.success(TwoFactorVerifyResponse(tokenHash, expiresInSeconds = 300L)),
        )
    }
}

@RestController
@RequestMapping("/api/v1/live-mode")
class LiveModeController(
    private val tokenStore: TwoFactorTokenStorePort,
) {
    @GetMapping
    fun current(@TenantHeader tenantId: TenantId): ResponseEntity<ApiResponse<LiveModeStateResponse>> {
        // LiveModeRepositoryPort 미구현 — Disabled 고정 placeholder.
        return ResponseEntity.ok(
            ApiResponse.success(
                LiveModeStateResponse(
                    mode = "DISABLED",
                    activatedAt = null,
                    suspendReason = null,
                    suspendedAt = null,
                ),
            ),
        )
    }

    @PutMapping
    fun toggle(
        @TenantHeader tenantId: TenantId,
        @RequestBody body: LiveModeToggleRequest,
    ): ResponseEntity<ApiResponse<LiveModeStateResponse>> = runBlocking {
        // 사용자 ID = tenantId 1:1 매핑 가정 (Phase 3 단순화)
        val userId = tenantId.value.hashCode().toLong()
        val redeemed = tokenStore.redeem(userId, body.twoFaTokenHash)
        if (!redeemed) {
            ResponseEntity.status(401).body(
                ApiResponse.error<LiveModeStateResponse>("TWO_FA_REQUIRED", "2FA token invalid or already used"),
            )
        } else {
            ResponseEntity.ok(
                ApiResponse.success(
                    LiveModeStateResponse(
                        mode = if (body.enabled) "ENABLED" else "DISABLED",
                        activatedAt = if (body.enabled) Instant.now() else null,
                        suspendReason = null,
                        suspendedAt = null,
                    ),
                ),
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
        val userId = tenantId.value.hashCode().toLong()
        val limit = riskLimitService.limitOrDefault(tenantId, userId, Instant.now())
        ResponseEntity.ok(ApiResponse.success(limit.toResponse()))
    }

    @PutMapping
    fun update(
        @TenantHeader tenantId: TenantId,
        @RequestBody body: RiskLimitUpdateRequest,
    ): ResponseEntity<ApiResponse<RiskLimitResponse>> = runBlocking {
        val userId = tenantId.value.hashCode().toLong()
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
        val userId = tenantId.value.hashCode().toLong()
        // 해제(false) 시 2FA 필수
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
        val userId = tenantId.value.hashCode().toLong()
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
    /**
     * Admin 전용 — gateway 가 ROLE_ADMIN 검증 후 X-User-Id 주입한다고 가정.
     * 실 RBAC 강제는 후속 (ADR-0024 의 ROLE 기반 메서드 시큐리티).
     */
    @PutMapping("/global")
    fun toggleGlobal(
        @TenantHeader adminId: TenantId,
        @RequestBody body: KillSwitchToggleRequest,
    ): ResponseEntity<ApiResponse<Map<String, Boolean>>> = runBlocking {
        val userId = adminId.value.hashCode().toLong()
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
) {
    @GetMapping
    fun list(
        @TenantHeader tenantId: TenantId,
    ): ResponseEntity<ApiResponse<List<OrderHistoryItem>>> {
        // page-based 조회는 후속 — placeholder empty.
        return ResponseEntity.ok(ApiResponse.success(emptyList()))
    }

    @PostMapping("/{id}/cancel")
    fun cancel(
        @TenantHeader tenantId: TenantId,
        @PathVariable id: String,
    ): ResponseEntity<ApiResponse<CancelOrderResponse>> {
        // CancelLiveOrderUseCase 미구현 — placeholder.
        return ResponseEntity.ok(
            ApiResponse.success(CancelOrderResponse(orderId = id, cancelledAt = Instant.now())),
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
