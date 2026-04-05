package com.kgd.codedictionary.infrastructure.opensearch.adapter

import com.kgd.codedictionary.application.search.port.ConceptSearchPort
import com.kgd.codedictionary.application.search.port.SearchHit
import com.kgd.codedictionary.application.search.port.SearchResponse
import org.opensearch.client.json.JsonData
import org.opensearch.client.opensearch.OpenSearchClient
import org.opensearch.client.opensearch._types.query_dsl.Query
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component

@Component
class ConceptSearchAdapter(
    private val openSearchClient: OpenSearchClient,
    @Value("\${opensearch.index-name:concept-index}") private val indexName: String
) : ConceptSearchPort {

    private val log = LoggerFactory.getLogger(ConceptSearchAdapter::class.java)

    override fun search(query: String, category: String?, level: String?, from: Int, size: Int): SearchResponse {
        val filters = mutableListOf<Query>()

        if (category != null) {
            filters.add(
                Query.of { q ->
                    q.term { t ->
                        t.field("category")
                            .value { v -> v.stringValue(category) }
                    }
                }
            )
        }

        if (level != null) {
            filters.add(
                Query.of { q ->
                    q.term { t ->
                        t.field("level")
                            .value { v -> v.stringValue(level) }
                    }
                }
            )
        }

        val response = openSearchClient.search({ s ->
            s.index(indexName)
                .query { q ->
                    q.bool { b ->
                        b.must { m ->
                            m.multiMatch { mm ->
                                mm.query(query)
                                    .fields(
                                        listOf(
                                            "concept_name^3",
                                            "synonyms^2",
                                            "description",
                                            "code_snippet"
                                        )
                                    )
                            }
                        }
                        .filter(filters)
                    }
                }
                .from(from)
                .size(size)
        }, JsonData::class.java)

        val hits = response.hits().hits().map { hit ->
            val source = hit.source()
            val sourceMap = if (source != null) {
                @Suppress("UNCHECKED_CAST")
                source.to(Map::class.java) as Map<String, Any?>
            } else {
                emptyMap()
            }

            SearchHit(
                conceptId = sourceMap["concept_id"]?.toString() ?: "",
                conceptName = sourceMap["concept_name"]?.toString() ?: "",
                category = sourceMap["category"]?.toString() ?: "",
                level = sourceMap["level"]?.toString() ?: "",
                filePath = sourceMap["file_path"]?.toString(),
                lineStart = (sourceMap["line_start"] as? Number)?.toInt(),
                lineEnd = (sourceMap["line_end"] as? Number)?.toInt(),
                codeSnippet = sourceMap["code_snippet"]?.toString(),
                gitUrl = sourceMap["git_url"]?.toString(),
                description = sourceMap["description"]?.toString(),
                score = hit.score()?.toFloat() ?: 0f
            )
        }

        val totalHits = response.hits().total()?.value() ?: 0L
        val maxScore = response.hits().maxScore()?.toFloat()

        log.debug("Search for '{}' returned {} hits (total: {})", query, hits.size, totalHits)

        return SearchResponse(
            hits = hits,
            totalHits = totalHits,
            maxScore = maxScore
        )
    }
}
