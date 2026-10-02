package com.kgd.search.infrastructure.render

import com.kgd.search.domain.attraction.model.AttractionClickSignal
import com.kgd.search.domain.attraction.model.AttractionDocument
import com.kgd.search.domain.attraction.model.AttractionRegion
import com.kgd.search.domain.attraction.model.EventPeriod
import com.kgd.search.domain.attraction.model.EventSchedule
import com.kgd.search.domain.attraction.model.EventStatus
import com.kgd.search.domain.attraction.model.EventStatusText
import com.kgd.search.domain.attraction.model.NearbyPlace
import com.kgd.search.domain.attraction.model.SimilarPlace
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

    given("속성이 해석된 문서") {
        val html = render(SHELL, doc(attributes = PARSED, region = REGION, similarElsewhere = SIMILAR))
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

        then("「무장애 정보」 절에 긍정 아이콘 줄이 정해진 순서로 나간다 — 값이 없는 엘리베이터는 없다") {
            section shouldContain "<h2>무장애 정보</h2>"
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

        then("웰니스 한 줄과 출처의 원천 이름이 붙고, 절은 배지 뒤 · 지역 안 위치 앞이다") {
            root shouldContain "<p data-place-section=\"wellness\">웰니스 관광 · 온천 / 사우나 / 스파</p>"
            root shouldContain "<p data-place-section=\"source\">출처: 한국관광공사 TourAPI · 무장애 여행 정보 · 웰니스관광 정보</p>"
            val order = listOf("매주 화요일 휴무", "무장애 정보", "웰니스 관광", "종로구 관광지 120곳").map { root.indexOf(it) }
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

        then("최소 표본에 닿으면 배지 목록 끝에 「많이 클릭한 곳」이 붙는다") {
            val root = rootOf(render(SHELL, doc(attributes = PARSED, uniqueClickers14d = min)))
            root shouldContain "<li>많이 클릭한 곳</li>"
            (root.indexOf("입장 무료") < root.indexOf("많이 클릭한 곳")) shouldBe true
        }

        then("최소 표본 미만이거나 신호가 없으면 붙지 않는다") {
            listOf(min - 1, 0, null).forEach { n ->
                rootOf(render(SHELL, doc(attributes = PARSED, uniqueClickers14d = n))) shouldNotContain "많이 클릭한 곳"
            }
        }

        then("속성이 없는 옛 문서여도 이 배지 하나로 요약 절을 그린다") {
            val root = rootOf(render(SHELL, doc(uniqueClickers14d = min)))
            root shouldContain "<h2>방문 정보 요약</h2><ul><li>많이 클릭한 곳</li></ul>"
        }

        then("영문 문구") {
            val root = rootOf(render(SHELL, doc(id = "2001", lang = "en", uniqueClickers14d = min)))
            root shouldContain "<li>Frequently clicked</li>"
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
            r shouldNotContain "<h2>비슷한 곳</h2>"
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
                root shouldContain "<p data-place-section=\"source\">출처: 한국관광공사 TourAPI</p><footer>"
            }
            rootOf(render(SHELL, stay(lang = "en"))) shouldContain
                "<p data-place-section=\"source\">Source: Korea Tourism Organization TourAPI</p><footer>"
        }

        then("새 유형 상세에 attraction-end 지면이 없다") {
            listOf(event(), stay(), course()).forEach { d ->
                val html = render(SHELL, d)
                html shouldNotContain "attraction-end"
                html shouldNotContain "adsbygoogle"
            }
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
