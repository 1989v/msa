package com.kgd.codedictionary.infrastructure.persistence.ontology

import com.kgd.codedictionary.application.ontology.dto.OntologyState
import com.kgd.codedictionary.application.ontology.port.OntologyStorePort
import com.kgd.codedictionary.application.ontology.port.OntologySyncStatePort
import com.kgd.codedictionary.domain.concept.ontology.ConceptOntology
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Component
import java.sql.ResultSet
import javax.sql.DataSource

/**
 * 온톨로지 적용과 sync 리스를 JDBC 로 한다. JPA 가 아니라 JDBC 인 이유 — kind·managed_by 는 JPA 엔티티에서
 * 읽기 전용이고, 적용은 표 단위 교체(간선 전체·동의어·근거·질문)라 행 단위 엔티티 조작보다 SQL 이 짧고 정확하다.
 * 트랜잭션은 호출자가 연다 — 같은 DataSource 라 JPA 트랜잭션 매니저가 연결을 공유한다.
 */
@Component
class JdbcOntologyStoreAdapter(dataSource: DataSource) : OntologyStorePort, OntologySyncStatePort {

    private val jdbc = JdbcTemplate(dataSource)

    override fun lockState(): OntologyState =
        jdbc.queryForObject("SELECT revision, content_hash, derived_hash FROM ontology_state WHERE id = 1 FOR UPDATE", ::state)!!

    override fun readState(): OntologyState =
        jdbc.queryForObject("SELECT revision, content_hash, derived_hash FROM ontology_state WHERE id = 1", ::state)!!

    override fun apply(ontology: ConceptOntology): Triple<Int, Int, Int> {
        val owner = ontology.domains.flatMap { d -> d.concepts.map { it.id to d.domain } }.toMap()
        val concepts = ontology.concepts
        val ids = concepts.map { it.id }

        batch(
            """
            INSERT INTO concept (concept_id, name, category, level, kind, managed_by, description)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE name = VALUES(name), category = VALUES(category), level = VALUES(level),
                kind = VALUES(kind), managed_by = VALUES(managed_by), description = VALUES(description)
            """.trimIndent(),
            concepts.map { arrayOf(it.id, it.name, it.category.name, it.level.name, it.kind?.name, owner.getValue(it.id), it.description) },
        )

        // 관리 해제 — 이전에 관리하던 개념 중 이번 묶음에 없는 것. 행은 남긴다(코드 참조가 값으로 건다)
        val releasedIds = jdbc.queryForList("SELECT concept_id FROM concept WHERE managed_by IS NOT NULL", String::class.java)
            .filterNot { it in ids.toSet() }
        if (releasedIds.isNotEmpty()) {
            batch("UPDATE concept SET kind = NULL, managed_by = NULL WHERE concept_id = ?", releasedIds.map { arrayOf(it) })
            batch("DELETE FROM concept_evidence WHERE concept_id = ?", releasedIds.map { arrayOf(it) })
            batch("DELETE FROM concept_question WHERE concept_id = ?", releasedIds.map { arrayOf(it) })
        }

        // 동의어·근거·질문 — 파일이 나열한 개념 단위로 전체 교체
        batch(
            "DELETE s FROM concept_synonym s JOIN concept c ON c.id = s.concept_id WHERE c.concept_id = ?",
            ids.map { arrayOf(it) },
        )
        batch(
            "INSERT INTO concept_synonym (concept_id, synonym) SELECT id, ? FROM concept WHERE concept_id = ?",
            concepts.flatMap { c -> c.synonyms.map { arrayOf(it, c.id) } },
        )
        batch("DELETE FROM concept_evidence WHERE concept_id = ?", ids.map { arrayOf(it) })
        batch(
            "INSERT INTO concept_evidence (concept_id, kind, ref, note, ordinal) VALUES (?, ?, ?, ?, ?)",
            concepts.flatMap { c -> c.evidence.mapIndexed { i, e -> arrayOf(c.id, e.kind.name, e.ref, e.note, i + 1) } },
        )
        batch("DELETE FROM concept_question WHERE concept_id = ?", ids.map { arrayOf(it) })
        batch(
            "INSERT INTO concept_question (concept_id, ordinal, question) VALUES (?, ?, ?)",
            concepts.flatMap { c -> c.questions.mapIndexed { i, q -> arrayOf(c.id, i + 1, q) } },
        )

        // 간선은 표 전체를 파일이 소유한다 — 파일에서 빠진 개념의 나가는 간선이 남아 유령 루트가 되지 않게
        jdbc.update("DELETE FROM concept_edge")
        val relations = ontology.relations
        batch(
            "INSERT INTO concept_edge (from_concept_id, to_concept_id, kind, ordinal, reason, evidence_ref) VALUES (?, ?, ?, ?, ?, ?)",
            relations.map { arrayOf(it.from, it.to, it.kind.name, it.ordinal, it.reason, it.evidenceRef) },
        )
        return Triple(concepts.size, relations.size, releasedIds.size)
    }

    override fun recordApplied(revision: Int, contentHash: String, appVersion: String) {
        jdbc.update(
            "UPDATE ontology_state SET revision = ?, content_hash = ?, applied_at = UTC_TIMESTAMP(), app_version = ? WHERE id = 1",
            revision, contentHash, appVersion.take(40),
        )
    }

    override fun tryAcquireLease(owner: String, leaseSeconds: Long): String? {
        val acquired = jdbc.update(
            """
            UPDATE ontology_state
               SET sync_owner = ?, sync_lease_until = UTC_TIMESTAMP() + INTERVAL ? SECOND, sync_target_hash = COALESCE(content_hash, '')
             WHERE id = 1 AND (sync_owner IS NULL OR sync_owner = ? OR sync_lease_until IS NULL OR sync_lease_until < UTC_TIMESTAMP())
            """.trimIndent(),
            owner, leaseSeconds, owner,
        )
        if (acquired == 0) return null
        return jdbc.queryForObject("SELECT sync_target_hash FROM ontology_state WHERE id = 1", String::class.java)
    }

    override fun retarget(owner: String, targetHash: String) {
        jdbc.update("UPDATE ontology_state SET sync_target_hash = ? WHERE id = 1 AND sync_owner = ?", targetHash, owner)
    }

    override fun recordDerived(owner: String, targetHash: String) {
        jdbc.update(
            "UPDATE ontology_state SET derived_hash = NULLIF(?, ''), derived_at = UTC_TIMESTAMP() WHERE id = 1 AND sync_owner = ?",
            targetHash, owner,
        )
    }

    override fun releaseLease(owner: String) {
        jdbc.update("UPDATE ontology_state SET sync_owner = NULL, sync_lease_until = NULL WHERE id = 1 AND sync_owner = ?", owner)
    }

    /** 빈 목록이면 부르지 않는다 — 드라이버에 따라 빈 배치가 오류가 난다 */
    private fun batch(sql: String, args: List<Array<out Any?>>) {
        if (args.isEmpty()) return
        // Java 의 List<Object[]> — 값에 null(reason·note 등)이 섞이므로 Array<Any?> 를 그대로 넘긴다
        @Suppress("UNCHECKED_CAST")
        jdbc.batchUpdate(sql, args.map { arrayOf<Any?>(*it) } as List<Array<Any>>)
    }

    private fun state(rs: ResultSet, @Suppress("UNUSED_PARAMETER") n: Int) = OntologyState(
        revision = rs.getInt("revision"),
        contentHash = rs.getString("content_hash"),
        derivedHash = rs.getString("derived_hash"),
    )
}
