package com.kgd.codedictionary.domain.concept.model

class Concept private constructor(
    val id: Long? = null,
    val conceptId: String,
    var name: String,
    var category: ConceptCategory,
    var level: ConceptLevel,
    var description: String,
    var synonyms: List<String>,
    var relatedConceptIds: List<String>
) {
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
            relatedConceptIds: List<String>
        ): Concept = Concept(
            id = id,
            conceptId = conceptId,
            name = name,
            category = category,
            level = level,
            description = description,
            synonyms = synonyms,
            relatedConceptIds = relatedConceptIds
        )
    }

    fun update(
        name: String? = null,
        category: ConceptCategory? = null,
        level: ConceptLevel? = null,
        description: String? = null
    ) {
        name?.let {
            require(it.isNotBlank()) { "name은 비어있을 수 없습니다" }
            this.name = it
        }
        category?.let { this.category = it }
        level?.let { this.level = it }
        description?.let { this.description = it }
    }

    fun updateSynonyms(synonyms: List<String>) {
        this.synonyms = synonyms
    }

    fun updateDescription(description: String) {
        this.description = description
    }
}
