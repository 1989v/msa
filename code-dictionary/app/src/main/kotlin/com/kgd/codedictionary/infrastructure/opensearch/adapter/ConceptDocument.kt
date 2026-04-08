package com.kgd.codedictionary.infrastructure.opensearch.adapter

import com.fasterxml.jackson.annotation.JsonIgnoreProperties
import com.fasterxml.jackson.annotation.JsonProperty

@JsonIgnoreProperties(ignoreUnknown = true)
data class ConceptDocument(
    @JsonProperty("concept_id") val conceptId: String? = null,
    @JsonProperty("concept_name") val conceptName: String? = null,
    @JsonProperty("synonyms") val synonyms: String? = null,
    @JsonProperty("category") val category: String? = null,
    @JsonProperty("level") val level: String? = null,
    @JsonProperty("file_path") val filePath: String? = null,
    @JsonProperty("line_start") val lineStart: Int? = null,
    @JsonProperty("line_end") val lineEnd: Int? = null,
    @JsonProperty("code_snippet") val codeSnippet: String? = null,
    @JsonProperty("git_url") val gitUrl: String? = null,
    @JsonProperty("description") val description: String? = null,
    @JsonProperty("indexed_at") val indexedAt: String? = null
)
