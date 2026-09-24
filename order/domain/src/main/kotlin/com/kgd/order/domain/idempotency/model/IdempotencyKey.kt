package com.kgd.order.domain.idempotency.model

import java.time.Duration
import java.time.Instant

enum class IdempotencyStatus { PROCESSING, COMPLETED }

/**
 * 주문 접수의 `Idempotency-Key` 한 건 — (사용자, 키) 유니크. 처리 중(PROCESSING)은 리스가 유효한 동안 같은 키를 막고(409),
 * 리스가 지나면 다른 요청이 이어받는다(앞선 요청이 죽었다고 본다). 완료(COMPLETED)면 저장한 응답을 그대로 돌려준다.
 */
class IdempotencyKey private constructor(
    val userId: String,
    val key: String,
    status: IdempotencyStatus,
    leaseUntil: Instant,
    response: String?,
    val createdAt: Instant,
) {
    var status: IdempotencyStatus = status
        private set
    var leaseUntil: Instant = leaseUntil
        private set

    /** 완료 응답 스냅샷 */
    var response: String? = response
        private set

    fun decide(now: Instant): Decision = when {
        status == IdempotencyStatus.COMPLETED -> Decision.Replay(requireNotNull(response) { "완료된 키에 응답이 없다: $key" })
        now.isBefore(leaseUntil) -> Decision.InProgress
        else -> Decision.LeaseExpired
    }

    fun complete(response: String) {
        check(status == IdempotencyStatus.PROCESSING) { "이미 완료된 키: $key" }
        status = IdempotencyStatus.COMPLETED
        this.response = response
    }

    sealed interface Decision {
        data class Replay(val response: String) : Decision
        data object InProgress : Decision
        data object LeaseExpired : Decision
    }

    companion object {
        val LEASE: Duration = Duration.ofSeconds(60)
        val RETENTION: Duration = Duration.ofHours(24)

        fun begin(userId: String, key: String, now: Instant, lease: Duration = LEASE): IdempotencyKey {
            require(key.isNotBlank() && key.length <= 100) { "Idempotency-Key 는 1~100자" }
            return IdempotencyKey(userId, key, IdempotencyStatus.PROCESSING, now.plus(lease), null, now)
        }

        fun restore(userId: String, key: String, status: IdempotencyStatus, leaseUntil: Instant, response: String?, createdAt: Instant) =
            IdempotencyKey(userId, key, status, leaseUntil, response, createdAt)
    }
}
