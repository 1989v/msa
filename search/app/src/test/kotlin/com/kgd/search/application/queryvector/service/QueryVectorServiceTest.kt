package com.kgd.search.application.queryvector.service

import com.kgd.search.application.queryvector.config.QueryVectorProperties
import com.kgd.search.application.queryvector.usecase.ManageQueryVectorsUseCase
import com.kgd.search.domain.queryvector.model.QueryVector
import com.kgd.search.domain.queryvector.port.QueryMissPort
import com.kgd.search.domain.queryvector.port.QueryVectorPort
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.micrometer.core.instrument.simple.SimpleMeterRegistry
import io.mockk.clearMocks
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import io.mockk.verify
import java.time.LocalDateTime

private const val MODEL_REF = "dragonkue/snowflake-arctic-embed-l-v2.0-ko@abc1234#d1024"
private val VECTOR = listOf(0.6f, 0.8f)

class QueryVectorServiceTest : BehaviorSpec({
    val vectorPort = mockk<QueryVectorPort>()
    val missPort = mockk<QueryMissPort>(relaxed = true)

    fun service(modelRef: String = MODEL_REF) = QueryVectorService(
        vectorPort, missPort, QueryVectorProperties(modelRef = modelRef), SimpleMeterRegistry(),
    )

    fun entry(normalized: String) = QueryVector(
        query = normalized, normalized = normalized, modelRef = MODEL_REF,
        vector = VECTOR, source = QueryVector.Source.INTENT, updatedAt = LocalDateTime.now(),
    )

    beforeTest { clearMocks(vectorPort, missPort) }

    given("질의를 벡터로 바꿀 때") {
        `when`("사전에 있으면") {
            then("정규화한 키로 찾아 벡터를 돌려줘야 한다") {
                every { vectorPort.find("$MODEL_REF|해수욕장") } returns entry("해수욕장")

                service().resolve(" 해수욕장? ", MODEL_REF) shouldBe VECTOR
            }
        }

        `when`("사전에 없으면") {
            then("null 을 주고 미적중을 기록해야 한다 — 미적중은 실패가 아니라 BM25 경로다") {
                every { vectorPort.find(any()) } returns null

                service().resolve("듣도 보도 못한 질의", MODEL_REF) shouldBe null

                verify { missPort.record(MODEL_REF, "듣도 보도 못한 질의") }
            }
        }

        `when`("같은 미적중 질의가 여러 번 오면") {
            then("저장소는 한 번만 치되 카운트는 매번 올려야 한다 — 카운트가 곧 우선순위다") {
                every { vectorPort.find(any()) } returns null
                val svc = service()

                repeat(3) { svc.resolve("야시장", MODEL_REF) }

                verify(exactly = 1) { vectorPort.find("$MODEL_REF|야시장") }
                verify(exactly = 3) { missPort.record(MODEL_REF, "야시장") }
            }
        }

        `when`("스탬프가 비어 있으면") {
            then("사전을 아예 보지 않아야 한다 — 첫 채움 전 정상 상태다") {
                service(modelRef = "").resolve("해수욕장", "") shouldBe null

                verify(exactly = 0) { vectorPort.find(any()) }
                verify(exactly = 0) { missPort.record(any(), any()) }
            }
        }

        `when`("정규화 결과가 비는 질의면") {
            then("사전을 보지도, 미적중으로 세지도 않아야 한다") {
                service().resolve("???", MODEL_REF) shouldBe null

                verify(exactly = 0) { vectorPort.find(any()) }
                verify(exactly = 0) { missPort.record(any(), any()) }
            }
        }

        `when`("미적중 기록이 실패하면") {
            then("검색은 계속돼야 한다 — Redis 때문에 답을 못 주면 안 된다") {
                every { vectorPort.find(any()) } returns null
                every { missPort.record(any(), any()) } throws RuntimeException("redis down")

                service().resolve("해수욕장", MODEL_REF) shouldBe null
            }
        }
    }

    given("도구가 사전을 채울 때") {
        `when`("원문 질의를 보내면") {
            then("서버가 정규화해 키를 만들어야 한다 — 규칙이 두 곳에 있으면 사전이 어긋난다") {
                val captured = slot<List<QueryVector>>()
                every { vectorPort.upsertAll(capture(captured)) } returns 1

                val applied = service().upsert(
                    MODEL_REF,
                    listOf(ManageQueryVectorsUseCase.Item(" 해수욕장? ", VECTOR, QueryVector.Source.INTENT)),
                )

                applied shouldBe ManageQueryVectorsUseCase.Applied(upserted = 1, skippedEmpty = 0)
                captured.captured.single().normalized shouldBe "해수욕장"
                captured.captured.single().query shouldBe " 해수욕장? "
                captured.captured.single().id shouldBe "$MODEL_REF|해수욕장"
            }
        }

        `when`("정규화하면 비는 질의가 섞여 있으면") {
            then("그것만 빼고 넣되 셈은 남겨야 한다") {
                val captured = slot<List<QueryVector>>()
                every { vectorPort.upsertAll(capture(captured)) } returns 1

                val applied = service().upsert(
                    MODEL_REF,
                    listOf(
                        ManageQueryVectorsUseCase.Item("궁궐", VECTOR, QueryVector.Source.INTENT),
                        ManageQueryVectorsUseCase.Item("!!!", VECTOR, QueryVector.Source.LOG),
                    ),
                )

                applied.skippedEmpty shouldBe 1
                captured.captured.map { it.normalized } shouldBe listOf("궁궐")
            }
        }

        `when`("미적중이던 질의를 넣으면") {
            then("다음 조회가 바로 적중해야 한다 — 캐시에 남은 옛 미적중이 가리면 안 된다") {
                every { vectorPort.find("$MODEL_REF|한옥") } returns null
                val svc = service()
                svc.resolve("한옥", MODEL_REF) shouldBe null

                every { vectorPort.upsertAll(any()) } returns 1
                svc.upsert(MODEL_REF, listOf(ManageQueryVectorsUseCase.Item("한옥", VECTOR, QueryVector.Source.LOG)))

                every { vectorPort.find("$MODEL_REF|한옥") } returns entry("한옥")
                svc.resolve("한옥", MODEL_REF) shouldBe VECTOR
            }
        }
    }

    given("도구가 미적중을 회수할 때") {
        `when`("목록을 물으면") {
            then("카운트 내림차순 그대로 넘겨야 한다") {
                every { missPort.top(MODEL_REF, 2) } returns listOf(
                    QueryMissPort.Miss("야시장", 42), QueryMissPort.Miss("한옥", 7),
                )

                service().misses(MODEL_REF, 2) shouldBe listOf(
                    ManageQueryVectorsUseCase.Miss("야시장", 42), ManageQueryVectorsUseCase.Miss("한옥", 7),
                )
            }
        }

        `when`("상태를 물으면") {
            then("사전 항목 수와 대기 중인 미적중 수를 함께 줘야 한다") {
                every { vectorPort.count(MODEL_REF) } returns 312
                every { missPort.size(MODEL_REF) } returns 45

                service().status(MODEL_REF) shouldBe
                    ManageQueryVectorsUseCase.Status(MODEL_REF, entries = 312, pendingMisses = 45)
            }
        }
    }
})
