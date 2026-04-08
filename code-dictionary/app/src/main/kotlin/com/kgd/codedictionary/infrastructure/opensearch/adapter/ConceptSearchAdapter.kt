package com.kgd.codedictionary.infrastructure.opensearch.adapter

import com.kgd.codedictionary.application.search.port.ConceptSearchPort
import com.kgd.codedictionary.application.search.port.SearchHit
import com.kgd.codedictionary.application.search.port.SearchResponse
import com.kgd.codedictionary.application.search.port.SuggestHit
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
        }, ConceptDocument::class.java)

        val hits = response.hits().hits().map { hit ->
            val doc = hit.source() ?: ConceptDocument()

            SearchHit(
                conceptId = doc.conceptId ?: "",
                conceptName = doc.conceptName ?: "",
                category = doc.category ?: "",
                level = doc.level ?: "",
                filePath = doc.filePath,
                lineStart = doc.lineStart,
                lineEnd = doc.lineEnd,
                codeSnippet = doc.codeSnippet,
                gitUrl = doc.gitUrl,
                description = doc.description,
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
        }, ConceptDocument::class.java)

        val seen = mutableSetOf<String>()
        return response.hits().hits().mapNotNull { hit ->
            val doc = hit.source() ?: return@mapNotNull null
            val conceptId = doc.conceptId ?: return@mapNotNull null
            if (!seen.add(conceptId)) return@mapNotNull null

            SuggestHit(
                conceptId = conceptId,
                conceptName = doc.conceptName ?: "",
                category = doc.category ?: "",
                level = doc.level ?: "",
                description = doc.description
            )
        }.take(size)
    }
}
