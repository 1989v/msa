package com.kgd.search.infrastructure.opensearch

import com.kgd.search.application.attraction.config.AttractionHybridProperties
import com.kgd.search.application.queryvector.config.QueryVectorProperties
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import org.opensearch.client.opensearch.OpenSearchClient
import org.opensearch.client.opensearch.core.CountRequest
import org.opensearch.client.opensearch.core.CountResponse
import org.opensearch.client.opensearch.core.SearchRequest
import org.opensearch.client.opensearch.core.SearchResponse
import org.opensearch.client.opensearch.core.search.Suggest
import org.opensearch.client.opensearch.core.search.TermSuggest
import org.opensearch.client.opensearch.core.search.TermSuggestOption
import org.opensearch.client.opensearch.core.search.TotalHitsRelation
import org.opensearch.client.util.ObjectBuilder
import java.util.function.Function

/**
 * 오타 교정([AttractionSearchAdapter.correct]) — 제안 유사도 하한이 한글과 라틴 단어에서 다르게 걸리는지 본다.
 *
 * 스텁: 색인 일치 건수는 [counts] 에서, 제안은 [suggestions](단어 → 제안·유사도)에서 돌려준다.
 * 교정 제안은 자모로 편 단어로 요청하므로 키는 [com.kgd.search.domain.attraction.model.Jamo.decompose] 한 값이다.
 */
class AttractionSearchAdapterSpellTest : BehaviorSpec({

    fun adapter(counts: Map<String, Long>, suggestions: Map<String, Pair<String, Double>>): AttractionSearchAdapter {
        val client = mockk<OpenSearchClient>()
        every { client.count(any<Function<CountRequest.Builder, ObjectBuilder<CountRequest>>>()) } answers {
            val request = firstArg<Function<CountRequest.Builder, ObjectBuilder<CountRequest>>>()
                .apply(CountRequest.Builder()).build()
            val word = counts.keys.firstOrNull { request.toJsonString().contains("\"$it\"") }
            CountResponse.Builder().count(counts[word] ?: 0L)
                .shards { s -> s.total(1).successful(1).failed(0) }.build()
        }
        every {
            client.search(any<Function<SearchRequest.Builder, ObjectBuilder<SearchRequest>>>(), AttractionSearchDocument::class.java)
        } answers {
            val request = firstArg<Function<SearchRequest.Builder, ObjectBuilder<SearchRequest>>>()
                .apply(SearchRequest.Builder()).build()
            val text = request.suggest()!!.suggesters().values.first().text()
            val options = suggestions[text]?.let { (option, score) ->
                listOf(TermSuggestOption.Builder().text(option).score(score).freq(10).build())
            }.orEmpty()
            val term = TermSuggest.Builder().text(text!!).offset(0).length(text.length).options(options).build()
            SearchResponse.Builder<AttractionSearchDocument>()
                .took(1).timedOut(false)
                .shards { s -> s.total(1).successful(1).failed(0) }
                .hits { h -> h.total { t -> t.value(0).relation(TotalHitsRelation.Eq) }.hits(emptyList()) }
                .suggest(mapOf("spell" to listOf(Suggest.of<AttractionSearchDocument> { s -> s.term(term) })))
                .build()
        }
        return AttractionSearchAdapter(
            client,
            AttractionRankingProperties(),
            AttractionHybridProperties(),
            QueryVectorProperties(modelRef = AttractionSearchBaselineQueries.MODEL_REF),
        )
    }

    given("영문 6글자 단어의 한 글자 오타 — 유사도 0.833") {
        val spell = adapter(
            counts = mapOf("botanical" to 7L, "garedn" to 0L),
            suggestions = mapOf("garedn" to ("garden" to 0.833)),
        )
        `when`("「botanical garedn」") {
            then("라틴 단어 하한 0.80 을 넘어 고친다") { spell.correct("botanical garedn", "en") shouldBe "botanical garden" }
        }
    }

    given("라틴 단어도 하한 아래면") {
        val spell = adapter(counts = mapOf("egpyt" to 0L), suggestions = mapOf("egpyt" to ("egret" to 0.6)))
        `when`("「egpyt」→ egret 0.6") {
            then("고치지 않는다") { spell.correct("egpyt", "en") shouldBe null }
        }
    }

    given("색인에 이미 있는 단어") {
        val spell = adapter(counts = mapOf("quiet" to 51L), suggestions = mapOf("quiet" to ("quilt" to 0.8)))
        `when`("「quiet」") {
            then("제안이 하한을 넘어도 부르지 않는다 — 교정은 0건 단어에만") { spell.correct("quiet", "en") shouldBe null }
        }
    }

    given("한글 단어는 하한 0.85 그대로") {
        val jamo = com.kgd.search.domain.attraction.model.Jamo.decompose("경복굼")
        val spell = adapter(
            counts = mapOf("경복굼" to 0L),
            suggestions = mapOf(jamo to (com.kgd.search.domain.attraction.model.Jamo.decompose("경복궁") to 0.833)),
        )
        `when`("자모 제안 유사도 0.833") {
            then("고치지 않는다 — 라틴 하한이 한글로 새지 않는다") { spell.correct("경복굼", "ko") shouldBe null }
        }
    }
})
