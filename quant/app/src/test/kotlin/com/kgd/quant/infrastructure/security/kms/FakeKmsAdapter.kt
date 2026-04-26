package com.kgd.quant.infrastructure.security.kms

import com.kgd.quant.application.port.security.KeyManagementService
import com.kgd.quant.application.port.security.WrappedDek
import java.nio.ByteBuffer
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

/**
 * TG-P2-03.4 — 단위 테스트 전용 Fake KMS.
 *
 * - 메모리 in-process AES-GCM-256
 * - deterministic seed 주입 가능 — 동일 seed 로 동일 KEK / IV 시퀀스 재현 가능 (회귀 테스트 안정화)
 * - 회전 시뮬레이션: [addVersion] 으로 새 버전 추가, [setActive] 로 활성 전환
 *
 * **주의** — 이 어댑터는 테스트 용도이며 운영에 사용 금지.
 */
class FakeKmsAdapter(
    seed: Long = DEFAULT_SEED,
    initialVersion: String = "fake-v1"
) : KeyManagementService {

    private val random = SecureRandom().apply { setSeed(seed) }
    private val keys: MutableMap<String, SecretKeySpec> = LinkedHashMap()
    private var activeVersion: String = initialVersion

    var unwrapErrorToThrow: Throwable? = null
        @Synchronized set
    var wrapCallCount: Int = 0
        private set
    var unwrapCallCount: Int = 0
        private set

    init {
        addVersion(initialVersion)
    }

    /** 새 KEK 버전 추가 (회전 시뮬레이션). */
    fun addVersion(version: String): SecretKeySpec {
        val keyBytes = ByteArray(KEK_SIZE_BYTES).also { random.nextBytes(it) }
        val spec = SecretKeySpec(keyBytes, AES)
        keys[version] = spec
        return spec
    }

    /** 활성 버전 전환. 회전 후 wrap 은 새 버전으로 진행. */
    fun setActive(version: String) {
        require(keys.containsKey(version)) { "FakeKmsAdapter: 등록되지 않은 버전 = $version" }
        activeVersion = version
    }

    override suspend fun wrap(plaintextDek: ByteArray): WrappedDek {
        wrapCallCount++
        require(plaintextDek.size == DEK_SIZE_BYTES) {
            "FakeKmsAdapter: DEK 길이는 $DEK_SIZE_BYTES bytes 여야 한다 (현재=${plaintextDek.size})"
        }
        val key = keys.getValue(activeVersion)
        val iv = ByteArray(IV_LENGTH_BYTES).also { random.nextBytes(it) }
        val cipher = Cipher.getInstance(TRANSFORMATION).apply {
            init(Cipher.ENCRYPT_MODE, key, GCMParameterSpec(GCM_TAG_LENGTH_BITS, iv))
        }
        val ct = cipher.doFinal(plaintextDek)
        val payload = ByteBuffer.allocate(IV_LENGTH_BYTES + ct.size)
            .put(iv)
            .put(ct)
            .array()
        return WrappedDek(ciphertext = payload, kekVersion = activeVersion)
    }

    override suspend fun unwrap(wrapped: WrappedDek): ByteArray {
        unwrapCallCount++
        unwrapErrorToThrow?.let { throw it }
        val key = keys[wrapped.kekVersion]
            ?: error("FakeKmsAdapter: 알 수 없는 KEK 버전 = ${wrapped.kekVersion}")
        val iv = wrapped.ciphertext.copyOfRange(0, IV_LENGTH_BYTES)
        val ct = wrapped.ciphertext.copyOfRange(IV_LENGTH_BYTES, wrapped.ciphertext.size)
        val cipher = Cipher.getInstance(TRANSFORMATION).apply {
            init(Cipher.DECRYPT_MODE, key, GCMParameterSpec(GCM_TAG_LENGTH_BITS, iv))
        }
        return cipher.doFinal(ct)
    }

    override suspend fun currentKekVersion(): String = activeVersion

    companion object {
        const val DEFAULT_SEED = 0xC0FFEEL
        private const val AES = "AES"
        private const val TRANSFORMATION = "AES/GCM/NoPadding"
        private const val IV_LENGTH_BYTES = 12
        private const val GCM_TAG_LENGTH_BITS = 128
        private const val KEK_SIZE_BYTES = 32
        private const val DEK_SIZE_BYTES = 32
    }
}
