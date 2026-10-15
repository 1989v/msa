package com.kgd.place.infrastructure.persistence.market.adapter

import com.kgd.place.domain.market.model.*
import com.kgd.place.infrastructure.persistence.market.entity.MarketGeometryRequestJpaEntity
import com.kgd.place.infrastructure.persistence.market.repository.MarketGeometryRequestJpaRepository
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.*

class MarketGeometryRequestRepositoryAdapterTest : BehaviorSpec({
    Given("request storage isolated from market geometry") {
        Then("roundtrips JSON coordinates, nullable drawings and decision metadata, and uses locking reads") {
            val repository = mockk<MarketGeometryRequestJpaRepository>()
            val adapter = MarketGeometryRequestRepositoryAdapter(repository)
            val request = MarketGeometryRequest(1, 3, 7, GeometryRequestKind.PATH, listOf(listOf(37.0, 127.0), listOf(37.001, 127.001)), "골목", id = 2)
                .decide(GeometryRequestAction.APPROVE, 9, "현장 확인")
            every { repository.saveAndFlush(any()) } answers { firstArg() }
            adapter.save(request) shouldBe request
            val entity = MarketGeometryRequestJpaEntity.fromDomain(request)
            entity.geometry shouldBe "[[37.0,127.0],[37.001,127.001]]"
            every { repository.lockById(2) } returns entity
            adapter.lockById(2) shouldBe request
            every { repository.findAllByStatusOrderByIdDesc(GeometryRequestStatus.APPROVED) } returns listOf(entity)
            adapter.list(GeometryRequestStatus.APPROVED) shouldBe listOf(request)
            every { repository.findAllByMarketIdOrderByIdDesc(1) } returns listOf(entity)
            adapter.listForMarket(1) shouldBe listOf(request)
            adapter.save(request.copy(geometry = null)).geometry shouldBe null
            verify(exactly = 1) { repository.lockById(2) }
        }
    }
})
