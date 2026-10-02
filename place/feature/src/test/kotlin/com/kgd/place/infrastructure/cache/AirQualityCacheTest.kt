package com.kgd.place.infrastructure.cache

import com.kgd.place.application.air.port.AirQualityRepositoryPort
import com.kgd.place.application.air.service.AirQualityLoader
import com.kgd.place.application.air.service.AirQualityService
import com.kgd.place.application.air.service.AirQualitySyncService
import com.kgd.place.application.air.usecase.AirQualityUseCase
import com.kgd.place.application.air.usecase.SyncAirQualityUseCase
import com.kgd.place.application.region.service.RegionCaches
import com.kgd.place.domain.air.model.AirMeasurement
import com.kgd.place.domain.air.model.AirStation
import com.kgd.place.domain.air.model.AirStationMapping
import com.kgd.place.infrastructure.persistence.air.adapter.AirQualityRepositoryAdapter
import com.kgd.place.presentation.air.controller.AirQualityController
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldContainAll
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
import tools.jackson.module.kotlin.jacksonObjectMapper
import java.time.Duration
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.temporal.ChronoUnit

/**
 * 시군구 대기의 레디스 경로. [WeatherCacheTest] 와 같이 실제 [RegionCacheConfig] 를 올리고 레디스 자리에
 * 바이트를 들고 있는 [InMemoryCacheWriter] 만 끼운다 — 응답은 실제 직렬화를 한 바퀴 돈 값이다.
 *
 * 판정 근거는 저장소 포트가 불린 횟수(적재 뒤 GET 이 포트를 부르면 사용자 요청이 MySQL 에 닿은 것)와,
 * 응답 값이 원천 행 원문의 문자열과 같은지다. 신선도는 컨트롤러가 읽는 KST 벽시계 기준이라 측정 시각을 지금에서 거꾸로 잡는다.
 */
