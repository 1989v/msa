package com.kgd.sevensplit.domain.credential

import com.kgd.sevensplit.domain.common.TenantId
import java.util.UUID

/**
 * ExchangeCredential — 거래소 API 키를 보유하는 Aggregate.
 *
 * 모든 민감 값은 이미 암호화된 바이트 배열(`*Cipher`) 상태로 보관한다.
 * 평문 접근은 Infrastructure 레이어의 decrypt use case에서만 허용되며,
 * 로깅 방지를 위해 `toString()`/`equals`/`hashCode` 는 모두 마스킹한다.
 */
class ExchangeCredential(
    val credentialId: UUID,
    val tenantId: TenantId,
    val exchange: Exchange,
    val apiKeyCipher: ByteArray,
    val apiSecretCipher: ByteArray,
    val passphraseCipher: ByteArray?,
    val ipWhitelist: List<String>
) {
    override fun toString(): String =
        "ExchangeCredential(credentialId=$credentialId, tenantId=$tenantId, exchange=$exchange, " +
                "apiKeyCipher=[REDACTED], apiSecretCipher=[REDACTED], " +
                "passphraseCipher=${if (passphraseCipher == null) "null" else "[REDACTED]"}, " +
                "ipWhitelist=$ipWhitelist)"

    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is ExchangeCredential) return false
        return credentialId == other.credentialId
    }

    override fun hashCode(): Int = credentialId.hashCode()
}
