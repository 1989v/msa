package com.kgd.search.application.attraction.service

import com.kgd.search.application.attraction.config.AttractionHybridProperties
import com.kgd.search.application.attraction.config.AttractionLtrProperties
import com.kgd.search.application.attraction.ltr.AttractionLtrReranker
import com.kgd.search.application.attraction.port.AttractionLtrFeaturePort
import com.kgd.search.application.attraction.port.LtrRetrievalFeatures
import com.kgd.search.application.attraction.usecase.CategoryLexiconUseCase
import com.kgd.search.application.attraction.usecase.SearchAttractionUseCase
import com.kgd.search.application.queryvector.config.QueryVectorProperties
import com.kgd.search.application.queryvector.usecase.ResolveQueryVectorUseCase
import com.kgd.search.domain.attraction.model.AttractionDocument
import com.kgd.search.domain.attraction.port.AttractionSearchPort
import com.kgd.search.domain.query.model.QueryIntent
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.micrometer.core.instrument.simple.SimpleMeterRegistry
import io.mockk.clearMocks
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import io.mockk.verify
import org.springframework.data.domain.PageImpl
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Pageable
import tools.jackson.databind.json.JsonMapper

class SearchAttractionServiceLtrTest : BehaviorSpec({
    val searchPort = mockk<AttractionSearchPort>()
    val resolveQueryVector = mockk<ResolveQueryVectorUseCase>()
    val featurePort = mockk<AttractionLtrFeaturePort>()
    // knn-only.json: knn > 0.5 면 1점 — 「4」 를 맨 앞으로 올리게 피처를 준다
    val reranker = AttractionLtrReranker(
        AttractionLtrProperties(enabled = true, model = "ltr/knn-only.json"), featurePort, JsonMapper.builder().build(), SimpleMeterRegistry(),
    )
    val service = SearchAttractionService(
        searchPort, resolveQueryVector,
        object : CategoryLexiconUseCase {
            override fun lexicon(lang: String?) = QueryIntent.Lexicon.EMPTY
        },
        AttractionHybridProperties(enabled = true),
        QueryVectorProperties(modelRef = "m@1"),
        SimpleMeterRegistry(),
        ltr = reranker,
    )

    fun hit(id: String) = AttractionSearchPort.AttractionHit(
        AttractionDocument(id = id, contentId = id, lang = "ko", title = "곳 $id", latitude = 37.0, longitude = 127.0),
        score = 1.0,
    )

    beforeTest {
        clearMocks(searchPort, resolveQueryVector, featurePort)
        every { searchPort.correct(any(), any()) } returns null
        every { resolveQueryVector.resolve(any(), any()) } returns listOf(0.1f)
        every { featurePort.features(any(), any(), any(), any()) } returns mapOf("4" to LtrRetrievalFeatures(knn = 0.9))
    }

    fun searchReturning(total: Int): io.mockk.CapturingSlot<Pageable> {
        val asked = slot<Pageable>()
        every { searchPort.search(any(), capture(asked)) } answers {
            val p = asked.captured
            val ids = (p.offset.toInt() until minOf(total, p.offset.toInt() + p.pageSize)).map { (it + 1).toString() }
            AttractionSearchPort.SearchResult(PageImpl(ids.map { hit(it) }, p, total.toLong()))
        }
        return asked
    }

    given("국문 하이브리드 첫 장") {
        `when`("한 장이 재정렬 깊이(20)보다 작으면") {
            then("깊이만큼 받아 다시 줄 세운 뒤 요청한 크기로 자른다") {
                val asked = searchReturning(total = 50)

                val r = service.execute(SearchAttractionUseCase.Query(keyword = "경복궁", lang = "ko", size = 3))

                asked.captured shouldBe PageRequest.of(0, 20)
                r.attractions.map { it.id } shouldBe listOf("4", "1", "2")
                r.totalElements shouldBe 50
                r.totalPages shouldBe 17
                // 피처는 입력 그대로의 검색어로, 상위 20 후보 전부에 대해 묻는다
                verify { featurePort.features("경복궁", "ko", listOf(0.1f), (1..20).map { it.toString() }) }
            }
        }
        `when`("한 장이 깊이보다 크면") {
            then("앞 20 만 다시 줄 세우고 21 번째부터는 자리를 지킨다") {
                searchReturning(total = 50)

                val r = service.execute(SearchAttractionUseCase.Query(keyword = "경복궁", lang = "ko", size = 30))

                r.attractions.map { it.id } shouldBe listOf("4", "1", "2", "3") + (5..30).map { it.toString() }
            }
        }
    }

    given("재정렬하지 않는 경우") {
        `when`("둘째 장이면") {
            then("하이브리드 순서 그대로다 — 첫 장 재정렬은 상위 20 안에서만 자리를 바꾼다") {
                val asked = searchReturning(total = 50)

                val r = service.execute(SearchAttractionUseCase.Query(keyword = "경복궁", lang = "ko", page = 1, size = 20))

                asked.captured shouldBe PageRequest.of(1, 20)
                r.attractions.map { it.id } shouldBe (21..40).map { it.toString() }
                verify(exactly = 0) { featurePort.features(any(), any(), any(), any()) }
            }
        }
        `when`("영문이면") {
            then("하이브리드 순서 그대로다") {
                searchReturning(total = 50)

                val r = service.execute(SearchAttractionUseCase.Query(keyword = "palace", lang = "en", size = 3))

                r.attractions.map { it.id } shouldBe listOf("1", "2", "3")
                verify(exactly = 0) { featurePort.features(any(), any(), any(), any()) }
            }
        }
        `when`("거리순이면") {
            then("벡터 레그가 없으니 재정렬도 없다") {
                searchReturning(total = 50)

                val r = service.execute(SearchAttractionUseCase.Query(keyword = "경복궁", lang = "ko", size = 3, lat = 37.0, lng = 127.0, sort = "distance"))

                r.attractions.map { it.id } shouldBe listOf("1", "2", "3")
                verify(exactly = 0) { featurePort.features(any(), any(), any(), any()) }
            }
        }
    }
})
