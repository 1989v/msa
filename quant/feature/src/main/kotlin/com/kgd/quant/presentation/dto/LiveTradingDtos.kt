package com.kgd.quant.presentation.dto

import java.math.BigDecimal
import java.time.Instant

/**
 * Phase 3 실매매 REST API DTO 묶음 (ADR-0037 / TG-P3-34).
 */

// 2FA
data class TwoFactorRegisterResponse(val qrCodeOtpAuthUri: String, val backupCodes: List<String>)
data class TwoFactorVerifyRequest(val totp: String)
data class TwoFactorVerifyResponse(val tokenHash: String, val expiresInSeconds: Long)

// Live mode
data class LiveModeToggleRequest(val enabled: Boolean, val twoFaTokenHash: String)
data class LiveModeStateResponse(
    val mode: String,
    val activatedAt: Instant?,
    val suspendReason: String?,
    val suspendedAt: Instant?,
)

// RiskLimit
data class RiskLimitResponse(
    val dailyLossLimitKrw: BigDecimal,
    val dailyVolumeLimitKrw: BigDecimal,
    val singleOrderMaxKrw: BigDecimal,
    val updatedAt: Instant,
)
data class RiskLimitUpdateRequest(
    val dailyLossLimitKrw: BigDecimal,
    val dailyVolumeLimitKrw: BigDecimal,
    val singleOrderMaxKrw: BigDecimal,
    val twoFaTokenHash: String,
)

// Kill-switch
data class KillSwitchToggleRequest(val enabled: Boolean, val reason: String?, val twoFaTokenHash: String?)
data class KillSwitchSnapshotResponse(val global: Boolean, val tenant: Boolean, val strategy: Boolean)

// Order
data class CancelOrderResponse(val orderId: String, val cancelledAt: Instant)
data class OrderHistoryItem(
    val orderId: String,
    val strategyId: String,
    val market: String,
    val asset: String,
    val side: String,
    val type: String,
    val priceKrw: BigDecimal?,
    val quantity: BigDecimal,
    val status: String,
    val placedAt: Instant,
    val filledAt: Instant?,
)

// Audit log
data class AuditLogItem(
    val eventType: String,
    val occurredAt: Instant,
    val payload: String,    // canonical JSON
    val currentHash: String,
)
