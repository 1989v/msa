package com.kgd.codedictionary.infrastructure.persistence.ontology

import com.kgd.codedictionary.application.ontology.dto.ApplyOutcome
import com.kgd.codedictionary.application.ontology.dto.LoadedOntology
import com.kgd.codedictionary.application.ontology.port.OntologySourcePort
import com.kgd.codedictionary.application.ontology.service.OntologyApplyService
import com.kgd.codedictionary.application.ontology.service.OntologyRevisionNotBumpedException
import com.kgd.codedictionary.domain.concept.model.ConceptCategory
import com.kgd.codedictionary.domain.concept.model.ConceptEdgeKind
import com.kgd.codedictionary.domain.concept.model.ConceptKind
import com.kgd.codedictionary.domain.concept.model.ConceptLevel
import com.kgd.codedictionary.domain.concept.ontology.ConceptOntology
import com.kgd.codedictionary.domain.concept.ontology.EvidenceKind
import com.kgd.codedictionary.domain.concept.ontology.OntologyConcept
import com.kgd.codedictionary.domain.concept.ontology.OntologyDomain
import com.kgd.codedictionary.domain.concept.ontology.OntologyEvidence
import com.kgd.codedictionary.domain.concept.ontology.OntologyManifest
import com.kgd.codedictionary.domain.concept.ontology.OntologyRelation
import com.zaxxer.hikari.HikariDataSource
import io.kotest.assertions.throwables.shouldThrowAny
import io.kotest.core.annotation.EnabledIf
import io.kotest.core.annotation.EnabledCondition
import io.kotest.core.spec.Spec
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldContainExactlyInAnyOrder
import io.kotest.matchers.nulls.shouldBeNull
import io.kotest.matchers.nulls.shouldNotBeNull
import io.kotest.matchers.shouldBe
import org.flywaydb.core.Flyway
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.jdbc.datasource.DataSourceTransactionManager
import org.springframework.transaction.support.TransactionTemplate
import org.testcontainers.DockerClientFactory
import org.testcontainers.containers.MySQLContainer
import org.testcontainers.utility.DockerImageName
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import kotlin.reflect.KClass

class DockerAvailable : EnabledCondition {
    override fun enabled(kclass: KClass<out Spec>): Boolean =
        runCatching { DockerClientFactory.instance().isDockerAvailable }.getOrDefault(false)
}

/**
 * 적용 계약(스펙 SR-4.3)을 실제 MySQL 에서 본다 — 운영과 같은 Flyway V1~V26 을 돌린 스키마 위에서.
 * FOR UPDATE 직렬화·strict 모드 롤백·ON DUPLICATE KEY 는 목(mock)으로는 재지 못한다.
 */
