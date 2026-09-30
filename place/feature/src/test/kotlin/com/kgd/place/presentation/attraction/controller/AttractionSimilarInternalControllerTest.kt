package com.kgd.place.presentation.attraction.controller

import com.kgd.place.application.attraction.usecase.LookupAttractionSimilarUseCase
import com.kgd.place.application.attraction.usecase.SyncAttractionSimilarUseCase
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot

class AttractionSimilarInternalControllerTest : BehaviorSpec({
    val sync = mockk<SyncAttractionSimilarUseCase>()
    val lookup = mockk<LookupAttractionSimilarUseCase>()
    val controller = AttractionSimilarInternalController(sync, lookup)
    val ref = "microsoft/harrier-oss-v1-270m@31de22b#d640"

    given("유사 목록 적재") {
        `when`("문서별 목록을 보내면") {
            then("순서를 지킨 채 유스케이스로 넘기고 적용 수를 돌려준다") {
                val docs = slot<List<SyncAttractionSimilarUseCase.Document>>()
                every { sync.replace(ref, capture(docs)) } returns SyncAttractionSimilarUseCase.Applied(2, 2)

                val body = controller.bulk(
                    SimilarBulkRequest(
                        modelRef = ref,
                        items = listOf(
                            SimilarBulkRequest.Item(1L, listOf(SimilarBulkRequest.Similar(3L, 0.9), SimilarBulkRequest.Similar(2L, 0.8))),
                            SimilarBulkRequest.Item(4L, emptyList()),
                        ),
                    ),
                ).data!!

                body shouldBe SyncAttractionSimilarUseCase.Applied(documents = 2, rows = 2)
                docs.captured.first().similar.map { it.id } shouldBe listOf(3L, 2L)
                docs.captured.last().similar shouldBe emptyList()
            }
        }
    }

    given("유사 목록 조회") {
        `when`("id 묶음을 주면") {
            then("문서마다 스탬프와 순위 목록을 싣는다") {
                every { lookup.lookup(ref, listOf(1L, 2L)) } returns listOf(
                    LookupAttractionSimilarUseCase.Found(1L, ref, listOf(LookupAttractionSimilarUseCase.Similar(3L, 0.9))),
                )

                val body = controller.lookup(SimilarLookupRequest(ref, listOf(1L, 2L))).data!!

                body.modelRef shouldBe ref
                body.items.single().attractionId shouldBe 1L
                body.items.single().modelRef shouldBe ref
                body.items.single().similar.single().id shouldBe 3L
            }
        }
    }
})
