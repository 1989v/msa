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
    val statements = mutableListOf<String>()
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
        config.setStatementInspector { sql -> statements.add(sql); sql }
        emf = config.buildSessionFactory()
        // Production keeps attractions on the server default utf8mb4_0900_ai_ci while the market tables
        // declare utf8mb4_unicode_ci. Recreate that split so every join across the two runs under it.
        java.sql.DriverManager.getConnection(mysql.jdbcUrl, mysql.username, mysql.password).use { connection ->
            connection.createStatement().execute("alter table attractions convert to character set utf8mb4 collate utf8mb4_0900_ai_ci")
        }
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
            repos.getRepository(MarketStewardJpaRepository::class.java), MarketRowRestorer(dataSource), searchRefresh = refresh, displayStores = MarketStoreQueryRepository(factory))
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
    Given("display-only store projection") {
        Then("selects source presence without raw payloads and retains every domain field and public badge") {
            val m = market("display-projection")
            val marketId = requireNotNull(m.id)
            val raw = """{"payload":"${"large-source-".repeat(1000)}"}"""
            val base = MarketStore(marketId, "원천가게", MarketStoreSource.ONNURI, sourceKey = "o",
                zoneId = 9, items = "떡", categoryMajor = "음식", categoryMid = "한식", categorySub = "떡집",
                latitude = 37.0, longitude = 127.0, roadAddress = "도로 1", jibunAddress = "지번 1",
                buildingManagementNo = "building-no", buildingName = "건물", dong = "가", floor = "2", ho = "201",
                roadName = "시장로", onnuriKey = "o", sanggaKey = "s", onnuriRaw = raw, sanggaRaw = raw,
                membership = MarketMembership(MarketMembershipStatus.IN), positionNote = "입구 옆",
                actorKind = MarketActorKind.ADMIN, createdByMemberId = 7,
                createdAt = LocalDateTime.of(2026, 10, 16, 12, 0), judgedMembership = MarketMembershipStatus.IN,
                judgedBy = MarketJudgedBy.INGEST, pathId = 5, needsReview = true, goodPriceKey = "g",
                goodPriceRaw = """{"업종":"한식","메뉴1":"국수","가격1":"7000"}""",
                goodPriceMatchedBy = "NAME", goodPriceMenuNames = "국수")
            val fixtures = listOf(base,
                base.copy(name = "상가", source = MarketStoreSource.SANGGA, sourceKey = "s2",
                    onnuriKey = null, onnuriRaw = null, sanggaKey = "s2"),
                base.copy(name = "수동", source = MarketStoreSource.MANUAL, sourceKey = null,
                    onnuriKey = null, sanggaKey = null, onnuriRaw = null, sanggaRaw = null,
                    pinKind = MarketPinKind.REFERENCE, referenceStoreId = 1, relativePosition = "옆"),
                // Presence comes from raw, including when an enrichment has no source key.
                base.copy(name = "보강", sourceKey = "o3", onnuriKey = "o3", sanggaKey = null),
                base.copy(name = "키만", sourceKey = "o4", onnuriKey = "o4", sanggaRaw = null))
            fixtures.forEach { em.persist(MarketStoreJpaEntity.fromDomain(it)) }
            em.flush(); em.clear()
            val full = writer.findStores(marketId)
            statements.clear()
            val narrow = writer.findStoresForDisplay(marketId)
            val select = statements.single { it.startsWith("select", ignoreCase = true) }
            val selectList = select.substringBefore(" from ").lowercase()
            // Reject even a read-and-discard implementation: raw columns may only appear in IS NOT NULL.
            listOf("onnuri_raw", "sangga_raw").forEach { column ->
                Regex("\\b$column\\b(?!\\s+is\\s+not\\s+null)").containsMatchIn(selectList) shouldBe false
                selectList.contains("$column is not null") shouldBe true
            }
            narrow shouldBe full.map { it.copy(
                onnuriRaw = MarketStore.RAW_OMITTED.takeIf { _ -> it.onnuriRaw != null },
                sanggaRaw = MarketStore.RAW_OMITTED.takeIf { _ -> it.sanggaRaw != null }) }
            fun response(rows: List<MarketStore>) = com.kgd.place.presentation.market.dto.MarketResponse.from(
                QueryMarketUseCase.MarketResult(m.toDomain(), emptyList(), MarketPublicProjection.stores(rows, emptyMap())))
            response(narrow) shouldBe response(full)
            MarketPublicProjection.stores(narrow, emptyMap()).map { it.sources } shouldBe
                MarketPublicProjection.stores(full, emptyMap()).map { it.sources }
            writer.findStoresForDisplay(marketId + 1000) shouldBe emptyList()
        }
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
    Given("영문 검색과 투영") {
        Then("로마자 이름과 영문 업종을 SQL에서 검색하며 이름을 업종보다 먼저 정렬한다") {
            val m = market("english-search")
            val roman = store(m, "광장상회", items = "농축수산품", category = "수산물 소매업")
            val named = store(m, "Seafood House")
            val category = store(m, "바다가게", category = "수산물 소매업")
            val result = adapter.search("seafood", "en", 0, 20).stores
            result.total shouldBe 3
            result.items.first().storeId shouldBe named.id
            result.items.map { it.matchedBy } shouldBe listOf(SearchMarketsUseCase.MatchedBy.NAME,
                SearchMarketsUseCase.MatchedBy.CATEGORY, SearchMarketsUseCase.MatchedBy.CATEGORY)
            val match = adapter.search("gwangjang", "en", 0, 20).stores.items.single()
            match.storeId shouldBe roman.id
            match.nameEn shouldBe "Gwangjangsanghoe"
            match.categoryEn shouldBe "Seafood retail"
            match.itemsEn shouldBe "Agricultural livestock and seafood products"
            adapter.search("seafood", "en", 0, 1).stores.total shouldBe 3
            adapter.search("seafood", "en", 1, 1).stores.items.size shouldBe 1
        }
        Then("V45 이후 기존 nonempty 검색표의 null 로마자를 기동 백필로 채운다") {
            val m = market("roman-backfill")
            store(m, "광장상회")
            em.createQuery("update MarketStoreSearchJpaEntity s set s.nameRoman = null").executeUpdate()
            MarketSearchBackfill(JPAQueryFactory(em), refresh).backfillIfEmpty()
            adapter.search("gwangjang", "en", 0, 20).stores.total shouldBe 1
            em.createQuery("select s.nameRoman from MarketStoreSearchJpaEntity s", String::class.java)
                .singleResult shouldBe "Gwangjangsanghoe"
        }
    }
    Given("영문 검색 투영") {
        Then("이름 로마자와 영문 업종을 검색하고 기존 행의 null 로마자를 백필한다") {
            val m = market("english")
            val row = store(m, "순희네빈대떡", items = "농축수산품", category = "카페")
            val id = requireNotNull(row.id)
            fun roman() = em.createQuery("select s.nameRoman from MarketStoreSearchJpaEntity s where s.storeId = :id", String::class.java)
                .setParameter("id", id).singleResult
            roman() shouldBe "Sunhuine Bindaetteok"
            val result = adapter.search("sunhuine bindaetteok", "en", 0, 20).stores.items.single()
            result.storeId shouldBe id
            result.nameEn shouldBe "Sunhuine Bindaetteok"
            result.itemsEn shouldBe "Agricultural livestock and seafood products"
            result.categoryEn shouldBe "Cafe"
            result.matchedBy shouldBe SearchMarketsUseCase.MatchedBy.NAME
            adapter.search("cafe", "en", 0, 20).stores.items.single().matchedBy shouldBe SearchMarketsUseCase.MatchedBy.CATEGORY
            em.createQuery("update MarketStoreSearchJpaEntity s set s.nameRoman = null").executeUpdate()
            MarketSearchBackfill(JPAQueryFactory(em), refresh).backfillIfEmpty()
            em.clear()
            roman() shouldBe "Sunhuine Bindaetteok"
            edit(row, MarketStoreField.NAME, "ABC-123 Shop!")
            adapter.search("abc-123", "en", 0, 20).stores.items.single().nameEn shouldBe "ABC-123 Shop!"
            adapter.search("sunhuine", "en", 0, 20).stores.total shouldBe 0
        }
        Then("TourAPI 영문 82만 같은 contentId의 메뉴와 음식점에 우선 적용한다") {
            val m = market("tour-en")
            val shop = store(m, "순희네빈대떡")
            fun restaurant(content: String, type: String, lang: String, title: String, raw: String) = AttractionJpaEntity(
                contentId = content, lang = lang, title = title, titleDisplay = title, contentTypeId = type,
                latitude = 37.0, longitude = 127.0, status = "ACTIVE", introRaw = raw).also { em.persist(it); em.flush() }
            val ko = restaurant("r1", "39", "ko", "순희네빈대떡", """{"firstmenu":"빈대떡","treatmenu":"육회"}""")
            val en = restaurant("r1", "82", "en", "Sunhuine", """{"firstmenu":"Mung bean pancake","treatmenu":"Beef tartare"}""")
            restaurant("r2", "39", "ko", "국문만", """{"firstmenu":"국수"}""")
            restaurant("r2", "39", "en", "Wrong type", """{"firstmenu":"wrong"}""")
            restaurant("unrelated", "82", "en", "Other", """{"firstmenu":"wrong"}""")
            val tour = MarketTourMenuRepositoryAdapter(JPAQueryFactory(em))
            val sw = MarketCoordinate(36.99,126.99); val ne = MarketCoordinate(37.01,127.01)
            val korean = tour.restaurants(sw, ne)
            tour.replace(requireNotNull(m.id), mapOf(requireNotNull(shop.id) to korean.single { it.contentId == "r1" }))
            val menu = tour.attached(requireNotNull(m.id)).getValue(requireNotNull(shop.id))
            menu.attraction.id shouldBe ko.id
            menu.firstMenu shouldBe "빈대떡"
            menu.firstMenuEn shouldBe "Mung bean pancake"
            menu.treatMenuEn shouldBe "Beef tartare"
            val english = tour.restaurants(sw, ne, "en").associateBy { it.contentId }
            english.getValue("r1").attraction.id shouldBe en.id
            english.getValue("r1").firstMenu shouldBe "Mung bean pancake"
            english.getValue("r2").attraction.lang shouldBe "ko"
            val service = MarketService(writer, writer, tour = tour)
            // The attached restaurant must remain excluded after switching to its English row id.
            em.merge(MarketJpaEntity.fromDomain(m.toDomain().copy(latitude = 37.0, longitude = 127.0)))
            em.flush(); em.clear()
            service.find("tour-en", false, "en")!!.restaurants.map { it.contentId } shouldBe listOf("r2")
        }
    }
    Given("유효 IN 가게 검색") {
        Then("related dish categories rank after literal fields and expose SQL match metadata") {
            val m = market("dish")
            val related = store(m, "분식집")
            em.createQuery("update MarketStoreJpaEntity s set s.categorySub = :c where s.id = :id")
                .setParameter("c", "김밥/만두/분식").setParameter("id", related.id).executeUpdate()
            store(m, "떡볶이집")
            store(m, "품목집", items = "떡볶이")
            store(m, "메뉴집", menu = "떡볶이")
            store(m, "업종집", category = "떡볶이")
            refresh.refresh(requireNotNull(m.id))
            val result = adapter.search("떡볶이", "ko", 0, 20).stores.items
            result.map { it.matchedBy } shouldBe SearchMarketsUseCase.MatchedBy.entries
            result.last().relatedCategory shouldBe "김밥/만두/분식"
            val english = adapter.search("tteokbokki", "en", 0, 20).stores.items
            english.map { it.name } shouldBe listOf("떡볶이집", "분식집")
            english.map { it.matchedBy } shouldBe listOf(SearchMarketsUseCase.MatchedBy.NAME, SearchMarketsUseCase.MatchedBy.RELATED_CATEGORY)
            english.last().storeId shouldBe related.id
        }
        Then("Tour adapter reads only Korean restaurants and replaces derived columns without touching source") {
            val m = market("tour-attach")
            val shop = store(m, "음식점")
            fun restaurant(content: String, type: String, lang: String, title: String = "음식점",
                raw: String = """{"firstmenu":"빈대떡","treatmenu":"육회"}""") = AttractionJpaEntity(
                contentId = content, lang = lang, title = title, titleDisplay = title, contentTypeId = type,
                latitude = 37.0, longitude = 127.0, status = "ACTIVE",
                introRaw = raw).also { em.persist(it) }
            restaurant("r1", "39", "ko"); restaurant("r2", "12", "ko"); restaurant("r3", "82", "en")
            val english = restaurant("r1", "82", "en", "Pancake Restaurant",
                """{"firstmenu":"Mung bean pancakes","treatmenu":"Beef tartare"}""")
            em.flush()
            val tour = MarketTourMenuRepositoryAdapter(JPAQueryFactory(em))
            val candidates = tour.restaurants(MarketCoordinate(36.99,126.99), MarketCoordinate(37.01,127.01))
            candidates.map { it.contentId } shouldBe listOf("r1")
            candidates.single().firstMenu shouldBe "빈대떡"
            tour.replace(requireNotNull(m.id), mapOf(requireNotNull(shop.id) to candidates.single()))
            val menu = tour.attached(requireNotNull(m.id)).getValue(requireNotNull(shop.id))
            menu.treatMenu shouldBe "육회"
            menu.firstMenuEn shouldBe "Mung bean pancakes"
            menu.treatMenuEn shouldBe "Beef tartare"
            val enRows = tour.restaurants(MarketCoordinate(36.99,126.99), MarketCoordinate(37.01,127.01), "en")
            enRows.single().attraction shouldBe SearchMarketsUseCase.AttractionRef(requireNotNull(english.id), "en")
            enRows.single().title shouldBe "Pancake Restaurant"
            em.clear()
            val attached = em.find(MarketStoreJpaEntity::class.java, shop.id)
            attached.name shouldBe "음식점"
            attached.tourContentId shouldBe "r1"
            // A normal source save must preserve all derived columns.
            em.merge(MarketStoreJpaEntity.fromDomain(attached.toDomain().copy(name = "바뀐이름")))
            em.flush(); em.clear()
            em.find(MarketStoreJpaEntity::class.java, shop.id).tourFirstMenu shouldBe "빈대떡"
            tour.replace(requireNotNull(m.id), emptyMap())
            tour.attached(requireNotNull(m.id)) shouldBe emptyMap()
            em.clear()
            em.find(MarketStoreJpaEntity::class.java, shop.id).tourContentId shouldBe null
        }
        Then("Tour menus append after good-price menus in the search projection") {
            val m = market("tour")
            val row = store(m, "메뉴집", menu = "국수")
            em.createQuery("update MarketStoreJpaEntity s set s.tourFirstMenu = :f, s.tourTreatMenu = :t where s.id = :id")
                .setParameter("f", "빈대떡").setParameter("t", "육회").setParameter("id", row.id).executeUpdate()
            refresh.refresh(requireNotNull(m.id))
            em.createQuery("select s.menuNames from MarketStoreSearchJpaEntity s where s.storeId = :id", String::class.java)
                .setParameter("id", row.id).singleResult shouldBe "국수 · 빈대떡 · 육회"
            adapter.search("육회", "ko", 0, 20).stores.items.single().matchedBy shouldBe SearchMarketsUseCase.MatchedBy.MENU
        }
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
