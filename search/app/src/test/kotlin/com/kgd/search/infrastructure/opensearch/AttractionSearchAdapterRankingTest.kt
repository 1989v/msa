package com.kgd.search.infrastructure.opensearch

import com.kgd.search.domain.attraction.port.AttractionSearchPort
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldContainExactlyInAnyOrder
import io.kotest.matchers.shouldBe
import io.mockk.CapturingSlot
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import org.opensearch.client.opensearch.OpenSearchClient
import org.opensearch.client.opensearch._types.mapping.FieldType
import org.opensearch.client.opensearch._types.query_dsl.FieldValueFactorModifier
import org.opensearch.client.opensearch._types.query_dsl.FunctionBoostMode
import org.opensearch.client.opensearch._types.query_dsl.FunctionScoreMode
import org.opensearch.client.opensearch.core.SearchRequest
import org.opensearch.client.opensearch.core.SearchResponse
import org.opensearch.client.opensearch.core.search.TotalHitsRelation
import org.springframework.data.domain.PageRequest

/**
 * ADR-0065 P2 — 분류 가중치. 적재의 62% 가 음식·쇼핑이라 관광 의도의 질의에서 상점·식당이
 * 관광지를 밀어냈다(2026-08-19 실측: "경복" 자동완성 1위 `한복남 경복궁점`).
 *
 * 실제 순위는 OpenSearch 가 정하므로 여기서는 **질의가 어떤 모양으로 나가는지**만 못 박는다.
 */
