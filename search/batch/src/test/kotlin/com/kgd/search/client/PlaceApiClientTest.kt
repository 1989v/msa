package com.kgd.search.client

import tools.jackson.databind.ObjectMapper
import com.kgd.search.infrastructure.client.PlaceApiClient
import com.sun.net.httpserver.HttpServer
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.longs.shouldBeLessThan
import io.kotest.matchers.shouldBe
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.web.reactive.function.client.ClientResponse
import org.springframework.web.reactive.function.client.WebClient
import reactor.core.publisher.Mono
import java.net.InetSocketAddress
import java.time.Duration
import java.util.concurrent.TimeoutException

/**
 * place API 응답을 담는 매핑 검사.
 *
 * 클라이언트가 JSON 을 Map 으로 받아 **손으로** 꺼내 담기 때문에, 데이터 클래스에 필드를 추가하고
 * 매핑을 빼먹으면 기본값 null 이 조용히 이긴다 — 실제로 썸네일이 그렇게 통째로 null 로 색인됐다.
 * 그래서 이 검사는 응답 JSON 을 주고 **클라이언트가 내놓은 값**을 본다 (이름 일치가 아니라 산출물).
 */
class PlaceApiClientTest : BehaviorSpec({

    val requestedUris = mutableListOf<String>()

    fun clientReturning(body: String): PlaceApiClient {
        val webClient = WebClient.builder()
            .exchangeFunction { request ->
                requestedUris += request.url().toString()
                Mono.just(
                    ClientResponse.create(HttpStatus.OK)
                        .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                        .body(body)
                        .build(),
                )
            }
            .build()
        return PlaceApiClient(webClient, ObjectMapper())
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
            }],"totalElements":-1,"totalPages":-1,"currentPage":-1,"nextAfterId":7}}
        """.trimIndent()

        When("한 페이지를 받으면") {
            val page = clientReturning(body).fetchPageAfter(0L, 100)
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
            }

            Then("키셋으로 요청하고 다음 커서를 담는다") {
                requestedUris.last() shouldBe "/api/places/attractions?afterId=0&size=100"
                page.nextAfterId shouldBe 7L
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
            val page = clientReturning(body).fetchPageAfter(0L, 100)
            val first = page.attractions.first()

            Then("null 그대로 담겨 화면이 폴백을 고를 수 있다") {
                first.imageUrl shouldBe null
                first.thumbnailUrl shouldBe null
            }
            Then("nextAfterId 가 없으면 마지막 페이지다") {
                page.nextAfterId shouldBe null
            }
        }
    }

    Given("place 가 행사 한 건과 날짜 없는 관광지 한 건을 돌려줄 때") {
        // place 는 DATE 컬럼을 ISO 날짜 문자열로, 목록 행 원문을 JSON 문자열로 낸다
        val body = """
            {"success":true,"data":{"attractions":[{
              "id":3,"contentId":"3112217","lang":"ko","title":"보령머드축제","latitude":36.3,"longitude":126.5,
              "contentTypeId":"15","eventStartDate":"2026-07-24","eventEndDate":"2026-08-09",
              "listRaw":"{\"contentid\":\"3112217\",\"eventstartdate\":\"20260724\"}","status":"ACTIVE"
            },{
              "id":4,"contentId":"126508","lang":"ko","title":"경복궁","latitude":37.5,"longitude":126.9,
              "contentTypeId":"12","eventStartDate":null,"status":"ACTIVE"
            }],"nextAfterId":null}}
        """.trimIndent()

        When("한 페이지를 받으면") {
            val (event, sight) = clientReturning(body).fetchPageAfter(0L, 100).attractions

            Then("행사 시작·종료일과 목록 원문이 DTO 에 실린다 — 빠지면 null 이 조용히 이긴다") {
                event.eventStartDate shouldBe java.time.LocalDate.parse("2026-07-24")
                event.eventEndDate shouldBe java.time.LocalDate.parse("2026-08-09")
                event.listRaw shouldBe """{"contentid":"3112217","eventstartdate":"20260724"}"""
            }
            Then("값이 없거나 키가 없으면 null 이다") {
                sight.eventStartDate shouldBe null
                sight.eventEndDate shouldBe null
                sight.listRaw shouldBe null
            }
        }
    }

    Given("place 가 응답을 제한 시간 넘게 주지 않을 때") {
        // 실제 소켓 — 헤더도 본문도 보내지 않고 붙들고 있는다. 운영에서 재색인이 14분 넘게 한 호출을 기다렸다
        val server = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0).apply {
            createContext("/") { exchange -> Thread.sleep(3_000); exchange.close() }
            start()
        }
        val client = PlaceApiClient(
            WebClient.builder().baseUrl("http://127.0.0.1:${server.address.port}").build(),
            ObjectMapper(),
            responseTimeout = Duration.ofMillis(200),
        )

        When("한 페이지를 요청하면") {
            val startedAt = System.nanoTime()
            val failure = runCatching { client.fetchPageAfter(0L, 100) }.exceptionOrNull()
            val elapsedMs = (System.nanoTime() - startedAt) / 1_000_000
            server.stop(0)

            Then("기다리지 않고 시간 초과로 실패해야 한다 — 잡이 실패해야 별칭이 그대로 남는다") {
                (failure is TimeoutException) shouldBe true
                elapsedMs shouldBeLessThan 2_000L
            }
        }
    }

    Given("place 가 임베딩 조회에 응답하면") {
        // 기준값은 서버 인코더와 같은 방식(ByteBuffer LITTLE_ENDIAN + Base64)으로 만든 것이고,
        // 같은 문자열을 도구(tools/embed) 쪽 검사도 쓴다 — 세 구현이 한 상수에 묶인다.
        val client = clientReturning(
            """
            {"success":true,"data":{"modelRef":"m@abc1234#d2","items":[
              {"attractionId":11,"textHash":"h11","vector":"mpkZv83MTD8=","embeddedAt":"2026-09-06T01:00:00"}
            ]}}
            """.trimIndent(),
        )
        val found = kotlinx.coroutines.runBlocking { client.lookupEmbeddings("m@abc1234#d2", listOf(11L, 12L)) }

        When("벡터를 푼다") {
            Then("float32 little-endian 순서 그대로 나와야 한다") {
                found.getValue(11L).vector shouldBe listOf(-0.6f, 0.8f)
                found.getValue(11L).textHash shouldBe "h11"
            }
            Then("응답에 없는 id 는 지도에 없어야 한다 — 그 문서는 BM25 로만 찾힌다") {
                found.containsKey(12L) shouldBe false
            }
        }
    }

    Given("place 가 비슷한 곳 조회에 응답하면") {
        val client = clientReturning(
            """
            {"success":true,"data":{"modelRef":"m@abc1234#d2","items":[
              {"attractionId":11,"modelRef":"m@abc1234#d2","similar":[{"id":31,"score":0.91},{"id":32,"score":0.88}]}
            ]}}
            """.trimIndent(),
        )
        requestedUris.clear()
        val found = kotlinx.coroutines.runBlocking { client.lookupSimilar("m@abc1234#d2", listOf(11L, 12L)) }

        When("목록을 읽는다") {
            Then("순위 순서와 행의 스탬프가 그대로 나와야 한다") {
                found.getValue(11L).ids shouldBe listOf(31L, 32L)
                found.getValue(11L).modelRef shouldBe "m@abc1234#d2"
                found.containsKey(12L) shouldBe false
                requestedUris.single() shouldBe "/internal/attractions/similar/lookup"
            }
        }
    }

    Given("place 가 부가 정보 묶음 조회에 응답하면") {
        // place `AttractionExtrasInternalController.lookup` 응답 모양(LookupAttractionExtrasUseCase.Found 직렬화) —
        // 상세 원문은 경복궁(126508) 운영 응답의 일부, 웰니스는 국문 표본 2994116 의 테마 코드
        val detailRaw = """{\"contentid\":\"126508\",\"wheelchair\":\"대여가능\",\"elevator\":\"\"}"""
        val client = clientReturning(
            """
            {"success":true,"data":{"items":[
              {"attractionId":11,"barrierFree":{"flags":["WHEELCHAIR"],"detailRaw":"$detailRaw"},"wellness":null},
              {"attractionId":21,"barrierFree":null,"wellness":{"themaCd":"EX050100"}},
              {"attractionId":31,"barrierFree":null,"wellness":null,
               "congestion":{"matchMethod":"EXACT","days":[{"date":"2026-10-02","rate":47.16},{"date":"2026-10-03","rate":52}]}},
              {"attractionId":41,"barrierFree":null,"wellness":null,"congestion":null,
               "relatedPlaces":[{"rank":2,"attractionId":601,"category":"자연경관(하천/해양)"},{"rank":4,"attractionId":602,"category":null},{"rank":5}]}
            ]}}
            """.trimIndent(),
        )
        requestedUris.clear()
        val found = kotlinx.coroutines.runBlocking { client.lookupExtras(listOf(11L, 21L, 30L)) }

        When("항목을 읽는다") {
            Then("무장애 코드·원문과 웰니스 코드가 그대로 나오고, 없는 쪽은 null 이다") {
                found.getValue(11L) shouldBe PlaceApiClient.ExtrasDto(
                    listOf("WHEELCHAIR"), """{"contentid":"126508","wheelchair":"대여가능","elevator":""}""", null,
                )
                found.getValue(21L) shouldBe PlaceApiClient.ExtrasDto(null, null, "EX050100")
                // 집중률 — 정수로 온 값(52)도 실수로 읽는다(원천 cnctrRate 는 소수 둘째 자리까지)
                found.getValue(31L).congestion shouldBe listOf(
                    PlaceApiClient.CongestionDayDto("2026-10-02", 47.16),
                    PlaceApiClient.CongestionDayDto("2026-10-03", 52.0),
                )
                // 연관 관광지 — place 순서 그대로, 순위·id 가 빠진 항목은 건너뛴다
                found.getValue(41L).relatedPlaces shouldBe listOf(
                    PlaceApiClient.RelatedPlaceDto(2, 601L, "자연경관(하천/해양)"),
                    PlaceApiClient.RelatedPlaceDto(4, 602L, null),
                )
                found.getValue(31L).relatedPlaces shouldBe null
                found.containsKey(30L) shouldBe false
                requestedUris.single() shouldBe "/internal/attractions/extras/lookup"
            }
        }
    }

    Given("place 가 링크 벌크 조회에 응답하면") {
        val collected = """{"source":"YOUTUBE","externalId":"v1","title":"경복궁 야경","url":"https://youtu.be/v1",""" +
            """"thumbnailUrl":"https://i.ytimg.com/v1.jpg","author":"서울여행","publishedAt":"2026-09-01T12:30:00","viewCount":123456}"""
        val deepLink = """{"provider":"INSTAGRAM","kind":"SOCIAL","url":"https://www.instagram.com/explore/tags/경복궁","revenueType":"PLAIN"}"""
        val client = clientReturning(
            """{"success":true,"data":{"items":[{"attractionId":11,"collected":[$collected],"deepLinks":[$deepLink]}]}}""",
        )
        requestedUris.clear()
        val found = kotlinx.coroutines.runBlocking { client.lookupLinks(listOf(11L, 12L)) }

        When("색인에 실을 원문을 만들면") {
            Then("place 가 준 링크 행의 필드가 하나도 빠지지 않는다 — 화면은 이 원문을 그대로 푼다") {
                val mapper = ObjectMapper()
                mapper.readTree(found.getValue(11L)) shouldBe
                    mapper.readTree("""{"collected":[$collected],"deepLinks":[$deepLink]}""")
                found.containsKey(12L) shouldBe false
                requestedUris.single() shouldBe "/internal/attractions/links/lookup"
            }
        }
    }

    Given("place 가 시군구 목록을 돌려줄 때") {
        // place 행정구역 응답 그대로 — code 는 시도 2 + 시군구 3 의 5자리다
        val client = clientReturning(
            """
            {"success":true,"data":{"regions":[
              {"code":"11110","parentCode":"11","level":"SIGUNGU","name":"종로구","nameEn":"Jongno-gu","attractionCount":null},
              {"code":"26110","parentCode":"26","level":"SIGUNGU","name":"중구","nameEn":null,"attractionCount":null}
            ]}}
            """.trimIndent(),
        )
        val names = kotlinx.coroutines.runBlocking { client.fetchSigunguNames() }

        When("언어별 이름표를 만들면") {
            Then("국문은 name, 영문은 nameEn 이고 영문명이 없으면 국문명이어야 한다") {
                names.getValue("ko") shouldBe mapOf("11110" to "종로구", "26110" to "중구")
                names.getValue("en") shouldBe mapOf("11110" to "Jongno-gu", "26110" to "중구")
            }
        }
    }

    Given("place 가 시도 목록을 돌려줄 때 (name 은 언어와 무관하게 국문)") {
        val body = """
            {"success":true,"data":{"regions":[
              {"code":"11","name":"서울특별시","nameEn":"Seoul"},
              {"code":"26","name":"부산광역시","nameEn":""}
            ]}}
            """.trimIndent()

        When("영문 이름표를 만들면") {
            val names = kotlinx.coroutines.runBlocking { clientReturning(body).fetchSidoNames("en") }
            Then("nameEn 을 쓰고, 영문명이 없으면 국문명이어야 한다") {
                names shouldBe mapOf("11" to "Seoul", "26" to "부산광역시")
            }
        }
        When("국문 이름표를 만들면") {
            val names = kotlinx.coroutines.runBlocking { clientReturning(body).fetchSidoNames("ko") }
            Then("name 을 써야 한다") {
                names shouldBe mapOf("11" to "서울특별시", "26" to "부산광역시")
            }
        }
    }

    Given("place 가 분류 코드표를 돌려줄 때") {
        val client = clientReturning(
            """
            {"success":true,"data":[
              {"lang":"ko","code":"VE","depth":1,"parentCode":null,"name":"역사관광"},
              {"lang":"ko","code":"VE03","depth":2,"parentCode":"VE","name":"역사유적지"},
              {"lang":"ko","code":"VE030100","depth":3,"parentCode":"VE03","name":"고궁"}
            ]}
            """.trimIndent(),
        )
        val names = kotlinx.coroutines.runBlocking { client.fetchCategoryNames("ko") }

        When("소분류 이름표를 만들면") {
            Then("depth 3 만 남아야 한다") {
                names shouldBe mapOf("VE030100" to "고궁")
            }
        }
    }

    Given("벡터 base64 를 직접 풀 때") {
        When("서버가 낸 문자열을 준다") {
            Then("JVM 인코더의 역이어야 한다") {
                PlaceApiClient.decodeVector("AACAPwAAAAAAAAAAAAAAAA==") shouldBe listOf(1.0f, 0.0f, 0.0f, 0.0f)
                PlaceApiClient.decodeVector("AAAAPwAAAD8AAAA/AAAAPw==") shouldBe listOf(0.5f, 0.5f, 0.5f, 0.5f)
            }
        }
        When("길이가 4의 배수가 아니면") {
            Then("조용한 쓰레기 벡터 대신 예외여야 한다") {
                io.kotest.assertions.throwables.shouldThrow<IllegalArgumentException> {
                    PlaceApiClient.decodeVector("AAAA")
                }
            }
        }
    }

    Given("조회 id 가 상한을 넘으면") {
        When("501건을 준다") {
            Then("서버에 보내기 전에 막아야 한다") {
                io.kotest.assertions.throwables.shouldThrow<IllegalArgumentException> {
                    kotlinx.coroutines.runBlocking {
                        clientReturning("{}").lookupEmbeddings("m@abc1234#d2", (1L..501L).toList())
                    }
                }
            }
        }
    }
})
