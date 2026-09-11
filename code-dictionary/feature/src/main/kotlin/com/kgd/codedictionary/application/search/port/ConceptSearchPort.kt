package com.kgd.codedictionary.application.search.port

data class SearchHit(
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

data class SearchResponse(
    val hits: List<SearchHit>,
    val totalHits: Long,
    val maxScore: Float?
)

data class SuggestHit(
    val conceptId: String,
    val conceptName: String,
    val category: String,
    val level: String,
    val description: String?
)

interface ConceptSearchPort {
    fun search(query: String, category: String?, level: String?, from: Int, size: Int): SearchResponse
    fun suggest(query: String, size: Int): List<SuggestHit>
}
