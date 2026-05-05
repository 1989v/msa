package com.kgd.quant.application.live

import com.fasterxml.jackson.databind.ObjectMapper
import com.kgd.quant.application.port.persistence.AuditEventRepositoryPort
import com.kgd.quant.domain.common.TenantId
import com.kgd.quant.domain.live.AuditEvent
import com.kgd.quant.domain.live.AuditEventType
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.kotest.matchers.types.shouldBeInstanceOf
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import io.mockk.slot
import kotlinx.coroutines.runBlocking
import java.time.Instant

/**
 * AuditChainServiceSpec — canonical JSON 정렬 + chain prevHash → currentHash 검증 (L8).
 */
class AuditChainServiceSpec : BehaviorSpec({
    val tenantId = TenantId("11111111-1111-1111-1111-111111111111")
    val now = Instant.parse("2026-05-05T00:00:00Z")

    given("AuditChainService.append") {
        val repo = mockk<AuditEventRepositoryPort>(relaxed = true)
        coEvery { repo.lastTipHash(tenantId) } returns null
        val captured = slot<AuditEvent>()
        coEvery { repo.append(capture(captured)) } returns Unit

        val service = AuditChainService(repo, ObjectMapper())

        `when`("payload 키 순서가 반대로 들어와도") {
            val payload1 = mapOf("z" to 1, "a" to 2, "m" to 3)
            val payload2 = mapOf("a" to 2, "m" to 3, "z" to 1)

            then("동일한 currentHash 가 생성된다 (canonical sort)") {
                runBlocking {
                    val ev1 = service.append(tenantId, AuditEventType.ORDER_PLACED, payload1, now)
                    coEvery { repo.lastTipHash(tenantId) } returns null
                    val ev2 = service.append(tenantId, AuditEventType.ORDER_PLACED, payload2, now)
                    ev1.currentHash shouldBe ev2.currentHash
                    ev1.payloadCanonical shouldContain "\"a\""
                }
            }
        }

        `when`("두 번째 append 시점에 prevHash 가 있다면") {
            then("currentHash 가 prevHash 를 반영해 달라진다") {
                runBlocking {
                    coEvery { repo.lastTipHash(tenantId) } returns null
                    val ev1 = service.append(tenantId, AuditEventType.ORDER_PLACED, mapOf("k" to "v"), now)
                    coEvery { repo.lastTipHash(tenantId) } returns ev1.currentHash
                    val ev2 = service.append(tenantId, AuditEventType.ORDER_PLACED, mapOf("k" to "v"), now)
                    ev1.currentHash shouldBe ev2.prevHash
                    (ev1.currentHash != ev2.currentHash) shouldBe true
                }
                coVerify(atLeast = 2) { repo.append(any()) }
            }
        }
    }

    given("AuditChainService.verify") {
        `when`("chain 이 정상이면") {
            then("Ok 반환") {
                val repo = mockk<AuditEventRepositoryPort>(relaxed = true)
                val mapper = ObjectMapper()
                val service = AuditChainService(repo, mapper)

                val ev1 = AuditEvent.append(tenantId, AuditEventType.ORDER_PLACED, "{\"a\":1}", now, null)
                val ev2 = AuditEvent.append(tenantId, AuditEventType.ORDER_FILLED, "{\"b\":2}", now.plusSeconds(1), ev1.currentHash)
                coEvery { repo.loadAscending(tenantId, any()) } returns listOf(ev1, ev2)

                val r = runBlocking { service.verify(tenantId) }
                r.shouldBeInstanceOf<AuditEvent.VerifyResult.Ok>()
            }
        }
    }
})
