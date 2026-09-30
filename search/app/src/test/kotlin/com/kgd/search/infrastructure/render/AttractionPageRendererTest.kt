package com.kgd.search.infrastructure.render

import com.kgd.search.domain.attraction.model.AttractionClickSignal
import com.kgd.search.domain.attraction.model.AttractionRegion
import com.kgd.search.domain.attraction.model.SimilarPlace
import com.kgd.search.infrastructure.config.AttractionRenderProperties
import com.kgd.search.infrastructure.render.AttractionPageFixtures.ALL_UNKNOWN
import com.kgd.search.infrastructure.render.AttractionPageFixtures.PARSED
import com.kgd.search.infrastructure.render.AttractionPageFixtures.REGION
import com.kgd.search.infrastructure.render.AttractionPageFixtures.SHELL
import com.kgd.search.infrastructure.render.AttractionPageFixtures.SIMILAR
import com.kgd.search.infrastructure.render.AttractionPageFixtures.doc
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.kotest.matchers.string.shouldNotContain
import tools.jackson.databind.ObjectMapper

/**
 * 렌더러가 **내놓은 HTML** 을 본다. 기대값은 규칙(이스케이프 순서·마커 치환·noindex·canonical)에서
 * 오고, 렌더러 안의 상수를 복사해 오지 않는다.
 */
