package com.kgd.quant.domain.live

import com.kgd.quant.domain.common.TenantId
import java.security.MessageDigest
import java.time.Instant

/**
 * AuditEvent — Phase 3 audit chain 이벤트 (ADR-0037).
 *
 * 각 이벤트는 (prev_hash || canonical(payload) || occurred_at) 의 SHA-256 으로 current_hash 를
 * 산출 → 변조 시 chain break. 매일 KST 03:00 verify job 이 chain 검증.
 *
 * 도메인 레이어는 hash 계산 로직만 캡슐화. 적재/조회는 인프라 레이어.
 */
data class AuditEvent(
    val tenantId: TenantId,
    val eventType: AuditEventType,
    val payloadCanonical: String,    // canonical JSON (정렬된 키)
    val occurredAt: Instant,
    val prevHash: String?,            // null = chain 시작
    val currentHash: String,
) {
    init {
        require(currentHash.length == 64) {
            "currentHash must be SHA-256 hex (64 chars), got ${currentHash.length}"
        }
        require(prevHash == null || prevHash.length == 64) {
            "prevHash must be null or SHA-256 hex (64 chars)"
        }
        require(payloadCanonical.isNotBlank()) { "payloadCanonical must not be blank" }
    }

    companion object {
        /**
         * 새 AuditEvent 를 chain 에 append — prevHash 와 payload 로부터 currentHash 를 계산.
         */
        fun append(
            tenantId: TenantId,
            eventType: AuditEventType,
            payloadCanonical: String,
            occurredAt: Instant,
            prevHash: String?,
        ): AuditEvent {
            val toHash = (prevHash ?: "") + "|" + payloadCanonical + "|" + occurredAt.toString()
            val md = MessageDigest.getInstance("SHA-256")
            val digest = md.digest(toHash.toByteArray(Charsets.UTF_8))
            val hex = digest.joinToString("") { "%02x".format(it) }
            return AuditEvent(
                tenantId = tenantId,
                eventType = eventType,
                payloadCanonical = payloadCanonical,
                occurredAt = occurredAt,
                prevHash = prevHash,
                currentHash = hex,
            )
        }

        /**
         * Chain verify — 주어진 sequence 가 무결한지 검사.
         * 첫 이벤트의 prevHash 는 null 또는 prevTip (옵션 시드). 나머지는 직전 currentHash 와 일치 필수.
         * 각 이벤트의 currentHash 가 재계산 결과와 일치해야 함.
         */
        fun verify(events: List<AuditEvent>, prevTip: String? = null): VerifyResult {
            var expectedPrev = prevTip
            events.forEachIndexed { idx, ev ->
                if (ev.prevHash != expectedPrev) {
                    return VerifyResult.PrevHashMismatch(idx, expectedPrev, ev.prevHash)
                }
                val recomputed = append(ev.tenantId, ev.eventType, ev.payloadCanonical, ev.occurredAt, ev.prevHash)
                if (recomputed.currentHash != ev.currentHash) {
                    return VerifyResult.HashMismatch(idx, ev.currentHash, recomputed.currentHash)
                }
                expectedPrev = ev.currentHash
            }
            return VerifyResult.Ok(events.size, expectedPrev)
        }
    }

    sealed interface VerifyResult {
        data class Ok(val count: Int, val tipHash: String?) : VerifyResult
        data class PrevHashMismatch(val index: Int, val expected: String?, val actual: String?) : VerifyResult
        data class HashMismatch(val index: Int, val stored: String, val recomputed: String) : VerifyResult
    }
}

enum class AuditEventType {
    LIVE_MODE_TOGGLE,
    RISK_LIMIT_CHANGE,
    KILL_SWITCH_TOGGLE,
    ORDER_PLACED,
    ORDER_FILLED,
    ORDER_CANCELLED,
    ORDER_REJECTED,
    RECONCILE_DRIFT,
    TWO_FA_VERIFIED,
    TWO_FA_FAILED,
}
