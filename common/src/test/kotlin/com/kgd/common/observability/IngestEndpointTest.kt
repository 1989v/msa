package com.kgd.common.observability

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.time.ZoneOffset

class IngestEndpointTest : BehaviorSpec({

    val now = Instant.parse("2026-09-12T00:00:00Z")
    val clock = Clock.fixed(now, ZoneOffset.UTC)

    fun check(job: String, lastIngestedAt: () -> Instant?) =
        IngestFreshness(job, "0 20 * * *", Duration.ofHours(72), lastIngestedAt)

    fun report(vararg checks: IngestFreshness) = IngestEndpoint(checks.toList(), clock).report()

    @Suppress("UNCHECKED_CAST")
    fun jobs(r: Map<String, Any>) = r["jobs"] as List<IngestFreshness.Report>

    Given("허용 나이 안에 적재된 배치") {
        Then("FRESH 이고 전체는 healthy 다") {
            val r = report(check("place-ingest-intro") { now.minus(Duration.ofHours(71)) })
            jobs(r).single().state shouldBe IngestFreshness.State.FRESH
            jobs(r).single().ageHours shouldBe 71L
            r["healthy"] shouldBe true
        }
    }

    Given("허용 나이를 넘긴 배치") {
        Then("STALE 이고 전체가 healthy 가 아니다") {
            val r = report(check("place-ingest-intro") { now.minus(Duration.ofHours(73)) })
            jobs(r).single().state shouldBe IngestFreshness.State.STALE
            r["healthy"] shouldBe false
        }
    }

    Given("한 번도 적재되지 않은 배치") {
        Then("NEVER 이고 나이를 싣지 않는다") {
            val r = report(check("ranking-ingest-gas") { null })
            jobs(r).single().state shouldBe IngestFreshness.State.NEVER
            jobs(r).single().ageHours shouldBe null
            r["healthy"] shouldBe false
        }
    }

    Given("조회가 실패한 배치") {
        Then("UNKNOWN 이고 배치 실패로 단정하지 않는다") {
            val r = report(check("place-ingest-intro") { error("connection refused") })
            jobs(r).single().state shouldBe IngestFreshness.State.UNKNOWN
            jobs(r).single().error shouldBe "connection refused"
            r["healthy"] shouldBe true
        }
    }

    Given("정상과 실패가 섞인 두 배치") {
        Then("job 이름순으로 나오고 하나라도 낡으면 healthy 가 아니다") {
            val r = report(
                check("place-ingest-intro") { now.minus(Duration.ofHours(1)) },
                check("ranking-ingest-gas") { null },
            )
            jobs(r).map { it.job } shouldBe listOf("place-ingest-intro", "ranking-ingest-gas")
            jobs(r).map { it.state } shouldBe
                listOf(IngestFreshness.State.FRESH, IngestFreshness.State.NEVER)
            r["healthy"] shouldBe false
        }
    }
})
