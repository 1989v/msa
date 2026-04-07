package com.kgd.codedictionary.infrastructure.opensearch.adapter

import com.kgd.codedictionary.application.search.port.ConceptIndexingPort
import com.kgd.codedictionary.domain.concept.model.Concept
import com.kgd.codedictionary.domain.index.model.ConceptIndex
import org.opensearch.client.opensearch.OpenSearchClient
import org.opensearch.client.opensearch._types.analysis.Analyzer
import org.opensearch.client.opensearch._types.analysis.CustomAnalyzer
import org.opensearch.client.opensearch._types.analysis.NoriDecompoundMode
import org.opensearch.client.opensearch._types.analysis.NoriTokenizer
import org.opensearch.client.opensearch._types.analysis.NoriPartOfSpeechTokenFilter
import org.opensearch.client.opensearch._types.analysis.SynonymGraphTokenFilter
import org.opensearch.client.opensearch._types.analysis.TokenFilter
import org.opensearch.client.opensearch._types.analysis.TokenFilterDefinition
import org.opensearch.client.opensearch._types.analysis.Tokenizer
import org.opensearch.client.opensearch._types.analysis.TokenizerDefinition
import org.opensearch.client.opensearch._types.mapping.Property
import org.opensearch.client.opensearch.core.bulk.BulkOperation
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component
import java.time.format.DateTimeFormatter

