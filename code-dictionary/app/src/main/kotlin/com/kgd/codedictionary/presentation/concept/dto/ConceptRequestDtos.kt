package com.kgd.codedictionary.presentation.concept.dto

import com.kgd.codedictionary.application.concept.dto.CreateConceptCommand
import com.kgd.codedictionary.application.concept.dto.UpdateConceptCommand
import com.kgd.codedictionary.domain.concept.model.ConceptCategory
import com.kgd.codedictionary.domain.concept.model.ConceptLevel

data class ConceptCreateRequest(
    val conceptId: String,
    val name: String,
    val category: String,
    val level: String,
    val description: String,
    val synonyms: List<String> = emptyList()
) {
    fun toCommand(): CreateConceptCommand = CreateConceptCommand(
        conceptId = conceptId,
        name = name,
        category = ConceptCategory.valueOf(category.uppercase()),
        level = ConceptLevel.valueOf(level.uppercase()),
        description = description,
        synonyms = synonyms
    )
}

data class ConceptUpdateRequest(
    val name: String? = null,
    val category: String? = null,
    val level: String? = null,
    val description: String? = null,
    val synonyms: List<String>? = null
) {
    fun toCommand(): UpdateConceptCommand = UpdateConceptCommand(
        name = name,
        category = category?.let { ConceptCategory.valueOf(it.uppercase()) },
        level = level?.let { ConceptLevel.valueOf(it.uppercase()) },
        description = description,
        synonyms = synonyms
    )
}
