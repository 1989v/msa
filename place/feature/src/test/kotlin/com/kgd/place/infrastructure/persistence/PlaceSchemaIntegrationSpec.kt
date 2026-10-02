package com.kgd.place.infrastructure.persistence

import com.kgd.place.domain.attraction.model.Attraction
import com.kgd.place.domain.attraction.model.AttractionBarrierFree
import com.kgd.place.domain.attraction.model.AttractionWellness
import com.kgd.place.domain.attraction.model.EmbeddingModelRef
import com.kgd.place.domain.attraction.model.SimilarAttractions
import com.kgd.place.infrastructure.config.PlaceDataSourceConfig
import com.kgd.place.domain.attraction.model.AttractionCongestion
import com.kgd.place.domain.attraction.model.AttractionRelated
import com.kgd.place.domain.attraction.model.NameMatch
import com.kgd.place.domain.attraction.model.RelatedTarget
import com.kgd.place.infrastructure.persistence.attraction.adapter.AttractionCongestionRepositoryAdapter
import com.kgd.place.infrastructure.persistence.attraction.adapter.AttractionExtrasRepositoryAdapter
import com.kgd.place.infrastructure.persistence.attraction.adapter.AttractionRelatedRepositoryAdapter
import com.kgd.place.infrastructure.persistence.attraction.adapter.AttractionRepositoryAdapter
import com.kgd.place.infrastructure.persistence.attraction.adapter.AttractionSimilarRepositoryAdapter
import com.kgd.place.infrastructure.persistence.attraction.repository.AttractionBarrierFreeJpaRepository
import com.kgd.place.infrastructure.persistence.attraction.repository.AttractionCategoryCodeJpaRepository
import com.kgd.place.infrastructure.persistence.attraction.repository.AttractionCongestionJpaRepository
import com.kgd.place.infrastructure.persistence.attraction.repository.AttractionJpaRepository
import com.kgd.place.infrastructure.persistence.attraction.repository.AttractionLinkJpaRepository
import com.kgd.place.infrastructure.persistence.attraction.repository.AttractionRelatedJpaRepository
import com.kgd.place.infrastructure.persistence.attraction.repository.AttractionSimilarJpaRepository
import com.kgd.place.infrastructure.persistence.attraction.repository.AttractionWellnessJpaRepository
import com.kgd.place.infrastructure.persistence.poi.repository.PoiJpaRepository
import com.kgd.place.infrastructure.persistence.region.repository.AdministrativeRegionJpaRepository
import com.kgd.place.infrastructure.persistence.region.repository.RegionJpaRepository
import com.kgd.place.infrastructure.persistence.region.repository.RegionVisitorDailyJpaRepository
import com.kgd.place.infrastructure.persistence.region.adapter.RegionVisitorRepositoryAdapter
import com.kgd.place.application.weather.port.WeatherRepositoryPort
import com.kgd.place.domain.weather.model.MidKind
import com.kgd.place.domain.weather.model.MidRegion
import com.kgd.place.domain.weather.model.WeatherArea
import com.kgd.place.infrastructure.persistence.weather.adapter.WeatherRepositoryAdapter
import com.kgd.place.infrastructure.persistence.weather.repository.WeatherMidForecastJpaRepository
import com.kgd.place.infrastructure.persistence.weather.repository.WeatherMidRegionJpaRepository
import com.kgd.place.infrastructure.persistence.weather.repository.WeatherShortForecastJpaRepository
import com.kgd.place.infrastructure.persistence.weather.repository.WeatherSigunguGridJpaRepository
import com.kgd.place.domain.region.model.AdministrativeRegionLevel
import com.kgd.place.domain.region.model.RegionVisitorDaily
import java.math.BigDecimal
import java.time.YearMonth
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.extensions.spring.SpringExtension
import io.kotest.matchers.shouldBe
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.autoconfigure.EnableAutoConfiguration
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.context.annotation.Import
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.testcontainers.DockerClientFactory
import org.testcontainers.containers.MySQLContainer
import org.testcontainers.utility.DockerImageName
import org.springframework.transaction.support.TransactionTemplate
import java.time.LocalDate
import java.time.LocalDateTime

