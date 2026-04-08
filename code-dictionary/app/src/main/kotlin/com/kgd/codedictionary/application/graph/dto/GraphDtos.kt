package com.kgd.codedictionary.application.graph.dto

data class GraphDataDto(
    val nodes: List<GraphNodeDto>,
    val links: List<GraphLinkDto>,
    val stats: GraphStatsDto
)

data class GraphNodeDto(
    val id: String,
    val name: String,
    val category: String,
    val level: String,
    val indexCount: Int,
    val relatedCount: Int,
    val description: String?
)

data class GraphLinkDto(
    val source: String,
    val target: String,
    val type: String
)

data class GraphStatsDto(
    val totalConcepts: Int,
    val totalIndexes: Long,
    val byCategory: Map<String, Int>,
    val byLevel: Map<String, Int>,
    val matrix: Map<String, Map<String, Int>>
)
