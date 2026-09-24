package com.kgd.codedictionary.application.ontology.service

import com.kgd.codedictionary.application.ontology.dto.OntologyState
import com.kgd.codedictionary.application.ontology.port.OntologySyncStatePort
import com.kgd.codedictionary.application.sync.dto.SyncOutcome
import com.kgd.codedictionary.application.sync.usecase.SyncConceptIndexUseCase
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.clearAllMocks
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify

class OntologyDerivedRefresherTest : BehaviorSpec({

    val state = mockk<OntologySyncStatePort>()
    val sync = mockk<SyncConceptIndexUseCase>()
    val refresher = OntologyDerivedRefresher(state, sync, listOf(0L, 0L, 0L))

    beforeContainer { clearAllMocks() }

    given("이미 수렴했다") {
        every { state.readState() } returns OntologyState(1, "h1", "h1")
        then("색인하지 않는다") {
            refresher.refreshIfStale() shouldBe true
            verify(exactly = 0) { sync.syncNow() }
        }
    }

    given("다른 파드가 색인 중이다가 끝난 뒤 우리가 돈다") {
        every { state.readState() } returnsMany listOf(
            OntologyState(2, "h2", "h1"), OntologyState(2, "h2", "h1"), OntologyState(2, "h2", "h2"),
        )
        every { sync.syncNow() } returnsMany listOf(SyncOutcome.Busy, SyncOutcome.Done("i", 1, "h2"))
        then("재시도해서 수렴한다") {
            refresher.refreshIfStale() shouldBe true
            verify(exactly = 2) { sync.syncNow() }
        }
    }

    given("색인이 계속 실패한다") {
        every { state.readState() } returns OntologyState(2, "h2", "h1")
        every { sync.syncNow() } throws IllegalStateException("opensearch down")
        then("backoff 횟수만큼 시도하고 false — 다음 부팅에 맡긴다") {
            refresher.refreshIfStale() shouldBe false
            verify(exactly = 4) { sync.syncNow() }
        }
    }
})
