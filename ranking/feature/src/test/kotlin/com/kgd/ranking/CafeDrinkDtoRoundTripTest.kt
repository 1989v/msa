package com.kgd.ranking

import com.kgd.ranking.domain.cafe.model.VolumeSource
import java.math.BigDecimal
import com.kgd.ranking.application.cafe.dto.CafeDrinkUpsertItem
import com.kgd.ranking.application.cafe.dto.CafeDrinkResponse
import com.kgd.ranking.infrastructure.persistence.entity.CafeDrinkJpaEntity
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.ints.shouldBeGreaterThan
import kotlin.reflect.full.memberProperties
import kotlin.reflect.full.primaryConstructor

class CafeDrinkDtoRoundTripTest : BehaviorSpec({
    Given("서로 다른 값으로 채운 원천 25필드") {
        val request = cafeItem()
        val requestFields = CafeDrinkUpsertItem::class.primaryConstructor!!.parameters.mapNotNull { it.name }.toSet()
        val responseProperties = CafeDrinkResponse::class.memberProperties.associateBy { it.name }
        Then("적재 필드가 모두 응답에 있고 DTO→Domain→JPA→Domain→응답 값도 같아야 한다") {
            requestFields.size shouldBeGreaterThan 24
            (requestFields - responseProperties.keys) shouldBe emptySet()
            val restored = CafeDrinkResponse.of(CafeDrinkJpaEntity.fromDomain(request.toDomain()).toDomain())
            CafeDrinkUpsertItem::class.memberProperties.forEach { property ->
                responseProperties.getValue(property.name).get(restored) shouldBe property.get(request)
            }
        }
        Then("파생 컵 용량·출처·농도도 JPA와 응답까지 보존한다") {
            val source = request.copy(brandSlug = "twosome", volumeMl = null, sizeLabel = "R", temperature = "ICE")
            val entity = CafeDrinkJpaEntity.fromDomain(source.toDomain())
            val response = CafeDrinkResponse.of(entity.toDomain())
            entity.cupVolumeMl shouldBe BigDecimal("414")
            entity.volumeSource shouldBe VolumeSource.BRAND_SIZE_TABLE
            response.cupVolumeMl shouldBe entity.cupVolumeMl
            response.volumeSource shouldBe entity.volumeSource
            response.kcalPer100ml shouldBe entity.kcalPer100ml
            response.sugarPer100ml shouldBe entity.sugarPer100ml
            response.caffeinePer100ml shouldBe entity.caffeinePer100ml
            response.volumeMl shouldBe null
        }
        Then("nullable 식별값은 DB의 빈문자열과 왕복하고 raw의 대시와 원문을 보존한다") {
            val source = request.copy(temperature = null, sizeLabel = null, caffeineMg = null,
                rawNutrition = mapOf("카페인" to "-", "값" to "1g미만"))
            val entity = CafeDrinkJpaEntity.fromDomain(source.toDomain())
            entity.temperature shouldBe ""
            entity.sizeLabel shouldBe ""
            CafeDrinkResponse.of(entity.toDomain()).rawNutrition shouldBe source.rawNutrition
            entity.toDomain() shouldBe source.toDomain()
            entity.drinkName shouldBe source.toDomain().drinkName
            CafeDrinkResponse.of(entity.toDomain()).drinkName shouldBe entity.drinkName
        }
    }
})
