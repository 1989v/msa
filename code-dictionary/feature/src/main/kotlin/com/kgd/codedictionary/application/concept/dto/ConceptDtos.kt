package com.kgd.codedictionary.application.concept.dto

import com.kgd.codedictionary.domain.concept.model.ConceptCategory
import com.kgd.codedictionary.domain.concept.model.ConceptLevel

data class CreateConceptCommand(
    val conceptId: String,
    val name: String,
    val category: ConceptCategory,
    val level: ConceptLevel,
    val description: String,
    val synonyms: List<String> = emptyList()
)

data class UpdateConceptCommand(
    val name: String? = null,
    val category: ConceptCategory? = null,
    val level: ConceptLevel? = null,
    val description: String? = null,
    val synonyms: List<String>? = null
)

data class ConceptResultDto(
    val id: Long,
    val conceptId: String,
    val name: String,
    val category: String,
    val level: String,
    val description: String,
    val synonyms: List<String>
)
