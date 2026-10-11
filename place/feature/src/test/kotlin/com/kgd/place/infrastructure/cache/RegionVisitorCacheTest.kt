package com.kgd.place.infrastructure.cache

import com.kgd.place.application.region.port.AdministrativeRegionRepositoryPort
import com.kgd.place.application.region.port.RegionVisitorRepositoryPort
import com.kgd.place.application.region.service.RegionVisitorRankingService
import com.kgd.place.application.region.service.RegionVisitorService
import com.kgd.place.application.region.service.RegionVisitorSyncService
import com.kgd.place.application.region.usecase.RegionVisitorRankingUseCase
import com.kgd.place.application.region.usecase.RegionVisitorUseCase
import com.kgd.place.application.region.usecase.SyncRegionVisitorsUseCase
import com.kgd.place.domain.region.model.AdministrativeRegionLevel
import com.kgd.place.domain.region.model.RegionVisitorDaily
import com.kgd.place.domain.region.model.RegionVisitorTrend
import com.kgd.place.presentation.region.controller.RegionVisitorController
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.mockk.clearMocks
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import io.mockk.verify
import org.springframework.context.annotation.AnnotationConfigApplicationContext
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import org.springframework.transaction.PlatformTransactionManager
import java.math.BigDecimal
import java.time.LocalDate
import java.time.YearMonth

/**
 * 지역 허브 「방문 추이」의 레디스 경로. [RegionCacheTest] 와 같이 실제 [RegionCacheConfig] 를 올리고 레디스 자리에
 * 바이트를 들고 있는 [InMemoryCacheWriter] 만 끼운다 — 응답은 실제 직렬화를 한 바퀴 돈 값이다.
 *
 * 판정 근거는 저장소 포트가 불린 횟수다: 적재 뒤 GET 이 포트를 부르면 사용자 요청이 MySQL 에 닿은 것이다.
 */
