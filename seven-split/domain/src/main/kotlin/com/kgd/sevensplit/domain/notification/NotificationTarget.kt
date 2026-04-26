package com.kgd.sevensplit.domain.notification

import com.kgd.sevensplit.domain.common.TenantId

/**
 * NotificationTarget — 알림 수신 채널 설정 VO.
 *
 * `botTokenCipher` 는 암호화된 값. `toString()` 에서 마스킹한다.
 */
class NotificationTarget(
    val tenantId: TenantId,
    val channel: NotificationChannel,
    val botTokenCipher: ByteArray,
    val chatId: String
) {
    override fun toString(): String =
        "NotificationTarget(tenantId=$tenantId, channel=$channel, " +
                "botTokenCipher=[REDACTED], chatId=$chatId)"

    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is NotificationTarget) return false
        return tenantId == other.tenantId && channel == other.channel && chatId == other.chatId
    }

    override fun hashCode(): Int {
        var result = tenantId.hashCode()
        result = 31 * result + channel.hashCode()
        result = 31 * result + chatId.hashCode()
        return result
    }
}
