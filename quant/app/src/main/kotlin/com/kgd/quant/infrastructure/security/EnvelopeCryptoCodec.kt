package com.kgd.quant.infrastructure.security

import com.kgd.quant.application.port.security.KeyManagementService
import com.kgd.quant.application.port.security.WrappedDek
import com.kgd.quant.infrastructure.security.kms.KmsDekCache
import org.springframework.stereotype.Component
import java.nio.ByteBuffer
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

/**
 * TG-P2-04.2 — Envelope Encryption Codec.
 *
 * ## 설계
 *  - 매 [encrypt] 호출마다 새 DEK(AES-256, 32 bytes) 를 생성한다.
 *  - DEK 는 [KeyManagementService.wrap] 으로 KEK wrap → 영구 저장 (`dek_wrapped` 컬럼).
 *  - 평문은 AES-GCM(DEK) 으로 암호화 → 영구 저장 (기존 `*_cipher` 컬럼 재사용).
 *  - [decrypt] 는 [KmsDekCache] 를 통해 KMS unwrap 결과를 캐시 (TTL 30분, stale-on-error).
 *  - [encryptGroup] 은 동일 DEK 로 다수 평문(예: api_key + api_secret + passphrase) 을 묶어 wrap.
 *    저장 시 `dek_wrapped` 컬럼 1개에 동일 DEK wrap 결과를 공유한다.
 *
 * ## Storage layout
 *  - `ciphertext`: `[12-byte IV][AES-GCM ciphertext + 16-byte tag]` (각 평문마다 IV 별도)
 *  - `wrapped_dek`: KMS wrap 결과 (raw bytes)
 *  - `kek_version` (라벨): KMS 가 부여한 버전 식별자
 *      - LocalFile: `local-vN`
 *      - OCI Vault: key version OCID
 *
 * ## 보안
 *  - 평문 DEK 는 함수 종료 시점에 best-effort 0 으로 덮어쓴다 (JVM 보장 X 이지만 노출 표면 축소).
 *  - 평문 DEK 는 어떤 로깅/메트릭/toString 에도 노출되지 않는다.
 *  - [EnvelopeCiphertext.toString] / [EnvelopeGroup.toString] 은 ciphertext 와 DEK ciphertext 를
 *    모두 마스킹한다.
 *
 * ## 트랜잭션
 *  - 본 컴포넌트는 stateless 하고 외부 IO 는 KMS 호출(suspend) 뿐이다.
 *  - JPA 트랜잭션 내부에서 호출하는 것을 금지한다 (ADR-0020 외부 IO 분리).
 *    호출 측은 트랜잭션 시작 전에 envelope 변환을 수행한다.
 */
