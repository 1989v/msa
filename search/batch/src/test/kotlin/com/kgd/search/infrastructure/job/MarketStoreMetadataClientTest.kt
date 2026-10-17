package com.kgd.search.infrastructure.job

import com.kgd.search.infrastructure.client.MarketStorePlaceClient
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.web.reactive.function.client.ClientResponse
import org.springframework.web.reactive.function.client.WebClient
import reactor.core.publisher.Mono

class MarketStoreMetadataClientTest : BehaviorSpec({
    given("paged public market summaries") {
        then("collect all pages by content ID and retain Korean fallback language") {
            val urls = mutableListOf<String>()
            val web = WebClient.builder().baseUrl("http://place").exchangeFunction { request ->
                urls += request.url().toString()
                val rows = if (request.url().query.contains("page=0")) (1..50).joinToString(",") { """{"contentId":"$it","attraction":{"id":7,"lang":"ko"}}""" }
                    else """{"contentId":"51","region":"서울 중구"}"""
                Mono.just(ClientResponse.create(HttpStatus.OK).header("Content-Type", MediaType.APPLICATION_JSON_VALUE)
                    .body("""{"data":{"markets":[$rows]}}""").build())
            }.build()
            val metadata = MarketStorePlaceClient(web).marketMetadata("en")
            metadata.size shouldBe 51
            metadata.getValue("1").path("attraction").path("lang").asText() shouldBe "ko"
            metadata.getValue("51").path("region").asText() shouldBe "서울 중구"
            urls.size shouldBe 2
            urls.last().contains("lang=en&page=1&size=50") shouldBe true
        }
        then("abort on missing metadata API data instead of publishing silently incomplete references") {
            val web = WebClient.builder().baseUrl("http://place").exchangeFunction {
                Mono.just(ClientResponse.create(HttpStatus.OK).header("Content-Type", MediaType.APPLICATION_JSON_VALUE)
                    .body("""{"data":null}""").build())
            }.build()
            shouldThrow<IllegalArgumentException> { MarketStorePlaceClient(web).marketMetadata("ko") }
        }
    }
})
