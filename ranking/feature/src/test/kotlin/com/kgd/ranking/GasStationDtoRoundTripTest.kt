package com.kgd.ranking

import com.kgd.ranking.application.dto.GasStationResponse
import com.kgd.ranking.application.dto.GasStationUpsertItem
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.ints.shouldBeGreaterThan
import kotlin.reflect.full.memberProperties
import kotlin.reflect.full.primaryConstructor

/**
 * 주유소 적재/조회 DTO 의 **왕복 불변식** (place 의 AttractionDtoRoundTripTest 와 같은 장치).
 *
 * 적재는 전체 동기화라 요청에 없는 필드는 지워지고, 응답에 없는 필드는 화면이 못 쓴다.
 * 컬럼이 늘 때 세 곳(요청 DTO·엔티티·응답 DTO) 중 하나만 빠뜨리는 게 사고의 형태라
 * 사람이 기억하는 대신 여기서 막는다.
 */
class GasStationDtoRoundTripTest : BehaviorSpec({

    Given("적재 요청 DTO 의 필드") {
        val requestFields = GasStationUpsertItem::class.primaryConstructor!!
            .parameters.mapNotNull { it.name }.toSet()

        When("조회 응답 DTO 와 맞춰보면") {
            val responseFields = GasStationResponse::class.memberProperties.map { it.name }.toSet()

            Then("적재할 수 있는 필드는 전부 조회로 되읽을 수 있어야 한다") {
                // 리플렉션이 빈 집합을 돌려주면 아래 비교가 공허하게 통과한다
                requestFields.size shouldBeGreaterThan 15
                (requestFields - responseFields).toList().shouldBeEmpty()
            }
        }
    }
})
