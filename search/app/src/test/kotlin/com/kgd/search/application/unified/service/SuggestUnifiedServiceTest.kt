package com.kgd.search.application.unified.service

import com.kgd.search.application.attraction.usecase.SuggestAttractionUseCase
import com.kgd.search.application.unified.port.UnifiedSearchPort
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.matchers.shouldBe
import io.mockk.*

class SuggestUnifiedServiceTest : BehaviorSpec({
    val places = mockk<SuggestAttractionUseCase>()
    val docs = mockk<UnifiedSearchPort>()
    val service = SuggestUnifiedService(places, docs)
    fun hit(title: String, type: String = "game") = UnifiedSearchPort.Hit("$type:1", type, "1", "garden", title, "summary", null, null, mapOf("group" to "AMERICANO"), 1.0)
    beforeTest {
        clearMocks(places, docs)
        every { places.execute(any(), any(), any()) } returns listOf(
            SuggestAttractionUseCase.Suggestion("REGION", "1", "정원시", latitude = 0.0, longitude = 0.0),
            SuggestAttractionUseCase.Suggestion("ATTRACTION", "2", "정원 산책", latitude = 0.0, longitude = 0.0))
        every { docs.suggest(any(), any(), any()) } returns listOf(hit("정원"))
    }
    given("keyword-only unified launcher suggestions") {
        then("exact name precedes place prefix; region suggestions do not become destination hits") {
            val result = service.execute(" 정원 ", null, 8)
            result.hits.map { it.type } shouldBe listOf("game", "attraction")
            result.hits.first().sourceId shouldBe "garden"
            verify(exactly = 0) { docs.search(any()) }
        }
        then("all existing types and cafe can be selected; type filter avoids unrelated source") {
            for (type in SearchUnifiedService.ALL_TYPES.filter { it != "attraction" }) {
                service.execute("정원", type, 8)
                verify { docs.suggest("정원", type, 8) }
            }
            verify(exactly = 0) { places.execute(any(), any(), any()) }
        }
        then("invalid query/type/size rejected before engine call") {
            shouldThrow<IllegalArgumentException> { service.execute(" ", null, 8) }
            shouldThrow<IllegalArgumentException> { service.execute("a".repeat(121), null, 8) }
            shouldThrow<IllegalArgumentException> { service.execute("a", "resume", 8) }
            shouldThrow<IllegalArgumentException> { service.execute("a", null, 21) }
            verify(exactly = 0) { docs.suggest(any(), any(), any()) }
        }
        then("engine failure propagates rather than claiming zero results") {
            every { docs.suggest(any(), any(), any()) } throws IllegalStateException("engine unavailable")
            shouldThrow<IllegalStateException> { service.execute("정원", "game", 8) }
        }
    }
})
