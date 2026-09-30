package com.kgd.search.infrastructure.render

import com.kgd.search.domain.attraction.model.Admission
import com.kgd.search.domain.attraction.model.AttractionAttributes
import com.kgd.search.domain.attraction.model.AttractionDocument
import com.kgd.search.domain.attraction.model.AttractionRegion
import com.kgd.search.domain.attraction.model.Availability
import com.kgd.search.domain.attraction.model.NearbyPlace
import com.kgd.search.domain.attraction.model.PetPolicy
import com.kgd.search.domain.attraction.model.RegularClosure
import com.kgd.search.domain.attraction.model.SimilarPlace
import java.time.DayOfWeek

/** 렌더 테스트가 함께 쓰는 셸·문서. 셸은 portal-fe index.html 의 마커 구조를 그대로 따른다. */
object AttractionPageFixtures {

    const val ORIGIN = "https://place.1989v.com"

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
    )

    val SIMILAR = listOf(
        SimilarPlace("3001", "경기전", "전북특별자치도"),
        SimilarPlace("3002", "화성행궁 <정조>", null),
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
            NearbyPlace("1002", "창덕궁", 1450),
            NearbyPlace("1003", "덕수궁 <별관>", 820),
        ),
    )
}
