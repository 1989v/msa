package com.kgd.quant.infrastructure.security.kms

import com.kgd.quant.application.port.security.KeyManagementService
import com.kgd.quant.application.port.security.WrappedDek
import com.oracle.bmc.Region
import com.oracle.bmc.auth.SimpleAuthenticationDetailsProvider
import com.oracle.bmc.keymanagement.KmsCryptoClient
import com.oracle.bmc.keymanagement.model.DecryptDataDetails
import com.oracle.bmc.keymanagement.model.EncryptDataDetails
import com.oracle.bmc.keymanagement.requests.DecryptRequest
import com.oracle.bmc.keymanagement.requests.EncryptRequest
import io.github.oshai.kotlinlogging.KotlinLogging
import jakarta.annotation.PostConstruct
import jakarta.annotation.PreDestroy
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.boot.context.properties.ConfigurationProperties
import org.springframework.context.annotation.Profile
import org.springframework.stereotype.Component
import java.io.FileInputStream
import java.util.Base64
import java.util.concurrent.atomic.AtomicReference

private val logger = KotlinLogging.logger {}

/**
 * TG-P2-03.2 — OCI Vault 기반 KEK 어댑터 (운영 전용).
 *
 * OCI Java SDK 의 [KmsCryptoClient] 를 사용해 master encryption key 로 DEK 를 wrap/unwrap 한다.
 * 모든 호출은 blocking SDK 라 [Dispatchers.IO] 위에서 [withContext] 로 격리한다.
 *
 * ## 자격증명
 * 다음 환경변수가 필수다 (Phase 2 운영 K8s Secret 으로 주입):
 * - `OCI_TENANCY` — 테넌시 OCID
 * - `OCI_USER` — IAM 사용자 OCID
 * - `OCI_FINGERPRINT` — API 키 fingerprint
 * - `OCI_PRIVATE_KEY_PATH` — private key 파일 경로 (PEM)
 * - `OCI_REGION` — 예: `ap-seoul-1`
 * - `OCI_VAULT_KEY_OCID` — master KEK 의 OCID
 * - `OCI_VAULT_CRYPTO_ENDPOINT` — Vault 별 crypto endpoint URL
 *
 * 미세팅 시 [PostConstruct] 단계에서 fail-fast (어플리케이션 기동 실패).
 *
 * ## currentKekVersion
 * 본 어댑터는 OCI Vault 에서 활성 key version 을 직접 조회하지 않고 설정값
 * `quant.security.kms.oci.vault-key-ocid` (또는 명시된 key version OCID) 를 그대로 반환한다.
 * 회전 시점에는 동일 master key 의 새 version OCID 를 K8s Secret 으로 갱신한다.
 *
 * ## 보안
 * - 평문 DEK 는 SDK 호출 직후 즉시 사용/캐시되며 별도 보관/로깅 금지.
 * - encrypt/decrypt 응답의 ciphertext 는 base64 문자열이라 길이만 로그에 남긴다.
 */
