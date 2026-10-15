package com.kgd.place.infrastructure.persistence.market.repository

import com.kgd.place.application.market.usecase.*
import com.kgd.place.application.market.service.*
import com.kgd.place.infrastructure.persistence.market.adapter.*
import com.kgd.place.domain.market.model.*
import com.kgd.place.infrastructure.persistence.market.entity.*
import com.kgd.place.infrastructure.persistence.market.adapter.MarketSearchRepositoryAdapter
import com.kgd.place.infrastructure.persistence.attraction.entity.AttractionJpaEntity
import com.querydsl.jpa.impl.JPAQueryFactory
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import jakarta.persistence.EntityManager
import org.hibernate.cfg.Configuration
import org.springframework.data.domain.PageRequest
import org.springframework.data.jpa.repository.support.JpaRepositoryFactory
import org.testcontainers.containers.MySQLContainer
import org.testcontainers.utility.DockerImageName
import java.time.LocalDateTime

/** Actual MySQL execution: correlated pairing, effective overrides, literal LIKE and DB pagination. */
class MarketSearchQueryRepositoryTest : BehaviorSpec({
    // 운영 place_db 와 같은 콜레이션: 서버·열 utf8mb4_unicode_ci, 연결은 드라이버 기본(utf8mb4_0900_ai_ci).
    // 컨테이너 기본값으로 돌리면 둘이 섞일 때 나는 Illegal mix of collations 를 놓친다.
    val mysql = MySQLContainer(DockerImageName.parse("mysql:8.0"))
        .withCommand("--character-set-server=utf8mb4", "--collation-server=utf8mb4_unicode_ci")
    lateinit var emf: org.hibernate.SessionFactory
    lateinit var em: EntityManager
    lateinit var repository: MarketSearchQueryRepository
    lateinit var refresh: com.kgd.place.infrastructure.persistence.market.adapter.MarketSearchRefreshRepositoryAdapter
    lateinit var writer: MarketRepositoryAdapter
    lateinit var geometryWriter: MarketGeometryRepositoryAdapter
    lateinit var adapter: MarketSearchRepositoryAdapter
    beforeSpec {
        mysql.start()
        val config = Configuration().setProperty("hibernate.connection.url", mysql.jdbcUrl)
            .setProperty("hibernate.connection.username", mysql.username)
            .setProperty("hibernate.connection.password", mysql.password)
            .setProperty("hibernate.hbm2ddl.auto", "create-drop")
        listOf(MarketJpaEntity::class.java, MarketStoreSearchJpaEntity::class.java, MarketStoreJpaEntity::class.java, MarketStoreOverrideJpaEntity::class.java,
            MarketBoundaryJpaEntity::class.java, MarketZoneJpaEntity::class.java, AttractionJpaEntity::class.java,
            MarketChangeLogJpaEntity::class.java, MarketStewardJpaEntity::class.java,
            MarketPathJpaEntity::class.java, MarketRoadRuleJpaEntity::class.java)
            .forEach { config.addAnnotatedClass(it) }
        emf = config.buildSessionFactory()
        em = emf.createEntityManager()
        val factory = JPAQueryFactory(em)
        repository = MarketSearchQueryRepository(factory)
        refresh = com.kgd.place.infrastructure.persistence.market.adapter.MarketSearchRefreshRepositoryAdapter(factory)
        refresh.javaClass.getDeclaredField("em").also { it.isAccessible = true }.set(refresh, em)
        val repos = JpaRepositoryFactory(em)
        val dataSource = org.springframework.jdbc.datasource.DriverManagerDataSource(mysql.jdbcUrl, mysql.username, mysql.password)
        writer = MarketRepositoryAdapter(repos.getRepository(MarketJpaRepository::class.java),
            repos.getRepository(MarketZoneJpaRepository::class.java), repos.getRepository(MarketStoreJpaRepository::class.java),
            repos.getRepository(MarketStoreOverrideJpaRepository::class.java), repos.getRepository(MarketChangeLogJpaRepository::class.java),
            repos.getRepository(MarketStewardJpaRepository::class.java), MarketRowRestorer(dataSource), searchRefresh = refresh)
        geometryWriter = MarketGeometryRepositoryAdapter(repos.getRepository(MarketBoundaryJpaRepository::class.java),
            repos.getRepository(MarketPathJpaRepository::class.java), repos.getRepository(MarketRoadRuleJpaRepository::class.java))
        geometryWriter.javaClass.getDeclaredField("entityManager").also { it.isAccessible = true }.set(geometryWriter, em)
        adapter = MarketSearchRepositoryAdapter(repository, repos.getRepository(MarketJpaRepository::class.java),
            repos.getRepository(MarketStoreOverrideJpaRepository::class.java),
            repos.getRepository(MarketZoneJpaRepository::class.java), factory)
    }
    beforeEach { em.transaction.begin() }
    afterEach { if (em.transaction.isActive) em.transaction.rollback(); em.clear() }
    afterSpec { runCatching { em.close() }; runCatching { emf.close() }; mysql.stop() }
    fun market(content: String, name: String = content, raw: String? = null): MarketJpaEntity = MarketJpaEntity.fromDomain(
        Market(content, name, MarketType.STREET, sourceRaw = raw)).also { em.persist(it); em.flush() }
    /** Same as ingest: recompute the market's pairs with the projection rule and write paired_store_id. */
    fun pair(marketId: Long) {
        val rows = em.createQuery("select s from MarketStoreJpaEntity s where s.marketId = :m", MarketStoreJpaEntity::class.java)
            .setParameter("m", marketId).resultList.map { it.toDomain() }
        em.createQuery("update MarketStoreJpaEntity s set s.pairedStoreId = null where s.marketId = :m").setParameter("m", marketId).executeUpdate()
        com.kgd.place.application.market.service.MarketPublicProjection.pairs(rows).forEach { (a, b) ->
            listOf(a to b, b to a).forEach { (id, partner) ->
                em.createQuery("update MarketStoreJpaEntity s set s.pairedStoreId = :p where s.id = :id")
                    .setParameter("p", partner).setParameter("id", id).executeUpdate()
            }
        }
        em.clear()
        refresh.refresh(marketId)
    }
    fun store(market: MarketJpaEntity, name: String, status: MarketMembershipStatus = MarketMembershipStatus.IN,
        items: String? = null, category: String? = null, source: MarketStoreSource = MarketStoreSource.MANUAL,
        jibun: String? = null, judged: MarketMembershipStatus? = null, menu: String? = null): MarketStoreJpaEntity {
        val key = java.util.UUID.randomUUID().toString()
        val row = MarketStore(requireNotNull(market.id), name, source, sourceKey = key, items = items,
            categoryMajor = category, jibunAddress = jibun, onnuriKey = if (source == MarketStoreSource.ONNURI) key else null,
            onnuriRaw = if (source == MarketStoreSource.ONNURI) "{}" else null,
            sanggaKey = if (source == MarketStoreSource.SANGGA) key else null,
            sanggaRaw = if (source == MarketStoreSource.SANGGA) "{}" else null,
            actorKind = MarketActorKind.ADMIN, createdByMemberId = 1,
            membership = MarketMembership(status), judgedMembership = judged,
            goodPriceRaw = menu?.let { """{"업종":"한식","메뉴1":"$it","가격1":"7000"}""" },
            goodPriceKey = menu?.let { "private-key" }, goodPriceMatchedBy = menu?.let { "NAME" }, goodPriceMenuNames = menu)
        return MarketStoreJpaEntity.fromDomain(row).also { em.persist(it); em.flush(); pair(requireNotNull(market.id)) }
    }
    fun edit(store: MarketStoreJpaEntity, field: MarketStoreField, value: String?) {
        em.persist(MarketStoreOverrideJpaEntity.fromDomain(MarketStoreOverride(requireNotNull(store.id), field,
            value, "수정", 1, MarketActorKind.ADMIN))); em.flush()
        refresh.refresh(store.marketId)
    }
    Given("쓰기와 같은 트랜잭션의 검색 투영") {
        Then("적재는 pairing 이후 한 번 갱신하고 재적재의 품목과 메뉴도 즉시 바뀐다") {
            val m = market("write-ingest")
            val marketId = requireNotNull(m.id)
            val ingest = MarketIngestService(writer, writer)
            val onnuri = MarketStore(marketId, "적재가게", MarketStoreSource.ONNURI, sourceKey = "o",
                onnuriKey = "o", onnuriRaw = "{}", jibunAddress = "중구1", items = "옛품목",
                membership = MarketMembership(MarketMembershipStatus.IN))
            val sangga = MarketStore(marketId, "적재가게", MarketStoreSource.SANGGA, sourceKey = "s",
                sanggaKey = "s", sanggaRaw = "{}", jibunAddress = "중구1", categoryMajor = "분류",
                membership = MarketMembership(MarketMembershipStatus.IN))
            fun ingestRows(a: MarketStore, b: MarketStore) = ingest.ingest(IngestMarketUseCase.Command(
                m.toDomain().copy(id = null), emptyList(), listOf(IngestMarketUseCase.Store(a), IngestMarketUseCase.Store(b)), listOf("o", "s")))
            ingestRows(onnuri, sangga)
            repository.counts()[marketId] shouldBe 1
            repository.stores("옛품목", PageRequest.of(0, 20)).total shouldBe 1
            ingestRows(onnuri.copy(items = "새품목"), sangga)
            repository.stores("옛품목", PageRequest.of(0, 20)).total shouldBe 0
            repository.stores("새품목", PageRequest.of(0, 20)).total shouldBe 1
            val search = em.createQuery("select s from MarketStoreSearchJpaEntity s", MarketStoreSearchJpaEntity::class.java).singleResult
            search.partnerId shouldBe writer.findStores(marketId).single { it.source == MarketStoreSource.SANGGA }.id
        }
        Then("운영자와 상인회 보정 IN OUT 및 수동 추가 수정 삭제는 오래된 검색 행을 남기지 않는다") {
            val m = market("write-editor")
            val marketId = requireNotNull(m.id)
            val editor = MarketEditorService(writer, writer, writer)
            val actor = MarketEditorActor(MarketActorKind.STEWARD, 1, setOf(marketId))
            val row = editor.manualStore(actor, marketId, null,
                EditMarketUseCase.ManualStoreRequest("수동가게", latitude = 37.0, longitude = 127.0))
            val id = requireNotNull(row.id)
            repository.stores("수동", PageRequest.of(0, 20)).total shouldBe 1
            editor.override(actor, marketId, id, EditMarketUseCase.OverrideRequest(mapOf("membership" to "OUT"), reason = "확인"))
            repository.counts() shouldBe emptyMap()
            editor.override(actor, marketId, id, EditMarketUseCase.OverrideRequest(mapOf("membership" to "IN", "name" to "새이름"), reason = "확인"))
            repository.stores("수동", PageRequest.of(0, 20)).total shouldBe 0
            repository.stores("새이름", PageRequest.of(0, 20)).total shouldBe 1
            editor.override(actor, marketId, id, EditMarketUseCase.OverrideRequest(clear = setOf("membership", "name"), reason = "복원"))
            editor.deleteStore(actor, marketId, id)
            repository.stores("수동", PageRequest.of(0, 20)).total shouldBe 0
            adapter.contentIds() shouldBe emptyList()
        }
        Then("재판정이 바꾼 IN OUT 판정을 검색에 반영한다") {
            val m = market("write-judgment")
            val marketId = requireNotNull(m.id)
            val row = store(m, "판정가게", source = MarketStoreSource.ONNURI)
            geometryWriter.saveJudgment(marketId, requireNotNull(row.id),
                MarketStoreJudgment(MarketMembershipStatus.OUT, MarketJudgedBy.INGEST, null, false))
            refresh.refresh(marketId)
            repository.stores("판정", PageRequest.of(0, 20)).total shouldBe 0
            val rejudge = MarketRejudgeService(writer, writer, geometryWriter, geometryWriter, refresh)
            rejudge.rejudge(marketId) shouldBe 1
            repository.stores("판정", PageRequest.of(0, 20)).total shouldBe 1
        }
        Then("비어 있는 검색 표는 모든 시장을 채우고 다시 실행해도 같은 결과를 준다") {
            val a = market("backfill-a"); val b = market("backfill-b")
            store(a, "가게"); store(b, "가게")
            em.createQuery("delete from MarketStoreSearchJpaEntity").executeUpdate()
            val backfill = MarketSearchBackfill(JPAQueryFactory(em), refresh)
            backfill.backfillIfEmpty()
            repository.counts() shouldBe mapOf(requireNotNull(a.id) to 1L, requireNotNull(b.id) to 1L)
            backfill.backfillIfEmpty()
            repository.counts().values.sum() shouldBe 2L
        }
        Then("백필은 한 시장이 실패해도 다음 시장을 계속 처리한다") {
            val a = market("failure-a"); val b = market("failure-b")
            store(a, "가게"); store(b, "가게")
            em.createQuery("delete from MarketStoreSearchJpaEntity").executeUpdate()
            val partial = object : com.kgd.place.application.market.port.MarketSearchRefreshPort {
                override fun refresh(marketId: Long) {
                    if (marketId == a.id) throw IllegalStateException("injected market failure")
                    refresh.refresh(marketId)
                }
            }
            MarketSearchBackfill(JPAQueryFactory(em), partial).backfillIfEmpty()
            repository.counts() shouldBe mapOf(requireNotNull(b.id) to 1L)
        }
        Then("이미 시작된 반복읽기 스냅샷 뒤에 커밋된 보정도 갱신에 반영한다") {
            val m = market("snapshot-refresh")
            val marketId = requireNotNull(m.id)
            val row = store(m, "예전이름")
            val storeId = requireNotNull(row.id)
            em.transaction.commit()
            em.clear()
            em.transaction.begin()
            try {
                // Ingest can establish this snapshot before waiting for the market lock.
                em.createQuery("select s.name from MarketStoreJpaEntity s where s.id = :id", String::class.java)
                    .setParameter("id", storeId).singleResult shouldBe "예전이름"
                val other = emf.createEntityManager()
                try {
                    other.transaction.begin()
                    other.persist(MarketStoreOverrideJpaEntity.fromDomain(MarketStoreOverride(storeId,
                        MarketStoreField.NAME, "커밋된이름", "동시편집", 1, MarketActorKind.ADMIN)))
                    other.transaction.commit()
                } finally { other.close() }
                refresh.refresh(marketId)
                // Inspect the refresh's own writes, which are visible regardless of snapshot age.
                em.createQuery("select s.name from MarketStoreSearchJpaEntity s where s.storeId = :id", String::class.java)
                    .setParameter("id", storeId).singleResult shouldBe "커밋된이름"
            } finally {
                em.transaction.rollback()
                em.clear()
                em.transaction.begin()
                em.createQuery("delete from MarketStoreSearchJpaEntity s where s.marketId = :id").setParameter("id", marketId).executeUpdate()
                em.createQuery("delete from MarketStoreOverrideJpaEntity s where s.storeId = :id").setParameter("id", storeId).executeUpdate()
                em.createQuery("delete from MarketStoreJpaEntity s where s.marketId = :id").setParameter("id", marketId).executeUpdate()
                em.createQuery("delete from MarketJpaEntity m where m.id = :id").setParameter("id", marketId).executeUpdate()
                em.transaction.commit()
                em.transaction.begin()
            }
        }
        Then("반복 갱신은 멱등이고 다른 시장의 검색 행을 건드리지 않는다") {
            val a = market("refresh-a"); val b = market("refresh-b")
            store(a, "가게"); store(b, "가게")
            repeat(2) { refresh.refresh(requireNotNull(a.id)) }
            repository.counts() shouldBe mapOf(requireNotNull(a.id) to 1L, requireNotNull(b.id) to 1L)
        }
    }
    Given("유효 IN 가게 검색") {
        Then("이름 품목 메뉴 업종 순위와 메뉴 공백 정규화를 적용하며 파트너 메뉴도 검색한다") {
            val m = market("menu")
            store(m, "분류가게", category = "칼국수")
            store(m, "메뉴가게", menu = "칼 국수")
            store(m, "품목가게", items = "칼국수")
            store(m, "칼국수집")
            val primary = store(m, "파트너가게", source = MarketStoreSource.ONNURI, jibun = "중구1")
            store(m, "파트너가게", source = MarketStoreSource.SANGGA, jibun = "중구1", menu = "칼국수")
            store(m, "제외메뉴", status = MarketMembershipStatus.OUT, menu = "칼국수")
            val result = adapter.search("칼국수", "ko", 0, 20).stores
            result.total shouldBe 5
            result.items.map { it.name } shouldBe listOf("칼국수집", "품목가게", "메뉴가게", "파트너가게", "분류가게")
            result.items.first { it.storeId == primary.id }.goodPrice shouldBe
                SearchMarketsUseCase.GoodPrice("한식", listOf(GoodPriceMenu("칼국수", 7000)))
            result.items[2].goodPrice?.menus?.single()?.name shouldBe "칼 국수"
        }
        Then("이름·품목·분류 순서, 시장명·가게명 동점 정렬과 DB 페이지 전체 건수가 맞는다") {
            val b = market("b", "나시장"); val a = market("a", "가시장")
            store(a, "분류가게", category = "떡")
            store(a, "품목가게", items = "떡")
            store(b, "떡집")
            store(a, "떡가게")
            store(a, "떡 OUT", MarketMembershipStatus.OUT)
            store(a, "떡 UNKNOWN", MarketMembershipStatus.UNKNOWN)
            val result = repository.stores("떡", PageRequest.of(0, 2))
            result.rows.map { it.first.name } shouldBe listOf("떡가게", "떡집")
            result.total shouldBe 4
            repository.stores("떡", PageRequest.of(1, 2)).rows.map { it.first.name } shouldBe listOf("품목가게", "분류가게")
        }
        Then("보정 이름·품목·소속과 판정 소속을 적용하고 지운 품목이나 옛 이름은 검색하지 않는다") {
            val m = market("a")
            val corrected = store(m, "옛 이름", MarketMembershipStatus.OUT, items = "숨길품목")
            edit(corrected, MarketStoreField.NAME, "새 떡집"); edit(corrected, MarketStoreField.MEMBERSHIP, "IN")
            edit(corrected, MarketStoreField.ITEMS, null)
            store(m, "판정떡집", MarketMembershipStatus.OUT, judged = MarketMembershipStatus.IN)
            val excluded = store(m, "제외떡집"); edit(excluded, MarketStoreField.MEMBERSHIP, "OUT")
            adapter.search("떡", "ko", 0, 20).stores.items.map { it.name } shouldBe listOf("새 떡집", "판정떡집")
            repository.stores("옛", PageRequest.of(0, 20)).total shouldBe 0
            repository.stores("숨길품목", PageRequest.of(0, 20)).total shouldBe 0
        }
        Then("온누리·상가 한 쌍은 공백과 영문 대소문자를 정규화하고 파트너 보정을 공유한다") {
            val m = market("pair")
            val primary = store(m, " 떡 Shop", source = MarketStoreSource.ONNURI, jibun = "서울 중구 1")
            val partner = store(m, "떡shop", category = "식품", source = MarketStoreSource.SANGGA, jibun = "서울중구1")
            edit(partner, MarketStoreField.NAME, "보정 떡집"); edit(partner, MarketStoreField.ITEMS, "찹쌀떡")
            val result = adapter.search("찹쌀", "en", 0, 20)
            result.stores.total shouldBe 1
            result.stores.items.single().storeId shouldBe primary.id
            result.stores.items.single().name shouldBe "보정 떡집"
            result.stores.items.single().category shouldBe "식품"
            result.markets.size shouldBe 0
            adapter.search("", "ko", 0, 20).markets.single().storeCount shouldBe 1
        }
        Then("참고 핀의 상가 이웃도 온누리 파트너와 보정을 함께 읽어 좌표를 상속한다") {
            val m = market("reference")
            val primary = store(m, "이웃", source = MarketStoreSource.ONNURI, jibun = "중구1")
            val partner = store(m, "이웃", status = MarketMembershipStatus.UNKNOWN,
                source = MarketStoreSource.SANGGA, jibun = "중구1")
            edit(primary, MarketStoreField.LATITUDE, "37.5"); edit(primary, MarketStoreField.LONGITUDE, "127.0")
            em.persist(MarketStoreJpaEntity.fromDomain(MarketStore(requireNotNull(m.id), "참고떡집", MarketStoreSource.MANUAL,
                pinKind = MarketPinKind.REFERENCE, referenceStoreId = partner.id, relativePosition = "옆",
                actorKind = MarketActorKind.ADMIN, createdByMemberId = 1, membership = MarketMembership(MarketMembershipStatus.IN))))
            em.flush()
            refresh.refresh(requireNotNull(m.id))
            val result = adapter.search("참고", "ko", 0, 20).stores.items.single()
            result.latitude shouldBe 37.5; result.longitude shouldBe 127.0
        }
        Then("모호한 세 임차인의 참고 핀을 부분 병합하거나 결과에서 누락하지 않는다") {
            val m = market("ambiguous-reference")
            val primary = store(m, "떡임차인", source = MarketStoreSource.ONNURI, jibun = "중구1")
            val reference = MarketStore(requireNotNull(m.id), "떡임차인", MarketStoreSource.SANGGA, sourceKey = "s1",
                sanggaKey = "s1", sanggaRaw = "{}", jibunAddress = "중구1", pinKind = MarketPinKind.REFERENCE,
                referenceStoreId = primary.id, relativePosition = "옆", membership = MarketMembership(MarketMembershipStatus.IN))
            val row = MarketStoreJpaEntity.fromDomain(reference).also { em.persist(it); em.flush() }
            store(m, "떡임차인", source = MarketStoreSource.SANGGA, jibun = "중구1")
            val result = adapter.search("떡", "ko", 0, 20).stores
            result.total shouldBe 3
            result.items.size shouldBe 3
            result.items.any { it.storeId == row.id } shouldBe true
        }
        Then("소속 보정이 없는 파트너의 원천 IN은 정본 OUT을 덮지 않는다") {
            val m = market("out-pair")
            store(m, "떡집", MarketMembershipStatus.OUT, source = MarketStoreSource.ONNURI, jibun = "중구1")
            store(m, "떡집", source = MarketStoreSource.SANGGA, jibun = "중구1")
            adapter.search("떡", "ko", 0, 20).stores.total shouldBe 0
            adapter.contentIds() shouldBe emptyList()
        }
        Then("동일 원천의 복수 임차인은 합치지 않고 와일드카드는 리터럴로 찾는다") {
            val m = market("ambiguous")
            store(m, "100%_떡", source = MarketStoreSource.ONNURI, jibun = "중구1")
            store(m, "100%_떡", source = MarketStoreSource.SANGGA, jibun = "중구1")
            store(m, "100%_떡", source = MarketStoreSource.SANGGA, jibun = "중구1")
            store(m, "100일반떡")
            repository.stores("%_", PageRequest.of(0, 20)).total shouldBe 3
            repository.counts()[m.id] shouldBe 4
        }
        Then("악센트가 다른 이름은 데이터베이스 기본 collation으로 병합하지 않는다") {
            val m = market("accent")
            store(m, "café", source = MarketStoreSource.ONNURI, jibun = "중구1")
            store(m, "cafe", source = MarketStoreSource.SANGGA, jibun = "중구1")
            repository.counts()[m.id] shouldBe 2
        }
    }
    Given("지도 대상 시장") {
        Then("시장명 검색은 10건으로 제한하고 지역은 원천 시군구 또는 요청 언어 주소를 사용한다") {
            repeat(12) { index ->
                val content = "market-${index.toString().padStart(2, '0')}"
                val m = market(content, "떡시장${index.toString().padStart(2, '0')}",
                    if (index == 0) "{\"시군구명\":\"광명시\"}" else null)
                store(m, "가게")
                em.persist(AttractionJpaEntity(contentId = content, lang = "ko", title = "관광지", titleDisplay = "관광지",
                    address = "서울특별시 중구 상세주소", latitude = 37.0, longitude = 127.0, status = "ACTIVE"))
                em.persist(AttractionJpaEntity(contentId = content, lang = "en", title = "Market", titleDisplay = "Market",
                    address = "Seoul Jung-gu detail", latitude = 37.0, longitude = 127.0, status = "ACTIVE"))
            }
            em.flush()
            val result = adapter.search("떡시장", "en", 1, 1)
            result.markets.size shouldBe 10
            result.markets.first().region shouldBe "광명시"
            result.markets[1].region shouldBe "Seoul Jung-gu"
            result.markets[1].storeCount shouldBe 1
            result.stores.total shouldBe 0
            adapter.search("떡시장", "ko", 0, 20).markets[1].region shouldBe "서울특별시 중구"
        }
        Then("상세 링크는 요청 언어의 관광지 id, 없으면 국문 관광지 id 를 준다") {
            val both = market("ref-both", "참시장"); val koOnly = market("ref-ko", "참새시장")
            store(both, "참기름집", items = "참기름"); store(koOnly, "참외가게", items = "참외")
            fun attraction(content: String, lang: String) = AttractionJpaEntity(contentId = content, lang = lang,
                title = content, titleDisplay = content, address = "서울특별시 중구", latitude = 37.0, longitude = 127.0,
                status = "ACTIVE").also { em.persist(it) }
            val bothKo = attraction("ref-both", "ko"); val bothEn = attraction("ref-both", "en")
            val koOnlyKo = attraction("ref-ko", "ko")
            em.flush()
            val en = adapter.search("참", "en", 0, 20)
            en.markets.associate { it.contentId to it.attraction } shouldBe mapOf(
                "ref-both" to SearchMarketsUseCase.AttractionRef(requireNotNull(bothEn.id), "en"),
                "ref-ko" to SearchMarketsUseCase.AttractionRef(requireNotNull(koOnlyKo.id), "ko"))
            en.stores.items.associate { it.name to it.attraction?.lang } shouldBe mapOf("참기름집" to "en", "참외가게" to "ko")
            adapter.search("참기름", "ko", 0, 20).stores.items.single().attraction shouldBe
                SearchMarketsUseCase.AttractionRef(requireNotNull(bothKo.id), "ko")
        }
        Then("유효 IN 또는 경계만 가진 시장을 반환하고 빈 검색은 가게를 조회하지 않는다") {
            val a = market("in", "가시장"); val b = market("boundary", "나시장")
            val c = market("out"); val d = market("unknown")
            store(a, "가게1"); store(a, "가게2")
            store(c, "밖", MarketMembershipStatus.OUT); store(d, "미정", MarketMembershipStatus.UNKNOWN)
            em.persist(MarketBoundaryJpaEntity(requireNotNull(b.id), "[[37,127],[37.1,127],[37,127.1]]",
                MarketGeometrySource.MANUAL, null, null, LocalDateTime.now())); em.flush()
            val result = adapter.search("", "ko", 0, 1)
            result.markets.map { it.contentId } shouldBe listOf("in")
            result.markets.single().storeCount shouldBe 2
            result.stores.total shouldBe 0
            result.stores.items shouldBe emptyList()
            adapter.search("", "ko", 1, 1).markets.single().contentId shouldBe "boundary"
            adapter.contentIds() shouldBe listOf("boundary", "in")
            adapter.search("시장", "ko", 0, 20).markets.map { it.contentId } shouldBe listOf("in", "boundary")
        }
    }
})
