package com.kgd.game.domain.ads.model

import com.kgd.game.domain.ads.exception.RewardAlreadySettledException
import java.time.Instant

enum class RewardStatus { PENDING, COMPLETED, FAILED, EXPIRED }

/**
 * rewarded 광고 보상 원장 — idempotencyKey 로 완료 콜백 중복/재시도에도 1회 지급 보장
 * (idempotent-consumer 패턴, 설계 §4.3).
 */
class RewardGrant private constructor(
    val id: Long? = null,
    val idempotencyKey: String,
    val placementKey: String,
    val gameId: Long,
    val sessionKey: String?,
    val memberId: Long?,
    var status: RewardStatus,
    val issuedAt: Instant,
    var settledAt: Instant?
) {
    companion object {
        fun issue(
            idempotencyKey: String,
            placementKey: String,
            gameId: Long,
            sessionKey: String?,
            memberId: Long?,
            now: Instant
        ): RewardGrant {
            require(idempotencyKey.isNotBlank()) { "idempotencyKey는 비어있을 수 없습니다" }
            return RewardGrant(
                idempotencyKey = idempotencyKey,
                placementKey = placementKey,
                gameId = gameId,
                sessionKey = sessionKey,
                memberId = memberId,
                status = RewardStatus.PENDING,
                issuedAt = now,
                settledAt = null
            )
        }

        fun restore(
            id: Long?,
            idempotencyKey: String,
            placementKey: String,
            gameId: Long,
            sessionKey: String?,
            memberId: Long?,
            status: RewardStatus,
            issuedAt: Instant,
            settledAt: Instant?
        ): RewardGrant =
            RewardGrant(id, idempotencyKey, placementKey, gameId, sessionKey, memberId, status, issuedAt, settledAt)
    }

    /** 시청 완료 — 멱등: 이미 COMPLETED 면 그대로 두고, FAILED/EXPIRED 에서의 완료는 거부 */
    fun complete(now: Instant) {
        when (status) {
            RewardStatus.COMPLETED -> return
            RewardStatus.PENDING -> {
                status = RewardStatus.COMPLETED
                settledAt = now
            }
            else -> throw RewardAlreadySettledException(idempotencyKey, status.name)
        }
    }

    fun fail(now: Instant) {
        if (status == RewardStatus.PENDING) {
            status = RewardStatus.FAILED
            settledAt = now
        }
    }
}
