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
    filePath: String,
    lineStart: Int,
    lineEnd: Int,
    codeSnippet: String?,
    gitUrl: String?,
    description: String?,
    gitCommitHash: String?,
    @Column(nullable = false)
    val indexedAt: LocalDateTime = LocalDateTime.now()
) {
    @Column(nullable = false, length = 500)
    var filePath: String = filePath
        private set

    @Column(nullable = false)
    var lineStart: Int = lineStart
        private set

    @Column(nullable = false)
    var lineEnd: Int = lineEnd
        private set

    @Column(columnDefinition = "TEXT")
    var codeSnippet: String? = codeSnippet
        private set

    @Column(length = 1000)
    var gitUrl: String? = gitUrl
        private set

    @Column(columnDefinition = "TEXT")
    var description: String? = description
        private set

    @Column(length = 40)
    var gitCommitHash: String? = gitCommitHash
        private set

    /** 전체 동기화 — 도메인 모델 기준으로 영속 상태를 덮어쓴다 (entity-mutation.md) */
    fun update(conceptIndex: ConceptIndex) {
        filePath = conceptIndex.location.filePath
        lineStart = conceptIndex.location.lineStart
        lineEnd = conceptIndex.location.lineEnd
        codeSnippet = conceptIndex.codeSnippet
        gitUrl = conceptIndex.location.gitUrl
        description = conceptIndex.description
        gitCommitHash = conceptIndex.gitCommitHash
    }

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