@EnabledIf(DockerAvailable::class)
class OntologyApplyIntegrationSpec : BehaviorSpec({

    val mysql = MySQLContainer(DockerImageName.parse("mysql:8.0.33"))
        .withDatabaseName("code_dictionary_db").withUsername("root").withPassword("test")
        .also { it.start() }
    val ds = HikariDataSource().apply {
        jdbcUrl = mysql.jdbcUrl + "?characterEncoding=UTF-8&useUnicode=true"
        username = mysql.username
        password = mysql.password
        maximumPoolSize = 6
    }
    Flyway.configure().dataSource(ds).locations("classpath:codedictionarydb/migration").load().migrate()
    val jdbc = JdbcTemplate(ds)
    val store = JdbcOntologyStoreAdapter(ds)
    val tx = TransactionTemplate(DataSourceTransactionManager(ds))

    fun concept(id: String, kind: ConceptKind, name: String = id, synonyms: List<String> = emptyList()) = OntologyConcept(
        id = id, kind = kind, name = name, category = ConceptCategory.BASICS, level = ConceptLevel.BEGINNER,
        description = "$id 설명", synonyms = synonyms,
        evidence = listOf(OntologyEvidence(EvidenceKind.POST, "post-$id")), questions = listOf("$id 는 왜 필요한가"),
    )

    fun loaded(revision: Int, hash: String, extra: List<OntologyConcept> = emptyList(), reason: String? = "상주 32× ↓", rename: String = "융합") =
        LoadedOntology(
            ConceptOntology(
                OntologyManifest(revision, listOf("t")),
                listOf(
                    OntologyDomain(
                        fileDomain = "t", domain = "t", root = "t-sys",
                        concepts = listOf(
                            concept("t-sys", ConceptKind.DOMAIN),
                            concept("t-fusion", ConceptKind.STAGE, name = rename, synonyms = listOf("rank fusion")),
                            concept("t-rrf", ConceptKind.MECHANISM),
                            concept("t-ndcg", ConceptKind.METRIC),
                        ) + extra,
                        relations = listOf(
                            OntologyRelation("t-sys", "t-fusion", ConceptEdgeKind.CONTAINS, 1),
                            OntologyRelation("t-fusion", "t-rrf", ConceptEdgeKind.CONTAINS, 1),
                            OntologyRelation("t-fusion", "t-ndcg", ConceptEdgeKind.CONTAINS, 2),
                            OntologyRelation("t-rrf", "t-ndcg", ConceptEdgeKind.AFFECTS, 1, reason, "ADR-0090"),
                        ) + extra.map { OntologyRelation("t-fusion", it.id, ConceptEdgeKind.CONTAINS, 9) },
                    ),
                ),
            ),
            hash,
        )

    fun service(src: LoadedOntology) =
        OntologyApplyService(object : OntologySourcePort { override fun load() = src }, store, tx, "test")

    fun stateRevision() = jdbc.queryForObject("SELECT revision FROM ontology_state WHERE id = 1", Int::class.java)
    fun kindOf(id: String) = jdbc.queryForList("SELECT kind FROM concept WHERE concept_id = ?", String::class.java, id).firstOrNull()
    fun edgeCount() = jdbc.queryForObject("SELECT COUNT(*) FROM concept_edge", Int::class.java)

    afterSpec { ds.close(); mysql.stop() }

    given("V22~V24 시드 간선이 있는 DB") {
        `when`("revision 1 을 처음 적용하면") {
            val report = service(loaded(1, "h1", extra = listOf(concept("t-gone", ConceptKind.MECHANISM)))).applyFromSource()
            then("APPLIED 이고 상태 행에 revision·해시가 적힌다") {
                report.outcome shouldBe ApplyOutcome.APPLIED
                stateRevision() shouldBe 1
                jdbc.queryForObject("SELECT content_hash FROM ontology_state WHERE id = 1", String::class.java) shouldBe "h1"
            }
            then("간선 표 전체가 파일의 간선으로 바뀐다 — 시드 간선은 남지 않는다") {
                edgeCount() shouldBe 5
                jdbc.queryForObject("SELECT reason FROM concept_edge WHERE kind = 'AFFECTS'", String::class.java) shouldBe "상주 32× ↓"
            }
            then("개념에 kind·managed_by, 동의어·근거·질문이 실린다") {
                kindOf("t-rrf") shouldBe "MECHANISM"
                jdbc.queryForObject("SELECT managed_by FROM concept WHERE concept_id = 't-rrf'", String::class.java) shouldBe "t"
                jdbc.queryForList(
                    "SELECT s.synonym FROM concept_synonym s JOIN concept c ON c.id = s.concept_id WHERE c.concept_id = 't-fusion'",
                    String::class.java,
                ) shouldContainExactlyInAnyOrder listOf("rank fusion")
                jdbc.queryForObject("SELECT COUNT(*) FROM concept_evidence WHERE concept_id = 't-fusion'", Int::class.java) shouldBe 1
                jdbc.queryForObject("SELECT COUNT(*) FROM concept_question WHERE concept_id = 't-fusion'", Int::class.java) shouldBe 1
            }
        }

        `when`("같은 revision·같은 해시를 다시 적용하면") {
            val report = service(loaded(1, "h1", extra = listOf(concept("t-gone", ConceptKind.MECHANISM)))).applyFromSource()
            then("SKIPPED_SAME — 두 번째 부팅은 아무것도 바꾸지 않는다") { report.outcome shouldBe ApplyOutcome.SKIPPED_SAME }
        }

        `when`("같은 revision 인데 내용이 다르면") {
            then("revision 을 안 올린 것이라 오류이고 상태는 그대로다") {
                shouldThrowAny { service(loaded(1, "h1-changed")).applyFromSource() }
                    .let { (it is OntologyRevisionNotBumpedException) shouldBe true }
                jdbc.queryForObject("SELECT content_hash FROM ontology_state WHERE id = 1", String::class.java) shouldBe "h1"
            }
        }

        `when`("revision 2 가 개념 하나를 뺐다") {
            val report = service(loaded(2, "h2")).applyFromSource()
            then("빠진 개념은 관리 해제되지만 행은 남고, 그 근거·질문은 지워진다") {
                report.released shouldBe 1
                jdbc.queryForObject("SELECT COUNT(*) FROM concept WHERE concept_id = 't-gone'", Int::class.java) shouldBe 1
                kindOf("t-gone").shouldBeNull()
                jdbc.queryForList("SELECT managed_by FROM concept WHERE concept_id = 't-gone'", String::class.java).first().shouldBeNull()
                jdbc.queryForObject("SELECT COUNT(*) FROM concept_evidence WHERE concept_id = 't-gone'", Int::class.java) shouldBe 0
                edgeCount() shouldBe 4
            }
        }

        `when`("옛 이미지가 낮은 revision 파일로 다시 뜨면") {
            val report = service(loaded(1, "h1", extra = listOf(concept("t-gone", ConceptKind.MECHANISM)))).applyFromSource()
            then("SKIPPED_OLDER — 데이터를 되돌리지 않는다") {
                report.outcome shouldBe ApplyOutcome.SKIPPED_OLDER
                stateRevision() shouldBe 2
                kindOf("t-gone").shouldBeNull()
            }
        }

        `when`("revision 3 이 이름을 바꾸면서 DB 가 거부하는 간선(reason 600자)을 담았다") {
            then("전부 롤백된다 — 이름도 상태 행도 revision 2 그대로") {
                shouldThrowAny { service(loaded(3, "h3", reason = "가".repeat(600), rename = "바뀐 이름")).applyFromSource() }
                stateRevision() shouldBe 2
                jdbc.queryForObject("SELECT name FROM concept WHERE concept_id = 't-fusion'", String::class.java) shouldBe "융합"
                edgeCount() shouldBe 4
            }
        }

        `when`("두 로더가 같은 revision 4 를 동시에 적용하면") {
            val pool = Executors.newFixedThreadPool(2)
            val start = CountDownLatch(1)
            val futures = (1..2).map { pool.submit<ApplyOutcome> { start.await(); service(loaded(4, "h4")).applyFromSource().outcome } }
            start.countDown()
            val outcomes = futures.map { it.get() }
            pool.shutdown()
            then("한 번만 적용되고 다른 하나는 건너뛴다") {
                outcomes shouldContainExactlyInAnyOrder listOf(ApplyOutcome.APPLIED, ApplyOutcome.SKIPPED_SAME)
                stateRevision() shouldBe 4
            }
        }
    }

    given("파생물 갱신 리스") {
        `when`("A 가 리스를 쥐고 있으면") {
            val targetA = store.tryAcquireLease("A", 60)
            then("A 는 현재 content_hash 를 대상으로 받고, B 는 못 잡는다") {
                targetA shouldBe "h4"
                store.tryAcquireLease("B", 60).shouldBeNull()
            }
            then("소유자가 아니면 derived_hash 를 적지 못한다") {
                store.recordDerived("B", "h4")
                store.readState().derivedHash.shouldBeNull()
                store.recordDerived("A", "h4")
                store.readState().derivedHash shouldBe "h4"
            }
        }
        `when`("A 가 놓으면") {
            store.releaseLease("A")
            then("B 가 잡는다") { store.tryAcquireLease("B", 0).shouldNotBeNull() }
        }
        `when`("B 의 리스가 만료되면") {
            Thread.sleep(1_100)
            then("C 가 빼앗는다") { store.tryAcquireLease("C", 60).shouldNotBeNull() }
        }
    }
})