@Component
class EnvelopeCryptoCodec(
    private val kms: KeyManagementService,
    private val dekCache: KmsDekCache,
) {

    private val random = SecureRandom()

    /**
     * 단일 평문 → envelope ciphertext.
     *
     * @return [EnvelopeCiphertext] (ciphertext + wrapped DEK + kek 버전 라벨)
     */
    suspend fun encrypt(plaintext: ByteArray): EnvelopeCiphertext {
        val dek = ByteArray(DEK_SIZE_BYTES).also { random.nextBytes(it) }
        try {
            val wrapped = kms.wrap(dek)
            val ct = encryptWithDek(dek, plaintext)
            return EnvelopeCiphertext(ciphertext = ct, wrappedDek = wrapped)
        } finally {
            dek.fill(0)
        }
    }

    /**
     * 다수 평문 → 동일 DEK 로 wrap 하고 각각 ciphertext 반환.
     *
     * 사용 예: ExchangeCredential 의 `apiKeyCipher` / `apiSecretCipher` / `passphraseCipher` 를
     * 단일 DEK 로 묶어 `dek_wrapped` 컬럼 1개에 저장.
     *
     * @param plaintexts 인덱스 보존 (반환 ciphertexts 의 i 가 입력 i 와 1:1 대응)
     * @return [EnvelopeGroup] (ciphertexts + 단일 wrapped DEK)
     */
    suspend fun encryptGroup(plaintexts: List<ByteArray>): EnvelopeGroup {
        require(plaintexts.isNotEmpty()) { "EnvelopeCryptoCodec.encryptGroup: empty plaintext list" }
        val dek = ByteArray(DEK_SIZE_BYTES).also { random.nextBytes(it) }
        try {
            val wrapped = kms.wrap(dek)
            val cts = plaintexts.map { encryptWithDek(dek, it) }
            return EnvelopeGroup(ciphertexts = cts, wrappedDek = wrapped)
        } finally {
            dek.fill(0)
        }
    }

    /**
     * envelope ciphertext → 평문.
     *
     * - [KmsDekCache] hit 시 KMS 호출 없이 반환.
     * - KMS 일시 장애 시 stale-on-error 로 만료된 캐시 entry 재사용 (캐시에 entry 있을 때만).
     */
    suspend fun decrypt(ciphertext: ByteArray, wrapped: WrappedDek): ByteArray {
        require(ciphertext.size > IV_LENGTH_BYTES) {
            "EnvelopeCryptoCodec: ciphertext 길이가 비정상 (${ciphertext.size} bytes, 최소=${IV_LENGTH_BYTES + 1})"
        }
        val dek = dekCache.unwrap(wrapped)
        return decryptWithDek(dek, ciphertext)
    }

    private fun encryptWithDek(dek: ByteArray, plaintext: ByteArray): ByteArray {
        val iv = ByteArray(IV_LENGTH_BYTES).also { random.nextBytes(it) }
        val cipher = Cipher.getInstance(TRANSFORMATION).apply {
            init(Cipher.ENCRYPT_MODE, SecretKeySpec(dek, AES), GCMParameterSpec(GCM_TAG_LENGTH_BITS, iv))
        }
        val ct = cipher.doFinal(plaintext)
        return ByteBuffer.allocate(IV_LENGTH_BYTES + ct.size)
            .put(iv)
            .put(ct)
            .array()
    }

    private fun decryptWithDek(dek: ByteArray, ciphertext: ByteArray): ByteArray {
        val iv = ciphertext.copyOfRange(0, IV_LENGTH_BYTES)
        val body = ciphertext.copyOfRange(IV_LENGTH_BYTES, ciphertext.size)
        val cipher = Cipher.getInstance(TRANSFORMATION).apply {
            init(Cipher.DECRYPT_MODE, SecretKeySpec(dek, AES), GCMParameterSpec(GCM_TAG_LENGTH_BITS, iv))
        }
        return cipher.doFinal(body)
    }

    companion object {
        private const val AES = "AES"
        private const val TRANSFORMATION = "AES/GCM/NoPadding"
        private const val IV_LENGTH_BYTES = 12
        private const val GCM_TAG_LENGTH_BITS = 128
        private const val DEK_SIZE_BYTES = 32  // AES-256
    }
}

/**
 * 단일 plaintext envelope 결과.
 */
data class EnvelopeCiphertext(
    val ciphertext: ByteArray,
    val wrappedDek: WrappedDek
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is EnvelopeCiphertext) return false
        return ciphertext.contentEquals(other.ciphertext) && wrappedDek == other.wrappedDek
    }

    override fun hashCode(): Int = 31 * ciphertext.contentHashCode() + wrappedDek.hashCode()

    override fun toString(): String =
        "EnvelopeCiphertext(kekVersion=${wrappedDek.kekVersion}, ct=[REDACTED ${ciphertext.size}B], dek=[REDACTED ${wrappedDek.ciphertext.size}B])"
}

/**
 * 다수 plaintext 가 동일 DEK 로 묶인 envelope 결과.
 *
 * 저장 시: 각 ciphertext 는 별도 컬럼 (`api_key_cipher` 등) 에, `wrappedDek` 는 단일 `dek_wrapped` 컬럼에.
 * 회수 시: `wrappedDek` unwrap → 동일 DEK 로 모든 ciphertext 복호 가능.
 */
data class EnvelopeGroup(
    val ciphertexts: List<ByteArray>,
    val wrappedDek: WrappedDek
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is EnvelopeGroup) return false
        if (wrappedDek != other.wrappedDek) return false
        if (ciphertexts.size != other.ciphertexts.size) return false
        for (i in ciphertexts.indices) {
            if (!ciphertexts[i].contentEquals(other.ciphertexts[i])) return false
        }
        return true
    }

    override fun hashCode(): Int {
        var result = wrappedDek.hashCode()
        for (ct in ciphertexts) result = 31 * result + ct.contentHashCode()
        return result
    }

    override fun toString(): String {
        val sizes = ciphertexts.map { it.size }
        return "EnvelopeGroup(kekVersion=${wrappedDek.kekVersion}, ctSizes=$sizes, dek=[REDACTED ${wrappedDek.ciphertext.size}B])"
    }
}
