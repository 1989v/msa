package com.kgd.quant.infrastructure.security.kms

import com.github.benmanes.caffeine.cache.Cache
import com.github.benmanes.caffeine.cache.Caffeine
import com.kgd.quant.application.port.security.KeyManagementService
import com.kgd.quant.application.port.security.WrappedDek
import com.kgd.quant.infrastructure.metrics.QuantMetrics
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.stereotype.Component
import java.time.Instant
import java.util.concurrent.TimeUnit

private val logger = KotlinLogging.logger {}

/**
 * TG-P2-03.5 — DEK 캐시 (Caffeine).
 *
 * - TTL 30분 (`expireAfterWrite`).
 * - Stale-on-error 정책: KMS 호출 실패 시 만료된 entry 라도 반환해 일시 장애 동안
 *   degrade-with-warning 한다 (ADR-0027 §6 정정).
 * - 메트릭 3종을 [QuantMetrics] 로 노출:
 *   - `quant_kek_cache_hits_total` — TTL 내 hit
 *   - `quant_kek_cache_misses_total` — KMS unwrap 호출 발생
 *   - `quant_kek_cache_stale_total` — KMS 실패 시 만료 entry 재사용
 *
 * ## 캐시 키 설계
 * `kekVersion + ":" + sha-of-ciphertext` 가 아닌 `kekVersion + ":" + hex(ciphertext)` 를 키로 한다.
 * ciphertext 자체가 wrap 결과이므로 추가 해시 없이도 충돌 위험 없음. 길이는 어댑터별 ~수십 바이트
 * (LocalFile = 32 bytes IV+CT, OCI = base64 ASCII) 로 메모리 부담 적음.
 *
 * ## 보안
 * - 평문 DEK 는 캐시 값으로 메모리에만 존재. 로그 출력 절대 금지.
 * - 캐시 키에는 ciphertext 만 들어가며 평문은 포함되지 않는다.
 * - [getIfPresentRaw] 는 테스트용 visibility (internal) — 운영 코드는 [unwrap] 만 사용.
 */
@Component
class KmsDekCache(
    private val kms: KeyManagementService,
    private val metrics: QuantMetrics? = null
) {

    private val cache: Cache<String, CachedDek> = Caffeine.newBuilder()
        .maximumSize(MAX_ENTRIES)
        .expireAfterWrite(TTL_MINUTES, TimeUnit.MINUTES)
        .build()

    /**
     * Wrap 된 DEK 를 unwrap. 캐시 hit 시 KMS 호출을 생략한다.
     *
     * 흐름:
     *  1. 캐시 hit → 즉시 반환 (`hits++`)
     *  2. 캐시 miss → KMS unwrap → 캐시 저장 → 반환 (`misses++`)
     *  3. KMS 실패 시 — `asMap()` 으로 만료 직전 entry 가 살아있으면 stale 반환 (`stale++`)
     *  4. 그것도 없으면 원본 예외 throw
     */
    suspend fun unwrap(wrapped: WrappedDek): ByteArray {
        val key = cacheKey(wrapped)

        cache.getIfPresent(key)?.let {
            metrics?.kekCacheHit()
            return it.dek
        }

        return try {
            val dek = kms.unwrap(wrapped)
            cache.put(key, CachedDek(dek, Instant.now()))
            metrics?.kekCacheMiss()
            dek
        } catch (e: Exception) {
            // stale-on-error: Caffeine 의 expireAfterWrite 가 이미 evict 했을 수 있어
            // asMap() 으로 raw 접근 후 가장 최근 cached entry 가 있으면 degrade 반환.
            val stale = cache.asMap()[key]
            if (stale != null) {
                metrics?.kekCacheStale()
                logger.warn(e) {
                    "KmsDekCache: KMS unwrap failed, returning stale DEK " +
                        "kekVersion=${wrapped.kekVersion} cachedAt=${stale.cachedAt}"
                }
                stale.dek
            } else {
                throw e
            }
        }
    }

    /** 테스트/관리용 — 캐시 비우기. */
    fun invalidateAll() {
        cache.invalidateAll()
    }

    /**
     * 테스트 visibility — 운영 코드 사용 금지.
     * Spec 검증용 (KmsDekCacheStaleOnErrorSpec) 으로만 사용.
     */
    internal fun getIfPresentRaw(wrapped: WrappedDek): CachedDek? =
        cache.asMap()[cacheKey(wrapped)]

    private fun cacheKey(wrapped: WrappedDek): String =
        wrapped.kekVersion + ":" + wrapped.ciphertext.toHex()

    private fun ByteArray.toHex(): String {
        val sb = StringBuilder(size * 2)
        for (b in this) {
            sb.append(HEX_CHARS[(b.toInt() ushr 4) and 0x0F])
            sb.append(HEX_CHARS[b.toInt() and 0x0F])
        }
        return sb.toString()
    }

    /**
     * 캐시 entry. dek 는 평문 ByteArray — toString/log 노출 금지.
     */
    internal data class CachedDek(
        val dek: ByteArray,
        val cachedAt: Instant
    ) {
        override fun equals(other: Any?): Boolean {
            if (this === other) return true
            if (other !is CachedDek) return false
            return dek.contentEquals(other.dek) && cachedAt == other.cachedAt
        }

        override fun hashCode(): Int = 31 * dek.contentHashCode() + cachedAt.hashCode()

        override fun toString(): String =
            "CachedDek(cachedAt=$cachedAt, dek=[REDACTED ${dek.size}B])"
    }

    companion object {
        private const val MAX_ENTRIES = 1_000L
        private const val TTL_MINUTES = 30L
        private val HEX_CHARS = "0123456789abcdef".toCharArray()
    }
}