class AttractionPageRendererTest : BehaviorSpec({

    val renderer = AttractionPageRenderer(AttractionRenderProperties(), ObjectMapper())

    fun rootOf(html: String): String =
        html.substringAfter("<div id=\"root\">").substringBefore("<script type=\"module\"")

    fun jsonLdBlocks(html: String): List<String> =
        Regex("""<script type="application/ld\+json"([^>]*)>([\s\S]*?)</script>""")
            .findAll(html).map { it.groupValues[1] + "|" + it.groupValues[2] }.toList()

    given("셸이 정상이고 원문에 태그·엔티티·치환 문자가 섞여 있을 때") {
        val overview = "첫 줄<br />둘째 줄 <b>굵게</b> &lt;script&gt;alert(1)&lt;/script&gt; 요금 \$1 \"따옴표\""
        val html = renderer.attractionPage(SHELL, doc(title = "경복궁 \$1 </script>", overview = overview))

        then("seo 블록이 관광지 메타로 갈리고 자산 스크립트는 남는다") {
            html shouldNotContain "<title>기본</title>"
            html shouldContain "<title>경복궁 \$1 &lt;/script&gt; 관광 정보 — 가는 길 · 주변 가볼 만한 곳 | K-관광</title>"
            html shouldContain "/assets/index-abc123.js"
            html shouldNotContain "<!--seo:start-->"
        }

        then("치환 문자열의 \$1 이 그룹 참조로 해석되지 않는다") {
            rootOf(html) shouldContain "요금 \$1"
            html shouldContain "<h1>경복궁 \$1 &lt;/script&gt;</h1>"
        }

        then("원문 엔티티는 디코드된 뒤 다시 이스케이프된다 — 태그가 되지 않는다") {
            html shouldNotContain "<script>alert(1)</script>"
            rootOf(html) shouldContain "&lt;script&gt;alert(1)&lt;/script&gt;"
            // 원문 태그는 글자로도 남지 않는다(지운다)
            rootOf(html) shouldNotContain "굵게</b>"
            rootOf(html) shouldNotContain "&lt;b&gt;"
            rootOf(html) shouldContain "&quot;따옴표&quot;"
        }

        then("JSON-LD 두 블록 모두 data-seo-multi 를 달고, 본문에 < 가 그대로 나가지 않는다") {
            val blocks = jsonLdBlocks(html)
            blocks shouldHaveSize 2
            blocks.forEach { block ->
                block.substringBefore("|") shouldBe " data-seo-multi"
                block.substringAfter("|") shouldNotContain "<"
            }
            html shouldContain "\\u003c/script>"
        }

        then("개요가 있으면 noindex 가 없다") {
            html shouldNotContain "noindex"
        }

        then("canonical 은 설정된 origin 과 문서 언어로 만든다") {
            html shouldContain """<link rel="canonical" href="https://place.1989v.com/attractions/1001" />"""
        }
    }

    given("개요가 없는 문서") {
        val html = renderer.attractionPage(SHELL, doc(overview = null))

        then("noindex, follow 로 나간다 — 화면(useSeo)과 같은 규칙") {
            html shouldContain """<meta name="robots" content="noindex, follow" />"""
        }
    }

    given("영문 문서") {
        val html = renderer.attractionPage(SHELL, doc(id = "2001", lang = "en", title = "Gyeongbokgung Palace"))

        then("html lang 과 canonical 이 영문 경로다") {
            html shouldContain "<html lang=\"en\">"
            html shouldContain """<link rel="canonical" href="https://place.1989v.com/en/attractions/2001" />"""
            html shouldContain "Visit Gyeongbokgung Palace — Map, Photos &amp; Things to Do Nearby | K-Tour"
        }
    }

    given("속성이 해석된 문서") {
        val html = renderer.attractionPage(SHELL, doc(attributes = PARSED, region = REGION, similarElsewhere = SIMILAR))
        val root = rootOf(html)

        then("아는 값만 배지로 나간다 — UNKNOWN 인 반려동물·카드는 없다") {
            root shouldContain "매주 화요일 휴무"
            root shouldContain "주차 가능"
            root shouldContain "유모차 대여 없음"
            root shouldContain "입장 무료"
            root shouldNotContain "반려동물"
            root shouldNotContain "신용카드"
        }

        then("지역 안 위치 문구와 허브 링크가 나간다") {
            root shouldContain "종로구 관광지 120곳 중 고궁 5곳"
            root shouldContain "href=\"/regions/11110\""
        }

        then("같은 분류 가까운 곳이 상세 링크로 나가고 제목은 이스케이프된다") {
            root shouldContain "<a href=\"/attractions/1002\">창덕궁</a>"
            root shouldContain "덕수궁 &lt;별관&gt;"
        }

        then("다른 시도의 비슷한 곳이 상세 링크와 시도 이름으로 나간다 — 시도를 모르면 이름만") {
            root shouldContain "<h2>비슷한 곳</h2>"
            root shouldContain "<li><a href=\"/attractions/3001\">경기전</a> · 전북특별자치도</li>"
            root shouldContain "<li><a href=\"/attractions/3002\">화성행궁 &lt;정조&gt;</a></li>"
        }

        then("섹션 순서는 개요 → 방문 정보 원문 → 배지 → 지역 안 위치 → 같은 분류 가까운 곳 → 비슷한 곳") {
            val order = listOf("조선 왕조의 법궁", "이용 안내", "매주 화요일 휴무", "종로구 관광지 120곳", "창덕궁", "비슷한 곳", "경기전")
                .map { root.indexOf(it) }
            order.none { it < 0 } shouldBe true
            order shouldBe order.sorted()
        }

        then("방문 정보 원문의 <br> 은 줄바꿈으로 평문화된다") {
            root shouldContain "<dt>이용시간</dt><dd>09:00~18:00\n입장 마감 17:00</dd>"
        }
    }

    given("영문 문서의 비슷한 곳") {
        val html = renderer.attractionPage(SHELL, doc(id = "2001", lang = "en", similarElsewhere = listOf(SimilarPlace("4001", "Gyeonggijeon Shrine", "Jeonbuk"))))

        then("영문 제목과 영문 상세 경로") {
            val root = rootOf(html)
            root shouldContain "<h2>Similar places in other regions</h2>"
            root shouldContain "<li><a href=\"/en/attractions/4001\">Gyeonggijeon Shrine</a> · Jeonbuk</li>"
        }
    }

    given("영문 문서의 지역 안 위치") {
        val region = AttractionRegion("Jongno-gu", 120, 5, "Palaces", emptyList())
        val html = renderer.attractionPage(SHELL, doc(id = "2001", lang = "en", region = region))

        then("영문 문구와 영문 허브 경로") {
            rootOf(html) shouldContain "Palaces 5 of 120 attractions in Jongno-gu"
            rootOf(html) shouldContain "href=\"/en/regions/11110\""
        }
    }

    given("속성이 모두 UNKNOWN 이거나 옛 색인 문서(속성·지역 없음)") {
        then("배지·지역 절을 그리지 않는다") {
            listOf(doc(attributes = ALL_UNKNOWN), doc()).forEach { d ->
                val root = rootOf(renderer.attractionPage(SHELL, d))
                root shouldNotContain "주차 가능"
                root shouldNotContain "/regions/11110"
                root shouldContain "<h1>경복궁</h1>"
            }
        }
    }

    given("14일 고유 클릭 방문자 수") {
        val min = AttractionClickSignal.MIN_SAMPLE

        then("최소 표본에 닿으면 배지 목록 끝에 「많이 클릭한 곳」이 붙는다") {
            val root = rootOf(renderer.attractionPage(SHELL, doc(attributes = PARSED, uniqueClickers14d = min)))
            root shouldContain "<li>많이 클릭한 곳</li>"
            (root.indexOf("입장 무료") < root.indexOf("많이 클릭한 곳")) shouldBe true
        }

        then("최소 표본 미만이거나 신호가 없으면 붙지 않는다") {
            listOf(min - 1, 0, null).forEach { n ->
                rootOf(renderer.attractionPage(SHELL, doc(attributes = PARSED, uniqueClickers14d = n))) shouldNotContain "많이 클릭한 곳"
            }
        }

        then("속성이 없는 옛 문서여도 이 배지 하나로 요약 절을 그린다") {
            val root = rootOf(renderer.attractionPage(SHELL, doc(uniqueClickers14d = min)))
            root shouldContain "<h2>방문 정보 요약</h2><ul><li>많이 클릭한 곳</li></ul>"
        }

        then("영문 문구") {
            val root = rootOf(renderer.attractionPage(SHELL, doc(id = "2001", lang = "en", uniqueClickers14d = min)))
            root shouldContain "<li>Frequently clicked</li>"
        }
    }

    given("셸을 한 번도 받지 못했을 때") {
        val html = renderer.attractionPage(null, doc())

        then("SPA 없이도 읽히는 최소 HTML 에 메타와 본문이 있다") {
            html shouldContain "<title>경복궁 관광 정보"
            html shouldContain "<h1>경복궁</h1>"
            html shouldContain "data-seo-multi"
        }
    }

    given("없는 관광지") {
        val html = renderer.notFoundPage(SHELL, "en")

        then("색인은 막고 크롤은 열어 두며, 허브로 돌려보낸다") {
            html shouldContain """<meta name="robots" content="noindex, follow" />"""
            html shouldContain "href=\"/en\""
            html shouldNotContain "<title>기본</title>"
        }
    }
})
