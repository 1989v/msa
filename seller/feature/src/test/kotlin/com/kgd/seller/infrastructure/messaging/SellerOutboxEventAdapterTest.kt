package com.kgd.seller.infrastructure.messaging

import com.kgd.common.messaging.outbox.OutboxPort
import com.kgd.seller.application.seller.port.SellerEventType
import com.kgd.seller.domain.seller.model.Seller
import com.kgd.seller.domain.seller.model.SellerStatus
import com.kgd.seller.domain.seller.model.SettlementCycle
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import tools.jackson.module.kotlin.jacksonMapperBuilder
import java.time.Instant

/** `seller.seller.*` 페이로드 — 판정은 아웃박스에 남은 JSON 이다 */
class SellerOutboxEventAdapterTest : BehaviorSpec({

    val mapper = jacksonMapperBuilder().build()
    val now = Instant.parse("2026-09-25T00:00:00Z")

    class RecordingOutbox : OutboxPort {
        val payloads = mutableListOf<String>()
        override fun save(aggregateType: String, aggregateId: Long, eventType: String, payload: String, partitionKey: String?, headers: Map<String, String>) {
            payloads += payload
        }
    }

    fun seller(status: SellerStatus) = Seller.restore(
        7L, "m-7", "도자기 공방", "1234567890", "대표", "은행", null, "***", 3_000L, SettlementCycle.WEEKLY,
        if (status == SellerStatus.PENDING) null else 1_000, status, null, null, null, now, now,
    )

    fun publishedName(type: SellerEventType, status: SellerStatus): Any? {
        val outbox = RecordingOutbox()
        SellerOutboxEventAdapter(outbox, mapper).publish(type, seller(status))
        return mapper.readValue(outbox.payloads.single(), Map::class.java)["businessName"]
    }

    Given("상호") {
        Then("승인된 판매자(ACTIVE·SUSPENDED)만 싣고, 심사 중(PENDING)은 싣지 않는다 — 반려 뒤 파기할 상호를 읽기 모델에 퍼뜨리지 않는다") {
            publishedName(SellerEventType.APPROVED, SellerStatus.ACTIVE) shouldBe "도자기 공방"
            publishedName(SellerEventType.SUSPENDED, SellerStatus.SUSPENDED) shouldBe "도자기 공방"
            publishedName(SellerEventType.APPLIED, SellerStatus.PENDING) shouldBe null
        }
    }
})
