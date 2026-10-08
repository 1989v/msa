package com.kgd.search.infrastructure.opensearch

import com.kgd.search.application.attraction.config.AttractionHybridProperties
import com.kgd.search.application.queryvector.config.QueryVectorProperties
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldContainExactlyInAnyOrder
import io.kotest.matchers.ints.shouldBeGreaterThanOrEqual
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import org.opensearch.client.json.JsonData
import org.opensearch.client.opensearch.OpenSearchClient
import org.opensearch.client.opensearch._types.aggregations.Aggregate
import org.opensearch.client.opensearch._types.aggregations.StringTermsAggregate
import org.opensearch.client.opensearch._types.aggregations.StringTermsBucket
import org.opensearch.client.opensearch.core.SearchRequest
import org.opensearch.client.opensearch.core.SearchResponse
import org.opensearch.client.opensearch.core.search.TotalHitsRelation
import tools.jackson.databind.ObjectMapper
import java.util.concurrent.CopyOnWriteArrayList

/**
 * 색인에 문서가 있는 분류 코드 — 어댑터가 내는 요청 JSON 과, 집계 응답을 읽어 낸 반환값을 본다.
 * 집계가 든 응답이 필요해 스냅샷 헬퍼(빈 응답만 준다) 대신 클라이언트 목을 따로 둔다.
 */
class AttractionSearchAdapterCategoryCodesTest : BehaviorSpec({

    val json = ObjectMapper()

    fun terms(sumOther: Long = 0, vararg buckets: StringTermsBucket): Aggregate =
        Aggregate.of { a ->
            a.sterms(
                StringTermsAggregate.of { t ->
                    t.buckets { b -> b.array(buckets.toList()) }.sumOtherDocCount(sumOther).docCountErrorUpperBound(0)
                },
            )
        }

    fun bucket(key: String, sub: Map<String, Aggregate> = emptyMap()): StringTermsBucket =
        StringTermsBucket.of { b -> b.key(key).docCount(1).aggregations(sub) }

    fun response(aggregations: Map<String, Aggregate>): SearchResponse<JsonData> =
        SearchResponse.Builder<JsonData>()
            .took(1).timedOut(false)
            .shards { s -> s.total(1).successful(1).failed(0) }
            .hits { h -> h.total { t -> t.value(0).relation(TotalHitsRelation.Eq) }.hits(emptyList()) }
            .aggregations(aggregations)
            .build()

    fun adapter(aggregations: Map<String, Aggregate>): Pair<AttractionSearchAdapter, List<SearchRequest>> {
        val client = mockk<OpenSearchClient>()
        val captured = CopyOnWriteArrayList<SearchRequest>()
        every { client.search(any<SearchRequest>(), JsonData::class.java) } answers {
            captured += firstArg<SearchRequest>()
            response(aggregations)
        }
        return AttractionSearchAdapter(
            client,
            AttractionRankingProperties(),
            AttractionHybridProperties(enabled = false),
            QueryVectorProperties(modelRef = ""),
        ) to captured
    }

    val lcls = listOf("lclsSystm1", "lclsSystm2", "lclsSystm3")

    val koEn = mapOf(
        "lang" to terms(
            0,
            bucket(
                "ko",
                mapOf(
                    "lclsSystm1" to terms(0, bucket("A")),
                    "lclsSystm2" to terms(0, bucket("B")),
                    "lclsSystm3" to terms(0, bucket("C")),
                ),
            ),
            bucket(
                "en",
                mapOf(
                    "lclsSystm1" to terms(0),
                    "lclsSystm2" to terms(0),
                    "lclsSystm3" to terms(0, bucket("D")),
                ),
            ),
        ),
    )

    given("ⓐ 버킷 크기 700 으로 물으면") {
        val (a, captured) = adapter(koEn)
        a.indexedCategoryCodes(700)
        val request = json.readTree(captured.single().toJsonString())

        then("결과 문서 없이 lang 별로 lclsSystm1~3 세 필드를 terms 집계하고, 버킷 크기가 인자 이상이다") {
            request["size"].asInt() shouldBe 0
            val byLang = request["aggregations"]["lang"]
            byLang["terms"]["field"].asString() shouldBe "lang"
            byLang["aggregations"].propertyNames().toList() shouldContainExactlyInAnyOrder lcls
            lcls.forEach { field ->
                val sub = byLang["aggregations"][field]["terms"]
                sub["field"].asString() shouldBe field
                sub["size"].asInt() shouldBeGreaterThanOrEqual 700
            }
        }
    }

    given("ⓑ ko 는 세 깊이에 하나씩, en 은 소분류 하나가 있는 응답") {
        val (a, _) = adapter(koEn)

        then("언어별로 세 깊이의 코드를 합친 집합을 돌려준다") {
            a.indexedCategoryCodes(10) shouldBe mapOf("ko" to setOf("A", "B", "C"), "en" to setOf("D"))
        }
    }

    given("ⓒ 어느 버킷이든 sum_other_doc_count > 0 이면") {
        `when`("하위 분류 집계가 잘렸으면") {
            val truncated = mapOf(
                "lang" to terms(
                    0,
                    bucket(
                        "ko",
                        mapOf(
                            "lclsSystm1" to terms(0, bucket("A")),
                            "lclsSystm2" to terms(3, bucket("B")),
                            "lclsSystm3" to terms(0, bucket("C")),
                        ),
                    ),
                ),
            )
            val (a, _) = adapter(truncated)
            then("예외를 던진다") {
                shouldThrow<IllegalStateException> { a.indexedCategoryCodes(10) }
            }
        }
        `when`("언어 집계가 잘렸으면") {
            val truncated = mapOf(
                "lang" to terms(
                    5,
                    bucket(
                        "ko",
                        mapOf(
                            "lclsSystm1" to terms(0, bucket("A")),
                            "lclsSystm2" to terms(0, bucket("B")),
                            "lclsSystm3" to terms(0, bucket("C")),
                        ),
                    ),
                ),
            )
            val (a, _) = adapter(truncated)
            then("예외를 던진다") {
                shouldThrow<IllegalStateException> { a.indexedCategoryCodes(10) }
            }
        }
    }
})
