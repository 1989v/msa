package com.kgd.codedictionary.infrastructure.persistence.concept.entity

import com.kgd.codedictionary.domain.concept.model.ConceptEdge
import com.kgd.codedictionary.domain.concept.model.ConceptEdgeKind
import io.github.oshai.kotlinlogging.KotlinLogging
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table

@Entity
@Table(name = "concept_edge")
class ConceptEdgeJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    // concept 행은 reindex 가 통째로 다시 심으므로 FK 가 아니라 값으로 들고 있는다 (tech_domain_concept 와 같다)
    @Column(name = "from_concept_id", nullable = false, length = 100)
    val fromConceptId: String,

    @Column(name = "to_concept_id", nullable = false, length = 100)
    val toConceptId: String,

    /**
     * enum 이 아니라 문자열로 든다. 롤링 배포에서 새 파드가 이 코드가 모르는 관계를 쓰는 동안
     * 옛 파드가 `Enum.valueOf` 로 죽지 않도록 — 모르는 값은 [toDomain] 이 경고하고 뺀다.
     */
    @Column(nullable = false, length = 16)
    val kind: String,

    @Column(nullable = false)
    val ordinal: Int = 0,

    @Column(length = 500)
    val reason: String? = null,

    @Column(name = "evidence_ref", length = 300)
    val evidenceRef: String? = null,
) {
    /** 이 코드가 모르는 관계 kind 면 null — 호출자는 그 간선을 뺀다 */
    fun toDomain(): ConceptEdge? {
        val known = ConceptEdgeKind.entries.firstOrNull { it.name == kind }
        if (known == null) {
            log.warn { "모르는 관계 kind 라 간선을 뺀다: id=$id kind=$kind $fromConceptId → $toConceptId" }
            return null
        }
        return ConceptEdge(
            id = id,
            fromConceptId = fromConceptId,
            toConceptId = toConceptId,
            kind = known,
            ordinal = ordinal,
            reason = reason,
            evidenceRef = evidenceRef,
        )
    }

    private companion object {
        val log = KotlinLogging.logger {}
    }
}
