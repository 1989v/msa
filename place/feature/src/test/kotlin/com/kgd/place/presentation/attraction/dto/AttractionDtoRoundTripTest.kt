package com.kgd.place.presentation.attraction.dto

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.ints.shouldBeGreaterThan
import kotlin.reflect.full.memberProperties
import kotlin.reflect.full.primaryConstructor

/**
 * 관광지 적재/조회 DTO 의 **왕복 불변식**.
 *
 * 개요 수집기는 `GET /attractions` 로 읽은 값을 그대로 bulk upsert 로 되돌려 보낸다.
 * bulk 는 전체 동기화라 요청에서 빠진 필드는 null 로 덮인다 — 즉 **조회 응답이 못 담는
 * 필드는 매일 밤 지워진다.** 실제로 cat1~3 이 그렇게 지워지고 있었다 (2026-08-21).
 *
 * 컬럼이 늘어날 때 세 곳(요청·View·응답) 중 하나만 빠뜨리는 게 이 사고의 형태라,
 * 사람이 기억하는 대신 여기서 막는다.
 */
class AttractionDtoRoundTripTest : BehaviorSpec({

    /** 서버가 소유해 수집기가 되돌려 보내지 않는 필드 — 왕복 대상이 아니다. */
    val serverOwned = setOf("status")

    Given("적재 요청 DTO 의 필드") {
        val requestFields = UpsertAttractionItem::class.primaryConstructor!!
            .parameters.mapNotNull { it.name }.toSet() - serverOwned

        When("조회 응답 DTO 와 맞춰보면") {
            val responseFields = AttractionResponse::class.memberProperties.map { it.name }.toSet()

            Then("적재할 수 있는 필드는 전부 조회로 되읽을 수 있어야 한다") {
                // 못 읽는 필드 = 다음 개요 배치가 null 로 덮을 필드
                // 리플렉션이 빈 집합을 돌려주면 아래 비교가 공허하게 통과한다
                requestFields.size shouldBeGreaterThan 20
                (requestFields - responseFields).toList().shouldBeEmpty()
            }
        }
    }
})
