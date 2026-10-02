package com.kgd.search.infrastructure.render

import com.kgd.search.domain.attraction.model.Admission
import com.kgd.search.domain.attraction.model.AttractionAttributes
import com.kgd.search.domain.attraction.model.AttractionDocument
import com.kgd.search.domain.attraction.model.AttractionRegion
import com.kgd.search.domain.attraction.model.Availability
import com.kgd.search.domain.attraction.model.CourseStop
import com.kgd.search.domain.attraction.model.EventPeriod
import com.kgd.search.domain.attraction.model.NearbyPlace
import com.kgd.search.domain.attraction.model.PetPolicy
import com.kgd.search.domain.attraction.model.RegularClosure
import com.kgd.search.domain.attraction.model.SimilarPlace
import java.time.DayOfWeek
import java.time.LocalDate

/** 렌더 테스트가 함께 쓰는 셸·문서. 셸은 portal-fe index.html 의 마커 구조를 그대로 따른다. */
object AttractionPageFixtures {

    const val ORIGIN = "https://place.1989v.com"

    /** 렌더 시점의 KST 오늘 — 서비스가 시계로 계산해 넘기는 값의 자리 */
    val TODAY: LocalDate = LocalDate.of(2026, 10, 2)

    val SHELL = """
        <!doctype html>
        <html lang="ko">
          <head>
            <!--seo:start-->
            <title>기본</title>
            <!--seo:end-->
          </head>
          <body>
            <div id="root"></div>
            <script type="module" src="/assets/index-abc123.js"></script>
          </body>
        </html>
    """.trimIndent()

    fun doc(
        id: String = "1001",
        lang: String = "ko",
        title: String = "경복궁",
        overview: String? = "조선 왕조의 법궁이다. 근정전과 경회루가 남아 있다.",
        attributes: AttractionAttributes? = null,
        region: AttractionRegion? = null,
        sidoName: String? = "서울특별시",
        similarElsewhere: List<SimilarPlace>? = null,
        uniqueClickers14d: Int? = null,
    ) = AttractionDocument(
        id = id,
        contentId = "126508",
        lang = lang,
        title = title,
        latitude = 37.5796,
        longitude = 126.977,
        address = "서울특별시 종로구 사직로 161",
        ldongRegnCd = "11",
        ldongSignguCd = "110",
        category = "history",
        contentTypeId = if (lang == "en") "76" else "12",
        imageUrl = "https://tong.visitkorea.or.kr/cms/resource/33/1.jpg",
        tel = "02-3700-3900",
        overview = overview,
        useTime = "09:00~18:00<br>입장 마감 17:00",
        restDate = "매주 화요일",
        useFee = null,
        parking = "가능",
        sidoName = sidoName,
        attributes = attributes,
        region = region,
        similarElsewhere = similarElsewhere,
        uniqueClickers14d = uniqueClickers14d,
    )

    val SIMILAR = listOf(
        SimilarPlace("3001", "경기전", "전북특별자치도", null),
        SimilarPlace("3002", "화성행궁 <정조>", null, null),
    )

    val PARSED = AttractionAttributes(
        regularClosure = RegularClosure.Weekly(setOf(DayOfWeek.TUESDAY)),
        parking = Availability.YES,
        petPolicy = PetPolicy.UNKNOWN,
        creditCard = Availability.UNKNOWN,
        strollerRental = Availability.NO,
        freeAdmission = Admission.FREE,
    )

    val ALL_UNKNOWN = AttractionAttributes(
        regularClosure = RegularClosure.Unknown,
        parking = Availability.UNKNOWN,
        petPolicy = PetPolicy.UNKNOWN,
        creditCard = Availability.UNKNOWN,
        strollerRental = Availability.UNKNOWN,
        freeAdmission = Admission.UNKNOWN,
    )

    val REGION = AttractionRegion(
        sigunguName = "종로구",
        typeCount = 120,
        categoryCount = 5,
        categoryName = "고궁",
        sameCategoryNearby = listOf(
            NearbyPlace("1002", "창덕궁", 1450, null),
            NearbyPlace("1003", "덕수궁 <별관>", 820, null),
        ),
    )

    /** 행사(유형 15·85). 기간 [period] 는 유효 기간 — null 이면 날짜 없는 행사(UNKNOWN). */
    fun event(
        id: String = "5001",
        lang: String = "ko",
        period: EventPeriod? = EventPeriod(LocalDate.of(2026, 9, 28), LocalDate.of(2026, 10, 5)),
        overview: String? = "가을 밤하늘을 수놓는 불꽃 축제다.",
        introRaw: String? = EVENT_INTRO,
        region: AttractionRegion? = null,
        similarElsewhere: List<SimilarPlace>? = null,
    ) = doc(id = id, lang = lang, title = if (lang == "en") "Seoul Fireworks Festival" else "서울세계불꽃축제", overview = overview)
        .copy(
            contentTypeId = if (lang == "en") "85" else "15",
            category = "culture",
            introRaw = introRaw,
            // 행사의 파생 컬럼은 소개 원문의 요금 키에서 온다 — 유형별 절이 대신 그리므로 일반 「이용 안내」에 나오면 안 된다
            useTime = "무료",
            useFee = "무료",
            restDate = null,
            parking = null,
            eventPeriod = period,
            region = region,
            similarElsewhere = similarElsewhere,
        )

    const val EVENT_INTRO =
        "{\"contentid\":\"3113671\",\"eventplace\":\"여의도 한강공원 <b>일대</b>\",\"playtime\":\"19:00~21:00\"," +
            "\"usetimefestival\":\"무료\",\"sponsor1\":\"한화 &amp; 서울시\",\"eventhomepage\":\"<a href=\\\"https://fireworks.example\\\">홈</a>\"}"

    /** 숙박(유형 32·80). 원문에 예약 URL·예약 안내 키가 들어 있다 — 그리지 않아야 하는 것 */
    fun stay(lang: String = "ko", introRaw: String? = STAY_INTRO) =
        doc(id = if (lang == "en") "6101" else "5101", lang = lang, title = if (lang == "en") "Hanok Stay" else "북촌 한옥 스테이", overview = "북촌의 한옥 숙소.")
            .copy(contentTypeId = if (lang == "en") "80" else "32", category = "stay", introRaw = introRaw, parking = "가능", useTime = null)

    const val STAY_INTRO =
        "{\"checkintime\":\"15:00\",\"checkouttime\":\"11:00\",\"roomcount\":\"5\",\"roomtype\":\"온돌방\"," +
            "\"parkinglodging\":\"불가\",\"subfacility\":\"바비큐장\",\"reservationurl\":\"https://booking.example.com/r?id=1\"," +
            "\"reservationlodging\":\"02-000-0000 예약 문의\",\"refundregulation\":\"환불 규정 원문\"}"

    /** 여행코스(유형 25, 국문만). 지점 이름은 일부러 가나다 순과 다른 순서다 */
    val COURSE_STOPS = listOf(
        CourseStop(0, "126081", "해운대해수욕장", 7001L),
        CourseStop(1, "999999", "광안리 카페거리", null),
        CourseStop(2, "126101", "감천문화마을", 7003L),
    )

    fun course(stops: List<CourseStop>? = COURSE_STOPS) =
        doc(id = "5201", title = "부산 바다 하루 코스", overview = "바다를 따라 걷는 코스.")
            .copy(
                contentTypeId = "25",
                category = "etc",
                introRaw = "{\"distance\":\"12.5km\",\"taketime\":\"당일\",\"theme\":\"테마 원문\"}",
                courseStops = stops,
                useTime = null,
                restDate = null,
                parking = null,
            )
}
