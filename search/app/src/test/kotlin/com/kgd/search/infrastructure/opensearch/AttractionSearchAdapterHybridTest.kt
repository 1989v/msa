package com.kgd.search.infrastructure.opensearch

import com.kgd.search.application.attraction.config.AttractionHybridProperties
import com.kgd.search.application.queryvector.config.QueryVectorProperties
import com.kgd.search.domain.attraction.port.AttractionSearchPort
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.collections.shouldContain
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import io.mockk.CapturingSlot
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import org.opensearch.client.opensearch.OpenSearchClient
import org.opensearch.client.opensearch.core.SearchRequest
import org.opensearch.client.opensearch.core.SearchResponse
import org.opensearch.client.opensearch.core.search.TotalHitsRelation
import org.springframework.data.domain.PageRequest

/**
 * 하이브리드 질의의 **모양**을 못 박는다 (ADR-0090 D4). 실제 순위는 OpenSearch 가 정하므로
 * 여기서 재는 것은 어댑터가 내놓은 `SearchRequest` 다 — 이름 일치가 아니라 산출물이다.
 */
class AttractionSearchAdapterHybridTest : BehaviorSpec({

    val modelRef = "dragonkue/snowflake-arctic-embed-l-v2.0-ko@abc1234#d1024"
    val vector = listOf(0.6f, 0.8f)

    fun <T> emptyResponse(): SearchResponse<T> =
        SearchResponse.Builder<T>()
            .took(1).timedOut(false)
            .shards { s -> s.total(1).successful(1).failed(0) }
            .hits { h -> h.total { t -> t.value(0).relation(TotalHitsRelation.Eq) }.hits(emptyList()) }
            .build()

    fun adapter(): Pair<AttractionSearchAdapter, CapturingSlot<SearchRequest>> {
        val client = mockk<OpenSearchClient>()
        val captured = slot<SearchRequest>()
        every { client.search(capture(captured), AttractionSearchDocument::class.java) } returns emptyResponse()
        every { client.search(any<SearchRequest>(), RegionSearchDocument::class.java) } returns emptyResponse()
        return AttractionSearchAdapter(
            client,
            AttractionRankingProperties(),
            AttractionHybridProperties(enabled = true, k = 100),
            QueryVectorProperties(modelRef = modelRef),
        ) to captured
    }

    given("벡터가 없는 질의") {
        `when`("검색하면") {
            then("하이브리드가 아니라 지금까지의 질의여야 한다") {
                val (a, captured) = adapter()

                a.search(AttractionSearchPort.SearchQuery(keyword = "한옥", lang = "ko"), PageRequest.of(0, 10))

                captured.captured.query()!!.isHybrid shouldBe false
                captured.captured.searchPipeline() shouldBe null
            }
        }
        `when`("응답을 받으면") {
            then("벡터 필드는 빼고 받아야 한다 — 하이브리드가 꺼져 있어도 문서당 4KB 다") {
                val (a, captured) = adapter()

                a.search(AttractionSearchPort.SearchQuery(keyword = "한옥"), PageRequest.of(0, 10))

                captured.captured.source()!!.filter()!!.excludes() shouldContain "embedding"
            }
        }
    }

    given("벡터가 있는 질의") {
        `when`("검색하면") {
            then("두 레그를 얹고 융합 파이프라인을 지정해야 한다") {
                val (a, captured) = adapter()

                a.search(
                    AttractionSearchPort.SearchQuery(keyword = "야시장", lang = "ko", embedding = vector),
                    PageRequest.of(0, 10),
                )

                val query = captured.captured.query()!!
                query.isHybrid shouldBe true
                query.hybrid().queries().size shouldBe 2
                captured.captured.searchPipeline() shouldBe "attraction-hybrid-rrf"
            }
        }

        `when`("벡터 레그를 보면") {
            then("설정한 k 와 벡터가 그대로 실려야 한다") {
                val (a, captured) = adapter()

                a.search(
                    AttractionSearchPort.SearchQuery(keyword = "야시장", embedding = vector),
                    PageRequest.of(0, 10),
                )

                val knn = captured.captured.query()!!.hybrid().queries().single { it.isKnn }.knn()
                knn.field() shouldBe "embedding"
                knn.vector() shouldBe vector
                knn.k() shouldBe 100
            }
        }

        `when`("스탬프가 다른 문서가 인덱스에 남아 있으면") {
            then("벡터 레그가 그것들을 걸러야 한다 — 다른 벡터 공간이라 거리가 뜻을 잃는다") {
                val (a, captured) = adapter()

                a.search(
                    AttractionSearchPort.SearchQuery(keyword = "야시장", embedding = vector),
                    PageRequest.of(0, 10),
                )

                val filter = captured.captured.query()!!.hybrid().queries().single { it.isKnn }.knn().filter()
                filter shouldNotBe null
                val terms = filter!!.bool().filter().filter { it.isTerm }.map { it.term() }
                terms.map { it.field() } shouldContain "embeddingModel"
                terms.single { it.field() == "embeddingModel" }.value().stringValue() shouldBe modelRef
            }
        }

        `when`("지역 필터를 함께 걸면") {
            then("벡터 레그도 같은 필터를 져야 한다 — 한쪽만 걸면 다른 레그가 필터 밖 문서를 끌어온다") {
                val (a, captured) = adapter()

                a.search(
                    AttractionSearchPort.SearchQuery(keyword = "야시장", lang = "ko", sidoCode = "11", embedding = vector),
                    PageRequest.of(0, 10),
                )

                val knnFilter = captured.captured.query()!!.hybrid().queries().single { it.isKnn }.knn().filter()!!
                // 키워드 레그의 필터를 그대로 감싸 넣었으므로, 안쪽 bool 에 lang·ldongRegnCd 가 있다
                val inner = knnFilter.bool().filter().single { it.isBool }.bool().filter()
                inner.filter { it.isTerm }.map { it.term().field() } shouldContain "ldongRegnCd"
                inner.filter { it.isTerm }.map { it.term().field() } shouldContain "lang"
            }
        }
        `when`("뒷장을 요청하면") {
            then("융합 깊이가 그 장을 덮어야 한다 — 기본값 10 이면 2페이지부터 빈다") {
                val (a, captured) = adapter()

                a.search(
                    AttractionSearchPort.SearchQuery(keyword = "야시장", embedding = vector),
                    PageRequest.of(12, 20),
                )

                captured.captured.query()!!.hybrid().paginationDepth() shouldBe 260
            }
        }

        `when`("첫 장을 요청하면") {
            then("적어도 k 만큼은 훑어야 한다") {
                val (a, captured) = adapter()

                a.search(
                    AttractionSearchPort.SearchQuery(keyword = "야시장", embedding = vector),
                    PageRequest.of(0, 10),
                )

                captured.captured.query()!!.hybrid().paginationDepth() shouldBe 100
            }
        }

        `when`("정렬을 붙이면") {
            then("아무 정렬도 걸지 않아야 한다 — OpenSearch 가 점수 정렬과 다른 기준의 조합을 거부한다") {
                val (a, captured) = adapter()

                a.search(
                    AttractionSearchPort.SearchQuery(keyword = "야시장", embedding = vector),
                    PageRequest.of(0, 10),
                )

                // 로컬 프로브가 실제로 받은 거부:
                //   "_score sort criteria cannot be applied with any other criteria."
                // tiebreaker(idSort·id)를 같이 주면 하이브리드 질의가 400 이 된다.
                captured.captured.sort().shouldBeEmpty()
            }
        }

        `when`("벡터가 없는 질의와 견주면") {
            then("BM25 쪽은 tiebreaker 를 그대로 가져야 한다 — 하이브리드만 예외다") {
                val (a, captured) = adapter()

                a.search(AttractionSearchPort.SearchQuery(keyword = "야시장"), PageRequest.of(0, 10))

                captured.captured.sort().size shouldBe 3
            }
        }

    }
})
