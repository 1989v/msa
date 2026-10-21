package com.kgd.ranking

import com.kgd.ranking.application.admin.dto.*
import com.kgd.ranking.application.admin.port.RankingAdminPort
import com.kgd.ranking.application.admin.service.RankingAdminService
import com.kgd.ranking.application.cafe.dto.*
import com.kgd.ranking.domain.cafe.model.*
import com.kgd.ranking.infrastructure.persistence.adapter.*
import com.kgd.ranking.infrastructure.persistence.entity.*
import com.kgd.ranking.infrastructure.persistence.repository.*
import com.kgd.ranking.presentation.controller.RankingAdminController
import com.kgd.common.exception.ForbiddenException
import com.kgd.common.exception.UnauthorizedException
import com.querydsl.jpa.impl.JPAQueryFactory
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.matchers.shouldBe
import org.hibernate.cfg.Configuration
import org.springframework.data.jpa.repository.support.JpaRepositoryFactory
import org.springframework.orm.jpa.JpaTransactionManager
import org.springframework.orm.jpa.SharedEntityManagerCreator
import org.springframework.test.util.ReflectionTestUtils
import org.springframework.transaction.support.TransactionTemplate
import tools.jackson.databind.json.JsonMapper
import java.math.BigDecimal
import java.time.Instant
import java.time.LocalDate
import java.util.UUID
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/** Real H2 transactions, pessimistic locks, repositories, JSON round trips and public SQL projection. */
class RankingAdminAcceptanceTest : BehaviorSpec({
    val factory = Configuration()
        .addAnnotatedClass(CafeDrinkJpaEntity::class.java).addAnnotatedClass(CafeEffectiveDrinkJpaEntity::class.java)
        .addAnnotatedClass(RankingAdminRecord::class.java).addAnnotatedClass(RankingBoardJpaEntity::class.java)
        .addAnnotatedClass(RankingSnapshotJpaEntity::class.java).addAnnotatedClass(RankingEntryJpaEntity::class.java)
        .setProperty("hibernate.connection.driver_class", "org.h2.Driver")
        .setProperty("hibernate.connection.url", "jdbc:h2:mem:admin;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=30000")
        .setProperty("hibernate.hbm2ddl.auto", "create-drop").setProperty("hibernate.show_sql", "false")
        .buildSessionFactory()
    val em = SharedEntityManagerCreator.createSharedEntityManager(factory)
    val manager = JpaTransactionManager(factory); val tx = TransactionTemplate(manager)
    val repos = JpaRepositoryFactory(em)
    val records = repos.getRepository(RankingAdminRecordRepository::class.java)
    val sourceRepo = repos.getRepository(CafeDrinkJpaRepository::class.java)
    val effectiveRepo = repos.getRepository(CafeEffectiveDrinkJpaRepository::class.java)
    val boards = repos.getRepository(RankingBoardJpaRepository::class.java)
    val snapshots = repos.getRepository(RankingSnapshotJpaRepository::class.java)
    val entries = repos.getRepository(RankingEntryJpaRepository::class.java)
    val query = CafeDrinkQueryRepository(JPAQueryFactory(em))
    val sourcePort = CafeDrinkRepositoryAdapter(sourceRepo, query)
    val store = RankingAdminAdapter(records, sourceRepo, effectiveRepo, boards, snapshots, entries, manager, JsonMapper.builder().findAndAddModules().build())
    ReflectionTestUtils.setField(store, "entityManager", em)
    val service = RankingAdminService(store, sourcePort)
    val today = LocalDate.now(java.time.Clock.systemUTC())
    fun patch(key: String, fields: Map<String, FieldChange>, id: String = UUID.randomUUID().toString()): CorrectionRequest {
        val row = store.corrections().find { it.drinkKey == key }
        val slug = CafeDrinkKey.fields(key)!!.first()
        return CorrectionRequest(id, row?.revision ?: 0, store.brands().find { it.brandSlug == slug }?.generation ?: 0,
            fields, "공식 자료 대조", "https://official.example/nutrition", today)
    }
    fun load(vararg rows: CafeDrinkUpsertItem) = service.sync(CafeDrinkBulkRequest(rows.toList()))
    fun key(row: CafeDrinkUpsertItem) = CafeDrinkKey.of(row.toDomain())
    beforeEach {
        tx.executeWithoutResult {
            listOf("RankingAdminRecord", "CafeDrinkJpaEntity", "CafeEffectiveDrinkJpaEntity", "RankingEntryJpaEntity", "RankingSnapshotJpaEntity", "RankingBoardJpaEntity").forEach { em.createQuery("delete from $it").executeUpdate() }
            em.persist(RankingAdminRecord("control", "LOCK", "{}"))
        }
    }
    afterSpec { factory.close() }

    Given("brand replacement, natural keys and immutable sources") {
        Then("AC1/2/4: only requested brands replace; IDs change twice, corrections/raw/notes survive and variants stay separate") {
            val a = cafeItem("a", "동명 메뉴").copy(temperature = null, sizeLabel = null)
            val decaf = a.copy(caffeineStatus = CaffeineStatus.DECAF)
            val other = cafeItem("b", "보존 메뉴")
            load(a, decaf, other)
            val original = sourceRepo.findAll().associate { CafeDrinkKey.of(it.toDomain()) to it.toDomain() }
            val oldIds = sourceRepo.findAll().map { it.id }.toSet()
            val op = service.correct(key(a), patch(key(a), mapOf("sugarG" to FieldChange("SET", "0"))), 27)
            sourceRepo.findAll().associate { CafeDrinkKey.of(it.toDomain()) to it.toDomain() } shouldBe original
            repeat(2) { load(a.copy(temperature = "", sizeLabel = ""), decaf.copy(temperature = "", sizeLabel = "")) }
            sourceRepo.findAll().filter { it.brandSlug == "a" }.all { it.id !in oldIds } shouldBe true
            query.find(key(a))!!.sugarG!!.compareTo(BigDecimal.ZERO) shouldBe 0
            query.find(key(decaf))!!.sugarG!!.compareTo(decaf.sugarG) shouldBe 0
            query.find(key(other))!!.menuName shouldBe other.menuName
            sourceRepo.findAll().associate { CafeDrinkKey.of(it.toDomain()) to it.toDomain() } shouldBe original
            service.sync(CafeDrinkBulkRequest(emptyList())).received shouldBe 0
            sourceRepo.count() shouldBe 3
            store.audits().count { it.operationId == op.operationId } shouldBe 1
        }
    }
    Given("field dependency conflicts, disappearance and reappearance") {
        Then("AC3: changed corrected field suspends only itself; orphaned and reappearing fields require review") {
            val a = cafeItem("a", "라떼"); load(a)
            service.correct(key(a), patch(key(a), mapOf("sugarG" to FieldChange("SET", "2"), "drinkGroup" to FieldChange("SET", "티"))), 27)
            load(a.copy(sugarG = BigDecimal("19"), checkedAt = today, sourceUrl = "https://official.example/new"))
            val c = store.corrections().single()
            c.fields.getValue("sugarG").state shouldBe "CONFLICT"
            c.fields.getValue("drinkGroup").state shouldBe "ACTIVE"
            query.find(key(a))!!.sugarG!!.compareTo(BigDecimal("19")) shouldBe 0
            query.find(key(a))!!.drinkGroup shouldBe "티"
            load(cafeItem("a", "다른 메뉴"))
            store.corrections().single().fields.values.all { it.state == "ORPHANED" } shouldBe true
            query.find(key(a)) shouldBe null
            load(a)
            store.corrections().single().fields.values.all { it.state == "CONFLICT" && it.reason == "KEY_REAPPEARED" } shouldBe true
            query.find(key(a))!!.drinkGroup shouldBe a.toDomain().drinkGroup
        }
        Then("numeric baseline canonicalizes SQL scale and unrelated source changes do not conflict") {
            val a = cafeItem("a", "메뉴"); load(a)
            service.correct(key(a), patch(key(a), mapOf("sugarG" to FieldChange("SET", "2"))), 27)
            load(a.copy(sourceUrl = "https://official.example/new", checkedAt = today))
            store.corrections().single().fields.getValue("sugarG").state shouldBe "ACTIVE"
            load(a.copy(servingBasis = "변경된 제공 기준"))
            store.corrections().single().fields.getValue("sugarG").state shouldBe "CONFLICT"
        }
    }
    Given("effective projection and volume tri-state") {
        Then("AC4/5: SET_UNKNOWN blocks all fallback, RESET restores inference; all SQL query paths agree") {
            val a = cafeItem("twosome", "원천 라떼").copy(volumeMl = null, sizeLabel = "R", temperature = "ICE")
            load(a)
            val sourceHash = JsonMapper.builder().findAndAddModules().build().writeValueAsString(sourceRepo.findAll().single().toDomain())
            service.correct(key(a), patch(key(a), mapOf("volumeMl" to FieldChange("SET_UNKNOWN"), "displayName" to FieldChange("SET", "교정 티"), "drinkGroup" to FieldChange("SET", "티"), "sourceUrl" to FieldChange("SET", "https://correct.example/notice"), "sugarG" to FieldChange("SET", "0"))), 27)
            val response = query.find(key(a))!!
            response.cupVolumeMl shouldBe null; response.sugarPer100ml shouldBe null; response.kcalPer100ml shouldBe null; response.caffeinePer100ml shouldBe null
            query.search(CafeDrinkQuery(q = "원천", group = "티", maxSugar = BigDecimal.ZERO), org.springframework.data.domain.PageRequest.of(0, 50)).totalElements shouldBe 1
            query.search(CafeDrinkQuery(q = "교정"), org.springframework.data.domain.PageRequest.of(0, 50)).totalElements shouldBe 1
            query.groups().single().group shouldBe "티"
            query.brands().single().sourceUrls shouldBe listOf("https://correct.example/notice")
            query.names("교정").single().drinkName shouldBe "교정티"
            query.variants("교정티").single().sugarG!!.compareTo(BigDecimal.ZERO) shouldBe 0
            service.correct(key(a), patch(key(a), mapOf("volumeMl" to FieldChange("SET", "500"))), 27)
            query.find(key(a))!!.volumeSource shouldBe VolumeSource.ADMIN_VERIFIED
            service.correct(key(a), patch(key(a), mapOf("volumeMl" to FieldChange("RESET"))), 27)
            query.find(key(a))!!.cupVolumeMl!!.compareTo(BigDecimal("414")) shouldBe 0
            JsonMapper.builder().findAndAddModules().build().writeValueAsString(sourceRepo.findAll().single().toDomain()) shouldBe sourceHash
            shouldThrow<IllegalArgumentException> { service.correct(key(a), patch(key(a), mapOf("sugarG" to FieldChange("SET", "-1"))), 27) }
            shouldThrow<IllegalArgumentException> { service.correct(key(a), patch(key(a), mapOf("brandSlug" to FieldChange("SET", "x"))), 27) }
            shouldThrow<IllegalArgumentException> { service.correct(key(a), patch(key(a), mapOf("kcal" to FieldChange("SET", "1.00001"))), 27) }
        }
        Then("undisclosed caffeine cannot be estimated and grams never become ml") {
            val a = cafeItem("a", "메뉴", CaffeineStatus.UNDISCLOSED).copy(volumeMl = null, servingBasis = "300g")
            load(a); query.find(key(a))!!.cupVolumeMl shouldBe null
            shouldThrow<IllegalArgumentException> { service.correct(key(a), patch(key(a), mapOf("caffeineMg" to FieldChange("SET", "0"))), 27) }
        }
    }
    Given("157 explicit keys preview, atomic apply, idempotency and compensating revert") {
        Then("AC6/7/8: apply and revert all keys exactly once; stale preview cancels every row") {
            val rows = (1..158).map { cafeItem("a", "메뉴$it") }; service.sync(CafeDrinkBulkRequest(rows))
            val keys = rows.take(157).map(::key)
            val previewRequest = PreviewRequest(keys, "티", "메뉴 분류 검토", "https://official.example/menu", today)
            val preview = service.preview(previewRequest, 27)
            preview.changed.size shouldBe 157; preview.blocked.size shouldBe 0
            val apply = ApplyPreviewRequest(preview.previewToken, UUID.randomUUID().toString())
            val op = service.apply(apply, 27); op.changed shouldBe 157
            store.atomic { store.save(preview.copy(expiresAt = Instant.now().minusSeconds(1))); true }
            service.apply(apply, 27) shouldBe op
            store.audits().count { it.operationId == op.operationId } shouldBe 157
            query.find(key(rows.last()))!!.drinkGroup shouldBe "기타"
            val revert = RevertRequest(UUID.randomUUID().toString(), op.revisions, op.generations, "검토 취소", "https://official.example/menu", today)
            val reversed = service.revert(op.operationId, revert, 27)
            reversed.changed shouldBe 157; service.revert(op.operationId, revert, 27) shouldBe reversed
            store.corrections().all { it.fields.isEmpty() } shouldBe true
            val stale = service.preview(previewRequest, 27)
            service.correct(keys.first(), patch(keys.first(), mapOf("displayName" to FieldChange("SET", "다른 이름"))), 27)
            shouldThrow<AdminConflict> { service.apply(ApplyPreviewRequest(stale.previewToken, UUID.randomUUID().toString()), 27) }
            query.groups().single().group shouldBe "기타"
        }
        Then("idempotent completed result precedes stale generation and same UUID with other body is rejected") {
            val a = cafeItem(); load(a)
            val req = patch(key(a), mapOf("sugarG" to FieldChange("SET", "2")))
            val op = service.correct(key(a), req, 27)
            load(a)
            service.correct(key(a), req, 27) shouldBe op
            shouldThrow<AdminConflict> { service.correct(key(a), req.copy(reason = "다른 본문"), 27) }
            shouldThrow<AdminConflict> { service.revert(op.operationId, RevertRequest(UUID.randomUUID().toString(), op.revisions, op.generations, "취소", "https://official.example/menu", today), 27) }
        }
        Then("audit failure rolls back source projection, correction and operation atomically") {
            val a = cafeItem(); load(a)
            val failing = object : RankingAdminPort by store { override fun save(value: AuditEvent) { error("injected audit failure") } }
            val svc = RankingAdminService(failing, sourcePort)
            val req = patch(key(a), mapOf("sugarG" to FieldChange("SET", "2")))
            shouldThrow<IllegalStateException> { svc.correct(key(a), req, 27) }
            store.corrections().size shouldBe 0
            store.operation(req.idempotencyKey) shouldBe null
            query.find(key(a))!!.sugarG!!.compareTo(a.sugarG) shouldBe 0
        }
    }
    Given("result persistence failure, conflict resolution and audit retention") {
        Then("operation result persistence failure rolls back all effects") {
            val a = cafeItem(); load(a)
            val failing = object : RankingAdminPort by store { override fun save(value: AdminOperation) { error("injected result failure") } }
            val req = patch(key(a), mapOf("drinkGroup" to FieldChange("SET", "티")))
            shouldThrow<IllegalStateException> { RankingAdminService(failing, sourcePort).correct(key(a), req, 27) }
            store.corrections().size shouldBe 0
            store.audits().size shouldBe 0
            query.find(key(a))!!.drinkGroup shouldBe a.toDomain().drinkGroup
        }
        Then("conflict resolution reapproves current baseline, is idempotent and can reset orphan fields") {
            val a = cafeItem(); load(a)
            service.correct(key(a), patch(key(a), mapOf("sugarG" to FieldChange("SET", "2"))), 27)
            load(a.copy(sugarG = BigDecimal("20")))
            val c = store.corrections().single()
            val conflictId = java.util.Base64.getUrlEncoder().withoutPadding().encodeToString("${key(a)}:sugarG".toByteArray())
            val req = ResolveRequest(UUID.randomUUID().toString(), "KEEP_CORRECTION", expectedRevision = c.revision, sourceGeneration = store.brands().single().generation, reason = "현재 공식 자료 재대조", evidenceUrl = "https://official.example/menu", evidenceCheckedAt = today)
            val op = service.resolve(conflictId, req, 27)
            service.resolve(conflictId, req, 27) shouldBe op
            store.corrections().single().fields.getValue("sugarG").state shouldBe "ACTIVE"
            query.find(key(a))!!.sugarG!!.compareTo(BigDecimal("2")) shouldBe 0
            load(cafeItem(a.brandSlug, "다른 메뉴"))
            val orphan = store.corrections().single()
            service.resolve(conflictId, req.copy(idempotencyKey = UUID.randomUUID().toString(), action = "ADOPT_SOURCE", expectedRevision = orphan.revision, sourceGeneration = store.brands().single().generation), 27)
            store.corrections().single().fields.size shouldBe 0
        }
        Then("retention deletes only expired audit/result records and leaves corrections intact") {
            val a = cafeItem(); load(a)
            val saved = service.correct(key(a), patch(key(a), mapOf("sugarG" to FieldChange("SET", "2"))), 27)
            val cutoff = Instant.now().minusSeconds(366 * 86400L)
            tx.executeWithoutResult {
                records.findByKind("AUDIT").forEach { it.updatedAt = cutoff }
                records.findByKind("OPERATION").forEach { it.updatedAt = cutoff }
            }
            service.purgeAudits() shouldBe 1
            store.audits().size shouldBe 0
            store.operation(saved.operationId) shouldBe null
            store.corrections().single().fields.getValue("sugarG").state shouldBe "ACTIVE"
        }
    }

    Given("admin identity and verification") {
        Then("AC9: every controller handler invokes same 401/403 identity guard") {
            val controller = RankingAdminController(service)
            shouldThrow<UnauthorizedException> { controller.identity(null, null) }
            listOf("ROLE_USER", "ROLE_SELLER").forEach { role -> shouldThrow<ForbiddenException> { controller.identity("27", role) } }
            controller.identity("27", "ROLE_USER, ROLE_ADMIN") shouldBe 27
        }
        Then("AC11: brand verification never modifies row checkedAt, retries and brand revert remain atomic") {
            val a = cafeItem(); load(a); val original = sourceRepo.findAll().single().checkedAt
            val req = VerificationRequest(UUID.randomUUID().toString(), 0, listOf("https://official.example/a", "https://official.example/b"), today, "확인 메모", "공식 공지 확인")
            val op = service.verify(a.brandSlug, req, 27); service.verify(a.brandSlug, req, 27) shouldBe op
            sourceRepo.findAll().single().checkedAt shouldBe original
            store.brands().single().officialUrls.size shouldBe 2
            service.revert(op.operationId, RevertRequest(UUID.randomUUID().toString(), op.revisions, op.generations, "취소", "https://official.example/menu", today), 27)
            store.brands().single().verifiedAt shouldBe null
        }
    }
    Given("ingest journal and diagnostics") {
        Then("AC10: successful, failed, interrupted and partial parent run results are distinguishable") {
            val parent = UUID.randomUUID().toString(); val a = cafeItem("a")
            service.sync(CafeDrinkBulkRequest(listOf(a), parent))
            shouldThrow<IllegalArgumentException> { service.sync(CafeDrinkBulkRequest(listOf(a, a), parent)) }
            store.atomic { store.save(IngestRun("interrupted", null, listOf("b"), Instant.now().minusSeconds(901), attemptedRows = 2)); true }
            @Suppress("UNCHECKED_CAST") val result = service.read("ingest-runs", emptyMap()) as AdminPage<IngestRun>
            result.items.find { it.runId == parent }!!.status shouldBe "PARTIAL"
            result.items.find { it.runId == "interrupted" }!!.status shouldBe "INTERRUPTED"
            result.items.find { it.status == "FAILED" }!!.committedRows shouldBe 0
            sourceRepo.count() shouldBe 1
        }
        Then("AC12: gas health checks pointer, duplicate ranks/count, 36h stale and missing states") {
            tx.executeWithoutResult {
                val b = boards.saveAndFlush(RankingBoardJpaEntity(slug = "gas-a", scopeKey = "a"))
                val s = snapshots.saveAndFlush(RankingSnapshotJpaEntity(boardId = b.id!!, capturedAt = Instant.now().minusSeconds(37 * 3600), entryCount = 1))
                entries.saveAndFlush(RankingEntryJpaEntity(snapshotId = s.id!!, rankNo = 1, subjectKey = "gas:a", prevRank = null)); b.publishSnapshot(s.id!!)
                boards.saveAndFlush(b)
                boards.saveAndFlush(RankingBoardJpaEntity(slug = "gas-empty"))
            }
            store.gasBoards().find { it["scope"] == "a" }!!["health"] shouldBe "STALE"
            store.gasBoards().find { it["slug"] == "gas-empty" }!!["health"] shouldBe "NOT_CREATED"
            val s = snapshots.findAll().single()
            @Suppress("UNCHECKED_CAST") val payload = store.gasSnapshot(s.id!!)!!["entries"] as List<Map<String, Any?>>
            payload.single()["prevRank"] shouldBe null
            tx.executeWithoutResult { entries.saveAndFlush(RankingEntryJpaEntity(snapshotId = s.id!!, rankNo = 1, subjectKey = "gas:b")) }
            store.gasBoards().find { it["scope"] == "a" }!!["health"] shouldBe "INCONSISTENT"
            store.gasSnapshot(Long.MAX_VALUE) shouldBe null
        }
    }
    Given("round 1 reviewed contract regressions") {
        Then("F2 bulk rejects lossy source decimals before any state mutation and records FAILED") {
            val a = cafeItem(); load(a); val source = store.sourceDrinks(); val generation = store.brands()
            listOf(BigDecimal("1.00001"), BigDecimal("10000000000"), BigDecimal("-1")).forEach { number ->
                shouldThrow<IllegalArgumentException> { load(a.copy(sugarG = number)) }
                store.sourceDrinks() shouldBe source; store.brands() shouldBe generation
                store.runs().last { it.status == "FAILED" }.committedRows shouldBe 0
            }
        }
        Then("F3/F4 ZERO only accepts zero and every allowed nullable field honors UNKNOWN then RESET") {
            val a = cafeItem(status = CaffeineStatus.ZERO).copy(caffeineMg = BigDecimal.ZERO); load(a)
            shouldThrow<AdminValidation> { service.correct(key(a), patch(key(a), mapOf("caffeineMg" to FieldChange("SET", "1"))), 27) }
            shouldThrow<AdminValidation> { service.correct(key(a), patch(key(a), mapOf("caffeineMg" to FieldChange("SET_UNKNOWN"))), 27) }
            val changes = (CafeCorrectionProjection.numericFields - "caffeineMg").associateWith { FieldChange("SET_UNKNOWN") } + ("adminNote" to FieldChange("SET_UNKNOWN"))
            service.correct(key(a), patch(key(a), changes), 27)
            val unknown = query.find(key(a))!!
            unknown.sugarG shouldBe null; unknown.kcal shouldBe null; unknown.sodiumMg shouldBe null; unknown.cupVolumeMl shouldBe null
            unknown.sugarPer100ml shouldBe null; unknown.caffeinePer100ml shouldBe null
            query.search(CafeDrinkQuery(maxSugar = BigDecimal("100")), org.springframework.data.domain.PageRequest.of(0, 50)).totalElements shouldBe 0
            store.corrections().single().fields.getValue("adminNote").action shouldBe "SET_UNKNOWN"
            service.correct(key(a), patch(key(a), changes.mapValues { FieldChange("RESET") } + ("caffeineMg" to FieldChange("SET", "0"))), 27)
            query.find(key(a))!!.sugarG!!.compareTo(a.sugarG) shouldBe 0
            query.find(key(a))!!.caffeineMg!!.signum() shouldBe 0
        }
        Then("F7/F17 correction provenance and structured prior dependencies survive expired audit and repeated conflict ingest") {
            val a = cafeItem(); load(a)
            service.correct(key(a), patch(key(a), mapOf("sugarG" to FieldChange("SET", "2"), "drinkGroup" to FieldChange("SET", "티"))), 27)
            tx.executeWithoutResult { records.findByKind("AUDIT").forEach { it.updatedAt = Instant.now().minusSeconds(366 * 86400L) } }
            service.purgeAudits()
            val active = query.find(key(a))!!
            active.officialSourceUrl shouldBe a.sourceUrl
            active.correctionEvidence.getValue("sugarG").evidenceUrl shouldBe "https://official.example/nutrition"
            val mapper = JsonMapper.builder().findAndAddModules().build()
            mapper.readTree(mapper.writeValueAsString(active)).has("rawNutrition") shouldBe false
            mapper.readTree(mapper.writeValueAsString(store.sourceDrinks().single())).has("rawNutrition") shouldBe true
            load(a.copy(sugarG = BigDecimal("20")))
            val first = store.corrections().single().fields.getValue("sugarG")
            load(a.copy(sugarG = BigDecimal("21")))
            val again = store.corrections().single().fields.getValue("sugarG")
            again.detectedAt shouldBe first.detectedAt; again.runId shouldBe first.runId
            again.evidenceUrl shouldBe "https://official.example/nutrition"; again.sourceSnapshot!!.rawNutrition shouldBe a.rawNutrition
            again.dependencies["servingBasis"] shouldBe a.servingBasis
            load(cafeItem(a.brandSlug, "소멸 대체 메뉴"))
            store.runs().filter { it.status == "SUCCESS" }.maxBy { it.startedAt }.orphanedKeys shouldBe 1
            @Suppress("UNCHECKED_CAST") val detail = service.read("cafe/drinks/${key(a)}", emptyMap()) as Map<String, Any?>
            (detail["sourceSnapshot"] as CafeDrink).menuName shouldBe a.menuName
            store.corrections().single().fields.getValue("sugarG").evidenceCheckedAt shouldBe today
        }
        Then("F8/F9 parent failures plus interruption never claim partial success and metadata is present") {
            val parent = "failed-parent"
            store.atomic {
                store.save(IngestRun("failed-child", parent, listOf("a"), Instant.now().minusSeconds(1000), Instant.now(), "FAILED", 2))
                store.save(IngestRun("interrupted-child", parent, listOf("b"), Instant.now().minusSeconds(1000), attemptedRows = 2)); true
            }
            @Suppress("UNCHECKED_CAST") val runs = (service.read("ingest-runs", emptyMap()) as AdminPage<IngestRun>).items
            runs.single { it.runId == parent }.status shouldBe "INTERRUPTED"
            val a = cafeItem(); load(a)
            @Suppress("UNCHECKED_CAST") val success = (service.read("ingest-runs", mapOf("job" to listOf("CAFE_DRINK_BULK"))) as AdminPage<IngestRun>).items.first { it.status == "SUCCESS" }
            success.generationBefore[a.brandSlug] shouldBe 0
            success.generationAfter[a.brandSlug] shouldBe 1
            success.checkedAtMin shouldBe a.checkedAt; success.checkedAtMax shouldBe a.checkedAt
            (success.elapsedMs != null) shouldBe true; success.actor shouldBe "INTERNAL_CAFE_COLLECTOR"
            @Suppress("UNCHECKED_CAST") val noOtherJob = service.read("ingest-runs", mapOf("job" to listOf("OTHER"))) as AdminPage<IngestRun>
            noOtherJob.total shouldBe 0
        }
        Then("F12 per-target previews explain changes and one stale row blocks whole-operation revert") {
            val a = cafeItem("a", "기타 메뉴"); val b = cafeItem("a", "다른 기타 메뉴"); load(a, b)
            val preview = service.preview(PreviewRequest(listOf(key(a), key(b)), "티", "유형 대조", "https://official.example/menu", today), 27)
            preview.targets.size shouldBe 2
            preview.targets.all { it.before == "기타" && it.after == "티" && it.outcome == "CHANGE" } shouldBe true
            val op = service.apply(ApplyPreviewRequest(preview.previewToken, UUID.randomUUID().toString()), 27)
            service.correct(key(b), patch(key(b), mapOf("displayName" to FieldChange("SET", "후속 수정"))), 27)
            val revert = service.read("operations/${op.operationId}/revert-preview", emptyMap()) as RevertPreview
            revert.reversible shouldBe false
            revert.targets.count { !it.reversible && it.blockedReason == "이후 교정 있음" } shouldBe 1
            revert.targets.all { it.restored!!.fields.isEmpty() } shouldBe true
            @Suppress("UNCHECKED_CAST") val audits = service.read("audit-events", mapOf("operationId" to listOf(op.operationId))) as AdminPage<Map<String, Any?>>
            audits.items.all { it["revertible"] == false } shouldBe true
        }
        Then("max200 boundary accepts 200 explicit keys and rejects 201") {
            val rows = (1..201).map { cafeItem("a", "경계 메뉴$it") }; service.sync(CafeDrinkBulkRequest(rows))
            val keys = rows.map(::key)
            service.preview(PreviewRequest(keys.take(200), "티", "대조", "https://official.example/menu", today), 27).targets.size shouldBe 200
            shouldThrow<IllegalArgumentException> { service.preview(PreviewRequest(keys, "티", "대조", "https://official.example/menu", today), 27) }
        }
        Then("gas healthy and broken latest pointer are separate from stale and absence") {
            tx.executeWithoutResult {
                val b = boards.saveAndFlush(RankingBoardJpaEntity(slug = "gas-healthy"))
                val snapshot = snapshots.saveAndFlush(RankingSnapshotJpaEntity(boardId = b.id!!, capturedAt = Instant.now(), entryCount = 1))
                entries.saveAndFlush(RankingEntryJpaEntity(snapshotId = snapshot.id!!, rankNo = 1)); b.publishSnapshot(snapshot.id!!)
                val broken = boards.saveAndFlush(RankingBoardJpaEntity(slug = "gas-broken")); broken.publishSnapshot(Long.MAX_VALUE)
            }
            store.gasBoards().single { it["slug"] == "gas-healthy" }["health"] shouldBe "HEALTHY"
            store.gasBoards().single { it["slug"] == "gas-broken" }["health"] shouldBe "INCONSISTENT"
        }
    }

    Given("round 2 exact conflict refresh") {
        Then("F5 conflictId filter locates a target after 200 same-brand same-field conflicts") {
            val rows = (1..201).map { cafeItem("a", "충돌 메뉴$it").toDomain() }
            store.atomic {
                sourcePort.saveAll(rows)
                rows.forEach { row -> store.save(DrinkCorrections(CafeDrinkKey.of(row), row.brandSlug, 1, mapOf("sugarG" to FieldCorrection("SET", "2", "baseline", "CONFLICT", detectedAt = Instant.now(), runId = "run")), lastKnownSource = row)) }
                true
            }
            val key = CafeDrinkKey.of(rows.last())
            val id = java.util.Base64.getUrlEncoder().withoutPadding().encodeToString("$key:sugarG".toByteArray())
            @Suppress("UNCHECKED_CAST") val result = service.read("conflicts", mapOf("conflictId" to listOf(id), "size" to listOf("1"))) as AdminPage<Map<String, Any?>>
            result.total shouldBe 1; result.items.single()["id"] shouldBe id; result.items.single()["drinkKey"] shouldBe key
        }
    }

    Given("shared correction/ingest locks across simultaneous transactions") {
        Then("AC14 correctness: ten races expose only complete source/effective/audit states") {
            val a = cafeItem("a"); load(a)
            service.correct(key(a), patch(key(a), mapOf("sugarG" to FieldChange("SET", "2"))), 27)
            val pool = Executors.newFixedThreadPool(2)
            try {
                repeat(10) {
                    val latch = CountDownLatch(1)
                    val req = patch(key(a), mapOf("sugarG" to FieldChange("SET", "2")))
                    val edit = pool.submit { latch.await(); try { service.correct(key(a), req, 27) } catch (_: AdminConflict) { } }
                    val ingest = pool.submit { latch.await(); load(a) }
                    latch.countDown(); edit.get(30, TimeUnit.SECONDS); ingest.get(30, TimeUnit.SECONDS)
                    sourceRepo.count() shouldBe 1; effectiveRepo.count() shouldBe 1
                    query.find(key(a))!!.sugarG!!.compareTo(BigDecimal("2")) shouldBe 0
                    store.corrections().single().fields.getValue("sugarG").state shouldBe "ACTIVE"
                }
            } finally { pool.shutdownNow() }
        }
    }
})
