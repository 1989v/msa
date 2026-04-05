package com.kgd.codedictionary.domain.index.model

import java.time.LocalDateTime

class ConceptIndex private constructor(
    val id: Long? = null,
    val conceptId: String,
    val location: CodeLocation,
    val codeSnippet: String? = null,
    val description: String? = null,
    val gitCommitHash: String? = null,
    val indexedAt: LocalDateTime
) {
    companion object {
        fun create(
            conceptId: String,
            location: CodeLocation,
            codeSnippet: String? = null,
            description: String? = null,
            gitCommitHash: String? = null
        ): ConceptIndex {
            require(conceptId.isNotBlank()) { "conceptId는 비어있을 수 없습니다" }
            return ConceptIndex(
                conceptId = conceptId,
                location = location,
                codeSnippet = codeSnippet,
                description = description,
                gitCommitHash = gitCommitHash,
                indexedAt = LocalDateTime.now()
            )
        }

        fun restore(
            id: Long?,
            conceptId: String,
            location: CodeLocation,
            codeSnippet: String?,
            description: String?,
            gitCommitHash: String?,
            indexedAt: LocalDateTime
        ): ConceptIndex = ConceptIndex(
            id = id,
            conceptId = conceptId,
            location = location,
            codeSnippet = codeSnippet,
            description = description,
            gitCommitHash = gitCommitHash,
            indexedAt = indexedAt
        )
    }
}
