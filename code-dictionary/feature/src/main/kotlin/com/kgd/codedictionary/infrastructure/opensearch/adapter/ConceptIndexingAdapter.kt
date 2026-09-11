package com.kgd.codedictionary.infrastructure.opensearch.adapter

import org.opensearch.client.opensearch.OpenSearchClient
import org.opensearch.client.opensearch._types.analysis.Analyzer
import org.opensearch.client.opensearch._types.analysis.CustomAnalyzer
import org.opensearch.client.opensearch._types.analysis.SynonymGraphTokenFilter
import org.opensearch.client.opensearch._types.analysis.TokenFilter
import org.opensearch.client.opensearch._types.analysis.TokenFilterDefinition
import org.opensearch.client.opensearch.core.bulk.BulkOperation
import com.kgd.codedictionary.application.search.port.ConceptIndexingPort
import com.kgd.codedictionary.domain.concept.model.Concept
import com.kgd.codedictionary.domain.index.model.ConceptIndex
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component
import java.time.format.DateTimeFormatter

@Component
class ConceptIndexingAdapter(
    private val openSearchClient: OpenSearchClient,
    @Value("\${opensearch.index-name:concept-index}") private val aliasName: String
) : ConceptIndexingPort {

    private val log = KotlinLogging.logger {}

    override fun indexConceptIndex(concept: Concept, conceptIndex: ConceptIndex) {
        val document = buildDocument(concept, conceptIndex)
        openSearchClient.index { i ->
            i.index(aliasName)
                .id(docId(concept, conceptIndex))
                .document(document)
        }
        log.debug { "Indexed concept '${concept.conceptId}' at '${conceptIndex.location.filePath}'" }
    }

    override fun deleteByConceptId(conceptId: String) {
        openSearchClient.deleteByQuery { d ->
            d.index(aliasName)
                .query { q ->
                    q.term { t ->
                        t.field("concept_id").value { v -> v.stringValue(conceptId) }
                    }
                }
        }
        log.info { "Deleted documents for conceptId '$conceptId'" }
    }

    override fun bulkIndex(targetIndex: String, entries: List<Pair<Concept, ConceptIndex>>) {
        if (entries.isEmpty()) return

        val operations = entries.map { (concept, conceptIndex) ->
            val document = buildDocument(concept, conceptIndex)
            BulkOperation.of { op ->
                op.index<Map<String, Any?>> { idx ->
                    idx.index(targetIndex)
                        .id(docId(concept, conceptIndex))
                        .document(document)
                }
            }
        }

        val response = openSearchClient.bulk { b ->
            b.index(targetIndex).operations(operations)
        }

        if (response.errors()) {
            val errorItems = response.items().filter { it.error() != null }
            log.error { "Bulk indexing had ${errorItems.size} errors out of ${entries.size} (index=$targetIndex)" }
            errorItems.take(5).forEach { item ->
                log.error { "  error: id=${item.id()}, reason=${item.error()?.reason()}" }
            }
        } else {
            log.info { "Bulk indexed ${entries.size} docs into '$targetIndex'" }
        }
    }

    override fun updateSynonyms(targetIndex: String, synonymMap: Map<String, List<String>>) {
        if (synonymMap.isEmpty()) return

        val synonymRules = synonymMap.entries
            .map { (_, synonyms) -> synonyms.joinToString(", ") }
            .filter { it.contains(",") }

        if (synonymRules.isEmpty()) {
            log.info { "No valid synonym rules to update on '$targetIndex', skipping" }
            return
        }

        openSearchClient.indices().close { c -> c.index(targetIndex) }
        try {
            openSearchClient.indices().putSettings { s ->
                s.index(targetIndex)
                    .settings { settings ->
                        settings.analysis { a ->
                            a.filter(
                                "concept_synonym",
                                TokenFilter.of { tf ->
                                    tf.definition(
                                        TokenFilterDefinition.of { tfd ->
                                            tfd.synonymGraph(
                                                SynonymGraphTokenFilter.of { sg ->
                                                    sg.synonyms(synonymRules).lenient(true)
                                                }
                                            )
                                        }
                                    )
                                }
                            ).analyzer(
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
            log.info { "Updated synonym filter on '$targetIndex' with ${synonymRules.size} rules" }
        } catch (e: Exception) {
            log.warn { "Failed to update synonyms on '$targetIndex': ${e.message}" }
        } finally {
            openSearchClient.indices().open { o -> o.index(targetIndex) }
        }
    }

    private fun docId(concept: Concept, conceptIndex: ConceptIndex): String =
        "${concept.conceptId}_${conceptIndex.id ?: conceptIndex.location.filePath}_${conceptIndex.location.lineStart}"

    private fun buildDocument(concept: Concept, conceptIndex: ConceptIndex): Map<String, Any?> = mapOf(
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
