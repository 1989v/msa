package com.kgd.quant.infrastructure.security.kms

import com.kgd.quant.application.port.security.KeyManagementService
import com.kgd.quant.application.port.security.WrappedDek
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.boot.context.properties.ConfigurationProperties
import org.springframework.context.annotation.Profile
import org.springframework.stereotype.Component
import java.nio.ByteBuffer
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

/**
 * TG-P2-03.3 — 로컬 dev / k3s-lite 용 LocalFile KMS 어댑터.
 *
 * 외부 KMS 호출 없이 in-process AES-GCM-256 으로 DEK 를 wrap/unwrap 한다.
 * KEK 자체는 환경변수 또는 application.yml(`quant.security.kms.local`)
 * 에서 hex-encoded 32-byte 키로 주입된다.
 *
 * ## 회전
 * - `kek-versions` 맵에 여러 버전을 등록 (`v1: hex...`, `v2: hex...`).
 * - 현재 활성은 `current-version` (예: `v2`).
 * - wrap 은 현재 활성 KEK, unwrap 은 [WrappedDek.kekVersion] 에 기록된 버전을 사용.
 * - 활성 미존재/알 수 없는 버전은 [IllegalStateException].
 *
 * ## Profile
 * - `local`, `test` 에서 활성화 가능. `quant.security.kms.provider=local` 일 때만 빈 등록.
 *
 * ## 보안
 * - 평문 KEK / DEK 는 로그에 절대 출력하지 않는다.
 * - 토큰 식별자만 로그 (예: 버전 라벨 `local-v1`).
 */
