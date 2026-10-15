package com.kgd.search.application.attraction.ltr

import com.kgd.search.application.attraction.config.AttractionLtrProperties
import com.kgd.search.application.attraction.port.AttractionLtrFeaturePort
import com.kgd.search.application.attraction.port.LtrRetrievalFeatures
import com.kgd.search.domain.attraction.model.AttractionDocument
import com.kgd.search.domain.attraction.port.AttractionSearchPort.AttractionHit
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.micrometer.core.instrument.simple.SimpleMeterRegistry
import io.mockk.every
import io.mockk.mockk
import tools.jackson.databind.json.JsonMapper

class AttractionLtrRerankerTest : BehaviorSpec({
    val mapper = JsonMapper.builder().build()

    fun doc(id: String, title: String = "경복궁", category: String? = "history", overview: String? = null) = AttractionDocument(
        id = id, contentId = id, lang = "ko", title = title, latitude = 37.5, longitude = 127.0, category = category, overview = overview,
    )

    fun hits(vararg ids: String) = ids.map { AttractionHit(doc(it), score = 1.0) }

    // knn-only.json: knn > 0.5 면 1점, 아니면 0점 — 재정렬이 모델 점수를 따르는지만 본다
    fun reranker(port: AttractionLtrFeaturePort, model: String = "ltr/knn-only.json", registry: SimpleMeterRegistry = SimpleMeterRegistry()) =
        AttractionLtrReranker(AttractionLtrProperties(enabled = true, model = model), port, mapper, registry)

    given("재정렬") {
        `when`("모델이 뒤 문서를 더 높게 채점하면") {
            then("그 문서가 앞으로 오고 동점은 라이브 순서를 지킨다") {
                val port = mockk<AttractionLtrFeaturePort>()
                every { port.features("경복궁", "ko", any(), listOf("1", "2", "3", "4")) } returns
                    mapOf("3" to LtrRetrievalFeatures(knn = 0.9), "4" to LtrRetrievalFeatures(knn = 0.7))

                reranker(port).rerank("경복궁", "ko", listOf(0.1f), hits("1", "2", "3", "4")).map { it.document.id } shouldBe
                    listOf("3", "4", "1", "2")
            }
        }
        `when`("피처를 받지 못하면") {
            then("받은 순서 그대로 두고 실패를 센다") {
                val port = mockk<AttractionLtrFeaturePort>()
                every { port.features(any(), any(), any(), any()) } throws IllegalStateException("msearch 실패")
                val registry = SimpleMeterRegistry()

                reranker(port, registry = registry).rerank("경복궁", "ko", listOf(0.1f), hits("1", "2")).map { it.document.id } shouldBe
                    listOf("1", "2")
                registry.counter("search.attraction.ltr.failed").count() shouldBe 1.0
            }
        }
    }

    given("적용 범위") {
        val r = reranker(mockk())
        `when`("언어가 국문이 아니면") {
            then("적용하지 않는다") {
                r.appliesTo("ko") shouldBe true
                r.appliesTo("en") shouldBe false
                r.appliesTo(null) shouldBe false
            }
        }
        `when`("꺼져 있으면") {
            then("어느 언어에도 적용하지 않는다") {
                AttractionLtrReranker(AttractionLtrProperties(enabled = false), mockk(), mapper, SimpleMeterRegistry()).appliesTo("ko") shouldBe false
            }
        }
        `when`("모델에 만들 줄 모르는 피처가 있으면") {
            then("기동 시점에 실패한다") {
                shouldThrow<IllegalStateException> { reranker(mockk(), model = "ltr/unknown-feature.json") }
            }
        }
    }

    given("피처 벡터") {
        val names = listOf("c_rank", "knn", "cat=history", "type=12", "setting=indoor", "lang=en", "title_has_query", "title_len", "overview_len")
        `when`("학습 행과 같은 정의로 만들면") {
            then("공백·대소문자를 무시한 제목 포함, 코드 포인트 길이, 분류 원-핫이 학습 스크립트와 같다") {
                val d = doc("9", title = "Gyeongbok 궁 😀", overview = "가나😀")
                val x = AttractionLtrReranker.vectorOf(names, 4, "gyeongbok궁", "ko", d, LtrRetrievalFeatures(knn = 0.3))
                x.toList() shouldBe listOf(4.0, 0.3, 1.0, 0.0, 0.0, 0.0, 1.0, 13.0, 3.0)
            }
        }
    }
})
