package com.kgd.codedictionary.application.search.dto

data class SearchCommand(
    val query: String,
    val category: String? = null,
    val level: String? = null,
    val page: Int = 0,
    val size: Int = 20
)

data class SearchResultDto(
    val hits: List<SearchHitDto>,
    val totalHits: Long,
    val maxScore: Float?
)

data class SearchHitDto(
    val conceptId: String,
    val conceptName: String,
    val category: String,
    val level: String,
    val filePath: String?,
    val lineStart: Int?,
    val lineEnd: Int?,
    val codeSnippet: String?,
    val gitUrl: String?,
    val description: String?,
    val score: Float
)
