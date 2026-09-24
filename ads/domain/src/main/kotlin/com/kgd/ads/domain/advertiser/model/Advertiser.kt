package com.kgd.ads.domain.advertiser.model

import com.kgd.ads.domain.advertiser.exception.InvalidAdvertiserException
import java.time.LocalDateTime

/**
 * 광고주. `MEMBER` 는 회원 1명당 1행이고 등록 즉시 `ACTIVE` 다.
 * 광고주가 되어도 전역 Role 은 바뀌지 않는다 — 권한은 이 행이 갖는다.
 *
 * 정지(`SUSPENDED`)는 운영자만 하고 사유·행위자·시각을 남긴다. 정지된 광고주는 조회만 되고 쓰기는 거절된다.
 */
class Advertiser private constructor(
    val id: Long?,
    val kind: AdvertiserKind,
    val memberId: Long?,
    val displayName: String,
    status: AdvertiserStatus,
    suspension: AdvertiserSuspension?,
) {
    var status: AdvertiserStatus = status
        private set
    var suspension: AdvertiserSuspension? = suspension
        private set

    init {
        // SYSTEM(「1989v 하우스」)은 회원도 지갑도 없다 — 회원 id 유무가 곧 종류다.
        require((kind == AdvertiserKind.MEMBER) == (memberId != null)) { "MEMBER 광고주만 회원 id 를 갖습니다" }
    }

    /** 캠페인·소재·충전 같은 쓰기를 할 수 있는지. */
    val canWrite: Boolean get() = status == AdvertiserStatus.ACTIVE

    fun suspend(reason: String, actorMemberId: Long, at: LocalDateTime) {
        // SYSTEM 을 정지하면 HOUSE 가 전부 빠져 자체 홍보 대체 경로가 사라진다.
        if (kind != AdvertiserKind.MEMBER) throw InvalidAdvertiserException("SYSTEM 광고주는 정지할 수 없습니다")
        if (status != AdvertiserStatus.ACTIVE) throw InvalidAdvertiserException("이미 정지된 광고주입니다")
        suspension = AdvertiserSuspension.of(reason, actorMemberId, at)
        status = AdvertiserStatus.SUSPENDED
    }

    fun unsuspend() {
        if (status != AdvertiserStatus.SUSPENDED) throw InvalidAdvertiserException("정지된 광고주가 아닙니다")
        suspension = null
        status = AdvertiserStatus.ACTIVE
    }

    companion object {
        const val MAX_DISPLAY_NAME_LENGTH = 100

        fun registerMember(memberId: Long, displayName: String): Advertiser {
            val name = displayName.trim()
            if (name.isEmpty() || name.length > MAX_DISPLAY_NAME_LENGTH) {
                throw InvalidAdvertiserException("광고주 이름은 1~${MAX_DISPLAY_NAME_LENGTH}자여야 합니다")
            }
            return Advertiser(null, AdvertiserKind.MEMBER, memberId, name, AdvertiserStatus.ACTIVE, null)
        }

        fun restore(
            id: Long,
            kind: AdvertiserKind,
            memberId: Long?,
            displayName: String,
            status: AdvertiserStatus,
            suspension: AdvertiserSuspension? = null,
        ): Advertiser = Advertiser(id, kind, memberId, displayName, status, suspension)
    }
}

/** 정지 사유·행위자(운영자 회원 id)·시각. */
data class AdvertiserSuspension(val reason: String, val actorMemberId: Long, val at: LocalDateTime) {
    companion object {
        const val MAX_REASON_LENGTH = 255

        fun of(reason: String, actorMemberId: Long, at: LocalDateTime): AdvertiserSuspension {
            val trimmed = reason.trim()
            if (trimmed.isEmpty() || trimmed.length > MAX_REASON_LENGTH) {
                throw InvalidAdvertiserException("정지 사유는 1~${MAX_REASON_LENGTH}자여야 합니다")
            }
            return AdvertiserSuspension(trimmed, actorMemberId, at)
        }
    }
}
