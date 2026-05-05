package com.kgd.codedictionary.infrastructure.cache

import com.github.benmanes.caffeine.cache.Caffeine
import org.springframework.cache.CacheManager
import org.springframework.cache.annotation.EnableCaching
import org.springframework.cache.caffeine.CaffeineCacheManager
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import java.time.Duration

/**
 * Caffeine in-memory CacheManager.
 *
 * - V1: 단일 인스턴스 in-memory (spec.md §7 Caching Strategy)
 * - cache name: `conceptCategoryStats` — TTL 5 분, max 256 entries
 * - Micrometer Caffeine 통합 (`recordStats()` enable) — `cache.gets`, `cache.puts`, `cache.evictions` 노출
 * - V2 (별도 스펙): prod-k8s 다중 인스턴스 → Redis 분산 캐시 + StatsCachePort 추상화 검토
 */
@Configuration
@EnableCaching
class CacheConfig {

    @Bean
    fun cacheManager(): CacheManager {
        val manager = CaffeineCacheManager(CACHE_CONCEPT_CATEGORY_STATS)
        manager.setCaffeine(
            Caffeine.newBuilder()
                .expireAfterWrite(Duration.ofMinutes(5))
                .maximumSize(256)
                .recordStats()
        )
        return manager
    }

    companion object {
        const val CACHE_CONCEPT_CATEGORY_STATS = "conceptCategoryStats"
    }
}