class RegionVisitorCacheTest : BehaviorSpec({
    val repo = mockk<RegionVisitorRepositoryPort>()
    val txManager = mockk<PlatformTransactionManager>(relaxed = true)
    // 시도 목록이 비어 있다 — 순위 갱신은 키를 만들지 않는다(순위 경로는 RegionVisitorRankingServiceTest)
    val adminRepo = mockk<AdministrativeRegionRepositoryPort>(relaxed = true)
    val writer = InMemoryCacheWriter()

    val ctx = AnnotationConfigApplicationContext().apply {
        beanFactory.registerSingleton("visitorRepo", repo)
        beanFactory.registerSingleton("transactionManager", txManager)
        beanFactory.registerSingleton("adminRepo", adminRepo)
        beanFactory.registerSingleton("writer", writer)
        register(
            RegionCacheTest.TestBeans::class.java, RegionCacheConfig::class.java,
            RegionVisitorService::class.java, RegionVisitorRankingService::class.java, RegionVisitorSyncService::class.java,
        )
        refresh()
    }
    val mvc: MockMvc = MockMvcBuilders.standaloneSetup(
        RegionVisitorController(
            ctx.getBean(RegionVisitorUseCase::class.java),
            ctx.getBean(SyncRegionVisitorsUseCase::class.java),
            ctx.getBean(RegionVisitorRankingUseCase::class.java),
        ),
    ).build()

    fun body(url: String): ByteArray = mvc.perform(get(url)).andReturn().response.also { it.status shouldBe 200 }.contentAsByteArray

    // 운영 표본(2026-10-02) 종로구 2026-09-01 세 행 — 외지인은 원천의 부동소수 표기 그대로
    val bulk = """
        {"items":[
          {"regionLevel":"SIGUNGU","signguCode":"11110","signguNm":"종로구","daywkDivCd":"2","daywkDivNm":"화요일","touDivCd":"1","touDivNm":"현지인(a)","touNum":"187029.5","baseYmd":"20260901"},
          {"regionLevel":"SIGUNGU","signguCode":"11110","signguNm":"종로구","daywkDivCd":"2","daywkDivNm":"화요일","touDivCd":"2","touDivNm":"외지인(b)","touNum":"24814.549999999996","baseYmd":"20260901"},
          {"regionLevel":"SIDO","areaCode":"11","areaNm":"서울특별시","daywkDivCd":"2","daywkDivNm":"화요일","touDivCd":"1","touDivNm":"현지인(a)","touNum":"4920440.0","baseYmd":"20260901"}
        ]}
    """.trimIndent()

    // 8월은 다 받았고, 9월은 이틀뿐인 덜 찬 달이다
    fun totals() = listOf("1" to "5000000.4", "2" to "800000.5", "3" to "12000").map { (div, total) ->
        RegionVisitorTrend.MonthlyTotal(YearMonth.of(2026, 8), div, BigDecimal(total), 31)
    } + RegionVisitorTrend.MonthlyTotal(YearMonth.of(2026, 9), "1", BigDecimal("187029.5"), 2)

    beforeEach {
        writer.store.clear()
        writer.failing = false
        clearMocks(repo, txManager, answers = false)
        every { repo.upsertAll(any(), any()) } answers { firstArg<List<RegionVisitorDaily>>().size }
        every { repo.findLatestDate(any(), any()) } returns LocalDate.of(2026, 9, 2)
        every { repo.findMonthlyTotals(any(), any(), any()) } returns totals()
    }

    given("수집기가 방문자 행을 적재하면") {
        `when`("받은 지역의 허브를 조회할 때") {
            then("적재가 덮은 캐시에서 나가고 저장소를 다시 부르지 않는다") {
                val rows = slot<List<RegionVisitorDaily>>()
                every { repo.upsertAll(capture(rows), any()) } answers { rows.captured.size }

                val res = mvc.perform(put("/internal/regions/visitors").contentType(MediaType.APPLICATION_JSON).content(bulk))
                    .andReturn().response
                res.status shouldBe 200
                res.contentAsString shouldContain "\"applied\":3"
                res.contentAsString shouldContain "\"regions\":2"
                // 원문은 고치지 않고 수준은 원천 키 이름(signguCode/areaCode)에서 갈린다
                rows.captured.map { it.level to it.regionCode } shouldBe listOf(
                    AdministrativeRegionLevel.SIGUNGU to "11110", AdministrativeRegionLevel.SIGUNGU to "11110", AdministrativeRegionLevel.SIDO to "11",
                )
                rows.captured[1].touNum shouldBe "24814.549999999996"
                verify(exactly = 1) { repo.findMonthlyTotals(AdministrativeRegionLevel.SIGUNGU, "11110", LocalDate.of(2025, 9, 1)) }
                writer.store.keys shouldBe setOf("placeRegionVisitors::11110", "placeRegionVisitors::11")

                val hub = String(body("/api/places/administrative-regions/11110/visitors"), Charsets.UTF_8)
                body("/api/places/administrative-regions/11/visitors")

                verify(exactly = 1) { repo.findMonthlyTotals(AdministrativeRegionLevel.SIGUNGU, "11110", any()) }
                verify(exactly = 1) { repo.findMonthlyTotals(AdministrativeRegionLevel.SIDO, "11", any()) }
                verify(exactly = 2) { repo.findLatestDate(any(), any()) }
                // 덜 찬 9월은 빠지고 다 받은 8월만, 반올림한 정수로
                hub shouldContain "\"latestDate\":\"2026-09-02\""
                hub shouldContain "\"months\":[{\"month\":\"2026-08\",\"local\":5000000,\"outsider\":800001,\"foreigner\":12000}]"
            }
        }
    }

    given("캐시에 없는 지역을 조회하면") {
        `when`("두 번 부르면") {
            then("처음 한 번만 저장소를 읽고, 두 번째는 트랜잭션도 열지 않은 채 같은 바이트를 낸다") {
                val first = body("/api/places/administrative-regions/26110/visitors")
                val second = body("/api/places/administrative-regions/26110/visitors")

                second shouldBe first
                verify(exactly = 1) { repo.findMonthlyTotals(any(), "26110", any()) }
                verify(exactly = 0) { txManager.getTransaction(any()) }
            }
        }
        `when`("받은 적 없는 지역이면") {
            then("빈 추이를 내고 그것도 캐시한다 — 화면은 절을 그리지 않는다") {
                every { repo.findLatestDate(any(), "29") } returns null
                String(body("/api/places/administrative-regions/29/visitors"), Charsets.UTF_8) shouldContain "\"months\":[]"
                body("/api/places/administrative-regions/29/visitors")
                verify(exactly = 1) { repo.findLatestDate(any(), "29") }
                verify(exactly = 0) { repo.findMonthlyTotals(any(), "29", any()) }
            }
        }
    }

    given("레디스가 응답하지 않으면") {
        `when`("적재와 조회가 들어와도") {
            then("적재는 성공하고 조회는 저장소에서 같은 바이트로 나간다") {
                val healthy = body("/api/places/administrative-regions/11110/visitors")
                writer.failing = true

                mvc.perform(put("/internal/regions/visitors").contentType(MediaType.APPLICATION_JSON).content(bulk))
                    .andReturn().response.status shouldBe 200
                body("/api/places/administrative-regions/11110/visitors") shouldBe healthy
            }
        }
    }
})
