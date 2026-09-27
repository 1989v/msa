package com.kgd.codedictionary.infrastructure.opensearch.adapter

import org.opensearch.client.opensearch.OpenSearchClient
import org.opensearch.client.opensearch._types.query_dsl.Query
import org.opensearch.client.json.JsonData
import com.kgd.codedictionary.application.search.port.ConceptSearchPort
import com.kgd.codedictionary.application.search.port.SearchHit
import com.kgd.codedictionary.application.search.port.SearchResponse
import com.kgd.codedictionary.application.search.port.SuggestHit
import io.github.oshai.kotlinlogging.KotlinLogging
import jakarta.json.JsonNumber
import jakarta.json.JsonString
import jakarta.json.JsonValue
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component

@Component
class ConceptSearchAdapter(
    private val openSearchClient: OpenSearchClient,
    @Value("\${opensearch.index-name:concept-index}") private val indexName: String
) : ConceptSearchPort {

    private val log = KotlinLogging.logger {}

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
                conceptId = jsonText(sourceMap["concept_id"]) ?: "",
                conceptName = jsonText(sourceMap["concept_name"]) ?: "",
                category = jsonText(sourceMap["category"]) ?: "",
                level = jsonText(sourceMap["level"]) ?: "",
                filePath = jsonText(sourceMap["file_path"]),
                lineStart = jsonInt(sourceMap["line_start"]),
                lineEnd = jsonInt(sourceMap["line_end"]),
                codeSnippet = jsonText(sourceMap["code_snippet"]),
                gitUrl = jsonText(sourceMap["git_url"]),
                description = jsonText(sourceMap["description"]),
                score = hit.score()?.toFloat() ?: 0f
            )
        }

        val totalHits = response.hits().total()?.value() ?: 0L
        val maxScore = response.hits().maxScore()?.toFloat()

        log.debug { "Search for '$query' returned ${hits.size} hits (total: $totalHits)" }

        return SearchResponse(
            hits = hits,
            totalHits = totalHits,
            maxScore = maxScore
        )
    }

    override fun suggest(query: String, size: Int): List<SuggestHit> {
        val response = openSearchClient.search({ s ->
            s.index(indexName)
                .query { q ->
                    q.bool { b ->
                        b.should(listOf(
                            Query.of { qq ->
                                qq.multiMatch { mm ->
                                    mm.query(query)
                                        .fields(listOf(
                                            "concept_name.autocomplete^3",
                                            "concept_name^2",
                                            "description.autocomplete",
                                            "description",
                                            "category"
                                        ))
                                }
                            }
                        ))
                        .minimumShouldMatch("1")
                    }
                }
                .size(size * 3)
                .source { src ->
                    src.filter { f ->
                        f.includes(listOf("concept_id", "concept_name", "category", "level", "description"))
                    }
                }
        }, JsonData::class.java)

        val seen = mutableSetOf<String>()
        return response.hits().hits().mapNotNull { hit ->
            val sourceMap = hit.source()?.let {
                @Suppress("UNCHECKED_CAST")
                it.to(Map::class.java) as Map<String, Any?>
            } ?: return@mapNotNull null

            val conceptId = jsonText(sourceMap["concept_id"]) ?: return@mapNotNull null
            if (!seen.add(conceptId)) return@mapNotNull null

            SuggestHit(
                conceptId = conceptId,
                conceptName = jsonText(sourceMap["concept_name"]) ?: "",
                category = jsonText(sourceMap["category"]) ?: "",
                level = jsonText(sourceMap["level"]) ?: "",
                description = jsonText(sourceMap["description"])
            )
        }.take(size)
    }
}

/**
 * `JsonData.to(Map)` 은 값을 JSON-P 객체로 남긴다 — `toString()` 으로 꺼내면 문자열에 따옴표가 한 겹 더 붙고
 * (`"\"lattice-viterbi\""`), JSON null 은 `"null"` 이라는 글자가 되며, 숫자는 [Number] 가 아니라 늘 null 로 떨어진다.
 */
internal fun jsonText(v: Any?): String? = when (v) {
    null, JsonValue.NULL -> null
    is JsonString -> v.string
    else -> v.toString()
}

internal fun jsonInt(v: Any?): Int? = when (v) {
    is JsonNumber -> v.intValue()
    is Number -> v.toInt()
    else -> null
}
