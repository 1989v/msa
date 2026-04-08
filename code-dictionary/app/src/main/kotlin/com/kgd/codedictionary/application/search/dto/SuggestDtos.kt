package com.kgd.codedictionary.application.search.dto

data class SuggestCommand(
    val query: String,
    val size: Int = 8
)

data class SuggestItemDto(
    val conceptId: String,
    val name: String,
    val category: String,
    val level: String,
    val description: String
)
