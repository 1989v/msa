package com.kgd.codedictionary.infrastructure.persistence.concept.entity

import com.kgd.codedictionary.domain.concept.model.ConceptEdge
import com.kgd.codedictionary.domain.concept.model.ConceptEdgeKind
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
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

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    val kind: ConceptEdgeKind,

    @Column(nullable = false)
    val ordinal: Int = 0,
) {
    fun toDomain(): ConceptEdge = ConceptEdge(
        id = id,
        fromConceptId = fromConceptId,
        toConceptId = toConceptId,
        kind = kind,
        ordinal = ordinal,
    )
}
