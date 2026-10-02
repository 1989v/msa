package com.kgd.place.infrastructure.cache

import com.kgd.place.application.attraction.port.AttractionRepositoryPort
import com.kgd.place.application.attraction.service.AttractionService
import com.kgd.place.application.attraction.usecase.UpsertAttractionUseCase
import com.kgd.place.application.region.port.AdministrativeRegionRepositoryPort
import com.kgd.place.application.region.port.RegionRepositoryPort
import com.kgd.place.application.region.service.AdministrativeRegionService
import com.kgd.place.application.region.service.RegionService
import com.kgd.place.application.region.usecase.AdministrativeRegionUseCase
import com.kgd.place.application.region.usecase.CreateRegionUseCase
import com.kgd.place.application.region.usecase.GetRegionUseCase
import com.kgd.place.domain.region.model.AdministrativeRegion
import com.kgd.place.domain.region.model.AdministrativeRegionLevel
import com.kgd.place.domain.region.model.Region
import com.kgd.place.domain.region.model.RegionLevel
import com.kgd.place.presentation.region.controller.AdministrativeRegionController
import com.kgd.place.presentation.region.controller.RegionController
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import io.mockk.clearMocks
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import org.springframework.context.annotation.AnnotationConfigApplicationContext
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.context.annotation.Primary
import org.springframework.data.redis.RedisConnectionFailureException
import org.springframework.data.redis.cache.CacheStatistics
import org.springframework.data.redis.cache.CacheStatisticsCollector
import org.springframework.data.redis.cache.RedisCacheWriter
import org.springframework.data.redis.connection.RedisConnectionFactory
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.annotation.EnableTransactionManagement
import java.time.Duration
import java.time.LocalDateTime
import java.util.concurrent.CompletableFuture
import java.util.concurrent.ConcurrentHashMap

/**
 * 지역 계층 레디스 캐시. 실제 [RegionCacheConfig](캐시 이름·TTL·직렬화·advice 순서·오류 처리)를 그대로 올리고,
 * 레디스 대신 바이트를 그대로 들고 있는 [InMemoryCacheWriter] 만 갈아 끼운다 — 적중 응답은 실제 직렬화를
 * 한 바퀴 돈 값이다. 운영과 같은 CGLIB 프록시, 트랜잭션 advice 도 함께 올려 적중 시 트랜잭션이 안 열리는지 본다.
 */
