package com.kgd.codedictionary.infrastructure.persistence.concept.entity

import jakarta.persistence.*

@Entity
@Table(
    name = "concept_relation",
    uniqueConstraints = [UniqueConstraint(columnNames = ["source_concept_id", "target_concept_id"])]
)
class ConceptRelationJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "source_concept_id", nullable = false)
    val sourceConcept: ConceptJpaEntity,
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "target_concept_id", nullable = false)
    val targetConcept: ConceptJpaEntity
)
