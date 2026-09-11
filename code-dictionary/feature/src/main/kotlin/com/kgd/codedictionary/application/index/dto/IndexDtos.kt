package com.kgd.codedictionary.application.index.dto

data class CreateIndexCommand(
    val conceptId: String,
    val filePath: String,
    val lineStart: Int,
    val lineEnd: Int,
    val codeSnippet: String? = null,
    val gitUrl: String? = null,
    val description: String? = null,
    val gitCommitHash: String? = null
)

data class IndexResultDto(
    val id: Long,
    val conceptId: String,
    val filePath: String,
    val lineStart: Int,
    val lineEnd: Int,
    val codeSnippet: String?,
    val gitUrl: String?,
    val description: String?,
    val indexedAt: String
)

data class IndexStatusDto(
    val totalIndexed: Long
)