@Component
@Profile("oci")
@ConditionalOnProperty(
    name = ["quant.security.kms.provider"],
    havingValue = "oci"
)
class OciVaultKmsAdapter(
    private val properties: OciKmsProperties
) : KeyManagementService {

    private val clientRef = AtomicReference<KmsCryptoClient>()

    @PostConstruct
    fun init() {
        properties.requireValid()
        val provider = SimpleAuthenticationDetailsProvider.builder()
            .tenantId(properties.tenancyOcid)
            .userId(properties.userOcid)
            .fingerprint(properties.fingerprint)
            .privateKeySupplier { FileInputStream(properties.privateKeyPath!!) }
            .region(Region.fromRegionId(properties.region!!))
            .build()
        val client = KmsCryptoClient.builder()
            .endpoint(properties.cryptoEndpoint!!)
            .build(provider)
        clientRef.set(client)
        logger.info {
            "OciVaultKmsAdapter initialized: region=${properties.region} " +
                "vaultKeyOcid=${maskOcid(properties.vaultKeyOcid!!)}"
        }
    }

    @PreDestroy
    fun shutdown() {
        runCatching { clientRef.get()?.close() }
            .onFailure { logger.warn(it) { "OciVaultKmsAdapter close failed" } }
    }

    override suspend fun wrap(plaintextDek: ByteArray): WrappedDek = withContext(Dispatchers.IO) {
        val client = clientOrThrow()
        val keyOcid = properties.vaultKeyOcid!!
        val request = EncryptRequest.builder()
            .encryptDataDetails(
                EncryptDataDetails.builder()
                    .keyId(keyOcid)
                    .plaintext(Base64.getEncoder().encodeToString(plaintextDek))
                    .build()
            )
            .build()
        val response = client.encrypt(request)
        val ct = response.encryptedData.ciphertext
        WrappedDek(
            ciphertext = ct.toByteArray(Charsets.US_ASCII),
            kekVersion = keyOcid
        )
    }

    override suspend fun unwrap(wrapped: WrappedDek): ByteArray = withContext(Dispatchers.IO) {
        val client = clientOrThrow()
        val keyOcid = wrapped.kekVersion
        val ciphertextBase64 = String(wrapped.ciphertext, Charsets.US_ASCII)
        val request = DecryptRequest.builder()
            .decryptDataDetails(
                DecryptDataDetails.builder()
                    .keyId(keyOcid)
                    .ciphertext(ciphertextBase64)
                    .build()
            )
            .build()
        val response = client.decrypt(request)
        Base64.getDecoder().decode(response.decryptedData.plaintext)
    }

    override suspend fun currentKekVersion(): String =
        properties.vaultKeyOcid
            ?: error("OciVaultKmsAdapter: vault-key-ocid 가 설정되지 않았다")

    private fun clientOrThrow(): KmsCryptoClient =
        clientRef.get()
            ?: error("OciVaultKmsAdapter: KmsCryptoClient 가 초기화되지 않았다 (init() 실패)")

    private fun maskOcid(ocid: String): String =
        if (ocid.length <= 12) "***" else ocid.take(8) + "***" + ocid.takeLast(4)
}

/**
 * OCI KMS 어댑터 설정.
 *
 * 예시 (`application.yml`, K8s Secret 으로 주입):
 * ```yaml
 * quant:
 *   security:
 *     kms:
 *       provider: oci
 *       oci:
 *         tenancy-ocid: ${OCI_TENANCY:}
 *         user-ocid: ${OCI_USER:}
 *         fingerprint: ${OCI_FINGERPRINT:}
 *         private-key-path: ${OCI_PRIVATE_KEY_PATH:}
 *         region: ${OCI_REGION:}
 *         vault-key-ocid: ${OCI_VAULT_KEY_OCID:}
 *         crypto-endpoint: ${OCI_VAULT_CRYPTO_ENDPOINT:}
 * ```
 */
@ConfigurationProperties(prefix = "quant.security.kms.oci")
data class OciKmsProperties(
    var tenancyOcid: String? = null,
    var userOcid: String? = null,
    var fingerprint: String? = null,
    var privateKeyPath: String? = null,
    var region: String? = null,
    var vaultKeyOcid: String? = null,
    var cryptoEndpoint: String? = null
) {
    fun requireValid() {
        val missing = buildList {
            if (tenancyOcid.isNullOrBlank()) add("tenancy-ocid")
            if (userOcid.isNullOrBlank()) add("user-ocid")
            if (fingerprint.isNullOrBlank()) add("fingerprint")
            if (privateKeyPath.isNullOrBlank()) add("private-key-path")
            if (region.isNullOrBlank()) add("region")
            if (vaultKeyOcid.isNullOrBlank()) add("vault-key-ocid")
            if (cryptoEndpoint.isNullOrBlank()) add("crypto-endpoint")
        }
        check(missing.isEmpty()) {
            "OciVaultKmsAdapter: 필수 설정 누락 = $missing. " +
                "K8s Secret 또는 환경변수(OCI_TENANCY, OCI_USER, OCI_FINGERPRINT, OCI_PRIVATE_KEY_PATH, " +
                "OCI_REGION, OCI_VAULT_KEY_OCID, OCI_VAULT_CRYPTO_ENDPOINT) 확인 필요."
        }
    }
}
