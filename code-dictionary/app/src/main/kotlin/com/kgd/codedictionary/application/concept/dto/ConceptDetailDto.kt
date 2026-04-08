package com.kgd.codedictionary.application.concept.dto

data class ConceptDetailDto(
    val id: Long,
    val conceptId: String,
    val name: String,
    val category: String,
    val level: String,
    val description: String,
    val synonyms: List<String>,
    val codeSnippets: List<CodeSnippetInfoDto>,
    val relatedConcepts: List<RelatedConceptInfoDto>
)

data class CodeSnippetInfoDto(
    val filePath: String,
    val lineStart: Int,
    val lineEnd: Int,
    val codeSnippet: String?,
    val gitUrl: String?,
    val description: String?
)

data class RelatedConceptInfoDto(
    val conceptId: String,
    val name: String,
    val category: String
)
