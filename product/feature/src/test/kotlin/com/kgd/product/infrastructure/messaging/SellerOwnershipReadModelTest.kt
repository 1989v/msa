package com.kgd.product.infrastructure.messaging

import com.kgd.common.exception.BusinessException
import com.kgd.common.messaging.IdempotentEventHandler
import com.kgd.common.messaging.IdempotentMetrics
import com.kgd.product.application.product.service.ProductWriteAuthorizer
import com.kgd.product.application.product.usecase.ProductRequester
import com.kgd.product.application.seller.InMemoryProductSellerRepository
import com.kgd.product.application.seller.service.ProductSellerSyncService
import com.kgd.product.domain.seller.model.ProductSellerStatus
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import org.apache.kafka.clients.consumer.ConsumerRecord
import tools.jackson.databind.ObjectMapper
import java.util.UUID

/**
 * seller.seller.* 이벤트 → 판매자 읽기 모델 → 쓰기 권한. 이벤트가 정지를 알리면 바로 다음 판정부터
 * 판매자 쓰기가 막힌다(토큰 재발급 없이). 판정 근거는 읽기 모델 행과 권한 판정기의 결과다.
 */
class SellerOwnershipReadModelTest : BehaviorSpec({
    val sellers = InMemoryProductSellerRepository()
    val handler = mockk<IdempotentEventHandler>()
    val block = slot<() -> Unit>()
    every { handler.process(any(), any(), capture(block)) } answers {
        block.captured.invoke()
        IdempotentEventHandler.Outcome.PROCESSED
    }
    val consumer = SellerReadModelConsumer(
        ProductSellerSyncService(sellers), ObjectMapper(), handler, mockk<IdempotentMetrics>(relaxed = true),
    )
    val authorizer = ProductWriteAuthorizer(sellers)
    val seller = ProductRequester("501", setOf("ROLE_SELLER"))

    fun event(topic: String, status: String, occurredAt: String) = ConsumerRecord(
        topic, 0, 0L, "7",
        """{"eventId":"${UUID.randomUUID()}","sellerId":7,"memberId":"501","status":"$status",""" +
            """"commissionRateBp":1000,"shippingFee":3000,"settlementCycle":"WEEKLY","occurredAt":"$occurredAt"}""",
    )

    beforeEach { sellers.clear() }

    given("승인 이벤트를 받으면") {
        then("ACTIVE 행이 생기고 등록 권한이 그 판매자 id 를 돌려준다") {
            consumer.onSellerEvent(event("seller.seller.approved", "ACTIVE", "2026-09-24T01:00:00Z"))

            sellers.findById(7L)!!.status shouldBe ProductSellerStatus.ACTIVE
            authorizer.authorizeCreate(seller) shouldBe 7L
        }
    }

    given("정지 이벤트를 받으면") {
        then("같은 토큰으로도 곧바로 403") {
            consumer.onSellerEvent(event("seller.seller.approved", "ACTIVE", "2026-09-24T01:00:00Z"))
            consumer.onSellerEvent(event("seller.seller.suspended", "SUSPENDED", "2026-09-24T02:00:00Z"))

            sellers.findById(7L)!!.status shouldBe ProductSellerStatus.SUSPENDED
            shouldThrow<BusinessException> { authorizer.authorizeCreate(seller) }
        }
    }

    given("아웃박스 재시도로 옛 승인 이벤트가 정지 뒤에 도착하면") {
        then("무시한다 — 정지가 되살아나지 않는다") {
            consumer.onSellerEvent(event("seller.seller.suspended", "SUSPENDED", "2026-09-24T02:00:00Z"))
            consumer.onSellerEvent(event("seller.seller.approved", "ACTIVE", "2026-09-24T01:00:00Z"))

            sellers.findById(7L)!!.status shouldBe ProductSellerStatus.SUSPENDED
        }
    }
})