/**
 * ADR-0093 ① — place 전용 스키마(`place_db`)와 JPA 엔티티가 일치하는지.
 *
 * **실제로 여기서 잡혔어야 할 것이 폴드할 때 처음 드러났다** — `attraction_category_codes.depth`
 * 가 TINYINT 인데 엔티티는 `Int` 였다. 운영은 `ddl-auto=none` 이라 몇 달 동안 조용했다.
 *
 * 컨텍스트가 뜬다 = Flyway 가 `placedb/migration` 을 적용했고 `validate` 가 통과했다는 뜻이다.
 * Docker 부재 시 skip.
 */
private val dockerAvailable: Boolean =
    runCatching { DockerClientFactory.instance().isDockerAvailable }.getOrDefault(false)

@Suppress("unused")
fun isPlaceDockerAvailable(): Boolean = dockerAvailable

@SpringBootTest(
    classes = [PlaceSchemaIntegrationSpec.Ctx::class],
    properties = [
        "spring.main.web-application-type=none",
        "spring.flyway.enabled=false",
        "place.flyway.enabled=true",
        "spring.jpa.hibernate.ddl-auto=validate",
    ],
)
@org.junit.jupiter.api.condition.EnabledIf(
    value = "com.kgd.place.infrastructure.persistence.PlaceSchemaIntegrationSpecKt#isPlaceDockerAvailable",
    disabledReason = "Docker 미연결 — Testcontainers MySQL 사용 불가",
)
class PlaceSchemaIntegrationSpec(
    @Autowired private val r0: RegionJpaRepository,
    @Autowired private val r1: AdministrativeRegionJpaRepository,
    @Autowired private val r2: PoiJpaRepository,
    @Autowired private val r3: AttractionJpaRepository,
    @Autowired private val r4: AttractionCategoryCodeJpaRepository,
    @Autowired private val r5: AttractionLinkJpaRepository,
    @Autowired private val r6: AttractionSimilarJpaRepository,
    @Autowired private val r7: AttractionBarrierFreeJpaRepository,
    @Autowired private val r8: AttractionWellnessJpaRepository,
    @Autowired private val r9: RegionVisitorDailyJpaRepository,
    @Autowired private val w0: WeatherSigunguGridJpaRepository,
    @Autowired private val w1: WeatherShortForecastJpaRepository,
    @Autowired private val w2: WeatherMidRegionJpaRepository,
    @Autowired private val w3: WeatherMidForecastJpaRepository,
    @Autowired private val c0: AttractionCongestionJpaRepository,
    @Autowired private val c1: AttractionRelatedJpaRepository,
    @Autowired private val tx: TransactionTemplate,
) : BehaviorSpec({

    Given("place 전용 Flyway 가 적용된 place_db") {
        Then("엔티티 매핑이 마이그레이션 스키마와 일치하고 쿼리가 실행된다")
            .config(enabledIf = { dockerAvailable }) {
                // count() 는 엔티티마다 실제 SQL 을 MySQL 로 보낸다 — 컬럼이 어긋나면
                // validate 에서 컨텍스트가 아예 안 뜨고, 뜬 뒤에도 매핑이 틀리면 여기서 터진다.
                listOf(r0, r1, r2, r3, r4, r5, r6, r7, r8, r9, w0, w1, w2, w3, c0, c1).map { it.count() }.size shouldBe 16
            }
    }

    Given("관광지를 id 로 이어 읽을 때 (키셋)") {
        Then("afterId 다음부터 id 순으로 이어지고 lang 이 걸러져야 한다")
            .config(enabledIf = { dockerAvailable }) {
                val adapter = AttractionRepositoryAdapter(r3)
                adapter.upsertAll(
                    (1..5).flatMap { n ->
                        listOf("ko", "en").map { lang ->
                            Attraction.create(contentId = "keyset-$n", lang = lang, title = "t$n", latitude = 37.0, longitude = 127.0)
                        }
                    },
                )
                val all = r3.findAll().filter { it.contentId.startsWith("keyset-") }.map { it.id!! }.sorted()

                // 두 쪽으로 이어 읽으면 빠짐·겹침 없이 전체가 id 순으로 나온다
                val first = adapter.findAfter(null, 0L, 6).map { it.id!! }
                val second = adapter.findAfter(null, first.last(), 6).map { it.id!! }
                first + second shouldBe all

                val ko = adapter.findAfter("ko", all[1], 10)
                ko.map { it.lang }.distinct() shouldBe listOf("ko")
                ko.map { it.id!! }.all { it > all[1] } shouldBe true
            }
    }

    Given("행사 날짜·목록 원문이 있는 행을 V23 컬럼에 적재할 때") {
        Then("개요 왕복 upsert 와 구글 보강 saveAll 을 지난 뒤에도 값이 남아야 한다")
            .config(enabledIf = { dockerAvailable }) {
                // searchFestival2 운영 표본(2026-10-02) 첫 행
                val raw = """{"contentid":"4116982","contenttypeid":"15","eventstartdate":"20261107","eventenddate":"20261108"}"""
                val adapter = AttractionRepositoryAdapter(r3)
                fun festival(withList: Boolean, overview: String? = null) = Attraction.create(
                    contentId = "4116982", lang = "ko", title = "산북AI김장문화축제",
                    latitude = 37.4008741346, longitude = 127.4451502631, contentTypeId = "15",
                    eventStartDate = if (withList) LocalDate.of(2026, 11, 7) else null,
                    eventEndDate = if (withList) LocalDate.of(2026, 11, 8) else null,
                    listRaw = if (withList) raw else null,
                    overview = overview,
                )
                adapter.upsertAll(listOf(festival(withList = true)))
                adapter.upsertAll(listOf(festival(withList = false, overview = "김장 문화 축제")))
                val id = r3.findByContentIdIn(setOf("4116982")).single().id!!
                adapter.saveAll(adapter.findAllByIds(listOf(id)).onEach { it.enrichGooglePlaceId("ChIJod7tSseifDUR9hXHLFNGMIs") })

                val back = adapter.findById(id)!!
                back.overview shouldBe "김장 문화 축제"
                back.googlePlaceId shouldBe "ChIJod7tSseifDUR9hXHLFNGMIs"
                back.eventStartDate shouldBe LocalDate.of(2026, 11, 7)
                back.eventEndDate shouldBe LocalDate.of(2026, 11, 8)
                back.listRaw shouldBe raw
            }
    }

    Given("문의처 번호가 100자를 넘는 행사를 적재할 때") {
        Then("V24 로 넓힌 tel 컬럼에 잘리지 않고 들어가야 한다")
            .config(enabledIf = { dockerAvailable }) {
                // searchFestival2 의 tel 최대 길이는 123자였다(2026-10-02). 그보다 긴 값으로 여유를 본다
                val tel = (1..12).joinToString(" / ") { "063-$it${it}0-$it$it$it$it" }.padEnd(150, '0')
                val adapter = AttractionRepositoryAdapter(r3)
                adapter.upsertAll(
                    listOf(
                        Attraction.create(
                            contentId = "long-tel", lang = "ko", title = "긴 문의처 행사",
                            latitude = 37.0, longitude = 127.0, contentTypeId = "15", tel = tel,
                        ),
                    ),
                )
                adapter.findById(r3.findByContentIdIn(setOf("long-tel")).single().id!!)!!.tel shouldBe tel
            }
    }

    Given("무장애·웰니스를 V25 표에 적재할 때") {
        Then("contentId 로 그 언어 관광지에 붙고, 목록 재적재가 상세를 지우지 않으며, 웰니스는 언어별로 통째로 바뀐다")
            .config(enabledIf = { dockerAvailable }) {
                // 운영 표본(2026-10-02): 경복궁 126508 상세 · 웰니스 국문 2994116 · 127956
                val attractions = AttractionRepositoryAdapter(r3)
                attractions.upsertAll(
                    listOf("126508" to "ko", "2994116" to "ko", "127956" to "ko", "126508" to "en").map { (cid, lang) ->
                        Attraction.create(contentId = cid, lang = lang, title = "t$cid", latitude = 37.0, longitude = 127.0)
                    },
                )
                val adapter = AttractionExtrasRepositoryAdapter(r7, r8)
                val ids = adapter.findAttractionIds("ko", listOf("126508", "2994116", "127956", "3305925"))
                ids.keys shouldBe setOf("126508", "2994116", "127956")
                val gyeongbokgung = ids.getValue("126508")
                val detail = """{"contentid":"126508","wheelchair":"대여가능","restroom":"장애인 화장실 있음"}"""
                val synced = LocalDateTime.of(2026, 10, 3, 2, 41)

                tx.execute {
                    adapter.saveBarrierFree(
                        listOf(AttractionBarrierFree(gyeongbokgung, "126508", """{"contentid":"126508"}""", null, detail, synced, listOf("WHEELCHAIR", "RESTROOM"), 1)),
                    )
                }
                // 목록만 다시 들어와도(서비스가 기존 상세를 실어 보낸다) 상세·플래그가 남는다
                val stored = adapter.findBarrierFreeByContentIds(listOf("126508")).single()
                tx.execute { adapter.saveBarrierFree(listOf(stored.copy(listModifiedAt = LocalDateTime.of(2026, 10, 2, 0, 0)))) }
                val back = adapter.findBarrierFreeByAttractionIds(listOf(gyeongbokgung)).single()
                // MySQL JSON 은 공백·키 순서를 바꿔 저장한다 — 값으로 견준다
                val json = tools.jackson.module.kotlin.jacksonObjectMapper()
                json.readTree(back.detailRaw) shouldBe json.readTree(detail)
                back.flags shouldBe listOf("WHEELCHAIR", "RESTROOM")
                back.flagsRuleVer shouldBe 1
                adapter.findBarrierFreeStates().single { it.contentId == "126508" }.detailSyncedAt shouldBe synced

                fun tag(cid: String) = AttractionWellness(ids.getValue(cid), cid, "ko", "EX050100", """{"contentId":"$cid"}""")
                tx.execute { adapter.replaceWellness("ko", listOf(tag("2994116"), tag("127956")), synced) } shouldBe emptySet()
                tx.execute { adapter.replaceWellness("ko", listOf(tag("2994116")), synced) } shouldBe
                    setOf(ids.getValue("2994116"), ids.getValue("127956"))
                adapter.findWellnessByAttractionIds(ids.values).map { it.contentId } shouldBe listOf("2994116")
            }
    }

    Given("집중률을 V28 표에 시군구 단위로 적재할 때") {
        Then("받은 시군구만 통째로 바뀌고 다른 시군구는 남으며, 원문에서 예측일 순 값이 읽히고 화면에 쓰는 매칭만 나온다")
            .config(enabledIf = { dockerAvailable }) {
                val adapter = AttractionCongestionRepositoryAdapter(c0)
                // 해운대구·종로구 운영 표본(2026-10-02) 모양 — 원문은 예측일 순서를 일부러 섞는다
                fun raw(name: String, signgu: String, vararg days: Pair<String, String>) = days.joinToString(",", "[", "]") { (ymd, rate) ->
                    """{"baseYmd":"$ymd","areaCd":"${signgu.take(2)}","signguCd":"$signgu","tAtsNm":"$name","cnctrRate":"$rate"}"""
                }
                fun row(signgu: String, name: String, id: Long?, method: NameMatch, vararg days: Pair<String, String>) =
                    AttractionCongestion(signgu, name, signgu.take(2), null, null, raw(name, signgu, *days),
                        LocalDate.of(2026, 10, 2), LocalDate.of(2026, 10, 3), id, method)
                val at = LocalDateTime.of(2026, 10, 3, 2, 0)

                tx.execute {
                    adapter.replaceSigungu("26350", listOf(
                        row("26350", "해운대해수욕장", 501L, NameMatch.EXACT, "20261003" to "52.5", "20261002" to "47.16"),
                        row("26350", "부산 해운대시장", 502L, NameMatch.CONTAINS, "20261002" to "30"),
                        row("26350", "SEA LIFE 부산아쿠아리움", null, NameMatch.NONE, "20261002" to "10"),
                    ), at)
                }
                tx.execute { adapter.replaceSigungu("11110", listOf(row("11110", "경복궁", 601L, NameMatch.EXACT, "20261002" to "99.24")), at) }
                // 다음 날 해운대구만 다시 — 같은 이름이 같은 트랜잭션에서 지워졌다 들어가도 유니크 키에 걸리지 않고, 종로구는 남는다
                tx.execute {
                    adapter.replaceSigungu("26350", listOf(
                        row("26350", "해운대해수욕장", 501L, NameMatch.EXACT, "20261003" to "60"),
                        row("26350", "부산 해운대시장", 502L, NameMatch.CONTAINS, "20261002" to "30"),
                    ), at)
                } shouldBe 3

                c0.findAll().map { it.signguCd to it.tAtsNm }.sortedBy { it.second } shouldBe
                    listOf("11110" to "경복궁", "26350" to "부산 해운대시장", "26350" to "해운대해수욕장")
                val served = adapter.findForecasts(listOf(501L, 502L, 601L), NameMatch.SERVED).associateBy { it.attractionId }
                served.keys shouldBe setOf(501L, 601L)
                served.getValue(501L).days.map { it.date to it.rate } shouldBe listOf(LocalDate.of(2026, 10, 3) to 60.0)
                served.getValue(601L).days.single().rate shouldBe 99.24
            }
    }

    Given("연관 관광지를 V29 표에 시군구 단위로 적재할 때") {
        Then("받은 시군구만 그 달로 통째로 바뀌고, 시군구별 최신 달이 읽히며, 대상 파생 값이 순위·매칭 그대로 돌아오고 화면에 쓰는 출발만 나온다")
            .config(enabledIf = { dockerAvailable }) {
                val adapter = AttractionRelatedRepositoryAdapter(c1)
                // 해운대구·종로구 202608 운영 표본(2026-10-02) 모양
                fun target(rank: Int, name: String, lcls: String, id: Long?, method: NameMatch) =
                    RelatedTarget(rank, name, lcls, "자연관광", "자연경관(하천/해양)", "26350", id, method)
                fun row(signgu: String, code: String, name: String, ym: String, id: Long?, method: NameMatch, vararg targets: RelatedTarget) =
                    AttractionRelated(code, name, signgu, ym, """[{"tAtsCd":"$code","rlteRank":"1"}]""", id, method, targets.toList())
                val at = LocalDateTime.of(2026, 10, 12, 2, 20)

                tx.execute {
                    adapter.replaceSigungu("26350", listOf(
                        row("26350", "d123", "해운대해수욕장", "202607", 501L, NameMatch.EXACT,
                            target(1, "동백섬", "관광지", 601L, NameMatch.NORMALIZED), target(2, "화로구이/마장점", "음식", null, NameMatch.NONE)),
                        row("26350", "e456", "부산 해운대시장", "202607", 502L, NameMatch.CONTAINS),
                    ), at)
                }
                tx.execute { adapter.replaceSigungu("11110", listOf(row("11110", "f789", "경복궁", "202608", 701L, NameMatch.EXACT)), at) }
                // 다음 달 해운대구만 다시 — 같은 출발이 같은 트랜잭션에서 지워졌다 들어가도 유니크 키에 걸리지 않고, 종로구는 남는다
                tx.execute {
                    adapter.replaceSigungu("26350", listOf(
                        row("26350", "d123", "해운대해수욕장", "202608", 501L, NameMatch.EXACT,
                            target(2, "누리마루 APEC하우스", "관광지", 602L, NameMatch.EXACT), target(1, "동백섬", "관광지", 601L, NameMatch.NORMALIZED)),
                        row("26350", "e456", "부산 해운대시장", "202608", 502L, NameMatch.CONTAINS),
                    ), at)
                } shouldBe 2

                adapter.latestBaseYmBySigungu() shouldBe mapOf("11110" to "202608", "26350" to "202608")
                val served = adapter.findLinked(listOf(501L, 502L, 701L), NameMatch.SERVED).associateBy { it.attractionId }
                served.keys shouldBe setOf(501L, 701L)
                served.getValue(501L).targets.map { Triple(it.rank, it.attractionId, it.matchMethod) } shouldBe
                    listOf(Triple(2, 602L, NameMatch.EXACT), Triple(1, 601L, NameMatch.NORMALIZED))
                served.getValue(501L).targets.first().scls shouldBe "자연경관(하천/해양)"
                served.getValue(701L).targets shouldBe emptyList()
            }
    }

    Given("날씨를 V27 표에 적재할 때") {
        Then("매핑·구역은 키로 덮이고, 예보는 같거나 새 발표만 덮으며(늦게 온 옛 발표는 무시), 원문이 그대로 읽혀야 한다")
            .config(enabledIf = { dockerAvailable }) {
                val adapter = WeatherRepositoryAdapter(w0, w1, w2, w3)
                val at = LocalDateTime.of(2026, 10, 2, 17, 30)
                tx.execute {
                    adapter.upsertMidRegions(listOf(MidRegion("11B00000", MidKind.LAND, "서울, 인천, 경기도"), MidRegion("11B10101", MidKind.TA, "서울")))
                    adapter.upsertAreas(
                        listOf(
                            WeatherArea("11110", 60, 127, "11B00000", "11B10101", "NAME"),
                            WeatherArea("11140", 60, 127, "11B00000", "11B10101", "METRO"),
                            WeatherArea("26350", 99, 75, "11H20000", "11H20201", "METRO"),
                        ),
                        at,
                    )
                }
                // 대표점이 옮겨 가면 매핑이 덮인다
                tx.execute { adapter.upsertAreas(listOf(WeatherArea("26350", 98, 76, "11H20000", "11H20201", "METRO")), at.plusHours(12)) }
                adapter.findArea("26350") shouldBe WeatherArea("26350", 98, 76, "11H20000", "11H20201", "METRO")
                w2.findById("11B10101").get().name shouldBe "서울"

                val raw0500 = """[{"baseDate":"20261002","baseTime":"0500","category":"TMX","fcstDate":"20261002","fcstTime":"1500","fcstValue":"22.0","nx":60,"ny":127}]"""
                val raw1700 = """[{"baseDate":"20261002","baseTime":"1700","category":"TMN","fcstDate":"20261003","fcstTime":"0600","fcstValue":"12.0","nx":60,"ny":127}]"""
                val base0500 = LocalDateTime.of(2026, 10, 2, 5, 0)
                val base1700 = LocalDateTime.of(2026, 10, 2, 17, 0)
                tx.execute { adapter.upsertShort(listOf(WeatherRepositoryPort.ShortRaw(60, 127, base1700, raw1700)), at) }
                // 늦게 도착한 05시 발표본(재실행)은 17시 발표본을 덮지 않는다
                tx.execute { adapter.upsertShort(listOf(WeatherRepositoryPort.ShortRaw(60, 127, base0500, raw0500)), at.plusHours(1)) }
                val short = adapter.findShort(60, 127)!!
                short.baseAt shouldBe base1700
                short.items.single().category shouldBe "TMN"
                w1.count() shouldBe 1

                val tmFc = LocalDateTime.of(2026, 10, 2, 6, 0)
                tx.execute { adapter.upsertMid(listOf(WeatherRepositoryPort.MidRaw("11B10101", MidKind.TA, tmFc, """{"regId":"11B10101","taMin4":10}""")), at) }
                tx.execute { adapter.upsertMid(listOf(WeatherRepositoryPort.MidRaw("11B10101", MidKind.TA, tmFc.minusDays(1), """{"regId":"11B10101","taMin4":3}""")), at) }
                tx.execute { adapter.upsertMid(listOf(WeatherRepositoryPort.MidRaw("11B10101", MidKind.TA, tmFc.plusDays(1), """{"regId":"11B10101","taMin4":11}""")), at) }
                adapter.findMid("11B10101", MidKind.TA)!!.let { (it.tmFc to it.fields["taMin4"]) } shouldBe (tmFc.plusDays(1) to "11")
                adapter.findMid("11B10101", MidKind.LAND) shouldBe null

                adapter.findSigunguByGrids(listOf(60 to 127)).toSet() shouldBe setOf("11110", "11140")
                adapter.findSigunguByMidRegions(listOf("11H20201")) shouldBe listOf("26350")
                adapter.findSigunguByMidRegions(listOf("11B00000")).toSet() shouldBe setOf("11110", "11140")
            }
    }

    Given("지역 방문자를 V26 표에 같은 날 두 번 적재할 때") {
        Then("키가 같은 행은 덮이고(행이 늘지 않는다), 원문은 그대로, 월 합계는 파생값으로 나와야 한다")
            .config(enabledIf = { dockerAvailable }) {
                val adapter = RegionVisitorRepositoryAdapter(r9)
                // 운영 표본(2026-10-02) 종로구 2026-09-01 — 외지인 값은 원천의 부동소수 표기 그대로
                fun row(div: String, num: String, day: Int = 1) = RegionVisitorDaily(
                    AdministrativeRegionLevel.SIGUNGU, "11110", LocalDate.of(2026, 9, day), div, num,
                    regionName = "종로구", touDivNm = "외지인(b)", daywkDivCd = "2", daywkDivNm = "화요일",
                )
                val at = LocalDateTime.of(2026, 10, 3, 2, 30)
                // 운영은 어댑터의 @Transactional 프록시가 감싼다 — 여기서는 어댑터를 직접 만들어 트랜잭션을 직접 연다
                tx.execute { adapter.upsertAll(listOf(row("1", "187029.5"), row("2", "24814.549999999996")), at) }
                tx.execute { adapter.upsertAll(listOf(row("1", "187030.0"), row("2", "24814.549999999996"), row("2", "100.25", day = 2)), at.plusDays(1)) }

                r9.findAll().filter { it.id.regionCode == "11110" }.size shouldBe 3
                val outsider = r9.findAll().single { it.id.regionCode == "11110" && it.id.touDivCd == "2" && it.id.baseYmd.dayOfMonth == 1 }
                outsider.touNum shouldBe "24814.549999999996"
                outsider.touNumValue.compareTo(BigDecimal("24814.550")) shouldBe 0
                outsider.syncedAt shouldBe at.plusDays(1)
                // 다시 받은 값이 원문까지 덮는다(원천이 고친 날)
                r9.findAll().single { it.id.regionCode == "11110" && it.id.touDivCd == "1" }.touNum shouldBe "187030.0"

                adapter.findLatestDate(AdministrativeRegionLevel.SIGUNGU, "11110") shouldBe LocalDate.of(2026, 9, 2)
                adapter.findLatestDate(AdministrativeRegionLevel.SIDO, "11") shouldBe null
                val totals = adapter.findMonthlyTotals(AdministrativeRegionLevel.SIGUNGU, "11110", LocalDate.of(2025, 9, 1))
                    .associateBy { it.touDivCd }
                totals.getValue("1").month shouldBe YearMonth.of(2026, 9)
                totals.getValue("1").total.compareTo(BigDecimal("187030.0")) shouldBe 0
                totals.getValue("2").days shouldBe 2
                totals.getValue("2").total.compareTo(BigDecimal("24914.800")) shouldBe 0
            }
    }

    Given("비슷한 곳 목록을 V22 표에 두 번 적재할 때") {
        Then("문서·스탬프 단위로 통째로 바뀌고, 다른 스탬프 목록은 남으며, 조회는 순위 순이어야 한다")
            .config(enabledIf = { dockerAvailable }) {
                val attractions = AttractionRepositoryAdapter(r3)
                attractions.upsertAll(
                    (1..5).map { n -> Attraction.create(contentId = "similar-$n", lang = "ko", title = "s$n", latitude = 37.0, longitude = 127.0) },
                )
                val (a, b, c, d, e) = r3.findAll().filter { it.contentId.startsWith("similar-") }.map { it.id!! }.sorted()
                val adapter = AttractionSimilarRepositoryAdapter(r6)
                val current = EmbeddingModelRef("microsoft/harrier-oss-v1-270m", "31de22b", 640)
                val old = EmbeddingModelRef("microsoft/harrier-oss-v1-270m", "0000000", 640)
                fun list(ref: EmbeddingModelRef, vararg ids: Long) =
                    SimilarAttractions.create(a, ref, ids.mapIndexed { i, id -> SimilarAttractions.Item(id, 0.9 - i * 0.1) })
                val at = LocalDateTime.of(2026, 9, 30, 0, 0)

                // 트랜잭션 안에서 지우고 곧바로 같은 (문서, 스탬프, 순위) 로 넣는다 — 유니크 키에 걸리면 안 된다
                tx.execute { adapter.replace(listOf(list(current, b, c, d), list(old, e)), at) }
                tx.execute { adapter.replace(listOf(list(current, e, b)), at) }

                adapter.findByModelAndIds(current.value, listOf(a)).single().items.map { it.similarId } shouldBe listOf(e, b)
                adapter.findByModelAndIds(old.value, listOf(a)).single().items.map { it.similarId } shouldBe listOf(e)

                // 빈 목록 = 그 스탬프의 목록을 지운다
                tx.execute { adapter.replace(listOf(list(current)), at) }
                adapter.findByModelAndIds(current.value, listOf(a)) shouldBe emptyList()
                adapter.existingAttractionIds(listOf(a, Long.MAX_VALUE)) shouldBe setOf(a)
            }
    }
}) {

    override fun extensions() = listOf(SpringExtension)

    /**
     * place 는 자기 config 가 이미 `@Primary` 를 붙인다 — 여기서 별칭을 하나 더 만들면
     * `@Primary` DataSource 가 둘이 되어 `JpaBaseConfiguration`(`@ConditionalOnSingleCandidate`)
     * 이 물러나고 `EntityManagerFactoryBuilder` 가 아예 안 생긴다. 다른 도메인 스펙과
     * 이 한 줄이 다른 이유다.
     */
    @EnableAutoConfiguration
    @Import(PlaceDataSourceConfig::class)
    open class Ctx

    companion object {
        @JvmStatic
        private val mysql: MySQLContainer<*>? = if (dockerAvailable) {
            MySQLContainer(DockerImageName.parse("mysql:8.0.33"))
                .withDatabaseName("place_db")
                .withUsername("root")
                .withPassword("test")
                .also { it.start() }
        } else {
            null
        }

        @JvmStatic
        @DynamicPropertySource
        fun props(registry: DynamicPropertyRegistry) {
            val container = mysql ?: return
            registry.add("spring.datasource.place.url") { container.jdbcUrl }
            registry.add("spring.datasource.place.username") { container.username }
            registry.add("spring.datasource.place.password") { container.password }
            registry.add("spring.datasource.place.driver-class-name") { "com.mysql.cj.jdbc.Driver" }
        }
    }
}
