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
            then("function_score 로 감싸고 두 분류 가중치를 싣는다") {
                val (adapter, captured) = adapterWith(AttractionRankingProperties())

                adapter.search(
                    AttractionSearchPort.SearchQuery(keyword = "한옥", lang = "ko"),
                    PageRequest.of(0, 10),
                )

                val query = captured.captured.query()
                query?.isFunctionScore shouldBe true
                val fs = query!!.functionScore()
                // 분류는 문서당 하나뿐이라 두 함수가 겹치지 않는다 — First 로 곱셈 누적을 막는다
                fs.scoreMode() shouldBe FunctionScoreMode.First
                // 곱이라 키워드 적합도의 상대 순서는 분류 안에서 유지된다
                fs.boostMode() shouldBe FunctionBoostMode.Multiply
                fs.functions().map { it.weight() } shouldContainExactlyInAnyOrder listOf(3.0f, 0.35f)
            }
        }

        `when`("자동완성을 하면") {
            then("같은 가중치가 걸려야 한다 — '경복' 이 밀린 곳이 바로 여기다") {
                val (adapter, captured) = adapterWith(AttractionRankingProperties())

                adapter.suggest("경복", "ko", 8)

                // 마지막 호출이 관광지 자동완성 (앞은 지역 슬롯)
                val query = captured.captured.query()
                query?.isFunctionScore shouldBe true
                // 분류 가중치만으로는 '한복남 경복궁점'(culture) 을 못 내린다 — 이름이 입력으로
                // 시작하는지를 함께 본다. 이 should 가 빠지면 그 회귀가 그대로 돌아온다.
                val inner = requireNotNull(query!!.functionScore().query()).bool()
                inner.should().any { it.isPrefix && it.prefix().field() == "title.keyword" } shouldBe true
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
