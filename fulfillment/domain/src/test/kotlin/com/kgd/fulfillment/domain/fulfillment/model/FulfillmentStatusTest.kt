package com.kgd.fulfillment.domain.fulfillment.model

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe

class FulfillmentStatusTest : BehaviorSpec({

    given("PENDING 상태") {
        val status = FulfillmentStatus.PENDING

        then("PICKING으로 전이 가능하다") {
            status.canTransitionTo(FulfillmentStatus.PICKING) shouldBe true
        }
        then("CANCELLED로 전이 가능하다") {
            status.canTransitionTo(FulfillmentStatus.CANCELLED) shouldBe true
        }
        then("PACKING으로 전이 불가하다") {
            status.canTransitionTo(FulfillmentStatus.PACKING) shouldBe false
        }
        then("SHIPPED로 전이 불가하다") {
            status.canTransitionTo(FulfillmentStatus.SHIPPED) shouldBe false
        }
        then("DELIVERED로 전이 불가하다") {
            status.canTransitionTo(FulfillmentStatus.DELIVERED) shouldBe false
        }
        then("PENDING으로 전이 불가하다") {
            status.canTransitionTo(FulfillmentStatus.PENDING) shouldBe false
        }
    }

    given("PICKING 상태") {
        val status = FulfillmentStatus.PICKING

        then("PACKING으로 전이 가능하다") {
            status.canTransitionTo(FulfillmentStatus.PACKING) shouldBe true
        }
        then("CANCELLED로 전이 가능하다") {
            status.canTransitionTo(FulfillmentStatus.CANCELLED) shouldBe true
        }
        then("PENDING으로 전이 불가하다") {
            status.canTransitionTo(FulfillmentStatus.PENDING) shouldBe false
        }
        then("PICKING으로 전이 불가하다") {
            status.canTransitionTo(FulfillmentStatus.PICKING) shouldBe false
        }
        then("SHIPPED로 전이 불가하다") {
            status.canTransitionTo(FulfillmentStatus.SHIPPED) shouldBe false
        }
        then("DELIVERED로 전이 불가하다") {
            status.canTransitionTo(FulfillmentStatus.DELIVERED) shouldBe false
        }
    }

    given("PACKING 상태") {
        val status = FulfillmentStatus.PACKING

        then("SHIPPED로 전이 가능하다") {
            status.canTransitionTo(FulfillmentStatus.SHIPPED) shouldBe true
        }
        then("CANCELLED로 전이 가능하다") {
            status.canTransitionTo(FulfillmentStatus.CANCELLED) shouldBe true
        }
        then("PENDING으로 전이 불가하다") {
            status.canTransitionTo(FulfillmentStatus.PENDING) shouldBe false
        }
        then("PICKING으로 전이 불가하다") {
            status.canTransitionTo(FulfillmentStatus.PICKING) shouldBe false
        }
        then("PACKING으로 전이 불가하다") {
            status.canTransitionTo(FulfillmentStatus.PACKING) shouldBe false
        }
        then("DELIVERED로 전이 불가하다") {
            status.canTransitionTo(FulfillmentStatus.DELIVERED) shouldBe false
        }
    }

    given("SHIPPED 상태") {
        val status = FulfillmentStatus.SHIPPED

        then("DELIVERED로 전이 가능하다") {
            status.canTransitionTo(FulfillmentStatus.DELIVERED) shouldBe true
        }
        then("PENDING으로 전이 불가하다") {
            status.canTransitionTo(FulfillmentStatus.PENDING) shouldBe false
        }
        then("PICKING으로 전이 불가하다") {
            status.canTransitionTo(FulfillmentStatus.PICKING) shouldBe false
        }
        then("PACKING으로 전이 불가하다") {
            status.canTransitionTo(FulfillmentStatus.PACKING) shouldBe false
        }
        then("SHIPPED로 전이 불가하다") {
            status.canTransitionTo(FulfillmentStatus.SHIPPED) shouldBe false
        }
        then("CANCELLED로 전이 불가하다") {
            status.canTransitionTo(FulfillmentStatus.CANCELLED) shouldBe false
        }
    }

    given("DELIVERED 상태") {
        val status = FulfillmentStatus.DELIVERED

        then("어떤 상태로도 전이 불가하다") {
            FulfillmentStatus.values().forEach { target ->
                status.canTransitionTo(target) shouldBe false
            }
        }
    }

    given("CANCELLED 상태") {
        val status = FulfillmentStatus.CANCELLED

        then("어떤 상태로도 전이 불가하다") {
            FulfillmentStatus.values().forEach { target ->
                status.canTransitionTo(target) shouldBe false
            }
        }
    }
})
