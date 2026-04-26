package com.kgd.sevensplit.application.port.credential

import com.kgd.sevensplit.domain.common.TenantId
import com.kgd.sevensplit.domain.credential.Exchange
import java.util.UUID

/**
 * CredentialVault — 거래소 크레덴셜 저장/복호 port.
 *
 * ## 배치 위치
 * Application 레이어. UseCase 가 Exchange 호출 직전에 복호 wrapper 를 얻는다.
 *
 * ## 계약
 * - `store` 는 저장과 동시에 복호 가능 여부를 내부에서 검증한다.
 * - `load` 는 **단명 wrapper** 인 [DecryptedCredential] 을 반환한다. 평문 필드는 로그·DTO·
 *   메트릭에 유출되면 안 된다 — wrapper 의 `toString()` 은 마스킹을 강제.
 * - 구현체는 Vault/KMS 를 사용하며 in-memory 캐시 시 TTL 을 짧게 유지한다.
 *
 * ## 보안
 * - `ipWhitelist` 는 정보성이며, 실제 IP 검증은 거래소 서버에서 이루어짐.
 * - `passphrase` 는 거래소에 따라 null 허용 (빗썸·업비트는 미사용, 일부 해외는 사용).
 */
interface CredentialVault {
    /** 평문을 암호화해 저장. 반환값은 생성된 `credentialId`. */
    suspend fun store(tenantId: TenantId, exchange: Exchange, plaintext: CredentialPlaintext): UUID

    /** 해당 tenant/exchange 의 크레덴셜을 복호해 단명 wrapper 로 반환. */
    suspend fun load(tenantId: TenantId, exchange: Exchange): DecryptedCredential
}

/**
 * CredentialPlaintext — `store` 호출 시 전달되는 평문 입력.
 *
 * 호출 후 GC 대상이 되도록 짧게 사용해야 한다 (장기 참조 금지).
 */
data class CredentialPlaintext(
    val apiKey: String,
    val apiSecret: String,
    val passphrase: String? = null,
    val ipWhitelist: List<String> = emptyList()
)

/**
 * DecryptedCredential — 복호된 평문을 감싸는 단명 wrapper.
 *
 * ## 보안 계약
 * - `toString()` 은 평문을 절대 노출하지 않는다 (마스킹).
 * - `equals`/`hashCode` 는 참조 기반 (기본) — 의도적으로 override 하지 않아 값 비교로 인한
 *   메모리 덤프/로그 유출을 차단.
 * - 이 타입은 DTO, Kafka payload, 도메인 이벤트에 포함되면 안 된다 (Review에서 grep 금지 규칙).
 */
class DecryptedCredential(
    val credentialId: UUID,
    val apiKey: String,
    val apiSecret: String,
    val passphrase: String?,
    val ipWhitelist: List<String>
) {
    override fun toString(): String =
        "DecryptedCredential(credentialId=$credentialId, " +
            "apiKey=[REDACTED], apiSecret=[REDACTED], " +
            "passphrase=${if (passphrase == null) "null" else "[REDACTED]"}, " +
            "ipWhitelist=$ipWhitelist)"
}
