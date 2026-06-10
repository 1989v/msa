package com.kgd.codedictionary.infrastructure.persistence.concept.entity

import com.kgd.codedictionary.domain.concept.model.Concept
import com.kgd.codedictionary.domain.concept.model.ConceptCategory
import com.kgd.codedictionary.domain.concept.model.ConceptLevel
import jakarta.persistence.*
import org.hibernate.annotations.CreationTimestamp
import org.hibernate.annotations.UpdateTimestamp
import java.time.LocalDateTime

@Entity
@Table(name = "concept")
class ConceptJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,
    conceptId: String,
    name: String,
    category: String,
    level: String,
    description: String?,
    @OneToMany(mappedBy = "concept", cascade = [CascadeType.ALL], orphanRemoval = true, fetch = FetchType.EAGER)
    val synonyms: MutableList<ConceptSynonymJpaEntity> = mutableListOf(),
    @OneToMany(mappedBy = "sourceConcept", cascade = [CascadeType.ALL], orphanRemoval = true, fetch = FetchType.EAGER)
    val relations: MutableList<ConceptRelationJpaEntity> = mutableListOf(),
    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    val createdAt: LocalDateTime = LocalDateTime.now(),
    @UpdateTimestamp
    @Column(nullable = false)
    var updatedAt: LocalDateTime = LocalDateTime.now()
) {
    @Column(nullable = false, unique = true, length = 100)
    var conceptId: String = conceptId
        private set

    @Column(nullable = false, length = 200)
    var name: String = name
        private set

    @Column(nullable = false, length = 50)
    var category: String = category
        private set

    @Column(nullable = false, length = 20)
    var level: String = level
        private set

    @Column(columnDefinition = "TEXT")
    var description: String? = description
        private set

    /**
     * 전체 동기화 — 도메인 모델 기준으로 영속 상태를 덮어쓴다 (entity-mutation.md).
     * 관계 대상 엔티티는 영속성 조회가 필요하므로 호출자(어댑터)가 resolve 해서 전달한다.
     */
    fun update(concept: Concept, relationTargets: List<ConceptJpaEntity>) {
        name = concept.name
        category = concept.category.name
        level = concept.level.name
        description = concept.description

        synonyms.clear()
        concept.synonyms.forEach { synonym ->
            synonyms.add(ConceptSynonymJpaEntity(synonym = synonym, concept = this))
        }

        relations.clear()
        relationTargets.forEach { target ->
            relations.add(ConceptRelationJpaEntity(sourceConcept = this, targetConcept = target))
        }
    }

    fun toDomain(): Concept = Concept.restore(
        id = id,
        conceptId = conceptId,
        name = name,
        category = ConceptCategory.valueOf(category),
        level = ConceptLevel.valueOf(level),
        description = description ?: "",
        synonyms = synonyms.map { it.synonym },
        relatedConceptIds = relations.map { it.targetConcept.conceptId }
    )

    companion object {
        fun fromDomain(
            concept: Concept,
            relationTargets: List<ConceptJpaEntity> = emptyList()
        ): ConceptJpaEntity {
            val entity = ConceptJpaEntity(
                id = concept.id,
                conceptId = concept.conceptId,
                name = concept.name,
                category = concept.category.name,
                level = concept.level.name,
                description = concept.description
            )
            concept.synonyms.forEach { synonym ->
                entity.synonyms.add(
                    ConceptSynonymJpaEntity(synonym = synonym, concept = entity)
                )
            }
            relationTargets.forEach { target ->
                entity.relations.add(
                    ConceptRelationJpaEntity(sourceConcept = entity, targetConcept = target)
                )
            }
            return entity
        }
    }
}
