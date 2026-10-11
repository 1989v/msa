package com.kgd.search.infrastructure.render

import com.kgd.search.domain.attraction.model.AttractionAccess
import com.kgd.search.domain.attraction.model.AttractionClickSignal
import com.kgd.search.domain.attraction.model.AttractionDocument
import com.kgd.search.domain.attraction.model.AttractionRegion
import com.kgd.search.domain.attraction.model.EventPeriod
import com.kgd.search.domain.attraction.model.EventSchedule
import com.kgd.search.domain.attraction.model.EventStatus
import com.kgd.search.domain.attraction.model.EventStatusText
import com.kgd.search.domain.attraction.model.NearbyPlace
import com.kgd.search.domain.attraction.model.RelatedPlace
import com.kgd.search.domain.attraction.model.SimilarPlace
import com.kgd.search.domain.attraction.model.TransitKind
import com.kgd.search.domain.attraction.model.WellnessTheme
import com.kgd.search.infrastructure.config.AttractionRenderProperties
import com.kgd.search.infrastructure.render.AttractionPageFixtures.ALL_UNKNOWN
import com.kgd.search.infrastructure.render.AttractionPageFixtures.COURSE_STOPS
import com.kgd.search.infrastructure.render.AttractionPageFixtures.GYEONGBOKGUNG_BARRIER_FREE
import com.kgd.search.infrastructure.render.AttractionPageFixtures.STAY_INTRO
import com.kgd.search.infrastructure.render.AttractionPageFixtures.TODAY
import com.kgd.search.infrastructure.render.AttractionPageFixtures.course
import com.kgd.search.infrastructure.render.AttractionPageFixtures.event
import com.kgd.search.infrastructure.render.AttractionPageFixtures.stay
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
import java.io.File
import java.time.LocalDate

/**
 * 렌더러가 **내놓은 HTML** 을 본다. 기대값은 규칙(이스케이프 순서·마커 치환·noindex·canonical)에서
 * 오고, 렌더러 안의 상수를 복사해 오지 않는다.
 */
