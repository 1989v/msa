package com.kgd.search.application.attraction.service

import com.kgd.search.application.attraction.port.CategoryCode
import com.kgd.search.application.attraction.port.CategoryCodePort
import com.kgd.search.domain.attraction.port.AttractionSearchPort
import com.kgd.search.domain.query.model.QueryIntent
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify

/**
 * 분류 사전 = 코드표 ∩ 그 언어 색인에 문서가 있는 코드. 판정은 사전 내부가 아니라
 * 쿼리 언더스탠딩의 산출물(`QueryIntent.analyze` 의 facets·hasFilter)로 한다.
 *
 * 픽스처는 운영 모양을 본떴다: 템플스테이(EX040100)는 코드표에 있으나 색인 문서가 없고,
 * EX04 계열에서 문서가 있는 것은 국문 EX040200 뿐이다.
 */
class CategoryLexiconServiceTest : BehaviorSpec({

    val table = listOf(
        CategoryCode("ko", "NA020100", 3, "해수욕장"),
        CategoryCode("ko", "EX040100", 3, "템플스테이"),
        CategoryCode("ko", "EX040200", 3, "사찰문화체험"),
        CategoryCode("en", "NA020100", 3, "Beach"),
        CategoryCode("en", "EX04", 1, "Temple Stay Experiences"),
        CategoryCode("en", "EX040100", 3, "Temple Stay"),
        CategoryCode("en", "EX040200", 3, "Temple Culture Experience"),
    )
    val indexed = mapOf(
        "ko" to setOf("NA02", "NA020100", "EX04", "EX040200"),
        "en" to setOf("NA02", "NA020100"),
    )

    fun fixture(): Triple<CategoryLexiconService, CategoryCodePort, AttractionSearchPort> {
        val codes = mockk<CategoryCodePort>()
        val search = mockk<AttractionSearchPort>()
        return Triple(CategoryLexiconService(codes, search), codes, search)
    }

    fun CategoryLexiconService.facets(query: String, lang: String?) = QueryIntent.analyze(query, lexicon(lang)).facets
    fun CategoryLexiconService.filters(query: String, lang: String?) = QueryIntent.analyze(query, lexicon(lang)).hasFilter

    given("코드표와 언어별 색인 집합을 받으면") {
        val (service, codes, search) = fixture()
        every { codes.codes() } returns table
        every { search.indexedCategoryCodes(any()) } returns indexed
        service.refresh()

        then("① 코드표에 있지만 그 언어 집합에 없는 코드의 이름은 필터를 만들지 않는다") {
            service.filters("템플스테이", "ko") shouldBe false
            service.filters("temple stay", "en") shouldBe false
            // 대조군: 집합에 있는 코드는 필터가 된다
            service.facets("해수욕장", "ko") shouldBe mapOf("lclsSystm3" to "NA020100")
        }
        then("② 국문 집합에만 있는 코드는 국문 사전에서만 필터가 되고, 영문 사전에서는 영문·국문 이름 모두 필터가 없다") {
            service.facets("사찰문화체험", "ko") shouldBe mapOf("lclsSystm3" to "EX040200")
            service.facets("Temple Culture Experience", "ko") shouldBe mapOf("lclsSystm3" to "EX040200")
            service.filters("Temple Culture Experience", "en") shouldBe false
            service.filters("사찰문화체험", "en") shouldBe false
            // 대조군: 영문 집합에 있는 코드
            service.facets("beach", "en") shouldBe mapOf("lclsSystm3" to "NA020100")
        }
        then("⑨ lang 이 null 이면 국문 사전과 같은 필터를 낸다") {
            service.facets("사찰문화체험", null) shouldBe service.facets("사찰문화체험", "ko")
            service.facets("사찰문화체험", null) shouldBe mapOf("lclsSystm3" to "EX040200")
        }
    }

    given("③ 같은 이름의 깊은 코드는 집합에 없고 얕은 코드는 있으면") {
        val (service, codes, search) = fixture()
        every { codes.codes() } returns listOf(
            CategoryCode("ko", "LS01", 1, "레저스포츠"),
            CategoryCode("ko", "LS0101", 2, "수상레저"),
            CategoryCode("ko", "LS010100", 3, "레저스포츠"),
            CategoryCode("ko", "LS010200", 3, "수상레저"),
        )
        every { search.indexedCategoryCodes(any()) } returns mapOf("ko" to setOf("LS01", "LS0101"))
        service.refresh()

        then("그 이름은 얕은 코드의 필드로 필터된다 — 다 만든 사전을 나중에 거르면 사라질 이름이다") {
            service.facets("레저스포츠", "ko") shouldBe mapOf("lclsSystm1" to "LS01")
            service.facets("수상레저", "ko") shouldBe mapOf("lclsSystm2" to "LS0101")
        }
    }

    given("④ 한 번 만든 뒤 색인 집합 조회가 예외를 던지면") {
        val (service, codes, search) = fixture()
        every { codes.codes() } returns table
        every { search.indexedCategoryCodes(any()) } returns indexed
        service.refresh()
        every { search.indexedCategoryCodes(any()) } throws IllegalStateException("집계 잘림")
        service.refresh()

        then("들고 있던 사전을 쓴다 — 코드표 전체로 돌아가지 않는다") {
            service.filters("템플스테이", "ko") shouldBe false
            service.facets("해수욕장", "ko") shouldBe mapOf("lclsSystm3" to "NA020100")
        }
    }

    given("⑤ 한 번 만든 뒤 받은 집합이 비면") {
        `when`("집합이 빈 맵이면") {
            val (service, codes, search) = fixture()
            every { codes.codes() } returns table
            every { search.indexedCategoryCodes(any()) } returns indexed
            service.refresh()
            every { search.indexedCategoryCodes(any()) } returns emptyMap()
            service.refresh()

            then("두 언어 모두 들고 있던 사전을 쓴다") {
                service.filters("템플스테이", "ko") shouldBe false
                service.facets("해수욕장", "ko") shouldBe mapOf("lclsSystm3" to "NA020100")
                service.filters("temple stay", "en") shouldBe false
                service.facets("beach", "en") shouldBe mapOf("lclsSystm3" to "NA020100")
            }
        }
        `when`("그 언어 집합만 비면") {
            val (service, codes, search) = fixture()
            every { codes.codes() } returns table
            every { search.indexedCategoryCodes(any()) } returns indexed
            service.refresh()
            every { search.indexedCategoryCodes(any()) } returns mapOf("ko" to setOf("EX040100"), "en" to emptySet())
            service.refresh()

            then("그 언어는 들고 있던 사전을 쓰고, 집합이 있는 언어는 새로 만든다") {
                service.filters("temple stay", "en") shouldBe false
                service.facets("beach", "en") shouldBe mapOf("lclsSystm3" to "NA020100")
                service.facets("템플스테이", "ko") shouldBe mapOf("lclsSystm3" to "EX040100")
                service.filters("해수욕장", "ko") shouldBe false
            }
        }
    }

    given("⑥ 색인 집합을 한 번도 못 받으면") {
        val (service, codes, search) = fixture()
        every { codes.codes() } returns table
        every { search.indexedCategoryCodes(any()) } throws IllegalStateException("색인 없음")
        service.refresh()

        then("코드표 전체로 만든다 — 오늘 동작") {
            service.facets("템플스테이", "ko") shouldBe mapOf("lclsSystm3" to "EX040100")
            service.facets("temple stay", "en") shouldBe mapOf("lclsSystm3" to "EX040100")
        }
    }

    given("⑦ 한 번 만든 뒤 코드표 조회가 실패하면") {
        val (service, codes, search) = fixture()
        every { codes.codes() } returns table
        every { search.indexedCategoryCodes(any()) } returns indexed
        service.refresh()
        every { codes.codes() } throws IllegalStateException("place 다운")
        every { search.indexedCategoryCodes(any()) } returns mapOf("ko" to setOf("EX040100"), "en" to setOf("EX040100"))
        service.refresh()

        then("들고 있던 사전을 쓴다") {
            service.filters("템플스테이", "ko") shouldBe false
            service.facets("해수욕장", "ko") shouldBe mapOf("lclsSystm3" to "NA020100")
        }
    }

    given("⑧ 코드표 N 행을 받으면") {
        val (service, codes, search) = fixture()
        every { codes.codes() } returns table
        every { search.indexedCategoryCodes(any()) } returns indexed
        service.refresh()

        then("색인 집합은 N 이상의 버킷 크기로 묻는다") {
            verify(exactly = 1) { search.indexedCategoryCodes(match { it >= table.size }) }
        }
    }

    given("⑩ 한 번 만든 뒤 코드표가 빈 목록이면") {
        val (service, codes, search) = fixture()
        every { codes.codes() } returns table
        every { search.indexedCategoryCodes(any()) } returns indexed
        service.refresh()
        every { codes.codes() } returns emptyList()
        service.refresh()

        then("색인 집계를 부르지 않고 들고 있던 사전을 쓴다") {
            verify(exactly = 1) { search.indexedCategoryCodes(any()) }
            service.facets("해수욕장", "ko") shouldBe mapOf("lclsSystm3" to "NA020100")
            service.filters("템플스테이", "ko") shouldBe false
        }
    }
})
