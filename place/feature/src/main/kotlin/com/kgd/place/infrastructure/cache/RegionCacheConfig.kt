package com.kgd.place.infrastructure.cache

import com.kgd.place.application.region.service.RegionCaches
import com.kgd.place.application.region.usecase.AdministrativeRegionUseCase
import com.kgd.place.application.region.usecase.GetRegionUseCase
import com.kgd.place.application.region.usecase.RegionVisitorUseCase
import com.kgd.place.application.weather.usecase.WeatherUseCase
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.cache.Cache
import org.springframework.cache.annotation.CachingConfigurer
import org.springframework.cache.annotation.EnableCaching
import org.springframework.cache.interceptor.CacheErrorHandler
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.core.Ordered
import org.springframework.data.redis.cache.BatchStrategies
import org.springframework.data.redis.cache.RedisCacheConfiguration
import org.springframework.data.redis.cache.RedisCacheManager
import org.springframework.data.redis.cache.RedisCacheWriter
import org.springframework.data.redis.connection.RedisConnectionFactory
import org.springframework.data.redis.serializer.JacksonJsonRedisSerializer
import org.springframework.data.redis.serializer.RedisSerializationContext
import tools.jackson.module.kotlin.jacksonMapperBuilder
import java.time.Duration

private val log = KotlinLogging.logger {}

/**
 * 지역 계층 조회 레디스 캐시 (ADR-0071 §서빙 경로).
 *
 * - 캐시 advice 를 트랜잭션보다 **바깥**에 둔다(HIGHEST_PRECEDENCE). 안쪽이면 적중해도 트랜잭션이 먼저 열려
 *   커넥션을 하나 빌린다 — 캐시를 둔 이유가 place 풀을 비우는 것이다.
 * - 레디스 오류는 삼키고 저장소로 내려간다. 캐시 때문에 조회가 실패하지 않는다.
 * - 값은 캐시마다 타입을 고정한 JSON 이다 — 타입 정보를 값에 싣지 않아 클래스 이름이 바뀌어도 옛 값이 예외 대신
 *   같은 모양으로 읽힌다.
 */
@Configuration
@EnableCaching(order = Ordered.HIGHEST_PRECEDENCE)
class RegionCacheConfig : CachingConfigurer {

    @Bean
    fun regionCacheWriter(connectionFactory: RedisConnectionFactory): RedisCacheWriter =
        // 전부 비우기를 KEYS 가 아니라 SCAN 으로 — 같은 레디스에 게임 키가 함께 있다
        RedisCacheWriter.nonLockingRedisCacheWriter(connectionFactory, BatchStrategies.scan(SCAN_BATCH))

    @Bean
    fun regionCacheManager(regionCacheWriter: RedisCacheWriter): RedisCacheManager = cacheManager(regionCacheWriter)

    override fun errorHandler(): CacheErrorHandler = FallThroughCacheErrorHandler

    companion object {
        /** 적재가 비우므로 TTL 은 놓친 비우기(레디스 장애 중 적재)의 상한이다. 수집이 하루 한 번이라 하루. */
        val TTL: Duration = Duration.ofDays(1)

        /**
         * 방문 추이는 적재가 덮는다(write-through). 수집이 매일 02:30 이라 TTL 은 다음 회차 + 두 시간 — 덮기가 실패한
         * 지역(레디스 장애 중 적재)도 다음 날 안에 캐시를 놓친 요청이 새로 채운다.
         */
        val VISITORS_TTL: Duration = Duration.ofHours(26)

        /**
         * 날씨도 적재가 덮는다. 단기 수집이 05:25 · 17:25 로 12시간 간격이라 TTL 은 다음 회차 + 한 시간 — 덮기가 실패한
         * 시군구도 다음 회차 안에 캐시를 놓친 요청이 새로 채운다. 신선도(발표 24시간)는 캐시와 별개로 읽을 때 거른다.
         */
        val WEATHER_TTL: Duration = Duration.ofHours(13)
        private const val SCAN_BATCH = 100

        fun cacheManager(writer: RedisCacheWriter): RedisCacheManager {
            val mapper = jacksonMapperBuilder().build()
            fun <T> listSerializer(type: Class<T>) = JacksonJsonRedisSerializer<List<T>>(
                mapper,
                mapper.typeFactory.constructCollectionType(List::class.java, type),
            )
            fun <T : Any> valueSerializer(type: Class<T>) = JacksonJsonRedisSerializer(mapper, type)
            fun config(serializer: JacksonJsonRedisSerializer<*>, ttl: Duration = TTL) = RedisCacheConfiguration.defaultCacheConfig()
                .entryTtl(ttl)
                .disableCachingNullValues()
                .serializeValuesWith(RedisSerializationContext.SerializationPair.fromSerializer(serializer))
            return RedisCacheManager.builder(writer)
                .withCacheConfiguration(RegionCaches.ADMINISTRATIVE, config(listSerializer(AdministrativeRegionUseCase.View::class.java)))
                .withCacheConfiguration(RegionCaches.GEONAMES, config(listSerializer(GetRegionUseCase.RegionView::class.java)))
                .withCacheConfiguration(RegionCaches.VISITORS, config(valueSerializer(RegionVisitorUseCase.Trend::class.java), VISITORS_TTL))
                .withCacheConfiguration(RegionCaches.WEATHER, config(valueSerializer(WeatherUseCase.Outlook::class.java), WEATHER_TTL))
                // 이름을 모르는 캐시는 만들지 않는다 — 기본 설정(JDK 직렬화)으로 조용히 생기면 값이 깨진다
                .disableCreateOnMissingCache()
                .build()
        }
    }
}

/** 캐시 오류는 경고만 남기고 넘어간다 — 조회는 저장소가, 비우기 실패는 TTL 이 메운다. */
internal object FallThroughCacheErrorHandler : CacheErrorHandler {
    override fun handleCacheGetError(exception: RuntimeException, cache: Cache, key: Any) =
        log.warn { "캐시 읽기 실패 — 저장소에서 읽는다: ${cache.name}::$key (${exception.message})" }

    override fun handleCachePutError(exception: RuntimeException, cache: Cache, key: Any, value: Any?) =
        log.warn { "캐시 쓰기 실패 — 응답은 그대로 나간다: ${cache.name}::$key (${exception.message})" }

    override fun handleCacheEvictError(exception: RuntimeException, cache: Cache, key: Any) =
        log.warn { "캐시 비우기 실패 — TTL 이 지나야 새 값이 보인다: ${cache.name}::$key (${exception.message})" }

    override fun handleCacheClearError(exception: RuntimeException, cache: Cache) =
        log.warn { "캐시 전체 비우기 실패 — TTL(${RegionCacheConfig.TTL}) 이 지나야 새 값이 보인다: ${cache.name} (${exception.message})" }
}
