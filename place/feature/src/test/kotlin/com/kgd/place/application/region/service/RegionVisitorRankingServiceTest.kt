package com.kgd.place.application.region.service

import com.kgd.common.exception.GlobalExceptionHandler
import com.kgd.place.application.region.port.AdministrativeRegionRepositoryPort
import com.kgd.place.application.region.port.RegionVisitorRepositoryPort
import com.kgd.place.application.region.usecase.RegionVisitorRankingUseCase
import com.kgd.place.application.region.usecase.RegionVisitorUseCase
import com.kgd.place.application.region.usecase.SyncRegionVisitorsUseCase
import com.kgd.place.domain.region.model.AdministrativeRegion
import com.kgd.place.domain.region.model.AdministrativeRegionLevel
import com.kgd.place.domain.region.model.RegionVisitorDaily
import com.kgd.place.domain.region.model.RegionVisitorRanking.SigunguMonthlyTotal
import com.kgd.place.infrastructure.cache.InMemoryCacheWriter
import com.kgd.place.infrastructure.cache.RegionCacheConfig
import com.kgd.place.infrastructure.cache.RegionCacheTest
import com.kgd.place.presentation.region.controller.RegionVisitorController
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.shouldBe
import io.mockk.clearMocks
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import org.springframework.context.annotation.AnnotationConfigApplicationContext
import org.springframework.http.MediaType
import org.springframework.http.converter.json.JacksonJsonHttpMessageConverter
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import org.springframework.transaction.PlatformTransactionManager
import tools.jackson.module.kotlin.jacksonMapperBuilder
import java.math.BigDecimal
import java.time.LocalDate
import java.time.YearMonth

/**
 * 시도 「타지 방문자가 많은 시군구」. 실제 [RegionCacheConfig] 를 올리고 레디스 자리에 [InMemoryCacheWriter] 만 끼운다 —
 * 응답은 실제 직렬화를 한 바퀴 돈 값이고, write-through 는 레디스 키와 저장소 포트 호출 횟수로 판정한다.
 * 경계값(다 받은 달·현지인 제외·옛 코드·상위 10·시군구 3개)은 리터럴 입력으로 만든다.
 */
