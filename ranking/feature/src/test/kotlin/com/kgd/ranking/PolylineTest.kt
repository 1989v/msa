package com.kgd.ranking

import com.kgd.ranking.infrastructure.routes.Geo
import com.kgd.ranking.infrastructure.routes.LatLng
import com.kgd.ranking.infrastructure.routes.Polyline
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.doubles.shouldBeGreaterThan
import io.kotest.matchers.doubles.shouldBeLessThan
import io.kotest.matchers.ints.shouldBeGreaterThan
import io.kotest.matchers.ints.shouldBeLessThan
import io.kotest.matchers.shouldBe

class PolylineTest : BehaviorSpec({

    Given("구글 문서의 표준 예시 폴리라인") {
        // Google Maps Platform 문서가 명시한 값 — 우리 코드가 만든 기대값이 아니다
        val encoded = "_p~iF~ps|U_ulLnnqC_mqNvxq`@"

        When("디코드하면") {
            val points = Polyline.decode(encoded)

            Then("문서에 적힌 세 좌표가 그대로 나온다") {
                points.size shouldBe 3
                points[0].latitude shouldBe 38.5
                points[0].longitude shouldBe (-120.2)
                points[1].latitude shouldBe 40.7
                points[1].longitude shouldBe (-120.95)
                points[2].latitude shouldBe 43.252
                points[2].longitude shouldBe (-126.453)
            }
        }
    }

    Given("빈 문자열") {
        Then("빈 경로가 나온다 — 예외가 아니다") {
            Polyline.decode("").shouldBe(emptyList())
        }
    }

    Given("서울 근방 두 점") {
        val a = LatLng(37.5, 127.0)
        val b = LatLng(37.5, 127.1)

        When("거리를 재면") {
            val meters = Geo.distanceMeters(a, b)

            Then("경도 0.1도는 이 위도에서 약 8.8km 다") {
                meters shouldBeGreaterThan 8_500.0
                meters shouldBeLessThan 9_200.0
            }
        }
    }

    Given("꼭짓점이 촘촘한 경로") {
        val path = (0..100).map { LatLng(37.5, 127.0 + it * 0.001) }

        When("1km 간격으로 성기게 만들면") {
            val sampled = Geo.sample(path, 1_000.0)

            Then("꼭짓점이 크게 줄고 시작·끝은 남는다") {
                // 총 8.8km 를 1km 간격으로 → 9~11개 (끝점 보정 포함). 101개가 그대로 남으면 안 된다
                sampled.size shouldBeGreaterThan 8
                sampled.size shouldBeLessThan 12
                sampled.first() shouldBe path.first()
                sampled.last() shouldBe path.last()
            }
        }
    }

    Given("점이 하나뿐인 경로") {
        Then("성기게 만들어도 그 점 하나가 남는다 — 출발지=도착지 입력에서 터지지 않는다") {
            Geo.sample(listOf(LatLng(37.5, 127.0)), 1_000.0).size shouldBe 1
        }
    }
})