class RegionCacheTest : BehaviorSpec({
    val adminRepo = mockk<AdministrativeRegionRepositoryPort>()
    val regionRepo = mockk<RegionRepositoryPort>()
    val attractionRepo = mockk<AttractionRepositoryPort>()
    val txManager = mockk<PlatformTransactionManager>(relaxed = true)
    val writer = InMemoryCacheWriter()

    val ctx = AnnotationConfigApplicationContext().apply {
        beanFactory.registerSingleton("adminRepo", adminRepo)
        beanFactory.registerSingleton("regionRepo", regionRepo)
        beanFactory.registerSingleton("attractionRepo", attractionRepo)
        beanFactory.registerSingleton("transactionManager", txManager)
        beanFactory.registerSingleton("writer", writer)
        register(
            TestBeans::class.java, RegionCacheConfig::class.java,
            AdministrativeRegionService::class.java, RegionService::class.java, AttractionService::class.java,
        )
        refresh()
    }
    val mvc: MockMvc = MockMvcBuilders.standaloneSetup(
        AdministrativeRegionController(ctx.getBean(AdministrativeRegionUseCase::class.java)),
        RegionController(ctx.getBean(CreateRegionUseCase::class.java), ctx.getBean(GetRegionUseCase::class.java)),
    ).build()

    fun body(url: String): ByteArray = mvc.perform(get(url)).andReturn().response.also {
        it.status shouldBe 200
    }.contentAsByteArray

    // 이름·좌표에 한글과 이진 표현이 긴 실수를 섞는다 — 직렬화 왕복에서 한 글자·한 자리라도 바뀌면 바이트가 갈린다
    val seoul = AdministrativeRegion.create("11", AdministrativeRegionLevel.SIDO, "서울특별시", nameEn = "Seoul", latitude = 37.5665, longitude = 0.1 + 0.2)
    val busan = AdministrativeRegion.create("26", AdministrativeRegionLevel.SIDO, "부산광역시")
    val jongno = AdministrativeRegion.create("11110", AdministrativeRegionLevel.SIGUNGU, "종로구", parentCode = "11")
    val asia = Region.restore(
        id = 1L, parentId = null, level = RegionLevel.CONTINENT, name = "Asia", nameKo = "아시아", countryCode = null,
        admin1Code = null, admin2Code = null, geonamesId = 6255147L, latitude = 29.84064, longitude = 89.29688,
        population = 4_700_000_000L, createdAt = LocalDateTime.of(2026, 1, 1, 0, 0),
    )

    beforeEach {
        writer.store.clear()
        writer.failing = false
        clearMocks(adminRepo, regionRepo, attractionRepo, txManager, answers = false)
        every { adminRepo.findByLevel(AdministrativeRegionLevel.SIDO) } returns listOf(seoul, busan)
        every { adminRepo.findChildren("11") } returns listOf(jongno)
        every { attractionRepo.countByLdong("ko", any()) } returns listOf(AttractionRepositoryPort.LdongCount("11", "110", 30))
        every { regionRepo.findByLevel(RegionLevel.CONTINENT) } returns listOf(asia)
    }

    given("행정구역 조회") {
        `when`("같은 요청을 두 번 하면") {
            then("두 번째는 저장소를 부르지 않고, 응답 바이트가 첫 번째와 같다") {
                val first = body("/api/places/administrative-regions?level=SIDO&lang=ko")
                val second = body("/api/places/administrative-regions?level=SIDO&lang=ko")

                second shouldBe first
                String(first, Charsets.UTF_8).contains("서울특별시") shouldBe true
                verify(exactly = 1) { adminRepo.findByLevel(AdministrativeRegionLevel.SIDO) }
                verify(exactly = 1) { attractionRepo.countByLdong("ko", any()) }
                // 적중이 실제 직렬화를 거쳤다 — 저장된 값이 있어야 두 번째가 그것을 읽은 것이다
                writer.store.keys.single() shouldBe "placeAdministrativeRegions::SIDO:null:ko"
            }
        }

        `when`("파라미터가 다르면") {
            then("키가 따로라 서로의 응답을 내주지 않는다") {
                val noLang = body("/api/places/administrative-regions?level=SIDO")
                val ko = body("/api/places/administrative-regions?level=SIDO&lang=ko")
                val children = body("/api/places/administrative-regions?level=SIGUNGU&parent=11&lang=ko")

                noLang shouldNotBe ko
                String(children, Charsets.UTF_8).contains("종로구") shouldBe true
                writer.store.keys shouldBe setOf(
                    "placeAdministrativeRegions::SIDO:null:null",
                    "placeAdministrativeRegions::SIDO:null:ko",
                    "placeAdministrativeRegions::SIGUNGU:11:ko",
                )
            }
        }

        `when`("행정구역이나 관광지를 적재하면") {
            then("캐시를 전부 비워 다음 조회가 저장소에서 새로 읽는다") {
                every { adminRepo.upsertAll(any()) } returns AdministrativeRegionRepositoryPort.UpsertSummary(0, 1)
                every { attractionRepo.upsertAll(any()) } returns AttractionRepositoryPort.UpsertSummary(0, 0)
                every { attractionRepo.count() } returns 0L
                val admin = ctx.getBean(AdministrativeRegionUseCase::class.java)
                val attractions = ctx.getBean(UpsertAttractionUseCase::class.java)

                body("/api/places/administrative-regions?level=SIDO&lang=ko")
                admin.upsertAll(emptyList())
                body("/api/places/administrative-regions?level=SIDO&lang=ko")
                attractions.executeBulk(emptyList())
                body("/api/places/administrative-regions?level=SIDO&lang=ko")

                verify(exactly = 3) { attractionRepo.countByLdong("ko", any()) }
            }
        }

        `when`("레디스가 응답하지 않으면") {
            then("요청은 실패하지 않고 저장소에서 같은 바이트로 나간다") {
                val healthy = body("/api/places/administrative-regions?level=SIDO&lang=ko")
                writer.failing = true

                body("/api/places/administrative-regions?level=SIDO&lang=ko") shouldBe healthy
                body("/api/places/administrative-regions?level=SIDO&lang=ko") shouldBe healthy
                verify(exactly = 3) { adminRepo.findByLevel(AdministrativeRegionLevel.SIDO) }
            }
        }
    }

    given("지명 계층 조회") {
        `when`("같은 요청을 두 번 하면") {
            then("두 번째는 저장소도 트랜잭션도 열지 않고, 응답 바이트가 같다") {
                val first = body("/api/places/regions?level=CONTINENT")
                val second = body("/api/places/regions?level=CONTINENT")

                second shouldBe first
                verify(exactly = 1) { regionRepo.findByLevel(RegionLevel.CONTINENT) }
                // 캐시 advice 가 트랜잭션 바깥이다 — 안쪽이면 적중에도 커넥션을 빌리는 트랜잭션이 열린다
                verify(exactly = 1) { txManager.getTransaction(any()) }
            }
        }
    }
}) {
    @Configuration
    @EnableTransactionManagement(proxyTargetClass = true) // 운영(부트 AOP 기본값)과 같은 CGLIB 프록시
    open class TestBeans {
        /** 설정의 레디스 writer 는 만들어지되 쓰이지 않는다 — 아래 메모리 writer 가 이긴다. */
        @Bean
        open fun redisConnectionFactory(): RedisConnectionFactory = mockk(relaxed = true)

        @Bean
        @Primary
        open fun inMemoryWriter(writer: InMemoryCacheWriter): RedisCacheWriter = writer
    }
}

