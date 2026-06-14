package com.kgd.codedictionary.infrastructure.opensearch.adapter

import io.github.oshai.kotlinlogging.KotlinLogging
import org.opensearch.client.opensearch.OpenSearchClient
import org.opensearch.client.opensearch._types.analysis.Analyzer
import org.opensearch.client.opensearch._types.analysis.CustomAnalyzer
import org.opensearch.client.opensearch._types.analysis.EdgeNGramTokenizer
import org.opensearch.client.opensearch._types.analysis.NoriDecompoundMode
import org.opensearch.client.opensearch._types.analysis.NoriPartOfSpeechTokenFilter
import org.opensearch.client.opensearch._types.analysis.NoriTokenizer
import org.opensearch.client.opensearch._types.analysis.TokenChar
import org.opensearch.client.opensearch._types.analysis.TokenFilter
import org.opensearch.client.opensearch._types.analysis.TokenFilterDefinition
import org.opensearch.client.opensearch._types.analysis.Tokenizer
import org.opensearch.client.opensearch._types.analysis.TokenizerDefinition
import org.opensearch.client.opensearch._types.mapping.Property
import org.springframework.stereotype.Component
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter

@Component
class IndexAliasManager(
    private val openSearchClient: OpenSearchClient
) {
    private val log = KotlinLogging.logger {}
    private val timestampFormatter = DateTimeFormatter.ofPattern("yyyyMMddHHmmss")

    fun createTimestampedIndexName(alias: String): String =
        "${alias}_${LocalDateTime.now().format(timestampFormatter)}"

    fun createIndex(indexName: String) {
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
                        .tokenizer(
                            "edge_ngram_tokenizer",
                            Tokenizer.of { t ->
                                t.definition(
                                    TokenizerDefinition.of { d ->
                                        d.edgeNgram(
                                            EdgeNGramTokenizer.of { e ->
                                                e.minGram(1).maxGram(20).tokenChars(
                                                    listOf(TokenChar.Letter, TokenChar.Digit)
                                                )
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
                                                n.stoptags(
                                                    listOf(
                                                        "E", "IC", "J", "MAG", "MAJ",
                                                        "MM", "SP", "SSC", "SSO", "SC",
                                                        "SE", "XPN", "XSA", "XSN", "XSV",
                                                        "UNA", "NA", "VSV"
                                                    )
                                                )
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
                        .analyzer(
                            "autocomplete_analyzer",
                            Analyzer.of { an ->
                                an.custom(
                                    CustomAnalyzer.of { ca ->
                                        ca.tokenizer("edge_ngram_tokenizer")
                                            .filter(listOf("lowercase"))
                                    }
                                )
                            }
                        )
                        .analyzer(
                            "autocomplete_search_analyzer",
                            Analyzer.of { an ->
                                an.custom(
                                    CustomAnalyzer.of { ca ->
                                        ca.tokenizer("standard")
                                            .filter(listOf("lowercase"))
                                    }
                                )
                            }
                        )
                    }
                }
                .mappings { m ->
                    m.properties("concept_id", Property.of { p -> p.keyword { k -> k } })
                        .properties("concept_name", Property.of { p ->
                            p.text { t ->
                                t.analyzer("concept_analyzer")
                                    .searchAnalyzer("concept_search_analyzer")
                                    .fields("autocomplete", Property.of { sub ->
                                        sub.text { st ->
                                            st.analyzer("autocomplete_analyzer")
                                                .searchAnalyzer("autocomplete_search_analyzer")
                                        }
                                    })
                            }
                        })
                        .properties("synonyms", Property.of { p ->
                            p.text { t -> t.analyzer("concept_analyzer").searchAnalyzer("concept_search_analyzer") }
                        })
                        .properties("category", Property.of { p -> p.keyword { k -> k } })
                        .properties("level", Property.of { p -> p.keyword { k -> k } })
                        .properties("file_path", Property.of { p -> p.keyword { k -> k } })
                        .properties("line_start", Property.of { p -> p.integer { i -> i } })
                        .properties("line_end", Property.of { p -> p.integer { i -> i } })
                        .properties("code_snippet", Property.of { p -> p.text { t -> t } })
                        .properties("git_url", Property.of { p -> p.keyword { k -> k } })
                        .properties("description", Property.of { p ->
                            p.text { t ->
                                t.analyzer("concept_analyzer")
                                    .searchAnalyzer("concept_search_analyzer")
                                    .fields("autocomplete", Property.of { sub ->
                                        sub.text { st ->
                                            st.analyzer("autocomplete_analyzer")
                                                .searchAnalyzer("autocomplete_search_analyzer")
                                        }
                                    })
                            }
                        })
                        .properties("indexed_at", Property.of { p -> p.date { d -> d } })
                }
        }
        log.info { "Created index: $indexName" }
    }

    /**
     * alias를 newIndexName으로 atomic 교체하고, 옛 인덱스 중 maxRetention 초과분을 삭제.
     */
    fun swapAlias(alias: String, newIndexName: String, maxRetention: Int = 2) {
        val aliasedIndices = getIndicesForAlias(alias)

        openSearchClient.indices().updateAliases { req ->
            // opensearch-java client: actions(lambda) 는 단건 액션을 만들기 때문에
            // 여러 액션을 등록하려면 매 액션마다 .actions{} 를 별도 호출해야 함
            aliasedIndices.forEach { oldIndex ->
                req.actions { a -> a.remove { r -> r.index(oldIndex).alias(alias) } }
            }
            req.actions { a -> a.add { ad -> ad.index(newIndexName).alias(alias) } }
            req
        }
        log.info { "Alias '$alias' → '$newIndexName' (removed ${aliasedIndices.size} old)" }

        // 이름 prefix 로 모든 timestamped 인덱스를 스캔 → 최신 maxRetention 개만 보관, 나머지 삭제
        val allTimestamped = listIndicesByPrefix("${alias}_")
        allTimestamped
            .sortedDescending()
            .drop(maxRetention)
            .forEach { oldIndex ->
                openSearchClient.indices().delete { d -> d.index(oldIndex) }
                log.info { "Deleted old index: $oldIndex" }
            }
    }

    private fun getIndicesForAlias(alias: String): List<String> =
        runCatching {
            // opensearch-java: GetAliasResponse 는 DictionaryResponse — aliases() 대신 result()
            openSearchClient.indices().getAlias { it.name(alias) }.result().keys.toList()
        }.getOrElse { emptyList() }

    private fun listIndicesByPrefix(prefix: String): List<String> =
        runCatching {
            // opensearch-java: GetIndexResponse 도 DictionaryResponse — indices() 대신 result()
            openSearchClient.indices().get { it.index("${prefix}*") }.result().keys.toList()
        }.getOrElse { emptyList() }
}
