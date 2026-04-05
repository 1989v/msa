package com.kgd.codedictionary.infrastructure.persistence.index.entity

import com.kgd.codedictionary.domain.index.model.CodeLocation
import com.kgd.codedictionary.domain.index.model.ConceptIndex
import com.kgd.codedictionary.infrastructure.persistence.concept.entity.ConceptJpaEntity
import jakarta.persistence.*
import java.time.LocalDateTime

@Entity
@Table(name = "concept_index")
class ConceptIndexJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "concept_id", nullable = false)
    val concept: ConceptJpaEntity,
    @Column(nullable = false, length = 500)
    var filePath: String,
    @Column(nullable = false)
    var lineStart: Int,
    @Column(nullable = false)
    var lineEnd: Int,
    @Column(columnDefinition = "TEXT")
    var codeSnippet: String?,
    @Column(length = 1000)
    var gitUrl: String?,
    @Column(columnDefinition = "TEXT")
    var description: String?,
    @Column(length = 40)
    var gitCommitHash: String?,
    @Column(nullable = false)
    val indexedAt: LocalDateTime = LocalDateTime.now()
) {
    fun toDomain(): ConceptIndex = ConceptIndex.restore(
        id = id,
        conceptId = concept.conceptId,
        location = CodeLocation(
            filePath = filePath,
            lineStart = lineStart,
            lineEnd = lineEnd,
            gitUrl = gitUrl
        ),
        codeSnippet = codeSnippet,
        description = description,
        gitCommitHash = gitCommitHash,
        indexedAt = indexedAt
    )

    companion object {
        fun fromDomain(conceptIndex: ConceptIndex, conceptEntity: ConceptJpaEntity) = ConceptIndexJpaEntity(
            id = conceptIndex.id,
            concept = conceptEntity,
            filePath = conceptIndex.location.filePath,
            lineStart = conceptIndex.location.lineStart,
            lineEnd = conceptIndex.location.lineEnd,
            codeSnippet = conceptIndex.codeSnippet,
            gitUrl = conceptIndex.location.gitUrl,
            description = conceptIndex.description,
            gitCommitHash = conceptIndex.gitCommitHash,
            indexedAt = conceptIndex.indexedAt
        )
    }
}
