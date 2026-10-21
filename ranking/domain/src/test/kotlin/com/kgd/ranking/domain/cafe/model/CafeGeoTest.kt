package com.kgd.ranking.domain.cafe.model

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.doubles.plusOrMinus

class CafeGeoTest : BehaviorSpec({
    Given("WGS84 public store coordinates") {
        Then("same point is zero and equatorial degree uses spherical earth radius") {
            CafeGeo.distanceM(37.5, 127.0, 37.5, 127.0) shouldBe 0.0
            CafeGeo.distanceM(0.0, 0.0, 0.0, 1.0) shouldBe (111195.08 plusOrMinus 0.1)
        }
        Then("bbox contains radius edge at Seoul latitude") {
            (CafeGeo.longitudeDelta(1.0, 37.5) > CafeGeo.latitudeDelta(1.0)) shouldBe true
        }
    }
})
