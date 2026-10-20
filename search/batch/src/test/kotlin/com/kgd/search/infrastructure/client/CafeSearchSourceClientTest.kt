package com.kgd.search.infrastructure.client

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.kotest.assertions.throwables.shouldThrow
import io.mockk.mockk
import org.springframework.web.reactive.function.client.*
import org.springframework.http.*
import reactor.core.publisher.Mono

class CafeSearchSourceClientTest : BehaviorSpec({
    fun client(body: String, inspect: (String) -> Unit = {}): WebClient = WebClient.builder().exchangeFunction { request ->
        inspect(request.url().toString())
        val response = if (request.url().path.endsWith("/games/garden")) """{"success":true,"data":{"description":"game"}}""" else body
        Mono.just(ClientResponse.create(HttpStatus.OK).header("Content-Type", "application/json").body(response).build())
    }.baseUrl("http://content.test").build()
    val drink = """{"brandSlug":"coffee","brandName":"커피","menuName":"아메리카노","drinkGroup":"AMERICANO","caffeineStatus":"DISCLOSED"}"""
    given("cafe projection through existing unified schema") {
        then("natural id is stable; group/brand go to facets without removing existing fields") {
            val source = CafeSearchSourceClient(client("""{"success":true,"data":{"content":[$drink],"totalElements":1}}"""))
            val first = source.fetch().single()
            source.fetch().single().id shouldBe first.id
            first.facets shouldBe mapOf("group" to "AMERICANO", "brand" to "coffee")
            first.type shouldBe "cafe_drink"
        }
        then("empty, malformed and partial source never count as successful collection") {
            shouldThrow<IllegalStateException> { CafeSearchSourceClient(client("""{"success":true,"data":{"content":[],"totalElements":0}}""")).fetch() }
            shouldThrow<IllegalStateException> { CafeSearchSourceClient(client("""{"success":true,"data":{"content":[$drink],"totalElements":2}}""")).fetch() }
            shouldThrow<IllegalArgumentException> { CafeSearchSourceClient(client("""{"success":true,"data":{"totalElements":1}}""")).fetch() }
        }
        then("game source has stable sort and strict complete public paging") {
            val body = """{"success":true,"data":{"content":[{"id":1,"slug":"garden","title":"정원","status":"BETA"}],"totalElements":1,"totalPages":1}}"""
            val web = client(body) { if (it.contains("?")) it shouldContain "sort=new" }
            val source = UnifiedSourceApiClient(web, web, web, mockk())
            source.fetch("game").single().slug shouldBe "garden"
            val partial = client(body.replace(""""totalElements":1""", """"totalElements":2"""))
            shouldThrow<IllegalStateException> { UnifiedSourceApiClient(partial, web, web, mockk()).fetch("game") }
        }
    }
})
