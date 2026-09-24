package com.kgd.payment.domain.opsissue.model

import com.kgd.payment.domain.opsissue.exception.InvalidOpsIssueStateException
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import java.time.Instant

class OpsIssueTest : BehaviorSpec({
    val t0 = Instant.parse("2026-09-24T00:00:00Z")

    fun issue() = OpsIssue.open(OpsIssueType.PAYMENT_UNKNOWN, "ORD-1-1", "재조회 5회 실패", null, t0)

    given("운영 이슈") {
        then("OPEN → RETRIED → CLOSED, 처리자·사유가 남는다") {
            val i = issue()
            i.retry("9", t0)
            i.status shouldBe OpsIssueStatus.RETRIED
            i.actorId shouldBe "9"
            i.close("9", "PG 콘솔에서 확인", t0)
            i.status shouldBe OpsIssueStatus.CLOSED
            i.reason shouldBe "PG 콘솔에서 확인"
        }
        then("CLOSED 는 종착 — 재시도·재종결 불가") {
            val i = issue().also { it.close("9", "종결", t0) }
            shouldThrow<InvalidOpsIssueStateException> { i.retry("9", t0) }
            shouldThrow<InvalidOpsIssueStateException> { i.close("9", "다시", t0) }
        }
        then("종결 사유는 비울 수 없다") {
            shouldThrow<IllegalArgumentException> { issue().close("9", " ", t0) }
        }
    }
})
