package com.kgd.place.infrastructure.cache

import com.kgd.place.application.region.service.RegionCaches
import com.kgd.place.application.weather.port.WeatherRepositoryPort
import com.kgd.place.application.weather.service.WeatherOutlookLoader
import com.kgd.place.application.weather.service.WeatherService
import com.kgd.place.application.weather.service.WeatherSyncService
import com.kgd.place.application.weather.usecase.SyncWeatherUseCase
import com.kgd.place.application.weather.usecase.WeatherUseCase
import com.kgd.place.domain.weather.model.MidForecast
import com.kgd.place.domain.weather.model.MidKind
import com.kgd.place.domain.weather.model.ShortForecast
import com.kgd.place.domain.weather.model.ShortForecastItem
import com.kgd.place.domain.weather.model.WeatherArea
import com.kgd.place.presentation.weather.controller.WeatherController
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldContainAll
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.kotest.matchers.string.shouldNotContain
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
import java.time.Duration
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit

/**
 * 시군구 날씨의 레디스 경로. [RegionVisitorCacheTest] 와 같이 실제 [RegionCacheConfig] 를 올리고 레디스 자리에
 * 바이트를 들고 있는 [InMemoryCacheWriter] 만 끼운다 — 응답은 실제 직렬화를 한 바퀴 돈 값이다.
 *
 * 판정 근거는 저장소 포트가 불린 횟수다: 적재 뒤 GET 이 포트를 부르면 사용자 요청이 MySQL 에 닿은 것이다.
 * 신선도는 컨트롤러가 읽는 KST 벽시계 기준이라, 예보 시각을 지금에서 거꾸로 잡는다.
 */