class AttractionPageRendererTest : BehaviorSpec({

    val renderer = AttractionPageRenderer(AttractionRenderProperties(), ObjectMapper())

    fun render(shell: String?, d: AttractionDocument, today: LocalDate = TODAY) = renderer.attractionPage(shell, d, today)

    fun rootOf(html: String): String =
        html.substringAfter("<div id=\"root\">").substringBefore("<script type=\"module\"")

    fun jsonLdBlocks(html: String): List<String> =
        Regex("""<script type="application/ld\+json"([^>]*)>([\s\S]*?)</script>""")
            .findAll(html).map { it.groupValues[1] + "|" + it.groupValues[2] }.toList()

    given("셸이 정상이고 원문에 태그·엔티티·치환 문자가 섞여 있을 때") {
        val overview = "첫 줄<br />둘째 줄 <b>굵게</b> &lt;script&gt;alert(1)&lt;/script&gt; 요금 \$1 \"따옴표\""
        val html = render(SHELL, doc(title = "경복궁 \$1 </script>", overview = overview))

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
        val html = render(SHELL, doc(overview = null))

        then("noindex, follow 로 나간다 — 화면(useSeo)과 같은 규칙") {
            html shouldContain """<meta name="robots" content="noindex, follow" />"""
        }
    }

    given("영문 문서") {
        val html = render(SHELL, doc(id = "2001", lang = "en", title = "Gyeongbokgung Palace"))

        then("html lang 과 canonical 이 영문 경로다") {
            html shouldContain "<html lang=\"en\">"
            html shouldContain """<link rel="canonical" href="https://place.1989v.com/en/attractions/2001" />"""
            html shouldContain "Visit Gyeongbokgung Palace — Map, Photos &amp; Things to Do Nearby | K-Tour"
        }
    }

    given("언어 대체 짝(alternateId)") {
        val hreflang = Regex("""<link rel="alternate" hreflang="([^"]*)" href="([^"]*)"([^>]*)/>""")
        fun linksOf(html: String) = hreflang.findAll(html).map { Triple(it.groupValues[1], it.groupValues[2], it.groupValues[3].trim()) }.toList()
        val pair = listOf(
            Triple("ko", "https://place.1989v.com/attractions/1001", "data-seo-multi"),
            Triple("en", "https://place.1989v.com/en/attractions/2001", "data-seo-multi"),
            Triple("x-default", "https://place.1989v.com/en/attractions/2001", "data-seo-multi"),
        )

        then("짝이 있고 색인 대상이면 ko · en · x-default 세 줄을 data-seo-multi 와 함께 낸다") {
            linksOf(render(SHELL, doc().copy(alternateId = "2001"))) shouldBe pair
        }

        then("영문 문서도 같은 세 줄이다 — 문서 언어 기준") {
            linksOf(render(SHELL, doc(id = "2001", lang = "en", title = "Gyeongbokgung Palace").copy(alternateId = "1001"))) shouldBe pair
        }

        then("짝이 없으면 0줄") {
            linksOf(render(SHELL, doc())) shouldBe emptyList()
        }

        then("짝이어도 개요가 없어 noindex 면 0줄") {
            val html = render(SHELL, doc(overview = null).copy(alternateId = "2001"))
            html shouldContain """<meta name="robots" content="noindex, follow" />"""
            linksOf(html) shouldBe emptyList()
        }

        then("/en/attractions/{국문 id} 요청도 렌더러는 문서 언어로 판정한다 — ko 쪽이 그 국문 id") {
            // 렌더러는 요청 경로를 받지 않는다 — 어느 경로로 왔든 국문 문서를 넘기면 국문 기준 세 줄
            val html = render(SHELL, doc(id = "1001", lang = "ko").copy(alternateId = "2001"))
            html shouldContain "<html lang=\"ko\">"
            linksOf(html) shouldBe pair
        }
    }

    given("최근 갱신 피드(RSS) 링크") {
        val feed = Regex("""<link rel="alternate" type="application/rss\+xml"[^>]*>""")

        then("국문 상세는 국문 피드 한 줄을 data-seo-multi 와 함께 낸다") {
            val links = feed.findAll(render(SHELL, doc())).map { it.value }.toList()
            links shouldBe listOf(
                """<link rel="alternate" type="application/rss+xml" title="K-관광 — 최근 바뀐 관광지" href="https://place.1989v.com/feed.xml" data-seo-multi />""",
            )
        }

        then("영문 상세는 영문 피드") {
            val links = feed.findAll(render(SHELL, doc(id = "2001", lang = "en", title = "Gyeongbokgung Palace"))).map { it.value }.toList()
            links shouldBe listOf(
                """<link rel="alternate" type="application/rss+xml" title="K-Tour — Recently Updated Attractions" href="https://place.1989v.com/en/feed.xml" data-seo-multi />""",
            )
        }

        then("피드 링크는 head 안에 있다") {
            val html = render(SHELL, doc())
            val at = html.indexOf("application/rss+xml")
            (at in 0 until html.indexOf("</head>")) shouldBe true
        }
    }

    given("속성이 해석된 문서") {
        val html = render(SHELL, doc(attributes = PARSED, region = REGION, similarElsewhere = SIMILAR))
        val root = rootOf(html)

        then("해석된 값은 방문 요약 칸 첫 줄로, 칸이 없는 것은 배지 줄로 — UNKNOWN 은 해석 줄이 없다") {
            val summary = root.substringAfter("<dl data-place-section=\"visit-summary\">").substringBefore("</dl>")
            summary shouldContain "<dt>쉬는 날</dt><dd>매주 화요일 휴무\n매주 화요일</dd>"
            summary shouldContain "<dt>주차</dt><dd>주차 가능\n가능</dd>"
            summary shouldContain "<dt>반려동물</dt><dd>정보 없음</dd>"
            root shouldContain "<p data-place-section=\"visit-badges\">유모차 대여 없음</p>"
            root shouldNotContain "신용카드"
            // 입장 무료/유료는 요금 칸 값과 같은 정보라 따로 내지 않는다
            root shouldNotContain "입장 무료"
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
            root shouldContain "<h2>다른 지역의 비슷한 곳</h2>"
            root shouldContain "<li><a href=\"/attractions/3001\">경기전</a> · 전북특별자치도</li>"
            root shouldContain "<li><a href=\"/attractions/3002\">화성행궁 &lt;정조&gt;</a></li>"
        }

        then("절 순서는 제목 → 행동 줄 → 방문 요약 → 배지 줄 → 개요 → 지역 안 위치 → 같은 분류 가까운 곳 → 비슷한 곳") {
            val order = listOf(
                "<h1>",
                "data-place-section=\"actions\"",
                "data-place-section=\"visit-summary\"",
                "data-place-section=\"visit-badges\"",
                "조선 왕조의 법궁",
                "종로구 관광지 120곳",
                "data-place-section=\"same-category-nearby\"",
                "다른 지역의 비슷한 곳",
                "경기전",
            ).map { root.indexOf(it) }
            order.none { it < 0 } shouldBe true
            order shouldBe order.sorted()
        }

        then("방문 요약 칸의 원문 <br> 은 줄바꿈으로 평문화된다") {
            root.substringAfter("<dl data-place-section=\"visit-summary\">").substringBefore("</dl>") shouldContain
                "<dt>이용시간</dt><dd>09:00~18:00\n입장 마감 17:00</dd>"
        }

        then("일반 유형은 「이용 안내」·「방문 정보 요약」 절을 내지 않는다 — 방문 요약이 대신한다") {
            root shouldNotContain "<h2>이용 안내</h2>"
            root shouldNotContain "방문 정보 요약"
        }
    }

    given("무장애 정보·웰니스 테마가 실린 문서") {
        val html = render(
            SHELL,
            doc(attributes = PARSED, region = REGION).copy(
                barrierFree = GYEONGBOKGUNG_BARRIER_FREE,
                // 이름은 운영 분류 코드표(attraction_category_codes, ko)의 EX050100 값
                wellness = WellnessTheme("EX050100", "온천 / 사우나 / 스파"),
            ),
        )
        val root = rootOf(html)
        val section = root.substringAfter("<section data-place-section=\"barrier-free\">").substringBefore("</section>")

        then("「접근성 정보」 절에 긍정 아이콘 줄이 정해진 순서로 나간다 — 값이 없는 엘리베이터는 없다") {
            section shouldContain "<h2>접근성 정보</h2>"
            section.substringAfter("<ul>").substringBefore("</ul>") shouldBe
                "<li>휠체어</li><li>장애인 화장실</li><li>장애인 주차</li><li>유모차</li><li>수유실</li>"
        }

        then("원천 문장은 원천 키 순서대로 고치지 않고 나간다") {
            val rows = Regex("<dt>([^<]*)</dt><dd>([^<]*)</dd>").findAll(section).map { it.groupValues[1] to it.groupValues[2] }.toList()
            rows shouldBe listOf(
                "주차" to "장애인 주차장 있음(광화문 우측 옥외 주차장에 9개)_무장애 편의시설",
                "휠체어" to "대여가능",
                "출입통로" to "주출입구는 경사로가 있어 휠체어 접근 가능함",
                "화장실" to "장애인 화장실 있음",
                "오디오가이드" to "음성안내 가이드 있음(티켓박스에서 음성안내기기와 PDA 대여가능)",
                "유모차" to "대여가능",
                "수유실" to "수유실 있음(흥례문, 주차장 여자화장실 내부)",
                "영유아 가족 기타" to "기저귀교환대 있음(수유실, 일반화장실 내부)",
            )
        }

        then("웰니스 한 줄과 출처의 원천 이름이 붙고, 절은 방문 요약 뒤 · 지역 안 위치 앞이다") {
            root shouldContain "<p data-place-section=\"wellness\">웰니스 관광 · 온천 / 사우나 / 스파</p>"
            root shouldContain "<p data-place-section=\"source\">출처: 한국관광공사 TourAPI · 무장애 여행 정보 · 웰니스관광 정보</p>"
            val order = listOf("매주 화요일 휴무", "접근성 정보", "웰니스 관광", "종로구 관광지 120곳").map { root.indexOf(it) }
            order.none { it < 0 } shouldBe true
            order shouldBe order.sorted()
        }

        then("정보가 없는 문서는 절이 없고 출처는 TourAPI 만이다") {
            val plain = rootOf(render(SHELL, doc(attributes = PARSED)))
            plain shouldNotContain "barrier-free"
            plain shouldNotContain "data-place-section=\"wellness\""
            plain shouldContain "<p data-place-section=\"source\">출처: 한국관광공사 TourAPI</p>"
        }
    }

    given("고캠핑 캠핑장 정보가 실린 문서") {
        // 고캠핑 운영 응답(2026-10-07, contentId 8031)에서 place 가 고른 키
        val camping = """{"induty":"일반야영장,자동차야영장","gnrlSiteCo":"25","autoSiteCo":"0","glampSiteCo":"3","sbrsCl":"전기,무선인터넷,장작판매","animalCmgCl":"가능","operPdCl":"봄,여름,가을,겨울","operDeCl":"평일+주말","manageSttus":"운영"}"""
        val root = rootOf(render(SHELL, doc(attributes = PARSED).copy(camping = camping)))
        val section = root.substringAfter("<section data-place-section=\"camping\">").substringBefore("</section>")

        then("「캠핑장 정보」 절에 업종·사이트(0 인 종류 제외)·부대시설·반려동물·운영 기간·운영일·상태가 나가고 출처에 고캠핑이 붙는다") {
            section shouldContain "<h2>캠핑장 정보</h2>"
            Regex("<dt>([^<]*)</dt><dd>([^<]*)</dd>").findAll(section).map { it.groupValues[1] to it.groupValues[2] }.toList() shouldBe listOf(
                "업종" to "일반야영장, 자동차야영장",
                "사이트" to "일반 25 · 글램핑 3",
                "부대시설" to "전기, 무선인터넷, 장작판매",
                "반려동물 동반" to "가능",
                "운영 기간" to "봄, 여름, 가을, 겨울",
                "운영일" to "평일+주말",
                "운영 상태" to "운영",
            )
            root shouldContain "<p data-place-section=\"source\">출처: 한국관광공사 TourAPI · 고캠핑</p>"
        }

        then("캠핑장 정보가 없거나 원문을 못 읽으면 절이 없다") {
            rootOf(render(SHELL, doc(attributes = PARSED))) shouldNotContain "data-place-section=\"camping\""
            rootOf(render(SHELL, doc(attributes = PARSED).copy(camping = "{not json"))) shouldNotContain "data-place-section=\"camping\""
        }
    }

    given("연관 관광지(함께 간 곳)가 실린 문서") {
        // 해운대해수욕장(id 6) 202608 운영 응답에서 place 가 고른 앞의 세 곳(순위 1 · 2 · 4) — 광안리해수욕장은 비슷한 곳에도 있다
        val related = listOf(
            RelatedPlace(1, "3063", "광안리해수욕장", "부산광역시", "자연경관(하천/해양)"),
            RelatedPlace(2, "8", "해동용궁사", "부산광역시", "종교성지"),
            RelatedPlace(4, "7670", "송정해수욕장", "부산광역시", null),
        )
        val similar = listOf(SimilarPlace("3063", "광안리해수욕장", "부산광역시", null), SimilarPlace("4001", "경포해수욕장", "강원특별자치도", null))
        val root = rootOf(render(SHELL, doc(attributes = PARSED, region = REGION, similarElsewhere = similar).copy(relatedPlaces = related)))
        val section = root.substringAfter("<section data-place-section=\"related\">").substringBefore("</section>")

        then("색인에 실린 목록을 그 순서 그대로 상세 링크와 원천 분류로 그린다 — 분류가 없으면 이름만") {
            section shouldContain "<h2>여기 온 사람들이 함께 간 곳</h2>"
            Regex("<li><a href=\"([^\"]+)\">([^<]+)</a>").findAll(section).map { it.groupValues[1] to it.groupValues[2] }.toList() shouldBe
                related.map { "/attractions/${it.id}" to it.title }
            section shouldContain "<li><a href=\"/attractions/3063\">광안리해수욕장</a> · 자연경관(하천/해양)</li>"
            section shouldContain "<li><a href=\"/attractions/7670\">송정해수욕장</a></li>"
        }

        then("비슷한 곳과 겹쳐도 두 절이 각자 그 곳을 그린다 — 절 순서는 비슷한 곳 → 함께 간 곳 → 출처") {
            val similarSection = root.substringAfter("<h2>다른 지역의 비슷한 곳</h2>").substringBefore("</ul>")
            similarSection shouldContain "광안리해수욕장"
            section shouldContain "광안리해수욕장"
            val order = listOf("<h2>다른 지역의 비슷한 곳</h2>", "여기 온 사람들이 함께 간 곳", "data-place-section=\"source\"").map { root.indexOf(it) }
            order.none { it < 0 } shouldBe true
            order shouldBe order.sorted()
        }

        then("출처에 원천 이름이 붙고, 목록이 없는 문서는 절도 원천 이름도 없다") {
            root shouldContain "<p data-place-section=\"source\">출처: 한국관광공사 TourAPI · 빅데이터 서비스(연관 관광지)</p>"
            val plain = rootOf(render(SHELL, doc(attributes = PARSED)))
            plain shouldNotContain "data-place-section=\"related\""
            plain shouldNotContain "연관 관광지"
        }

        then("영문 문서는 영문 제목과 영문 경로") {
            val en = rootOf(render(SHELL, doc(id = "2001", lang = "en").copy(relatedPlaces = listOf(RelatedPlace(1, "4001", "Gwangalli Beach", null, null)))))
            en shouldContain "<h2>Where visitors also went</h2><ul><li><a href=\"/en/attractions/4001\">Gwangalli Beach</a></li></ul>"
        }
    }

    given("영문 문서의 비슷한 곳") {
        val html = render(SHELL, doc(id = "2001", lang = "en", similarElsewhere = listOf(SimilarPlace("4001", "Gyeonggijeon Shrine", "Jeonbuk", null))))

        then("영문 제목과 영문 상세 경로") {
            val root = rootOf(html)
            root shouldContain "<h2>Similar places in other regions</h2>"
            root shouldContain "<li><a href=\"/en/attractions/4001\">Gyeonggijeon Shrine</a> · Jeonbuk</li>"
        }
    }

    given("영문 문서의 지역 안 위치") {
        val region = AttractionRegion("Jongno-gu", 120, 5, "Palaces", emptyList())
        val html = render(SHELL, doc(id = "2001", lang = "en", region = region))

        then("영문 문구와 영문 허브 경로") {
            rootOf(html) shouldContain "Palaces 5 of 120 attractions in Jongno-gu"
            rootOf(html) shouldContain "href=\"/en/regions/11110\""
        }
    }

    given("속성이 모두 UNKNOWN 이거나 옛 색인 문서(속성·지역 없음)") {
        then("배지·지역 절을 그리지 않는다") {
            listOf(doc(attributes = ALL_UNKNOWN), doc()).forEach { d ->
                val root = rootOf(render(SHELL, d))
                root shouldNotContain "주차 가능"
                root shouldNotContain "/regions/11110"
                root shouldContain "<h1>경복궁</h1>"
            }
        }
    }

    given("14일 고유 클릭 방문자 수") {
        val min = AttractionClickSignal.MIN_SAMPLE

        then("최소 표본에 닿으면 배지 줄 끝에 「많이 클릭한 곳」이 붙는다") {
            val root = rootOf(render(SHELL, doc(attributes = PARSED, uniqueClickers14d = min)))
            root shouldContain "<p data-place-section=\"visit-badges\">유모차 대여 없음 · 많이 클릭한 곳</p>"
        }

        then("최소 표본 미만이거나 신호가 없으면 붙지 않는다") {
            listOf(min - 1, 0, null).forEach { n ->
                rootOf(render(SHELL, doc(attributes = PARSED, uniqueClickers14d = n))) shouldNotContain "많이 클릭한 곳"
            }
        }

        then("속성이 없는 옛 문서여도 이 배지 하나로 배지 줄을 그린다") {
            val root = rootOf(render(SHELL, doc(uniqueClickers14d = min)))
            root shouldContain "<p data-place-section=\"visit-badges\">많이 클릭한 곳</p>"
        }

        then("영문 문구") {
            val root = rootOf(render(SHELL, doc(id = "2001", lang = "en", uniqueClickers14d = min)))
            root shouldContain "<p data-place-section=\"visit-badges\">Frequently clicked</p>"
        }

        then("배지 항목이 하나도 없으면 배지 줄이 없다") {
            rootOf(render(SHELL, doc(attributes = ALL_UNKNOWN))) shouldNotContain "visit-badges"
        }
    }

    given("이 사이트 근거 줄 (찜 · 클릭)") {
        // 경계는 리터럴이다 — 상수 이름으로 만들면 상수를 낮춰도 초록이다
        fun signals(d: AttractionDocument): List<String> {
            val block = Regex("""<div data-place-section="visit-signals">([\s\S]*?)</div>""").find(rootOf(render(SHELL, d)))
                ?.groupValues?.get(1) ?: return emptyList()
            return Regex("""<p>([\s\S]*?)</p>""").findAll(block).map { it.groupValues[1] }.toList()
        }
        val asOf = LocalDate.of(2026, 10, 10)

        then("찜 3 · 클릭 5 — 두 줄에 기준일을 붙인다") {
            signals(doc().copy(savedCount = 3, uniqueClickers14d = 5, signalsAsOf = asOf)) shouldBe listOf(
                "이 사이트 회원 3명이 찜했습니다 · 2026-10-10 기준",
                "최근 14일 이 사이트에서 5명이 눌렀습니다(같은 사람은 한 번) · 2026-10-10 기준",
            )
        }

        then("찜 2 · 클릭 4 — 하한 미만은 줄도 절도 없다") {
            rootOf(render(SHELL, doc().copy(savedCount = 2, uniqueClickers14d = 4, signalsAsOf = asOf))) shouldNotContain "visit-signals"
        }

        then("기준일이 없는 옛 문서는 「기준」 없이") {
            signals(doc().copy(savedCount = 12)) shouldBe listOf("이 사이트 회원 12명이 찜했습니다")
        }

        then("영문 — 같은 두 문장, visitor 없음") {
            val lines = signals(doc(id = "2001", lang = "en").copy(savedCount = 3, uniqueClickers14d = 5, signalsAsOf = asOf))
            lines shouldBe listOf(
                "3 members of this site saved this · as of 2026-10-10",
                "5 people on this site clicked this in the last 14 days (each person counted once) · as of 2026-10-10",
            )
            lines.forEach { it.lowercase() shouldNotContain "visitor" }
        }

        then("근거 묶음은 방문 요약·배지 줄 뒤, 개요 앞 — 행동 줄은 그보다 위다") {
            val root = rootOf(render(SHELL, doc(attributes = PARSED).copy(savedCount = 3)))
            val order = listOf(
                "data-place-section=\"actions\"",
                "data-place-section=\"visit-summary\"",
                "data-place-section=\"visit-badges\"",
                "data-place-section=\"visit-signals\"",
                "조선 왕조의 법궁",
            ).map { root.indexOf(it) }
            order.none { it < 0 } shouldBe true
            order shouldBe order.sorted()
        }

        then("행사·숙박 같은 유형 문서에도 같은 줄이 행동 줄 뒤에 나온다") {
            val root = rootOf(render(SHELL, stay().copy(savedCount = 3)))
            root shouldContain "<div data-place-section=\"visit-signals\"><p>이 사이트 회원 3명이 찜했습니다</p></div>"
            (root.indexOf("data-place-section=\"actions\"") in 0 until root.indexOf("data-place-section=\"visit-signals\"")) shouldBe true
        }

        then("렌더러 출력에 「인기」「많이 본」「핫플」이 없고, 근거 줄에 「방문자」가 없다") {
            listOf("ko", "en").forEach { lang ->
                val root = rootOf(render(SHELL, doc(id = if (lang == "en") "2001" else "1001", lang = lang).copy(savedCount = 40, uniqueClickers14d = 40, signalsAsOf = asOf)))
                listOf("인기", "많이 본", "핫플").forEach { root shouldNotContain it }
                signals(doc(lang = lang).copy(savedCount = 40, uniqueClickers14d = 40, signalsAsOf = asOf)).forEach { it shouldNotContain "방문자" }
            }
        }
    }

    given("가까운 역·정류장") {
        // 경계·기대 문구는 리터럴이다
        val date = LocalDate.of(2024, 12, 31)
        fun rail(name: String, m: Int, lines: String? = null, en: String? = null, rank: Int = 1) =
            AttractionAccess.Stop(TransitKind.RAIL, rank, name, en, lines, m, date)
        fun bus(name: String, m: Int, rank: Int = 1) = AttractionAccess.Stop(TransitKind.BUS, rank, name, null, null, m, LocalDate.of(2025, 10, 31))
        fun section(d: AttractionDocument): String? =
            Regex("""<section data-place-section="access">([\s\S]*?)</section>""").find(rootOf(render(SHELL, d)))?.groupValues?.get(1)
        fun items(d: AttractionDocument) = Regex("""<li>([\s\S]*?)</li>""").findAll(section(d).orEmpty()).map { it.groupValues[1] }.toList()

        then("모든 거리 앞에 「직선거리」, 999m · 1.0km · 1.1km, 「서울역」에 역을 다시 붙이지 않는다") {
            val d = doc().copy(
                access = AttractionAccess(
                    listOf(rail("서울역", 999, "1·4호선"), rail("시청", 1000, "1·2호선", rank = 2), bus("세종문화회관", 1049), bus("광화문", 1050, rank = 2)),
                    true,
                ),
            )
            items(d) shouldBe listOf(
                "서울역 (1·4호선) · 직선거리 999m",
                "시청역 (1·2호선) · 직선거리 1.0km",
                "세종문화회관 버스정류장 · 직선거리 1.0km",
                "광화문 버스정류장 · 직선거리 1.1km",
            )
            section(d)!! shouldNotContain "서울역역"
            section(d)!! shouldNotContain "도보"
            section(d)!! shouldContain "<p data-access=\"note\">직선거리이며 실제 걷는 길은 더 깁니다 · 자료 기준일 2025-10-31</p>"
            section(d)!! shouldContain "<p data-access=\"source\">출처: 국가철도공단 도시철도 역사정보 · 국토교통부 전국 버스정류장 위치정보</p>"
        }

        then("버스 원천 미연계면 정류장 자리에 「자료 없음」, 연계 지역의 범위 밖이면 버스 줄이 없다") {
            items(doc().copy(access = AttractionAccess(listOf(rail("서울역", 999)), false))) shouldBe
                listOf("서울역 · 직선거리 999m", "이 지역은 버스정류장 위치 자료가 없습니다")
            items(doc().copy(access = AttractionAccess(emptyList(), false))) shouldBe listOf("이 지역은 버스정류장 위치 자료가 없습니다")
            items(doc().copy(access = AttractionAccess(listOf(rail("서울역", 999)), true))) shouldBe listOf("서울역 · 직선거리 999m")
        }

        then("보일 것이 없으면 절이 없다") {
            listOf(null, AttractionAccess(emptyList(), true), AttractionAccess(emptyList(), null)).forEach { access ->
                rootOf(render(SHELL, doc().copy(access = access))) shouldNotContain "data-place-section=\"access\""
            }
        }

        then("영문 — 영문 역명·「Line」 노선, 정류장은 국문 이름에 「Bus stop」") {
            items(doc(id = "2001", lang = "en").copy(access = AttractionAccess(listOf(rail("서울역", 999, "1·4호선", "Seoul Station"), bus("광화문", 120)), true))) shouldBe
                listOf("Seoul Station (Line 1·4) · straight-line 999m", "Bus stop 광화문 · straight-line 120m")
        }

        then("절은 행동 줄 바로 뒤, 방문 요약 앞이다 — 화면과 같은 자리") {
            val root = rootOf(render(SHELL, doc(attributes = PARSED).copy(access = AttractionAccess(listOf(rail("경복궁", 420, "3호선")), true))))
            val order = listOf(
                "data-place-section=\"actions\"",
                "data-place-section=\"access\"",
                "data-place-section=\"visit-summary\"",
            ).map { root.indexOf(it) }
            order.none { it < 0 } shouldBe true
            order shouldBe order.sorted()
        }
    }

    given("셸을 한 번도 받지 못했을 때") {
        val html = render(null, doc())

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

    // ─── 유형별 본문 (행사 · 숙박 · 여행코스) ────────────────────────────────

    fun robotsOf(html: String): String? =
        Regex("""<meta name="robots" content="([^"]*)" />""").find(html)?.groupValues?.get(1)

    fun statusOf(html: String): String? =
        Regex("""<p data-event-status>([^<]*)</p>""").find(rootOf(html))?.groupValues?.get(1)

    fun primaryJsonLdType(html: String): String? =
        Regex(""""@type":"([A-Za-z]+)"""").find(html.substringAfter("application/ld+json"))?.groupValues?.get(1)

    given("행사 문서의 상태 문구") {
        val period = EventPeriod(LocalDate.of(2026, 10, 5), LocalDate.of(2026, 10, 7))

        then("렌더 날짜마다 공용 함수(EventStatusText)의 출력과 같은 문구가 나간다 — 국·영, 시작 전·당일·진행·종료") {
            var day = LocalDate.of(2026, 9, 20)
            val seen = mutableSetOf<EventStatus>()
            while (!day.isAfter(LocalDate.of(2026, 11, 20))) {
                for (lang in listOf("ko", "en")) {
                    val html = render(SHELL, event(lang = lang, period = period), day)
                    statusOf(html) shouldBe EventStatusText.of(period, day, lang)
                }
                seen += EventSchedule.status(period, day)
                day = day.plusDays(1)
            }
            seen shouldBe setOf(EventStatus.UPCOMING, EventStatus.ONGOING, EventStatus.ENDED)
        }

        then("하루 전 영문은 「Starts tomorrow」, 국문은 「D-1 시작」") {
            statusOf(render(SHELL, event(lang = "en", period = period), LocalDate.of(2026, 10, 4))) shouldBe "Starts tomorrow"
            statusOf(render(SHELL, event(lang = "ko", period = period), LocalDate.of(2026, 10, 4))) shouldBe "D-1 시작"
        }

        then("날짜 없는 행사(UNKNOWN)는 상태 문구와 기간 줄이 없다") {
            val root = rootOf(render(SHELL, event(period = null)))
            root shouldNotContain "data-event-status"
            root shouldNotContain "<dt>기간</dt>"
            root shouldContain "<dt>행사 장소</dt>"
        }
    }

    given("행사 문서의 본문") {
        val root = rootOf(render(SHELL, event()))

        then("기간 · 행사 원문 키(장소 · 공연 시간 · 이용 요금 · 주최)가 평문으로 나간다 — 허용 목록 밖 키는 없다") {
            root shouldContain "<section data-place-section=\"event\">"
            root shouldContain "<dt>기간</dt><dd>2026-09-28 ~ 2026-10-05</dd>"
            root shouldContain "<dt>행사 장소</dt><dd>여의도 한강공원 일대</dd>"
            root shouldContain "<dt>공연 시간</dt><dd>19:00~21:00</dd>"
            root shouldContain "<dt>이용 요금</dt><dd>무료</dd>"
            root shouldContain "<dt>주최</dt><dd>한화 &amp; 서울시</dd>"
            root shouldNotContain "fireworks.example"
            root shouldNotContain "3113671"
        }

        then("일반 「이용 안내」는 그리지 않는다 — 같은 원문 키에서 온 파생 값이 두 번 나가지 않게") {
            root shouldNotContain "<h2>이용 안내</h2>"
        }

        then("JSON-LD 는 Event 다") {
            primaryJsonLdType(render(SHELL, event())) shouldBe "Event"
        }
    }

    given("행사 robots — 개요 없음 OR (행사 ∧ 유효 종료일 + 31일 ≤ 오늘)") {
        val end = LocalDate.of(2026, 8, 31)
        val ended = EventPeriod(LocalDate.of(2026, 8, 20), end)

        then("종료 + 30일은 색인 대상, + 31일부터 noindex, follow") {
            robotsOf(render(SHELL, event(period = ended), end.plusDays(30))) shouldBe null
            robotsOf(render(SHELL, event(period = ended), end.plusDays(31))) shouldBe "noindex, follow"
        }

        then("종료된 행사도 30일 안에는 200 본문에 「종료된 행사」를 그린다") {
            statusOf(render(SHELL, event(period = ended), end.plusDays(1))) shouldBe "종료된 행사"
        }

        then("진행 중이어도 개요가 없으면 noindex — 두 조건은 OR 이다") {
            robotsOf(render(SHELL, event(overview = null))) shouldBe "noindex, follow"
        }

        then("날짜 없는 행사는 개요가 있으면 색인 대상이다") {
            robotsOf(render(SHELL, event(period = null), LocalDate.of(2030, 1, 1))) shouldBe null
        }

        then("행사가 아닌 문서는 날짜와 무관하다") {
            robotsOf(render(SHELL, doc(), LocalDate.of(2030, 1, 1))) shouldBe null
        }
    }

    given("가까운 곳·비슷한 곳 항목에 재색인 뒤 끝난 행사가 섞여 있을 때") {
        val region = AttractionRegion(
            sigunguName = "영등포구", typeCount = 4, categoryCount = 2, categoryName = "지역축제",
            sameCategoryNearby = listOf(
                NearbyPlace("5101", "어제 끝난 축제", 900, TODAY.minusDays(1)),
                NearbyPlace("5102", "오늘 끝나는 축제", 1200, TODAY),
                NearbyPlace("5103", "관광지 항목", 1500, null),
            ),
        )
        val similar = listOf(
            SimilarPlace("5201", "지난달 축제", "부산광역시", TODAY.minusDays(20)),
            SimilarPlace("5202", "다음 달 축제", "대구광역시", TODAY.plusDays(30)),
        )
        val root = rootOf(render(SHELL, event(region = region, similarElsewhere = similar)))

        then("오늘 이전에 끝난 항목은 빠지고, 오늘 끝나는 항목·행사 아닌 항목은 남는다") {
            root shouldNotContain "어제 끝난 축제"
            root shouldContain "오늘 끝나는 축제"
            root shouldContain "관광지 항목"
            root shouldNotContain "지난달 축제"
            root shouldContain "다음 달 축제"
        }

        then("남은 항목이 하나도 없으면 절 제목도 없다") {
            val allEnded = region.copy(sameCategoryNearby = listOf(NearbyPlace("5101", "어제 끝난 축제", 900, TODAY.minusDays(1))))
            val r = rootOf(render(SHELL, event(region = allEnded, similarElsewhere = similar.take(1))))
            r shouldNotContain "같은 분류 가까운 곳"
            r shouldNotContain "<h2>다른 지역의 비슷한 곳</h2>"
        }
    }

    given("끝난 행사 자기 문서의 지역 건수가 0 일 때") {
        val region = AttractionRegion("영등포구", 0, 0, "지역축제", emptyList())
        val root = rootOf(render(SHELL, event(period = EventPeriod(LocalDate.of(2026, 8, 1), LocalDate.of(2026, 8, 10)), region = region)))

        then("「0곳」 문구를 그리지 않고 시군구 허브 링크는 남긴다") {
            root shouldNotContain "0곳"
            root shouldContain "영등포구 둘러보기"
        }
    }

    given("숙박 문서") {
        then("픽스처 원문에 예약 URL·예약 안내 키가 들어 있다(아래 단언의 전제)") {
            STAY_INTRO shouldContain "\"reservationurl\""
            STAY_INTRO shouldContain "\"reservationlodging\""
        }

        val root = rootOf(render(SHELL, stay()))

        then("허용 목록(입실 · 퇴실 · 객실 수 · 객실 유형 · 주차 · 부대시설)만 그린다") {
            root shouldContain "<section data-place-section=\"stay\">"
            root shouldContain "<dt>입실</dt><dd>15:00</dd>"
            root shouldContain "<dt>퇴실</dt><dd>11:00</dd>"
            root shouldContain "<dt>객실 수</dt><dd>5</dd>"
            root shouldContain "<dt>객실 유형</dt><dd>온돌방</dd>"
            root shouldContain "<dt>주차</dt><dd>불가</dd>"
            root shouldContain "<dt>부대시설</dt><dd>바비큐장</dd>"
        }

        then("예약 URL · 예약 안내 · 허용 목록 밖 원문은 출력에 없다") {
            root shouldNotContain "booking.example.com"
            root shouldNotContain "예약"
            root shouldNotContain "환불 규정"
        }

        then("일반 「이용 안내」의 주차 파생 값을 따로 그리지 않는다 — 주차가 두 번 나가지 않게") {
            root shouldNotContain "<h2>이용 안내</h2>"
        }

        then("영문 라벨과 LodgingBusiness") {
            val html = render(SHELL, stay(lang = "en"))
            rootOf(html) shouldContain "<dt>Check-in</dt><dd>15:00</dd>"
            primaryJsonLdType(html) shouldBe "LodgingBusiness"
        }
    }

    given("여행코스 문서") {
        val html = render(SHELL, course())
        val root = rootOf(html)

        then("코스 구성이 원천 순서대로 나가고 매칭된 지점만 상세 링크다") {
            root shouldContain "<section data-place-section=\"course\">"
            val positions = COURSE_STOPS.map { root.indexOf(it.name) }
            positions.none { it < 0 } shouldBe true
            positions shouldBe positions.sorted()
            root shouldContain "<li><a href=\"/attractions/7001\">해운대해수욕장</a></li>"
            root shouldContain "<li>광안리 카페거리</li>"
            root shouldContain "<li><a href=\"/attractions/7003\">감천문화마을</a></li>"
        }

        then("총 거리 · 소요 시간 원문 — 허용 목록 밖 키는 없다") {
            root shouldContain "<dt>총 거리</dt><dd>12.5km</dd>"
            root shouldContain "<dt>소요 시간</dt><dd>당일</dd>"
            root shouldNotContain "테마 원문"
        }

        then("JSON-LD 는 TouristTrip 이고 itinerary 가 같은 순서다") {
            primaryJsonLdType(html) shouldBe "TouristTrip"
            val names = Regex(""""name":"([^"]*)"""").findAll(html.substringAfter("\"itinerary\"").substringBefore("</script>"))
                .map { it.groupValues[1] }.toList()
            names shouldBe COURSE_STOPS.map { it.name }
        }

        then("코스 구성을 못 읽은 문서는 목록 없이 원문 줄만") {
            val r = rootOf(render(SHELL, course(stops = null)))
            r shouldNotContain "<ol>"
            r shouldContain "<dt>총 거리</dt>"
        }
    }

    given("출처 문구와 광고 지면") {
        then("본문 끝(바닥글 앞)에 국·영 출처 문구가 있다 — 모든 유형") {
            listOf(doc(), event(), stay(), course()).forEach { d ->
                val root = rootOf(render(SHELL, d))
                root shouldContain "<p data-place-section=\"source\">출처: 한국관광공사 TourAPI</p></main><footer>"
            }
            rootOf(render(SHELL, stay(lang = "en"))) shouldContain
                "<p data-place-section=\"source\">Source: Korea Tourism Organization TourAPI</p></main><footer>"
        }

        then("새 유형 상세에 attraction-end 지면이 없다") {
            listOf(event(), stay(), course()).forEach { d ->
                val html = render(SHELL, d)
                html shouldNotContain "attraction-end"
                html shouldNotContain "adsbygoogle"
            }
        }
    }

    given("원천 사진 주소가 http tong 일 때") {
        val http = doc().copy(imageUrl = "http://tong.visitkorea.or.kr/cms/resource/33/1.jpg")
        val html = render(SHELL, http)

        then("og:image · og:image:secure_url · JSON-LD image 가 셋 다 https") {
            val https = "https://tong.visitkorea.or.kr/cms/resource/33/1.jpg"
            Regex("""<meta property="og:image" content="([^"]*)" />""").find(html)!!.groupValues[1] shouldBe https
            Regex("""<meta property="og:image:secure_url" content="([^"]*)" />""").find(html)!!.groupValues[1] shouldBe https
            val jsonLd = Regex("""<script type="application/ld\+json" data-seo-multi>([\s\S]*?)</script>""")
                .findAll(html).map { ObjectMapper().readTree(it.groupValues[1]) }.first()
            jsonLd["image"]["contentUrl"].asString() shouldBe https
            html shouldNotContain "http://tong."
        }

        then("https 원천으로 그린 HTML 과 바이트가 같다") {
            html shouldBe render(SHELL, doc())
        }
    }

    given("본문 랜드마크") {
        val pages = mapOf(
            "관광지" to render(SHELL, doc()),
            "셸 없는 관광지" to render(null, doc()),
            "없는 관광지" to renderer.notFoundPage(SHELL, "ko"),
        )
        pages.forEach { (name, html) ->
            then("$name — <main> 이 하나이고 제목을 품으며 바닥글은 그 밖이다") {
                Regex("<main[ >]").findAll(html).toList() shouldHaveSize 1
                val main = html.substringAfter("<main>").substringBefore("</main>")
                main shouldContain "<h1>"
                main shouldNotContain "<footer>"
                html.substringAfter("</main>") shouldContain "<footer>"
            }
        }
    }


    // ─── 첫 화면 (방문 요약 · 배지 줄 · 행동 줄) · 고유 블록 ─────────────────────

    fun section(root: String, name: String): String? =
        Regex("""<(?:dl|p|section) data-place-section="$name">([\s\S]*?)</(?:dl|p|section)>""").find(root)?.groupValues?.get(1)

    fun summaryValue(root: String, label: String): String? =
        Regex("""<dt>${Regex.escape(label)}</dt><dd>([\s\S]*?)</dd>""").find(section(root, "visit-summary").orEmpty())?.groupValues?.get(1)

    given("행사·숙박·코스 문서") {
        then("방문 요약·배지 줄 없이 유형별 절과 배지 절을 그대로 두고 행동 줄만 붙는다") {
            listOf(event(), stay().copy(attributes = PARSED), course()).forEach { d ->
                val root = rootOf(render(SHELL, d))
                root shouldNotContain "visit-summary"
                root shouldNotContain "visit-badges"
                root shouldContain "<p data-place-section=\"actions\"><a href=\"tel:0237003900\">02-3700-3900</a></p>"
            }
            val stayRoot = rootOf(render(SHELL, stay().copy(attributes = PARSED)))
            stayRoot shouldContain "<h2>방문 정보 요약</h2>"
            stayRoot shouldContain "<li>입장 무료</li>"
            val order = listOf("<h1>", "data-place-section=\"actions\"", "북촌의 한옥 숙소", "data-place-section=\"stay\"", "방문 정보 요약")
                .map { stayRoot.indexOf(it) }
            order.none { it < 0 } shouldBe true
            order shouldBe order.sorted()
        }
    }

    given("행동 줄") {
        then("전화 원문이 없으면 절이 없다") {
            rootOf(render(SHELL, doc().copy(tel = null, infoCenter = null))) shouldNotContain "data-place-section=\"actions\""
            rootOf(render(SHELL, doc().copy(tel = "", infoCenter = "<br>"))) shouldNotContain "data-place-section=\"actions\""
        }

        then("번호를 못 찾으면 링크 없이 원문만") {
            rootOf(render(SHELL, doc().copy(infoCenter = "문의: 없음"))) shouldContain
                "<p data-place-section=\"actions\">문의: 없음</p>"
        }

        then("길찾기 링크는 서버 렌더에 없다 — 화면 전용") {
            val actions = section(rootOf(render(SHELL, doc())), "actions").orEmpty()
            actions shouldNotContain "maps"
            Regex("<a ").findAll(actions).toList() shouldHaveSize 1
        }

        then("tel: href 와 원문은 이스케이프된다") {
            val root = rootOf(render(SHELL, doc().copy(infoCenter = "\"관리소\" <b>02-123-4567</b> & 매표소")))
            root shouldContain "<p data-place-section=\"actions\"><a href=\"tel:021234567\">&quot;관리소&quot; 02-123-4567 &amp; 매표소</a></p>"
        }
    }

    given("전화 중복") {
        then("infoCenter 가 비고 tel 만 있으면 제목 아래 전화 줄이 없고 행동 줄이 tel 을 쓴다") {
            val root = rootOf(render(SHELL, doc().copy(infoCenter = null)))
            Regex("02-3700-3900").findAll(root).toList() shouldHaveSize 1
            section(root, "actions") shouldBe "<a href=\"tel:0237003900\">02-3700-3900</a>"
        }

        then("둘 다 있으면 제목 아래 tel 줄과 행동 줄의 infoCenter 가 둘 다 보인다") {
            val root = rootOf(render(SHELL, doc().copy(infoCenter = "관리사무소 02-2148-1800")))
            root shouldContain "<p>02-3700-3900</p>"
            section(root, "actions") shouldBe "<a href=\"tel:0221481800\">관리사무소 02-2148-1800</a>"
        }
    }

    given("요금 칸 — feeText 는 이미 정규화된 평문") {
        then("태그 모양 글자가 요소가 되지 않는다 — escapeHtml 만 거친다") {
            val root = rootOf(render(SHELL, doc().copy(feeText = "<img src=x onerror=alert(1)> \"무료\"")))
            val summary = section(root, "visit-summary").orEmpty()
            summary shouldContain "&lt;img src=x onerror=alert(1)&gt; &quot;무료&quot;"
            summary shouldNotContain "<img"
        }

        then("「<어린이> 무료」는 그대로 보인다 — sourceText 를 다시 걸면 「무료」만 남는다") {
            summaryValue(rootOf(render(SHELL, doc().copy(feeText = "<어린이> 무료"))), "요금") shouldBe "&lt;어린이&gt; 무료"
        }

        then("feeText 가 없으면 원천 useFee 를 정규화해 쓰고, 둘 다 없으면 「정보 없음」") {
            summaryValue(rootOf(render(SHELL, doc().copy(useFee = "어른 1,000원<br>&lt;어린이&gt; 무료"))), "요금") shouldBe
                "어른 1,000원\n&lt;어린이&gt; 무료"
            summaryValue(rootOf(render(SHELL, doc())), "요금") shouldBe "정보 없음"
            summaryValue(rootOf(render(SHELL, doc(id = "2001", lang = "en"))), "Admission") shouldBe "Not provided"
        }
    }

    given("확인 상태 칸") {
        val updated = java.time.LocalDateTime.of(2026, 9, 30, 10, 15)

        then("출처 표시명과 원천 갱신일, 수집일은 「정보 없음」") {
            summaryValue(rootOf(render(SHELL, doc().copy(source = "TOURAPI", modifiedAt = updated))), "확인 상태") shouldBe
                "출처: 한국관광공사 TourAPI · 원천 갱신일: 2026-09-30 · 수집일: 정보 없음"
            summaryValue(rootOf(render(SHELL, doc(id = "2001", lang = "en").copy(source = "GOCAMPING", modifiedAt = updated))), "Data status") shouldBe
                "Source: Korea Tourism Organization GoCamping · Source updated: 2026-09-30 · Collected: Not provided"
        }

        then("출처가 없거나 모르는 값이면 「출처: 정보 없음」, 갱신일이 없으면 「원천 갱신일: 정보 없음」") {
            listOf(null, "KTO_ETC").forEach { source ->
                summaryValue(rootOf(render(SHELL, doc().copy(source = source))), "확인 상태") shouldBe
                    "출처: 정보 없음 · 원천 갱신일: 정보 없음 · 수집일: 정보 없음"
            }
        }
    }

    given("바닥 출처 줄") {
        val camping = """{"induty":"일반야영장"}"""

        then("고캠핑 원천 + 캠핑장 정보면 첫 항목이 고캠핑이고 「고캠핑」은 한 번만") {
            val root = rootOf(render(SHELL, doc().copy(source = "GOCAMPING", camping = camping)))
            root shouldContain "<p data-place-section=\"source\">출처: 한국관광공사 고캠핑</p>"
            val en = rootOf(render(SHELL, doc(id = "2001", lang = "en").copy(source = "GOCAMPING", camping = camping)))
            en shouldContain "<p data-place-section=\"source\">Source: Korea Tourism Organization GoCamping</p>"
        }

        then("TourAPI·없음·모르는 값이면 지금 고정 문구 — 의무 문구라 비우지 않는다") {
            listOf("TOURAPI", null, "KTO_ETC").forEach { source ->
                rootOf(render(SHELL, doc().copy(source = source, camping = camping))) shouldContain
                    "<p data-place-section=\"source\">출처: 한국관광공사 TourAPI · 고캠핑</p>"
            }
        }
    }

    given("브레드크럼 시군구") {
        fun breadcrumbOf(html: String): List<Pair<String, String>> {
            val json = Regex("""<script type="application/ld\+json" data-seo-multi>([\s\S]*?)</script>""")
                .findAll(html).map { ObjectMapper().readTree(it.groupValues[1]) }.toList()[1]
            val items = json["itemListElement"]
            return (0 until items.size()).map { items[it]["name"].asString() to items[it]["item"].asString() }
        }

        then("시도·시군구 코드와 시군구 이름을 알면 화면과 BreadcrumbList 에 시군구 단계가 있다") {
            val html = render(SHELL, doc(region = REGION))
            rootOf(html) shouldContain
                "<nav><a href=\"/\">한국 관광지 탐색</a> › <a href=\"/regions/11\">서울특별시</a> › <a href=\"/regions/11110\">종로구</a></nav>"
            breadcrumbOf(html) shouldBe listOf(
                "한국 관광지 탐색" to "https://place.1989v.com/",
                "서울특별시" to "https://place.1989v.com/regions/11",
                "종로구" to "https://place.1989v.com/regions/11110",
                "경복궁" to "https://place.1989v.com/attractions/1001",
            )
        }

        then("시군구 이름이 없으면 시도까지 — 원문 시군구 이름은 평문화 · 이스케이프된다") {
            val html = render(SHELL, doc())
            rootOf(html) shouldContain "<nav><a href=\"/\">한국 관광지 탐색</a> › <a href=\"/regions/11\">서울특별시</a></nav>"
            breadcrumbOf(html) shouldHaveSize 3
            rootOf(render(SHELL, doc(region = REGION.copy(sigunguName = "종로<b>구</b> &amp; \"x\"")))) shouldContain
                "<a href=\"/regions/11110\">종로구 &amp; &quot;x&quot;</a></nav>"
        }

        then("시도가 없으면 시군구 단계도 없다") {
            breadcrumbOf(render(SHELL, doc(region = REGION, sidoName = null))) shouldHaveSize 2
        }
    }

    given("같은 분류 가까운 곳 (독립 절)") {
        then("지역 안 위치 밖 독립 절로 나간다") {
            val root = rootOf(render(SHELL, doc(region = REGION)))
            section(root, "same-category-nearby") shouldBe
                "<h2>같은 분류 가까운 곳</h2><ul><li><a href=\"/attractions/1002\">창덕궁</a> · 1.5km</li>" +
                "<li><a href=\"/attractions/1003\">덕수궁 &lt;별관&gt;</a> · 820m</li></ul>"
        }

        then("목록이 비었거나 모두 끝난 행사면 절이 없다") {
            rootOf(render(SHELL, doc(region = REGION.copy(sameCategoryNearby = emptyList())))) shouldNotContain "same-category-nearby"
            val allEnded = REGION.copy(sameCategoryNearby = listOf(NearbyPlace("5101", "어제 끝난 축제", 900, TODAY.minusDays(1))))
            val root = rootOf(render(SHELL, doc(region = allEnded)))
            root shouldNotContain "same-category-nearby"
            root shouldNotContain "같은 분류 가까운 곳"
        }
    }

    given("대표 사진 <img>") {
        fun imgOf(d: AttractionDocument): String? = Regex("<img [^>]*>").find(rootOf(render(SHELL, d)))?.value

        then("https 는 그대로, alt 는 제목이고 크기 속성은 없다") {
            imgOf(doc(title = "경복궁 <정궁>")) shouldBe
                "<img src=\"https://tong.visitkorea.or.kr/cms/resource/33/1.jpg\" alt=\"경복궁 &lt;정궁&gt;\">"
        }

        then("tong http 는 https 로 바꿔 낸다") {
            imgOf(doc().copy(imageUrl = "http://tong.visitkorea.or.kr/cms/resource/33/1.jpg")) shouldBe
                "<img src=\"https://tong.visitkorea.or.kr/cms/resource/33/1.jpg\" alt=\"경복궁\">"
        }

        then("그 밖의 http 와 사진 없음은 내지 않는다") {
            imgOf(doc().copy(imageUrl = "http://example.com/1.jpg")) shouldBe null
            imgOf(doc().copy(imageUrl = null)) shouldBe null
            imgOf(doc().copy(imageUrl = "")) shouldBe null
        }
    }

    given("유형별 골든 HTML (T11)") {
        // 갱신은 명시 플래그로만: UPDATE_RENDER_GOLDEN=1 ./gradlew :search:app:test --tests '*AttractionPageRendererTest'
        val update = System.getenv("UPDATE_RENDER_GOLDEN") == "1"
        val dir = File("src/test/resources/render/golden")
        val ended = EventPeriod(LocalDate.of(2026, 8, 20), LocalDate.of(2026, 8, 31))
        val nearbyRegion = AttractionRegion(
            "영등포구", 4, 2, "지역축제",
            listOf(NearbyPlace("5101", "어제 끝난 축제", 900, TODAY.minusDays(1)), NearbyPlace("5103", "여의도공원", 1500, null)),
        )
        val cases = mapOf(
            "event-ongoing-ko" to event(region = nearbyRegion, similarElsewhere = listOf(SimilarPlace("5201", "지난달 축제", "부산광역시", TODAY.minusDays(20)))),
            "event-ongoing-en" to event(id = "6001", lang = "en", introRaw = "{\"eventplace\":\"Yeouido Hangang Park\"}"),
            "event-ended-ko" to event(period = ended, region = AttractionRegion("영등포구", 0, 0, "지역축제", emptyList())),
            "event-ended-en" to event(id = "6002", lang = "en", period = ended),
            "event-unknown-ko" to event(period = null),
            "event-unknown-en" to event(id = "6003", lang = "en", period = null),
            "stay-ko" to stay(),
            "stay-en" to stay(lang = "en"),
            "course-ko" to course(),
            "attraction-http-image-ko" to doc().copy(imageUrl = "http://tong.visitkorea.or.kr/cms/resource/33/1.jpg"),
            // 관광지(12/76) 첫 화면 — 행동 줄 · 방문 요약 · 배지 줄 · 사진 · 시군구 · 같은 분류 가까운 곳 · 출처
            "attraction-ko" to richAttraction("ko"),
            "attraction-en" to richAttraction("en"),
        )
        cases.forEach { (name, d) ->
            then(name) {
                val html = render(SHELL, d)
                val file = File(dir, "$name.html")
                if (update) {
                    dir.mkdirs()
                    file.writeText(html)
                }
                check(file.exists()) { "골든 없음: ${file.path} — UPDATE_RENDER_GOLDEN=1 로 만든다" }
                html shouldBe file.readText()
            }
        }
    }
})

/** 골든용 관광지 — 첫 화면의 모든 절이 나오는 문서 */
private fun richAttraction(lang: String): AttractionDocument {
    val en = lang == "en"
    return doc(
        id = if (en) "2001" else "1001",
        lang = lang,
        title = if (en) "Gyeongbokgung Palace" else "경복궁",
        attributes = PARSED,
        region = if (en) REGION.copy(sigunguName = "Jongno-gu", categoryName = "Palaces") else REGION,
        similarElsewhere = SIMILAR,
        uniqueClickers14d = AttractionClickSignal.MIN_SAMPLE,
    ).copy(
        source = "TOURAPI",
        copyrightDivCd = "Type1",
        modifiedAt = java.time.LocalDateTime.of(2026, 9, 30, 10, 15),
        feeText = if (en) "Adults 3,000 won / Children <free>" else "어른 3,000원 / <어린이> 무료",
        infoCenter = if (en) "+82-2-3700-3900" else "경복궁 관리소 02-3700-3900",
        petAcmpyType = if (en) null else "동반 불가",
        barrierFree = GYEONGBOKGUNG_BARRIER_FREE,
    )
}
