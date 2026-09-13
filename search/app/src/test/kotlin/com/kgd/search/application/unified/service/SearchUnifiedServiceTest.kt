package com.kgd.search.application.unified.service

import com.kgd.search.application.attraction.port.CategoryLexiconPort
import com.kgd.search.application.attraction.usecase.SearchAttractionUseCase
import com.kgd.search.application.unified.port.UnifiedSearchPort
import com.kgd.search.application.unified.usecase.SearchUnifiedUseCase
import com.kgd.search.domain.query.model.QueryIntent
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldContainExactly
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import io.mockk.verify

class SearchUnifiedServiceTest : BehaviorSpec({

    fun attractionResult(vararg titles: String) = SearchAttractionUseCase.Result(
        searchId = "s", totalElements = titles.size.toLong(), totalPages = 1, currentPage = 0,
        attractions = titles.mapIndexed { i, t ->
            SearchAttractionUseCase.AttractionSearchResult(
                id = "a$i", contentId = "c$i", lang = "ko", title = t, latitude = 0.0, longitude = 0.0, category = "nature",
            )
        },
    )

    fun unifiedPage(type: String, vararg titles: String) = UnifiedSearchPort.Page(
        hits = titles.mapIndexed { i, t ->
            UnifiedSearchPort.Hit(id = "$type:$i", type = type, sourceId = "$i", slug = "s$i", title = t, summary = null,
                category = null, thumbnailUrl = null, score = 1.0)
        },
        total = titles.size.toLong(),
    )

    fun fixture(): Triple<SearchUnifiedService, SearchAttractionUseCase, UnifiedSearchPort> {
        val attraction = mockk<SearchAttractionUseCase>()
        val port = mockk<UnifiedSearchPort>()
        val lexicon = mockk<CategoryLexiconPort> { every { lexicon(any()) } returns QueryIntent.Lexicon.EMPTY }
        return Triple(SearchUnifiedService(attraction, port, lexicon), attraction, port)
    }

    given("타입 의도어가 없는 「하이브리드 검색」") {
        val (service, attraction, port) = fixture()
        every { attraction.execute(any()) } returns attractionResult()
        every { port.search(any()) } answers {
            val q = firstArg<UnifiedSearchPort.Query>()
            if (q.type == "blog_post") unifiedPage("blog_post", "하이브리드 글") else UnifiedSearchPort.Page(emptyList(), 0)
        }

        `when`("검색하면") {
            val result = service.execute(SearchUnifiedUseCase.Query(q = "하이브리드 검색"))

            then("관광지 + 여섯 타입을 다 묻고, 결과가 있는 묶음만 낸다") {
                verify(exactly = 1) { attraction.execute(any()) }
                verify(exactly = 6) { port.search(any()) }
                result.groups.map { it.type } shouldContainExactly listOf("blog_post")
                result.understood.type shouldBe null
                result.understood.residual shouldBe "하이브리드 검색"
            }
        }
    }

    given("「블로그 하이브리드」 — 타입 의도어가 있는 질의") {
        val (service, attraction, port) = fixture()
        val captured = slot<UnifiedSearchPort.Query>()
        every { port.search(capture(captured)) } returns unifiedPage("blog_post", "하이브리드 글")

        `when`("검색하면") {
            val result = service.execute(SearchUnifiedUseCase.Query(q = "블로그 하이브리드"))

            then("블로그 글만 묻고 관광지는 묻지 않는다 — 검색어에서 「블로그」는 빠진다") {
                verify(exactly = 0) { attraction.execute(any()) }
                captured.captured.type shouldBe "blog_post"
                captured.captured.keyword shouldBe "하이브리드"
                result.understood.type shouldBe "blog_post"
            }
        }
    }

    given("타입 의도어만으로 된 「게임」") {
        val (service, _, port) = fixture()
        val captured = slot<UnifiedSearchPort.Query>()
        every { port.search(capture(captured)) } returns unifiedPage("game", "AMP ARENA")

        `when`("검색하면") {
            service.execute(SearchUnifiedUseCase.Query(q = "게임"))

            then("키워드 없이 그 타입을 인기순으로 묻는다") {
                captured.captured.type shouldBe "game"
                captured.captured.keyword shouldBe null
            }
        }
    }

    given("관광지가 죽어 있을 때") {
        val (service, attraction, port) = fixture()
        every { attraction.execute(any()) } throws IllegalStateException("opensearch down")
        every { port.search(any()) } answers {
            if (firstArg<UnifiedSearchPort.Query>().type == "concept") unifiedPage("concept", "BM25") else UnifiedSearchPort.Page(emptyList(), 0)
        }

        `when`("전 타입 검색하면") {
            val result = service.execute(SearchUnifiedUseCase.Query(q = "bm25"))

            then("그 묶음만 빠지고 나머지는 나온다") {
                result.groups.map { it.type } shouldContainExactly listOf("concept")
            }
        }
    }

    given("의도 타입이 있고 다른 묶음도 걸릴 때") {
        val (service, attraction, port) = fixture()
        every { attraction.execute(any()) } returns attractionResult("관광지 하나")
        every { port.search(any()) } returns unifiedPage("blog_post", "글 하나", "글 둘")

        `when`("type 파라미터로 관광지를 지정하면") {
            val result = service.execute(SearchUnifiedUseCase.Query(q = "야경", type = "attraction"))

            then("지정한 타입만 나온다") {
                result.groups.map { it.type } shouldContainExactly listOf("attraction")
                result.groups.single().hits.single().slug shouldBe "a0"
            }
        }
    }

    given("「AMP ARENA」 — 관광지도 벡터 레그로 무언가를 내지만 게임 제목이 정확히 맞을 때") {
        val (service, attraction, port) = fixture()
        every { attraction.execute(any()) } returns attractionResult("KSPO Dome", "올림픽공원")
        every { port.search(any()) } answers {
            when (firstArg<UnifiedSearchPort.Query>().type) {
                "game" -> unifiedPage("game", "AMP ARENA")
                "blog_post" -> unifiedPage("blog_post", "아레나 개발기")
                else -> UnifiedSearchPort.Page(emptyList(), 0)
            }
        }

        `when`("전 타입 검색하면") {
            val result = service.execute(SearchUnifiedUseCase.Query(q = "AMP ARENA"))

            then("제목이 검색어를 담은 게임 묶음이 먼저고, 나머지는 고정 순서(관광지 → 글)다") {
                result.groups.map { it.type } shouldContainExactly listOf("game", "attraction", "blog_post")
            }
        }
    }

    given("빈 검색어") {
        val (service, attraction, port) = fixture()
        then("아무것도 묻지 않고 빈 결과다") {
            service.execute(SearchUnifiedUseCase.Query(q = "  ")).groups shouldBe emptyList()
            verify(exactly = 0) { attraction.execute(any()); port.search(any()) }
        }
    }
})