/** 키·값 바이트를 그대로 들고 있는 레디스 대역. `failing` 이면 연결 실패를 던진다. */
class InMemoryCacheWriter : RedisCacheWriter {
    val store = ConcurrentHashMap<String, ByteArray>()

    @Volatile
    var failing = false

    private fun check() {
        if (failing) throw RedisConnectionFailureException("redis down")
    }

    override fun get(name: String, key: ByteArray): ByteArray? = check().let { store[String(key)] }

    override fun retrieve(name: String, key: ByteArray, ttl: Duration?): CompletableFuture<ByteArray> =
        CompletableFuture.completedFuture(get(name, key))

    override fun put(name: String, key: ByteArray, value: ByteArray, ttl: Duration?) {
        check()
        store[String(key)] = value
    }

    override fun store(name: String, key: ByteArray, value: ByteArray, ttl: Duration?): CompletableFuture<Void> =
        CompletableFuture.runAsync { put(name, key, value, ttl) }

    override fun putIfAbsent(name: String, key: ByteArray, value: ByteArray, ttl: Duration?): ByteArray? {
        check()
        return store.putIfAbsent(String(key), value)
    }

    override fun evict(name: String, key: ByteArray) {
        check()
        store.remove(String(key))
    }

    override fun clear(name: String, pattern: ByteArray) {
        check()
        val prefix = String(pattern).removeSuffix("*")
        store.keys.removeIf { it.startsWith(prefix) }
    }

    override fun clearStatistics(name: String) = Unit

    override fun withStatisticsCollector(cacheStatisticsCollector: CacheStatisticsCollector): RedisCacheWriter = this

    override fun getCacheStatistics(cacheName: String): CacheStatistics =
        CacheStatisticsCollector.none().getCacheStatistics(cacheName)
}
