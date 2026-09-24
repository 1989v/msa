package com.kgd.codedictionary.infrastructure.persistence.ontology

import com.kgd.codedictionary.application.ontology.dto.ApplyOutcome
import com.kgd.codedictionary.application.ontology.service.OntologyApplyService
import com.kgd.codedictionary.infrastructure.ontology.YamlOntologyReader
import com.zaxxer.hikari.HikariDataSource
import io.kotest.core.annotation.EnabledIf
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import org.flywaydb.core.Flyway
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.jdbc.datasource.DataSourceTransactionManager
import org.springframework.transaction.support.TransactionTemplate
import org.testcontainers.containers.MySQLContainer
import org.testcontainers.utility.DockerImageName
import tools.jackson.module.kotlin.jacksonObjectMapper
import tools.jackson.module.kotlin.readValue

/**
 * 첫 이관 — 레포의 실제 `search.yaml` 을 운영과 같은 시드(V22~V24) 위에 적용한다.
 *
 * ① 적용 전 간선이 운영에서 내보낸 145건과 같다(시드 = 운영) ② 파일이 strict 모드 MySQL 에 실제로 들어간다
 * ③ 적용 뒤 간선이 파일의 간선과 정확히 같다 — 그래서 운영 적용 뒤 같은 비교(context/migration-diff.md)가 성립한다.
 */
@EnabledIf(DockerAvailable::class)
class SearchOntologyMigrationSpec : BehaviorSpec({

    val mysql = MySQLContainer(DockerImageName.parse("mysql:8.0.33"))
        .withDatabaseName("code_dictionary_db").withUsername("root").withPassword("test").also { it.start() }
    val ds = HikariDataSource().apply {
        jdbcUrl = mysql.jdbcUrl + "?characterEncoding=UTF-8&useUnicode=true"
        username = mysql.username
        password = mysql.password
    }
    Flyway.configure().dataSource(ds).locations("classpath:codedictionarydb/migration").load().migrate()
    val jdbc = JdbcTemplate(ds)
    afterSpec { ds.close(); mysql.stop() }

    fun edges(): Set<Triple<String, String, String>> =
        jdbc.query("SELECT from_concept_id, to_concept_id, kind FROM concept_edge") { rs, _ ->
            Triple(rs.getString(1), rs.getString(2), rs.getString(3))
        }.toSet()

    val exported: Set<Triple<String, String, String>> =
        jacksonObjectMapper().readValue<List<Map<String, Any>>>(javaClass.getResource("/ontology-migration/edges-before.json")!!.readText())
            .map { Triple(it["from"] as String, it["to"] as String, it["kind"] as String) }.toSet()

    given("Flyway V1~V26 만 돈 DB") {
        then("간선이 운영에서 내보낸 145건과 같다 — 시드가 곧 운영 상태다") { edges() shouldBe exported }
    }

    given("레포의 온톨로지 파일 묶음을 적용하면") {
        val loaded = YamlOntologyReader("classpath:ontology/").load()
        val report = OntologyApplyService(YamlOntologyReader("classpath:ontology/"), JdbcOntologyStoreAdapter(ds),
            TransactionTemplate(DataSourceTransactionManager(ds)), "test").applyFromSource()
        then("APPLIED 이고 간선이 파일의 간선과 정확히 같다") {
            report.outcome shouldBe ApplyOutcome.APPLIED
            edges() shouldBe loaded.ontology.relations.map { Triple(it.from, it.to, it.kind.name) }.toSet()
        }
        then("관리 대상 개념 전부에 kind 가 있고, 옛 지표 묶음 둘은 관리 밖이다") {
            jdbc.queryForObject("SELECT COUNT(*) FROM concept WHERE managed_by IS NOT NULL AND kind IS NOT NULL", Int::class.java) shouldBe
                loaded.ontology.concepts.size
            jdbc.queryForObject(
                "SELECT COUNT(*) FROM concept WHERE concept_id IN ('search-ops-metrics','offline-metrics') AND managed_by IS NULL", Int::class.java,
            ) shouldBe 2
        }
        then("배치율 — 시드에 있던 개념 중 관리 밖은 옛 지표 묶음 둘뿐이다") {
            jdbc.queryForList("SELECT concept_id FROM concept WHERE managed_by IS NULL", String::class.java).toSet() shouldBe
                setOf("search-ops-metrics", "offline-metrics")
        }
    }
})
