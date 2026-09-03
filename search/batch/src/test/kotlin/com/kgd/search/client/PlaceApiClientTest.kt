package com.kgd.search.client

import com.kgd.search.infrastructure.client.PlaceApiClient
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.web.reactive.function.client.ClientResponse
import org.springframework.web.reactive.function.client.WebClient
import reactor.core.publisher.Mono

/**
 * place API 응답을 담는 매핑 검사.
 *
 * 클라이언트가 JSON 을 Map 으로 받아 **손으로** 꺼내 담기 때문에, 데이터 클래스에 필드를 추가하고
 * 매핑을 빼먹으면 기본값 null 이 조용히 이긴다 — 실제로 썸네일이 그렇게 통째로 null 로 색인됐다.
 * 그래서 이 검사는 응답 JSON 을 주고 **클라이언트가 내놓은 값**을 본다 (이름 일치가 아니라 산출물).
 */
class PlaceApiClientTest : BehaviorSpec({

    fun clientReturning(body: String): PlaceApiClient {
        val webClient = WebClient.builder()
            .exchangeFunction { _ ->
                Mono.just(
                    ClientResponse.create(HttpStatus.OK)
                        .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                        .body(body)
                        .build(),
                )
            }
            .build()
        return PlaceApiClient(webClient)
    }

    Given("place API 가 관광지 한 건을 돌려줄 때") {
        val body = """
            {"success":true,"data":{"attractions":[{
              "id":1,"contentId":"126508","lang":"ko","title":"경복궁","titleDisplay":"경복궁",
              "titleLocal":null,"latitude":37.5,"longitude":126.9,"address":"서울 종로구",
              "areaCode":"1","sigunguCode":"1","ldongRegnCd":"11","ldongSignguCd":"110",
              "category":"history",
              "imageUrl":"https://tong.visitkorea.or.kr/cms/resource/98/3487598_image2_1.jpg",
              "thumbnailUrl":"https://tong.visitkorea.or.kr/cms/resource/98/3487598_image3_1.jpg",
              "tel":"02-3700-3900","overview":"조선의 법궁","googlePlaceId":"ChIJ",
              "sourceModifiedAt":"2026-01-02T03:04:05","status":"ACTIVE"
            }],"totalElements":1,"totalPages":1,"currentPage":0}}
        """.trimIndent()

        When("한 페이지를 받으면") {
            val page = clientReturning(body).fetchPage(0, 100)
            val first = page.attractions.first()

            Then("표시에 쓰는 이미지 두 개가 모두 담긴다") {
                first.imageUrl shouldBe "https://tong.visitkorea.or.kr/cms/resource/98/3487598_image2_1.jpg"
                // 카드 얼굴이 쓰는 값 — 여기가 null 이면 원본(약 500KB)이 대신 나간다
                first.thumbnailUrl shouldBe "https://tong.visitkorea.or.kr/cms/resource/98/3487598_image3_1.jpg"
            }

            Then("나머지 표시 필드도 담긴다") {
                first.title shouldBe "경복궁"
                first.category shouldBe "history"
                first.googlePlaceId shouldBe "ChIJ"
                page.totalPages shouldBe 1
            }
        }
    }

    Given("원천에 썸네일이 없는 관광지") {
        val body = """
            {"success":true,"data":{"attractions":[{
              "id":2,"contentId":"1","lang":"ko","title":"이름","latitude":37.0,"longitude":127.0,
              "imageUrl":null,"thumbnailUrl":null,"status":"ACTIVE"
            }],"totalElements":1,"totalPages":1,"currentPage":0}}
        """.trimIndent()

        When("한 페이지를 받으면") {
            val first = clientReturning(body).fetchPage(0, 100).attractions.first()

            Then("null 그대로 담겨 화면이 폴백을 고를 수 있다") {
                first.imageUrl shouldBe null
                first.thumbnailUrl shouldBe null
            }
        }
    }
})