class RegionVisitorRankingServiceTest : BehaviorSpec({
    val visitorRepo = mockk<RegionVisitorRepositoryPort>()
    val adminRepo = mockk<AdministrativeRegionRepositoryPort>()
    val txManager = mockk<PlatformTransactionManager>(relaxed = true)
    val writer = InMemoryCacheWriter()

    val ctx = AnnotationConfigApplicationContext().apply {
        beanFactory.registerSingleton("visitorRepo", visitorRepo)
        beanFactory.registerSingleton("adminRepo", adminRepo)
        beanFactory.registerSingleton("transactionManager", txManager)
        beanFactory.registerSingleton("writer", writer)
        register(
            RegionCacheTest.TestBeans::class.java, RegionCacheConfig::class.java,
            RegionVisitorService::class.java, RegionVisitorRankingService::class.java, RegionVisitorSyncService::class.java,
        )
        refresh()
    }
    val mapper = jacksonMapperBuilder().build()
    val mvc: MockMvc = MockMvcBuilders.standaloneSetup(
        RegionVisitorController(
            ctx.getBean(RegionVisitorUseCase::class.java),
            ctx.getBean(SyncRegionVisitorsUseCase::class.java),
            ctx.getBean(RegionVisitorRankingUseCase::class.java),
        ),
    )
        .setControllerAdvice(GlobalExceptionHandler())
        .setMessageConverters(JacksonJsonHttpMessageConverter(mapper))
        .build()

    fun ranking(sido: String): RegionVisitorRankingUseCase.Ranking {
        val res = mvc.perform(get("/api/places/administrative-regions/$sido/visitor-ranking")).andReturn().response
        res.status shouldBe 200
        return mapper.treeToValue(mapper.readTree(res.contentAsString).get("data"), RegionVisitorRankingUseCase.Ranking::class.java)
    }

    val sidos = listOf("11", "12", "36", "50").map { AdministrativeRegion.create(it, AdministrativeRegionLevel.SIDO, "시도$it") }
    fun sigungu(code: String) = AdministrativeRegion.create(code, AdministrativeRegionLevel.SIGUNGU, "구$code", parentCode = code.take(2), nameEn = "Gu$code")

    // 서울 12구 — 값이 서로 다르게 외지인을 준다(코드가 클수록 크다). 마지막 두 구는 같은 값이다.
    val seoul = (1..12).map { "11${(100 + it * 10)}" }
    val aug = YearMonth.of(2026, 8)
    val sep = YearMonth.of(2026, 9)
    fun full(code: String, month: YearMonth, local: String, outsider: String, foreigner: String, days: Int = month.lengthOfMonth()) = listOf(
        SigunguMonthlyTotal(code, month, "1", BigDecimal(local), days),
        SigunguMonthlyTotal(code, month, "2", BigDecimal(outsider), days),
        SigunguMonthlyTotal(code, month, "3", BigDecimal(foreigner), days),
    )

    beforeEach {
        writer.store.clear()
        clearMocks(visitorRepo, adminRepo, answers = false)
        every { adminRepo.findByLevel(AdministrativeRegionLevel.SIDO) } returns sidos
        every { adminRepo.findChildren(any()) } returns emptyList()
        every { adminRepo.findChildren("11") } returns seoul.map(::sigungu)
        every { visitorRepo.findLatestSigunguDate(any()) } returns LocalDate.of(2026, 9, 10)
        every { visitorRepo.findSigunguMonthlyTotals(any(), any()) } returns emptyList()
        every { visitorRepo.upsertAll(any(), any()) } answers { firstArg<List<RegionVisitorDaily>>().size }
        every { visitorRepo.findLatestDate(any(), any()) } returns null
    }

    given("서울 12구가 8월을 다 받고 9월은 10일만 받았으면") {
        val totals = seoul.flatMapIndexed { i, code ->
            // 현지인은 순서를 거꾸로 크게 준다 — 현지인을 더하면 순위가 뒤집힌다
            val outsider = if (i >= 10) "5000.9" else "${1000 + i * 100}.9"
            full(code, aug, local = "${100000 - i * 1000}", outsider = outsider, foreigner = "0.5") +
                full(code, sep, local = "1", outsider = "999999", foreigner = "0", days = 10)
        }
        `when`("순위를 조회하면") {
            then("8월의 외지인+외국인으로 상위 10, 소수는 버리고, 같은 값이면 코드 오름차순이다") {
                every { visitorRepo.findSigunguMonthlyTotals("11", LocalDate.of(2025, 9, 1)) } returns totals
                val r = ranking("11")

                r.month shouldBe "2026-08"
                r.items.size shouldBe 10
                r.items.take(2).map { it.code } shouldBe listOf("11210", "11220")
                r.items[0].outsiders shouldBe 5000L
                r.items[0].foreigners shouldBe 0L
                r.items[0].total shouldBe 5001L
                r.items[0].name shouldBe "구11210"
                r.items[0].nameEn shouldBe "Gu11210"
                r.items[2].code shouldBe "11200"
                r.items.map { it.code }.contains("11110") shouldBe false
            }
        }
        `when`("한 구가 8월 하루를 못 받았으면") {
            then("시도 전체로 판정해 그 앞의 다 받은 달(7월)로 간다") {
                val jul = YearMonth.of(2026, 7)
                val broken = totals.map { if (it.code == "11110" && it.month == aug && it.touDivCd == "3") it.copy(days = 30) else it } +
                    seoul.flatMap { full(it, jul, "1", "10", "0") }
                every { visitorRepo.findSigunguMonthlyTotals("11", any()) } returns broken
                ranking("11").month shouldBe "2026-07"
            }
        }
        `when`("어느 달도 다 받지 못했으면") {
            then("빈 결과다") {
                every { visitorRepo.findSigunguMonthlyTotals("11", any()) } returns totals.filter { it.month == sep }
                val r = ranking("11")
                r.month shouldBe null
                r.items.shouldBeEmpty()
            }
        }
    }

    given("통합 시도(12)에 옛 코드(29·46) 행이 섞여 있으면") {
        then("지금 행정구역 목록의 시군구만 줄 세운다") {
            val now = listOf("12110", "12130", "12150")
            every { adminRepo.findChildren("12") } returns now.map(::sigungu)
            every { visitorRepo.findSigunguMonthlyTotals("12", any()) } returns
                now.flatMap { full(it, aug, "1", "10", "1") } + full("29110", aug, "1", "99999", "1") + full("46110", aug, "1", "88888", "1")
            ranking("12").items.map { it.code } shouldBe now
        }
    }

    given("시군구가 3개 미만인 시도") {
        then("세종(36, 1개)은 다 받은 달이 있어도 빈 결과다") {
            every { adminRepo.findChildren("36") } returns listOf(sigungu("36110"))
            every { visitorRepo.findSigunguMonthlyTotals("36", any()) } returns full("36110", aug, "1", "10", "1")
            ranking("36").items.shouldBeEmpty()
        }
        then("제주(50, 2개)도 빈 결과다") {
            every { adminRepo.findChildren("50") } returns listOf(sigungu("50110"), sigungu("50130"))
            every { visitorRepo.findSigunguMonthlyTotals("50", any()) } returns
                full("50110", aug, "1", "10", "1") + full("50130", aug, "1", "20", "1")
            ranking("50").items.shouldBeEmpty()
        }
    }

    given("없는·잘못된 시도 코드") {
        listOf("99", "29", "1", "111", "ab").forEach { bad ->
            then("'$bad' → 400 이고 캐시 키를 만들지 않는다") {
                mvc.perform(get("/api/places/administrative-regions/$bad/visitor-ranking")).andReturn().response.status shouldBe 400
                writer.store.keys.filter { it.startsWith("placeRegionVisitorRanking::") }.shouldBeEmpty()
            }
        }
    }

    given("방문자 적재가 들어오면") {
        then("받은 시도의 순위 키를 다시 쓰고, 그 뒤 조회는 저장소를 다시 부르지 않는다") {
            every { visitorRepo.findSigunguMonthlyTotals("11", any()) } returns seoul.flatMap { full(it, aug, "1", "10", "1") }
            // 서울 시군구 한 행 + 옛 코드 시도(29) 한 행 — 29 는 지금 시도가 아니라 키를 만들지 않는다(적재는 성공)
            val bulk = """
                {"items":[
                  {"regionLevel":"SIGUNGU","signguCode":"11110","signguNm":"종로구","touDivCd":"2","touNum":"10","baseYmd":"20260901"},
                  {"regionLevel":"SIGUNGU","signguCode":"29110","signguNm":"동구","touDivCd":"2","touNum":"10","baseYmd":"20260601"}
                ]}
            """.trimIndent()
            mvc.perform(put("/internal/regions/visitors").contentType(MediaType.APPLICATION_JSON).content(bulk))
                .andReturn().response.status shouldBe 200

            writer.store.keys.filter { it.startsWith("placeRegionVisitorRanking::") }.toSet() shouldBe setOf("placeRegionVisitorRanking::11")
            verify(exactly = 1) { visitorRepo.findSigunguMonthlyTotals("11", any()) }

            ranking("11").month shouldBe "2026-08"
            verify(exactly = 1) { visitorRepo.findSigunguMonthlyTotals("11", any()) }
        }
    }
})
