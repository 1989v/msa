package com.kgd.place.infrastructure.persistence

import com.kgd.place.domain.attraction.model.Attraction
import com.kgd.place.domain.attraction.model.EmbeddingModelRef
import com.kgd.place.domain.attraction.model.SimilarAttractions
import com.kgd.place.infrastructure.config.PlaceDataSourceConfig
import com.kgd.place.infrastructure.persistence.attraction.adapter.AttractionRepositoryAdapter
import com.kgd.place.infrastructure.persistence.attraction.adapter.AttractionSimilarRepositoryAdapter
import com.kgd.place.infrastructure.persistence.attraction.repository.AttractionCategoryCodeJpaRepository
import com.kgd.place.infrastructure.persistence.attraction.repository.AttractionJpaRepository
import com.kgd.place.infrastructure.persistence.attraction.repository.AttractionLinkJpaRepository
import com.kgd.place.infrastructure.persistence.attraction.repository.AttractionSimilarJpaRepository
import com.kgd.place.infrastructure.persistence.poi.repository.PoiJpaRepository
import com.kgd.place.infrastructure.persistence.region.repository.AdministrativeRegionJpaRepository
import com.kgd.place.infrastructure.persistence.region.repository.RegionJpaRepository
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
    @Autowired private val tx: TransactionTemplate,
) : BehaviorSpec({

    Given("place 전용 Flyway 가 적용된 place_db") {
        Then("엔티티 매핑이 마이그레이션 스키마와 일치하고 쿼리가 실행된다")
            .config(enabledIf = { dockerAvailable }) {
                // count() 는 엔티티마다 실제 SQL 을 MySQL 로 보낸다 — 컬럼이 어긋나면
                // validate 에서 컨텍스트가 아예 안 뜨고, 뜬 뒤에도 매핑이 틀리면 여기서 터진다.
                listOf(r0, r1, r2, r3, r4, r5, r6).map { it.count() }.size shouldBe 7
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