class WeatherCacheTest : BehaviorSpec({
    val repo = mockk<WeatherRepositoryPort>()
    val txManager = mockk<PlatformTransactionManager>(relaxed = true)
    val writer = InMemoryCacheWriter()

    val ctx = AnnotationConfigApplicationContext().apply {
        beanFactory.registerSingleton("weatherRepo", repo)
        beanFactory.registerSingleton("transactionManager", txManager)
        beanFactory.registerSingleton("writer", writer)
        register(
            RegionCacheTest.TestBeans::class.java, RegionCacheConfig::class.java,
            WeatherOutlookLoader::class.java, WeatherService::class.java, WeatherSyncService::class.java,
        )
        refresh()
    }
    val mvc: MockMvc = MockMvcBuilders.standaloneSetup(
        WeatherController(ctx.getBean(WeatherUseCase::class.java), ctx.getBean(SyncWeatherUseCase::class.java)),
    ).build()

    fun body(url: String): String = mvc.perform(get(url)).andReturn().response.also { it.status shouldBe 200 }.contentAsString

    val now = LocalDateTime.now(ZoneId.of("Asia/Seoul"))
    val today = now.toLocalDate()

    /** 오늘부터 사흘, 낮 12시 한 시각씩 — 하늘 4(흐림) · 강수 1(비) · 강수확률 70 · 최저 9 · 최고 21. */
    fun short(baseAt: LocalDateTime) = ShortForecast(
        60, 127, baseAt,
        (0L..3L).flatMap { d ->
            val date = baseAt.toLocalDate().plusDays(d)
            listOf(
                ShortForecastItem("SKY", date, 1200, "4"), ShortForecastItem("PTY", date, 1200, "1"),
                ShortForecastItem("POP", date, 1200, "70"), ShortForecastItem("TMN", date, 600, "9.0"),
                ShortForecastItem("TMX", date, 1500, "21.0"),
            )
        },
    )

    fun mid(kind: MidKind, tmFc: LocalDateTime) = MidForecast(
        if (kind == MidKind.LAND) "11B00000" else "11B10101", kind, tmFc,
        if (kind == MidKind.LAND) {
            (4..7).flatMap { n -> listOf("wf${n}Am" to "맑음", "wf${n}Pm" to "구름많음", "rnSt${n}Am" to "10", "rnSt${n}Pm" to "20") }.toMap() +
                (8..10).flatMap { n -> listOf("wf$n" to "흐림", "rnSt$n" to "30") }.toMap()
        } else {
            (4..10).flatMap { n -> listOf("taMin$n" to "12", "taMax$n" to "24") }.toMap()
        },
    )

    val freshBase = now.truncatedTo(ChronoUnit.HOURS).minusHours(1)
    val freshMid = now.truncatedTo(ChronoUnit.HOURS).minusHours(2)

    beforeEach {
        writer.store.clear()
        writer.failing = false
        clearMocks(repo, txManager, answers = false)
        every { repo.findArea(any()) } answers { WeatherArea(firstArg(), 60, 127, "11B00000", "11B10101", "NAME") }
        every { repo.findShort(60, 127) } returns short(freshBase)
        every { repo.findMid("11B00000", MidKind.LAND) } returns mid(MidKind.LAND, freshMid)
        every { repo.findMid("11B10101", MidKind.TA) } returns mid(MidKind.TA, freshMid)
        every { repo.upsertShort(any(), any()) } answers { firstArg<List<*>>().size }
        every { repo.upsertMid(any(), any()) } answers { firstArg<List<*>>().size }
        every { repo.findSigunguByGrids(any()) } returns listOf("11110", "11140")
        every { repo.findSigunguByMidRegions(any()) } returns listOf("11110")
    }

    given("수집기가 단기 발표본을 적재하면") {
        `when`("그 격자를 쓰는 시군구를 조회할 때") {
            then("적재가 덮은 캐시에서 나가고 저장소를 다시 부르지 않는다 — 원문은 고치지 않고 넘긴다") {
                val raw = """[{"baseDate":"20261002","baseTime":"0500","category":"TMP","fcstDate":"20261002","fcstTime":"0600","fcstValue":"11","nx":60,"ny":127}]"""
                val rows = slot<List<WeatherRepositoryPort.ShortRaw>>()
                every { repo.upsertShort(capture(rows), any()) } answers { rows.captured.size }
                val bulk = """{"items":[{"nx":60,"ny":127,"baseDate":"20261002","baseTime":"0500","itemsRaw":${quote(raw)}}]}"""

                val res = mvc.perform(put("/internal/weather/short").contentType(MediaType.APPLICATION_JSON).content(bulk)).andReturn().response
                res.status shouldBe 200
                res.contentAsString shouldContain "\"sigungu\":2"
                rows.captured.single().itemsRaw shouldBe raw
                rows.captured.single().baseAt shouldBe LocalDateTime.of(2026, 10, 2, 5, 0)
                writer.store.keys shouldBe setOf("placeWeather::11110", "placeWeather::11140")
                verify(exactly = 2) { repo.findArea(any()) }

                val jongno = body("/api/places/weather?sigungu=11110")
                body("/api/places/weather?sigungu=11140")
                verify(exactly = 2) { repo.findArea(any()) }
                verify(exactly = 2) { repo.findShort(any(), any()) }
                // 오늘 ~ 글피는 단기, 그 뒤 일곱 날(4~10일 뒤)은 중기
                jongno shouldContain "\"date\":\"$today\",\"source\":\"SHORT\",\"min\":9,\"max\":21"
                jongno shouldContain "\"pm\":{\"sky\":\"흐리고 비\",\"pop\":70}"
                jongno shouldContain "\"date\":\"${freshMid.toLocalDate().plusDays(10)}\",\"source\":\"MID\",\"min\":12,\"max\":24,\"am\":null,\"pm\":null,\"allDay\":{\"sky\":\"흐림\",\"pop\":30}"
                jongno shouldContain "\"shortBaseAt\":\"${freshBase.format(DateTimeFormatter.ISO_LOCAL_DATE_TIME).removeSuffix(":00")}\""
            }
        }
    }

    given("수집기가 중기 발표본을 적재하면") {
        then("그 구역을 쓰는 시군구 캐시를 덮는다") {
            val bulk = """{"items":[{"regId":"11B10101","kind":"TA","tmFc":"202610020600","itemRaw":"{\"regId\":\"11B10101\",\"taMin4\":10}"}]}"""
            val res = mvc.perform(put("/internal/weather/mid").contentType(MediaType.APPLICATION_JSON).content(bulk)).andReturn().response
            res.status shouldBe 200
            verify(exactly = 1) { repo.findSigunguByMidRegions(listOf("11B10101")) }
            writer.store.keys shouldBe setOf("placeWeather::11110")
        }
    }

    given("캐시에 없는 시군구를 조회하면") {
        `when`("두 번 부르면") {
            then("처음 한 번만 PK 행(매핑 · 단기 · 육상 · 기온)을 읽고, 두 번째는 트랜잭션도 열지 않은 채 같은 바이트를 낸다") {
                val first = body("/api/places/weather?sigungu=26350")
                val second = body("/api/places/weather?sigungu=26350")
                second shouldBe first
                verify(exactly = 1) { repo.findArea("26350") }
                verify(exactly = 1) { repo.findShort(60, 127) }
                verify(exactly = 2) { repo.findMid(any(), any()) }
                verify(exactly = 0) { txManager.getTransaction(any()) }
            }
        }
        `when`("매핑이 없는 시군구면(좌표 없는 부천시 등)") {
            then("빈 날씨를 낸다 — 화면은 절을 그리지 않는다") {
                every { repo.findArea("41190") } returns null
                body("/api/places/weather?sigungu=41190") shouldContain "\"days\":[]"
            }
        }
    }

    given("단기 발표가 24시간을 넘었으면") {
        then("단기 날은 응답에서 빠지고(0 으로 그리지 않는다) 신선한 중기 날만 남는다") {
            every { repo.findShort(60, 127) } returns short(now.minusHours(25))
            val res = body("/api/places/weather?sigungu=11110")
            res shouldNotContain "\"source\":\"SHORT\""
            res shouldContain "\"source\":\"MID\""
            res shouldContain "\"shortBaseAt\":null"
        }
        then("캐시에 신선할 때 들어간 값도 읽는 시각으로 다시 거른다") {
            body("/api/places/weather?sigungu=11110") shouldContain "\"source\":\"SHORT\""
            // 캐시 값은 그대로인데 지금이 25시간 뒤라면 — 서비스를 직접 불러 시각만 옮긴다
            val later = ctx.getBean(WeatherUseCase::class.java).outlook("11110", freshBase.plusHours(25))
            later.days.map { it.source }.toSet() shouldBe setOf("MID")
            verify(exactly = 1) { repo.findShort(60, 127) }
        }
    }

    given("레디스가 응답하지 않으면") {
        then("적재는 성공하고 조회는 저장소에서 같은 바이트로 나간다") {
            val healthy = body("/api/places/weather?sigungu=11110")
            writer.failing = true
            val bulk = """{"items":[{"nx":60,"ny":127,"baseDate":"20261002","baseTime":"0500","itemsRaw":"[]"}]}"""
            mvc.perform(put("/internal/weather/short").contentType(MediaType.APPLICATION_JSON).content(bulk))
                .andReturn().response.status shouldBe 200
            body("/api/places/weather?sigungu=11110") shouldBe healthy
        }
    }

    given("캐시 설정") {
        then("날씨는 이름이 등록돼 있고 TTL 은 다음 단기 회차 + 한 시간(13시간)이다") {
            val manager = RegionCacheConfig.cacheManager(writer).also { it.initializeCaches() }
            manager.cacheConfigurations.keys shouldContainAll listOf(RegionCaches.WEATHER)
            manager.cacheConfigurations.getValue(RegionCaches.WEATHER)!!.ttlFunction.getTimeToLive("k", "v") shouldBe Duration.ofHours(13)
        }
    }
})

private fun quote(s: String): String = "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\""
