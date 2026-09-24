package com.kgd.codedictionary.domain.concept.model

import com.kgd.codedictionary.domain.concept.exception.ManagedConceptException

class Concept private constructor(
    val id: Long? = null,
    val conceptId: String,
    var name: String,
    var category: ConceptCategory,
    var level: ConceptLevel,
    var description: String,
    var synonyms: List<String>,
    var relatedConceptIds: List<String>,
    /** 역할 축. 온톨로지 로더만 쓴다 — null 이면 아직 어느 파일에도 놓이지 않은 개념 */
    val kind: ConceptKind? = null,
    /** 이 개념을 관리하는 온톨로지 파일의 도메인. 있으면 어드민 수정·삭제를 받지 않는다 */
    val managedBy: String? = null,
) {
    val isManaged: Boolean get() = managedBy != null

    companion object {
        fun create(
            conceptId: String,
            name: String,
            category: ConceptCategory,
            level: ConceptLevel,
            description: String,
            synonyms: List<String> = emptyList(),
            relatedConceptIds: List<String> = emptyList()
        ): Concept {
            require(conceptId.isNotBlank()) { "conceptId는 비어있을 수 없습니다" }
            require(name.isNotBlank()) { "name은 비어있을 수 없습니다" }
            return Concept(
                conceptId = conceptId,
                name = name,
                category = category,
                level = level,
                description = description,
                synonyms = synonyms,
                relatedConceptIds = relatedConceptIds
            )
        }

        fun restore(
            id: Long?,
            conceptId: String,
            name: String,
            category: ConceptCategory,
            level: ConceptLevel,
            description: String,
            synonyms: List<String>,
            relatedConceptIds: List<String>,
            kind: ConceptKind? = null,
            managedBy: String? = null,
        ): Concept = Concept(
            id = id,
            conceptId = conceptId,
            name = name,
            category = category,
            level = level,
            description = description,
            synonyms = synonyms,
            relatedConceptIds = relatedConceptIds,
            kind = kind,
            managedBy = managedBy,
        )
    }

    fun update(
        name: String? = null,
        category: ConceptCategory? = null,
        level: ConceptLevel? = null,
        description: String? = null
    ) {
        ensureEditable()
        name?.let {
            require(it.isNotBlank()) { "name은 비어있을 수 없습니다" }
            this.name = it
        }
        category?.let { this.category = it }
        level?.let { this.level = it }
        description?.let { this.description = it }
    }

    fun updateSynonyms(synonyms: List<String>) {
        ensureEditable()
        this.synonyms = synonyms
    }

    fun updateDescription(description: String) {
        ensureEditable()
        this.description = description
    }

    /** 관리 개념은 파일이 원본이라 어드민 수정·삭제를 받지 않는다 */
    fun ensureEditable() {
        managedBy?.let { throw ManagedConceptException(conceptId, it) }
    }
}