class AttractionSearchAdapterRankingTest : BehaviorSpec({

    fun <T> emptyResponse(): SearchResponse<T> =
        SearchResponse.Builder<T>()
            .took(1).timedOut(false)
            .shards { s -> s.total(1).successful(1).failed(0) }
            .hits { h ->
                h.total { t -> t.value(0).relation(TotalHitsRelation.Eq) }.hits(emptyList())
            }
            .build()

    fun adapterWith(
        properties: AttractionRankingProperties,
    ): Pair<AttractionSearchAdapter, CapturingSlot<SearchRequest>> {
        val client = mockk<OpenSearchClient>()
        val captured = slot<SearchRequest>()
        every {
            client.search(capture(captured), AttractionSearchDocument::class.java)
        } returns emptyResponse()
        // 자동완성은 지역 인덱스를 먼저 친다 (상단 슬롯) — 그 호출도 답을 줘야 관광지까지 간다
        every {
            client.search(any<SearchRequest>(), RegionSearchDocument::class.java)
        } returns emptyResponse()
        return AttractionSearchAdapter(client, properties) to captured
    }

    given("기본 설정(관광 3.0 / 상점·식당 0.35)") {
        `when`("키워드 검색을 하면") {
            then("function_score 로 분류 가중치 둘 + 완결성 fvf 를 싣는다") {
                val (adapter, captured) = adapterWith(AttractionRankingProperties())

                adapter.search(
                    AttractionSearchPort.SearchQuery(keyword = "한옥", lang = "ko"),
                    PageRequest.of(0, 10),
                )

                val query = captured.captured.query()
                query?.isFunctionScore shouldBe true
                val fs = query!!.functionScore()
                // 분류 필터 둘은 배타(문서당 하나만 걸림) + fvf 는 항상 걸림 —
                // Multiply 로 (분류 가중치 × ln1p(완결성)) 가 된다. First 는 fvf 를 무시한다.
                fs.scoreMode() shouldBe FunctionScoreMode.Multiply
                // 곱이라 키워드 적합도의 상대 순서는 분류 안에서 유지된다
                fs.boostMode() shouldBe FunctionBoostMode.Multiply
                fs.functions().mapNotNull { it.weight() } shouldContainExactlyInAnyOrder
                    listOf(3.0f, 0.35f)

                // 완결성 신호 — ln1p 로 눌러 키워드 모드에선 BM25 가 지배적으로 남고,
                // missing=1.0 이라 재색인 전 옛 인덱스에서도 중립으로 동작한다
                val fvf = fs.functions().single { it.isFieldValueFactor }.fieldValueFactor()
                fvf.field() shouldBe "popularityScore"
                fvf.modifier() shouldBe FieldValueFactorModifier.Ln1p
                fvf.missing() shouldBe 1.0
            }
        }

        `when`("키워드 없이(브라우즈) 검색을 하면") {
            then("동점(matchAll)을 idSort 숫자 정렬로 끊는다 — keyword id 는 사전순이었다") {
                val (adapter, captured) = adapterWith(AttractionRankingProperties())

                adapter.search(AttractionSearchPort.SearchQuery(lang = "en"), PageRequest.of(0, 10))

                // matchAll 동점에서도 fvf 가 걸려 완결성 높은 문서가 먼저 온다
                captured.captured.query()?.isFunctionScore shouldBe true

                val sorts = captured.captured.sort()
                sorts[0].isScore shouldBe true
                sorts[1].field().field() shouldBe "idSort"
                // 재색인 전 옛 인덱스에는 idSort 가 없다 — unmappedType 이 없으면 정렬이 깨진다
                sorts[1].field().unmappedType() shouldBe FieldType.Long
                sorts[2].field().field() shouldBe "id"
            }
        }

        `when`("자동완성을 하면") {
            then("같은 가중치가 걸려야 한다 — '경복' 이 밀린 곳이 바로 여기다") {
                val (adapter, captured) = adapterWith(AttractionRankingProperties())

                adapter.suggest("경보", "ko", 8)   // 조합 중간 상태

                // 마지막 호출이 관광지 자동완성 (앞은 지역 슬롯)
                val query = captured.captured.query()
                query?.isFunctionScore shouldBe true
                // 분류 가중치만으로는 '한복남 경복궁점'(culture) 을 못 내린다 — 이름이 입력으로
                // 시작하는지를 함께 본다. 이 should 가 빠지면 그 회귀가 그대로 돌아온다.
                val inner = requireNotNull(query!!.functionScore().query()).bool()
                inner.should().any { it.isPrefix && it.prefix().field() == "title.keyword" } shouldBe true

                // must 가 아니라 should — 자모로만 맞는 입력을 must 가 걸러버리면 자모 색인이
                // 아무 일도 하지 못한다.
                inner.must().isEmpty() shouldBe true
                inner.minimumShouldMatch() shouldBe "1"

                // 가중치 순서가 뒤집히면 자모로만 스친 문서가 이름이 정확한 문서를 밀어낸다
                val boosts = inner.should().associate { clause ->
                    when {
                        clause.isPrefix -> "keyword" to clause.prefix().boost()
                        clause.isMatchBoolPrefix -> "title" to clause.matchBoolPrefix().boost()
                        else -> "jamo" to clause.match().boost()
                    }
                }
                boosts["keyword"] shouldBe 6.0f
                boosts["title"] shouldBe 1.0f
                boosts["jamo"] shouldBe 0.3f
            }
        }
    }

    given("분류 필터") {
        `when`("여러 분류를 주면") {
            then("terms 로 한 번에 건다 — 목록(관광)과 지도(음식·쇼핑)를 가르는 축이다") {
                val (adapter, captured) = adapterWith(AttractionRankingProperties())

                adapter.search(
                    AttractionSearchPort.SearchQuery(
                        lang = "ko",
                        categories = listOf("nature", "history", "culture", "leisure"),
                    ),
                    PageRequest.of(0, 10),
                )

                val filters = requireNotNull(captured.captured.query()!!.functionScore().query()).bool().filter()
                val terms = filters.single { it.isTerms }.terms()
                terms.field() shouldBe "category"
                terms.terms().value().map { it.stringValue() } shouldContainExactlyInAnyOrder
                    listOf("nature", "history", "culture", "leisure")
            }
        }
        `when`("분류를 주지 않으면") {
            then("분류 필터를 걸지 않는다") {
                val (adapter, captured) = adapterWith(AttractionRankingProperties())

                adapter.search(AttractionSearchPort.SearchQuery(lang = "ko"), PageRequest.of(0, 10))

                val filters = requireNotNull(captured.captured.query()!!.functionScore().query()).bool().filter()
                filters.none { it.isTerms } shouldBe true
            }
        }
    }

    given("가중치를 둘 다 1.0 으로 두면") {
        `when`("검색을 하면") {
            then("function_score 를 감싸지 않는다 — 끄는 스위치가 있어야 되돌릴 수 있다") {
                val (adapter, captured) = adapterWith(
                    AttractionRankingProperties(sightWeight = 1.0, commerceWeight = 1.0),
                )

                adapter.search(
                    AttractionSearchPort.SearchQuery(keyword = "한옥", lang = "ko"),
                    PageRequest.of(0, 10),
                )

                captured.captured.query()?.isBool shouldBe true
            }
        }
    }
})
