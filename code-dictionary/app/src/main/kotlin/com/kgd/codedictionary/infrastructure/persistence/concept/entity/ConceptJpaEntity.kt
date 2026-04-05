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
    @Column(nullable = false, unique = true, length = 100)
    var conceptId: String,
    @Column(nullable = false, length = 200)
    var name: String,
    @Column(nullable = false, length = 50)
    var category: String,
    @Column(nullable = false, length = 20)
    var level: String,
    @Column(columnDefinition = "TEXT")
    var description: String?,
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
        fun fromDomain(concept: Concept): ConceptJpaEntity {
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
            return entity
        }
    }
}
