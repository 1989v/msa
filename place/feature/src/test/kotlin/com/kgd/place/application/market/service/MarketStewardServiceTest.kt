package com.kgd.place.application.market.service

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.place.application.market.port.*
import com.kgd.place.application.market.usecase.*
import com.kgd.place.domain.market.model.*
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.*

class MarketStewardServiceTest : BehaviorSpec({
    fun fixture(): Triple<MarketStewardService, MarketStewardPort, MutableMap<Long, MarketSteward>> {
        val rows = mutableMapOf<Long, MarketSteward>()
        val port = mockk<MarketStewardPort>()
        val editor = mockk<MarketEditorPort>()
        every { editor.lockMarket(any()) } answers { Market("m", "시장", MarketType.STREET, id = firstArg()) }
        every { editor.findMarket(any()) } answers { Market("m", "시장", MarketType.STREET, id = firstArg()) }
        every { port.find(any(), any()) } answers { rows.values.find { it.marketId == firstArg<Long>() && it.memberId == secondArg<Long>() } }
        every { port.marketIdById(any()) } answers { rows[firstArg<Long>()]?.marketId }
        every { port.lockById(any()) } answers { rows[firstArg<Long>()] }
        every { port.save(any()) } answers {
            firstArg<MarketSteward>().let { it.copy(id = it.id ?: rows.size + 1L) }.also { rows[it.id!!] = it }
        }
        return Triple(MarketStewardService(port, editor), port, rows)
    }
    Given("market-scoped application lifecycle") {
        Then("creates PENDING, rejects duplicate PENDING/ACTIVE, and permits multiple markets") {
            val (service, _, rows) = fixture()
            val request = MarketStewardUseCase.Application("상인회", "연락처")
            service.apply(7, 1, request).status shouldBe MarketStewardStatus.PENDING
            shouldThrow<MarketEditConflict> { service.apply(7, 1, request) }
            service.decide(9, 1, MarketStewardUseCase.Action.APPROVE)
            shouldThrow<MarketEditConflict> { service.apply(7, 1, request) }
            service.apply(7, 2, request).marketId shouldBe 2
            rows.size shouldBe 2
        }
        Then("reapplies REJECTED using the same ID and blocks SUSPENDED until admin restore") {
            val (service, _, _) = fixture()
            val request = MarketStewardUseCase.Application("상인회", "연락처")
            val original = service.apply(7, 1, request)
            service.decide(9, 1, MarketStewardUseCase.Action.REJECT)
            val reapplied = service.apply(7, 1, request.copy(contact = "새 연락처"))
            reapplied.id shouldBe original.id
            reapplied.createdAt shouldBe original.createdAt
            reapplied.status shouldBe MarketStewardStatus.PENDING
            reapplied.contact shouldBe "새 연락처"
            service.decide(9, 1, MarketStewardUseCase.Action.APPROVE)
            service.decide(9, 1, MarketStewardUseCase.Action.SUSPEND)
            shouldThrow<MarketEditConflict> { service.apply(7, 1, request) }
            service.decide(10, 1, MarketStewardUseCase.Action.RESTORE).approvedByMemberId shouldBe 10
        }
        Then("all illegal transitions fail without persistence and approval metadata survives suspension") {
            val (service, port, rows) = fixture()
            service.apply(7, 1, MarketStewardUseCase.Application("상인회", "연락처"))
            MarketStewardStatus.entries.forEach { state ->
                val approved = java.time.LocalDateTime.of(2026, 10, 15, 12, 0)
                rows[1] = rows.getValue(1).copy(status = state, approvedByMemberId = 9, approvedAt = approved)
                MarketStewardUseCase.Action.entries.forEach { action ->
                    rows[1] = rows.getValue(1).copy(status = state, approvedByMemberId = 9, approvedAt = approved)
                    val valid = (state == MarketStewardStatus.PENDING && action in listOf(MarketStewardUseCase.Action.APPROVE, MarketStewardUseCase.Action.REJECT)) ||
                        (state == MarketStewardStatus.ACTIVE && action == MarketStewardUseCase.Action.SUSPEND) ||
                        (state == MarketStewardStatus.SUSPENDED && action == MarketStewardUseCase.Action.RESTORE)
                    clearMocks(port, answers = false, recordedCalls = true)
                    if (valid) {
                        val result = service.decide(10, 1, action)
                        if (action == MarketStewardUseCase.Action.SUSPEND) {
                            result.approvedAt shouldBe approved
                            result.approvedByMemberId shouldBe 9
                        }
                    } else {
                        shouldThrow<InvalidMarketStewardTransition> { service.decide(10, 1, action) }
                        verify(exactly = 0) { port.save(any()) }
                    }
                }
            }
        }
        Then("reads DB each request and rejects other member/market and requests after suspension") {
            val (service, port, _) = fixture()
            service.apply(7, 1, MarketStewardUseCase.Application("상인회", "연락처"))
            service.decide(9, 1, MarketStewardUseCase.Action.APPROVE)
            service.actor(7, 1).kind shouldBe MarketActorKind.STEWARD
            shouldThrow<BusinessException> { service.actor(7, 2) }.errorCode shouldBe ErrorCode.FORBIDDEN
            shouldThrow<BusinessException> { service.actor(8, 1) }.errorCode shouldBe ErrorCode.FORBIDDEN
            service.decide(9, 1, MarketStewardUseCase.Action.SUSPEND)
            shouldThrow<BusinessException> { service.actor(7, 1) }.errorCode shouldBe ErrorCode.FORBIDDEN
            verify(atLeast = 2) { port.find(1, 7) }
        }
        Then("locks market before current steward read and rejects a decision already changed by another writer") {
            val port = mockk<MarketStewardPort>()
            val editor = mockk<MarketEditorPort>()
            val service = MarketStewardService(port, editor)
            var locked = false
            every { port.marketIdById(1) } returns 1L
            every { editor.lockMarket(1) } answers { locked = true; Market("m", "시장", MarketType.STREET, id = 1) }
            every { port.lockById(1) } answers {
                locked shouldBe true
                // The scalar lookup occurred while PENDING; the current locked row is now ACTIVE.
                MarketSteward(1, 7, "a", "c", MarketStewardStatus.ACTIVE, 9, java.time.LocalDateTime.now(), id = 1)
            }
            shouldThrow<InvalidMarketStewardTransition> { service.decide(10, 1, MarketStewardUseCase.Action.REJECT) }
            verifyOrder { port.marketIdById(1); editor.lockMarket(1); port.lockById(1) }
            verify(exactly = 0) { port.save(any()) }
        }
        Then("bounds input and pagination, returns own current state and pages status results") {
            val (service, port, _) = fixture()
            shouldThrow<IllegalArgumentException> { service.apply(7, 1, MarketStewardUseCase.Application(" ", "c")) }
            shouldThrow<IllegalArgumentException> { service.apply(7, 1, MarketStewardUseCase.Application("a", "c".repeat(501))) }
            shouldThrow<IllegalArgumentException> { service.list(9, null, 0, 101) }
            service.current(7, 1) shouldBe null
            val row = service.apply(7, 1, MarketStewardUseCase.Application("a", "c"))
            service.current(7, 1) shouldBe row
            every { port.list(MarketStewardStatus.PENDING, 1, 5) } returns (listOf(row) to 1L)
            service.list(9, MarketStewardStatus.PENDING, 1, 5).items shouldBe listOf(row)
        }
    }
})
