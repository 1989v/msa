package com.kgd.codedictionary.infrastructure.persistence.concept.entity

import jakarta.persistence.*

@Entity
@Table(name = "concept_synonym")
class ConceptSynonymJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,
    @Column(nullable = false, length = 200)
    val synonym: String,
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "concept_id", nullable = false)
    val concept: ConceptJpaEntity
)