@Component
class ConceptIndexingAdapter(
    private val openSearchClient: OpenSearchClient,
    @Value("\${opensearch.index-name:concept-index}") private val indexName: String
) : ConceptIndexingPort {

    private val log = LoggerFactory.getLogger(ConceptIndexingAdapter::class.java)

    override fun createOrUpdateIndex() {
        val indexExists = openSearchClient.indices().exists { e -> e.index(indexName) }.value()

        if (indexExists) {
            log.info("Index '{}' already exists, skipping creation", indexName)
            return
        }

        openSearchClient.indices().create { c ->
            c.index(indexName)
                .settings { s ->
                    s.analysis { a ->
                        a.tokenizer(
                            "nori_mixed",
                            Tokenizer.of { t ->
                                t.definition(
                                    TokenizerDefinition.of { d ->
                                        d.noriTokenizer(
                                            NoriTokenizer.of { n ->
                                                n.decompoundMode(NoriDecompoundMode.Mixed)
                                            }
                                        )
                                    }
                                )
                            }
                        )
                        .filter(
                            "nori_pos_filter",
                            TokenFilter.of { tf ->
                                tf.definition(
                                    TokenFilterDefinition.of { tfd ->
                                        tfd.noriPartOfSpeech(
                                            NoriPartOfSpeechTokenFilter.of { n ->
                                                n.stoptags(listOf(
                                                    "E", "IC", "J", "MAG", "MAJ",
                                                    "MM", "SP", "SSC", "SSO", "SC",
                                                    "SE", "XPN", "XSA", "XSN", "XSV",
                                                    "UNA", "NA", "VSV"
                                                ))
                                            }
                                        )
                                    }
                                )
                            }
                        )
                        .analyzer(
                            "concept_analyzer",
                            Analyzer.of { an ->
                                an.custom(
                                    CustomAnalyzer.of { ca ->
                                        ca.tokenizer("nori_mixed")
                                            .filter(listOf("lowercase", "nori_pos_filter"))
                                    }
                                )
                            }
                        )
                        .analyzer(
                            "concept_search_analyzer",
                            Analyzer.of { an ->
                                an.custom(
                                    CustomAnalyzer.of { ca ->
                                        ca.tokenizer("nori_mixed")
                                            .filter(listOf("lowercase", "nori_pos_filter"))
                                    }
                                )
                            }
                        )
                    }
                }
                .mappings { m ->
                    m.properties("concept_id", Property.of { p -> p.keyword { k -> k } })
                        .properties("concept_name", Property.of { p -> p.text { t -> t.analyzer("concept_analyzer").searchAnalyzer("concept_search_analyzer") } })
                        .properties("synonyms", Property.of { p -> p.text { t -> t.analyzer("concept_analyzer").searchAnalyzer("concept_search_analyzer") } })
                        .properties("category", Property.of { p -> p.keyword { k -> k } })
                        .properties("level", Property.of { p -> p.keyword { k -> k } })
                        .properties("file_path", Property.of { p -> p.keyword { k -> k } })
                        .properties("line_start", Property.of { p -> p.integer { i -> i } })
                        .properties("line_end", Property.of { p -> p.integer { i -> i } })
                        .properties("code_snippet", Property.of { p -> p.text { t -> t } })
                        .properties("git_url", Property.of { p -> p.keyword { k -> k } })
                        .properties("description", Property.of { p -> p.text { t -> t.analyzer("concept_analyzer").searchAnalyzer("concept_search_analyzer") } })
                        .properties("indexed_at", Property.of { p -> p.date { d -> d } })
                }
        }

        log.info("Index '{}' created successfully", indexName)
    }

    override fun indexConceptIndex(concept: Concept, conceptIndex: ConceptIndex) {
        val document = buildDocument(concept, conceptIndex)

        openSearchClient.index { i ->
            i.index(indexName)
                .id("${concept.conceptId}_${conceptIndex.id ?: conceptIndex.location.filePath}_${conceptIndex.location.lineStart}")
                .document(document)
        }

        log.debug("Indexed concept '{}' at '{}'", concept.conceptId, conceptIndex.location.filePath)
    }

    override fun bulkIndex(entries: List<Pair<Concept, ConceptIndex>>) {
        if (entries.isEmpty()) return

        val operations = entries.map { (concept, conceptIndex) ->
            val document = buildDocument(concept, conceptIndex)
            val docId = "${concept.conceptId}_${conceptIndex.id ?: conceptIndex.location.filePath}_${conceptIndex.location.lineStart}"

            BulkOperation.of { op ->
                op.index<Map<String, Any?>> { idx ->
                    idx.index(indexName)
                        .id(docId)
                        .document(document)
                }
            }
        }

        val response = openSearchClient.bulk { b ->
            b.index(indexName)
                .operations(operations)
        }

        if (response.errors()) {
            val errorItems = response.items().filter { it.error() != null }
            log.error("Bulk indexing had {} errors out of {} operations", errorItems.size, entries.size)
            errorItems.forEach { item ->
                log.error("Bulk error: index={}, id={}, error={}", item.index(), item.id(), item.error()?.reason())
            }
        } else {
            log.info("Bulk indexed {} documents successfully", entries.size)
        }
    }

    override fun deleteByConceptId(conceptId: String) {
        openSearchClient.deleteByQuery { d ->
            d.index(indexName)
                .query { q ->
                    q.term { t ->
                        t.field("concept_id")
                            .value { v -> v.stringValue(conceptId) }
                    }
                }
        }

        log.info("Deleted documents for conceptId '{}'", conceptId)
    }

    override fun updateSynonyms(synonymMap: Map<String, List<String>>) {
        if (synonymMap.isEmpty()) return

        val synonymRules = synonymMap.entries
            .map { (_, synonyms) -> synonyms.joinToString(", ") }
            .filter { it.contains(",") }

        if (synonymRules.isEmpty()) {
            log.info("No valid synonym rules to update, skipping")
            return
        }

        openSearchClient.indices().close { c -> c.index(indexName) }

        try {
            openSearchClient.indices().putSettings { s ->
                s.index(indexName)
                    .settings { settings ->
                        settings.analysis { a ->
                            a.filter(
                                "concept_synonym",
                                TokenFilter.of { tf ->
                                    tf.definition(
                                        TokenFilterDefinition.of { tfd ->
                                            tfd.synonymGraph(
                                                SynonymGraphTokenFilter.of { sg ->
                                                    sg.synonyms(synonymRules)
                                                        .lenient(true)
                                                }
                                            )
                                        }
                                    )
                                }
                            )
                            .analyzer(
                                "concept_search_analyzer",
                                Analyzer.of { an ->
                                    an.custom(
                                        CustomAnalyzer.of { ca ->
                                            ca.tokenizer("nori_mixed")
                                                .filter(listOf("lowercase", "nori_pos_filter", "concept_synonym"))
                                        }
                                    )
                                }
                            )
                        }
                    }
            }

            log.info("Updated synonym filter with {} rules", synonymRules.size)
        } catch (e: Exception) {
            log.warn("Failed to update synonyms, search will work without synonym expansion: {}", e.message)
        } finally {
            openSearchClient.indices().open { o -> o.index(indexName) }
        }
    }

    private fun buildDocument(concept: Concept, conceptIndex: ConceptIndex): Map<String, Any?> {
        return mapOf(
            "concept_id" to concept.conceptId,
            "concept_name" to concept.name,
            "synonyms" to concept.synonyms.joinToString(" "),
            "category" to concept.category.name,
            "level" to concept.level.name,
            "file_path" to conceptIndex.location.filePath,
            "line_start" to conceptIndex.location.lineStart,
            "line_end" to conceptIndex.location.lineEnd,
            "code_snippet" to conceptIndex.codeSnippet,
            "git_url" to conceptIndex.location.gitUrl,
            "description" to (conceptIndex.description ?: concept.description),
            "indexed_at" to conceptIndex.indexedAt.format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)
        )
    }
}