@Component
@Profile("local", "test")
@ConditionalOnProperty(
    name = ["quant.security.kms.provider"],
    havingValue = "local",
    matchIfMissing = false
)
class LocalFileKmsAdapter(
    private val properties: LocalKmsProperties
) : KeyManagementService {

    private val secureRandom = SecureRandom()

    private val keys: Map<String, SecretKeySpec> by lazy {
        val raw = properties.kekVersions
        require(raw.isNotEmpty()) {
            "LocalFileKmsAdapter: quant.security.kms.local.kek-versions 가 비어 있다. " +
                "최소 1개 이상의 KEK 버전이 필요하다."
        }
        raw.mapValues { (version, hex) ->
            val bytes = decodeKekHex(version, hex)
            SecretKeySpec(bytes, AES)
        }
    }

    private val activeVersionLabel: String by lazy {
        val current = properties.currentVersion?.takeIf { it.isNotBlank() }
            ?: error(
                "LocalFileKmsAdapter: quant.security.kms.local.current-version 가 설정되지 않았다."
            )
        require(keys.containsKey(current)) {
            "LocalFileKmsAdapter: current-version=$current 가 kek-versions 맵에 없다. " +
                "등록된 버전: ${keys.keys}"
        }
        toFullVersionLabel(current)
    }

    override suspend fun wrap(plaintextDek: ByteArray): WrappedDek {
        require(plaintextDek.size == DEK_SIZE_BYTES) {
            "LocalFileKmsAdapter: DEK 길이는 $DEK_SIZE_BYTES bytes 여야 한다 (현재=${plaintextDek.size})"
        }
        val versionLabel = activeVersionLabel
        val shortVersion = stripLocalPrefix(versionLabel)
        val key = keys.getValue(shortVersion)
        val iv = ByteArray(IV_LENGTH_BYTES).also { secureRandom.nextBytes(it) }
        val cipher = Cipher.getInstance(TRANSFORMATION).apply {
            init(Cipher.ENCRYPT_MODE, key, GCMParameterSpec(GCM_TAG_LENGTH_BITS, iv))
        }
        val ct = cipher.doFinal(plaintextDek)
        val payload = ByteBuffer.allocate(IV_LENGTH_BYTES + ct.size)
            .put(iv)
            .put(ct)
            .array()
        return WrappedDek(ciphertext = payload, kekVersion = versionLabel)
    }

    override suspend fun unwrap(wrapped: WrappedDek): ByteArray {
        val shortVersion = stripLocalPrefix(wrapped.kekVersion)
        val key = keys[shortVersion]
            ?: error(
                "LocalFileKmsAdapter: 알 수 없는 KEK 버전 = ${wrapped.kekVersion}. " +
                    "등록된 버전: ${keys.keys.map { toFullVersionLabel(it) }}"
            )
        require(wrapped.ciphertext.size > IV_LENGTH_BYTES) {
            "LocalFileKmsAdapter: ciphertext 길이가 비정상 (${wrapped.ciphertext.size} bytes)"
        }
        val iv = wrapped.ciphertext.copyOfRange(0, IV_LENGTH_BYTES)
        val ct = wrapped.ciphertext.copyOfRange(IV_LENGTH_BYTES, wrapped.ciphertext.size)
        val cipher = Cipher.getInstance(TRANSFORMATION).apply {
            init(Cipher.DECRYPT_MODE, key, GCMParameterSpec(GCM_TAG_LENGTH_BITS, iv))
        }
        return cipher.doFinal(ct)
    }

    override suspend fun currentKekVersion(): String = activeVersionLabel

    private fun decodeKekHex(version: String, hex: String): ByteArray {
        val cleaned = hex.trim()
        require(cleaned.length == KEK_HEX_LENGTH) {
            "LocalFileKmsAdapter: KEK $version 의 hex 길이가 $KEK_HEX_LENGTH 이어야 한다 " +
                "(현재=${cleaned.length}). AES-256 = 32 bytes = 64 hex chars."
        }
        require(cleaned.all { it.isDigit() || it in 'a'..'f' || it in 'A'..'F' }) {
            "LocalFileKmsAdapter: KEK $version 에 hex 가 아닌 문자가 포함됨"
        }
        return ByteArray(cleaned.length / 2) { i ->
            val hi = Character.digit(cleaned[i * 2], 16)
            val lo = Character.digit(cleaned[i * 2 + 1], 16)
            ((hi shl 4) or lo).toByte()
        }
    }

    private fun toFullVersionLabel(short: String): String =
        if (short.startsWith(LOCAL_PREFIX)) short else "$LOCAL_PREFIX$short"

    private fun stripLocalPrefix(label: String): String =
        if (label.startsWith(LOCAL_PREFIX)) label.removePrefix(LOCAL_PREFIX) else label

    companion object {
        private const val AES = "AES"
        private const val TRANSFORMATION = "AES/GCM/NoPadding"
        private const val IV_LENGTH_BYTES = 12
        private const val GCM_TAG_LENGTH_BITS = 128
        private const val KEK_HEX_LENGTH = 64  // AES-256 = 32 bytes = 64 hex
        private const val DEK_SIZE_BYTES = 32  // AES-256 DEK
        private const val LOCAL_PREFIX = "local-"
    }
}

/**
 * LocalFile KMS 설정.
 *
 * 예시 (`application-local.yml`):
 * ```yaml
 * quant:
 *   security:
 *     kms:
 *       provider: local
 *       local:
 *         current-version: v1
 *         kek-versions:
 *           v1: 0000000000000000000000000000000000000000000000000000000000000000
 * ```
 *
 * 환경변수 매핑:
 * - `SEVEN_SPLIT_SECURITY_KMS_LOCAL_CURRENT_VERSION`
 * - `SEVEN_SPLIT_SECURITY_KMS_LOCAL_KEK_VERSIONS_V1` 등
 */
@ConfigurationProperties(prefix = "quant.security.kms.local")
data class LocalKmsProperties(
    /** 현재 활성 KEK 버전 키 (kek-versions 맵의 키). 예: `v1` */
    var currentVersion: String? = null,
    /** 버전 → hex(64 chars) KEK 매핑. */
    var kekVersions: Map<String, String> = emptyMap()
)