class AirQualityCacheTest : BehaviorSpec({
    val repo = mockk<AirQualityRepositoryPort>()
    val txManager = mockk<PlatformTransactionManager>(relaxed = true)
    val writer = InMemoryCacheWriter()

    val ctx = AnnotationConfigApplicationContext().apply {
        beanFactory.registerSingleton("airRepo", repo)
        beanFactory.registerSingleton("transactionManager", txManager)
        beanFactory.registerSingleton("writer", writer)
        register(
            RegionCacheTest.TestBeans::class.java, RegionCacheConfig::class.java,
            AirQualityLoader::class.java, AirQualityService::class.java, AirQualitySyncService::class.java,
        )
        refresh()
    }
    val mvc: MockMvc = MockMvcBuilders.standaloneSetup(
        AirQualityController(ctx.getBean(AirQualityUseCase::class.java), ctx.getBean(SyncAirQualityUseCase::class.java)),
    ).build()
    val json = jacksonObjectMapper()

    fun body(url: String): String = mvc.perform(get(url)).andReturn().response.also { it.status shouldBe 200 }.contentAsString

    val now = LocalDateTime.now(ZoneId.of("Asia/Seoul"))
    val freshAt = now.truncatedTo(ChronoUnit.HOURS).minusHours(1)

    // 세종 조치원읍 운영 응답(2026-10-02 21:00) 원문 — 일산화탄소·아황산가스는 통신장애로 값이 「-」, 등급이 없다
    val jochiwonRaw = """{"so2Grade":null,"coFlag":"통신장애","khaiValue":"48","so2Value":"-","coValue":"-","pm25Flag":null,"pm10Flag":null,"o3Grade":"1","pm10Value":"34","khaiGrade":"1","pm25Value":"8","sidoName":"세종","no2Flag":null,"no2Grade":"1","o3Flag":null,"pm25Grade":"1","so2Flag":"통신장애","dataTime":"2026-10-02 21:00","coGrade":null,"no2Value":"0.017","stationName":"조치원읍","pm10Grade":"1","o3Value":"0.027"}"""
    fun measurement(at: LocalDateTime?, raw: String = jochiwonRaw) =
        AirMeasurement("세종", "조치원읍", at, AirQualityRepositoryAdapter.fields(raw))

    beforeEach {
        writer.store.clear()
        writer.failing = false
        clearMocks(repo, txManager, answers = false)
        // 세종시 후보 둘 — 조치원읍(측정 있음) · 신흥동(이번 회차 측정 없음)
        every { repo.findMappings(any()) } answers {
            listOf(AirStationMapping(firstArg(), "조치원읍", 2410, 120), AirStationMapping(firstArg(), "신흥동", 5100, 30))
        }
        every { repo.findStations(any()) } returns listOf(AirStation("조치원읍", 36.6005, 127.2961), AirStation("신흥동", 36.4800, 127.2600))
        every { repo.findMeasurements(any()) } returns listOf(measurement(freshAt))
        every { repo.upsertMeasurements(any(), any()) } answers { firstArg<List<*>>().size }
        every { repo.upsertStations(any(), any()) } answers { firstArg<List<*>>().size }
        every { repo.replaceMappings(any(), any()) } answers { firstArg<List<*>>().size }
        every { repo.findSigunguByStations(any()) } returns listOf("36110")
    }

    given("수집기가 전국 측정을 적재하면") {
        `when`("그 측정소를 쓰는 시군구를 조회할 때") {
            then("적재가 덮은 캐시에서 나가고 저장소를 다시 부르지 않는다 — 원문·측정 시각은 측정소마다 그대로 넘긴다") {
                val rows = slot<List<AirQualityRepositoryPort.MeasurementRaw>>()
                every { repo.upsertMeasurements(capture(rows), any()) } answers { rows.captured.size }
                val items = listOf(
                    mapOf("sidoName" to "세종", "stationName" to "조치원읍", "dataTime" to "2026-10-02 21:00", "itemRaw" to jochiwonRaw),
                    // 같은 응답 안의 다른 측정소는 22시 — 시각이 섞여도 한 줄로 맞추지 않는다. 자정은 원천이 24:00 으로 준다
                    mapOf("sidoName" to "서울", "stationName" to "중구", "dataTime" to "2026-10-02 24:00", "itemRaw" to """{"stationName":"중구"}"""),
                    mapOf("sidoName" to "경기", "stationName" to "점검소", "dataTime" to null, "itemRaw" to """{"stationName":"점검소"}"""),
                )
                val res = mvc.perform(
                    put("/internal/air/measurements").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(mapOf("items" to items))),
                ).andReturn().response
                res.status shouldBe 200
                res.contentAsString shouldContain "\"sigungu\":1"
                rows.captured.map { it.stationName to it.dataTime } shouldBe listOf(
                    "조치원읍" to LocalDateTime.of(2026, 10, 2, 21, 0),
                    "중구" to LocalDateTime.of(2026, 10, 3, 0, 0),
                    "점검소" to null,
                )
                rows.captured.first().itemRaw shouldBe jochiwonRaw
                verify(exactly = 1) { repo.findSigunguByStations(listOf("조치원읍", "중구", "점검소")) }
                writer.store.keys shouldBe setOf("placeAir::36110")
                verify(exactly = 1) { repo.findMappings(any()) }

                val sejong = json.readTree(body("/api/places/air?sigungu=36110"))["data"]
                verify(exactly = 1) { repo.findMappings(any()) }
                verify(exactly = 1) { repo.findMeasurements(listOf("조치원읍", "신흥동")) }
                // 후보는 측정소마다 따로 — 값을 섞거나 평균하지 않고, 측정 없는 측정소는 측정이 비어 있다
                sejong["stations"].let { list -> (0 until list.size()).map { list[it]["name"].asText() } } shouldBe listOf("신흥동", "조치원읍")
                sejong["stations"][0]["measurement"].isNull shouldBe true
                val jochiwon = sejong["stations"][1]
                jochiwon["latitude"].asDouble() shouldBe 36.6005
                // 값·등급은 원문 문자열 그대로 — 수로 바꾸거나 등급을 다시 매기지 않는다
                val m = jochiwon["measurement"]
                m["dataTime"].asText() shouldBe freshAt.toString()
                m["sidoName"].asText() shouldBe "세종"
                m["pm10"].toString() shouldBe """{"value":"34","grade":"1","flag":null}"""
                m["pm25"].toString() shouldBe """{"value":"8","grade":"1","flag":null}"""
            }
        }
    }

    given("Flag(통신장애 등)가 있는 측정이면") {
        then("값 대신 원천 표시를 그대로 낸다") {
            val raw = jochiwonRaw.replace("\"pm10Flag\":null", "\"pm10Flag\":\"점검및교정\"").replace("\"pm10Value\":\"34\"", "\"pm10Value\":\"-\"")
                .replace("\"pm10Grade\":\"1\"", "\"pm10Grade\":null")
            every { repo.findMeasurements(any()) } returns listOf(measurement(freshAt, raw))
            json.readTree(body("/api/places/air?sigungu=36110"))["data"]["stations"][1]["measurement"]["pm10"].toString() shouldBe
                """{"value":"-","grade":null,"flag":"점검및교정"}"""
        }
    }

    given("측정이 3시간을 넘었으면") {
        then("측정은 응답에서 빠지고(0 으로 그리지 않는다) 측정소만 남는다") {
            every { repo.findMeasurements(any()) } returns listOf(measurement(now.minusHours(3).minusMinutes(1)))
            val res = json.readTree(body("/api/places/air?sigungu=36110"))["data"]["stations"][1]
            res["measurement"].isNull shouldBe true
            res["name"].asText() shouldBe "조치원읍"
        }
        then("캐시에 신선할 때 들어간 값도 읽는 시각으로 다시 거른다") {
            body("/api/places/air?sigungu=36110") shouldContain "\"pm10\""
            val later = ctx.getBean(AirQualityUseCase::class.java).air("36110", freshAt.plusHours(3).plusMinutes(1))
            later.stations.map { it.measurement } shouldBe listOf(null, null)
            verify(exactly = 1) { repo.findMeasurements(any()) }
        }
    }

    given("후보가 없거나 측정소에 이번 측정이 없으면") {
        then("측정소 목록 · 측정이 비어 화면은 절을 그리지 않는다") {
            every { repo.findMappings("41190") } returns emptyList()
            json.readTree(body("/api/places/air?sigungu=41190"))["data"]["stations"].size() shouldBe 0
            verify(exactly = 0) { repo.findStations(any()) }
            every { repo.findMeasurements(any()) } returns listOf(measurement(null))
            json.readTree(body("/api/places/air?sigungu=36110"))["data"]["stations"].let { list ->
                (0 until list.size()).map { list[it]["measurement"].isNull }
            } shouldBe listOf(true, true)
        }
    }

    given("측정소 목록과 매핑을 적재하면") {
        then("측정소는 좌표 그대로 저장하고, 매핑을 받은 시군구 캐시를 덮는다") {
            val stations = slot<List<AirQualityRepositoryPort.StationRaw>>()
            every { repo.upsertStations(capture(stations), any()) } answers { stations.captured.size }
            val request = mapOf(
                "stations" to listOf(mapOf("stationName" to "중구", "latitude" to 37.564639, "longitude" to 126.975961, "itemRaw" to """{"dmX":"37.564639"}""")),
                "mappings" to listOf(
                    mapOf("sigunguCode" to "11140", "stationName" to "중구", "distanceM" to 820, "attractions" to 310),
                    // 대표점이 없는 시군구도 관광지 후보만으로 들어온다
                    mapOf("sigunguCode" to "41190", "stationName" to "중구", "distanceM" to null, "attractions" to 2),
                ),
            )
            val res = mvc.perform(put("/internal/air/stations").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(request)))
                .andReturn().response
            res.status shouldBe 200
            stations.captured.single().station shouldBe AirStation("중구", 37.564639, 126.975961)
            verify(exactly = 1) {
                repo.replaceMappings(listOf(AirStationMapping("11140", "중구", 820, 310), AirStationMapping("41190", "중구", null, 2)), any())
            }
            writer.store.keys shouldBe setOf("placeAir::11140", "placeAir::41190")
        }
    }

    given("레디스가 응답하지 않으면") {
        then("적재는 성공하고 조회는 저장소에서 같은 바이트로 나간다") {
            val healthy = body("/api/places/air?sigungu=36110")
            writer.failing = true
            val bulk = """{"items":[{"sidoName":"세종","stationName":"조치원읍","dataTime":"2026-10-02 21:00","itemRaw":"{}"}]}"""
            mvc.perform(put("/internal/air/measurements").contentType(MediaType.APPLICATION_JSON).content(bulk))
                .andReturn().response.status shouldBe 200
            body("/api/places/air?sigungu=36110") shouldBe healthy
        }
    }

    given("캐시 설정") {
        then("대기는 이름이 등록돼 있고 TTL 은 다음 회차 + 한 시간(2시간)이다") {
            val manager = RegionCacheConfig.cacheManager(writer).also { it.initializeCaches() }
            manager.cacheConfigurations.keys shouldContainAll listOf(RegionCaches.AIR)
            manager.cacheConfigurations.getValue(RegionCaches.AIR)!!.ttlFunction.getTimeToLive("k", "v") shouldBe Duration.ofHours(2)
        }
    }
})
