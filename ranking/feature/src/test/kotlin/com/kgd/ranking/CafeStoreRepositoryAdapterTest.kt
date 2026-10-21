package com.kgd.ranking

import com.kgd.ranking.application.cafe.dto.*
import com.kgd.ranking.infrastructure.persistence.adapter.CafeStoreRepositoryAdapter
import com.kgd.ranking.infrastructure.persistence.entity.*
import com.kgd.ranking.infrastructure.persistence.repository.*
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.assertions.throwables.shouldThrow
import io.mockk.*
import tools.jackson.databind.ObjectMapper
import java.time.Instant
import java.time.LocalDate
import java.util.Optional

class CafeStoreRepositoryAdapterTest : BehaviorSpec({
    Given("a complete snapshot with three stores") {
        val snapshots = mockk<CafeStoreSnapshotJpaRepository>(relaxed = true)
        val stores = mockk<CafeStoreJpaRepository>(relaxed = true)
        val areas = mockk<CafeStoreAreaJpaRepository>(relaxed = true)
        val rows = mutableListOf<CafeStoreJpaEntity>()
        var current: CafeStoreSnapshotJpaEntity? = null
        every { snapshots.lockCurrent() } answers { current }
        every { snapshots.saveAndFlush(any()) } answers { firstArg<CafeStoreSnapshotJpaEntity>().also { current = it } }
        every { stores.findAll() } answers { rows.toList() }
        every { stores.saveAll(any<List<CafeStoreJpaEntity>>()) } answers { firstArg<List<CafeStoreJpaEntity>>().also { rows.clear(); rows.addAll(it) } }
        val adapter = CafeStoreRepositoryAdapter(snapshots, stores, areas, ObjectMapper())
        fun store(key: String) = CafeStoreRecord(key, "starbucks", "스타벅스", "스타벅스", null, "서울", 37.5, 127.0, "1168000000", "CONFIRMED", mapOf("sourceExtra" to "unchanged"))
        fun snapshot(version: String, keys: List<String>, seconds: Long) = CafeStoreSnapshot(version, true, null, Instant.parse("2026-10-20T00:00:00Z").plusSeconds(seconds), "v1", keys.map(::store), sourceTotal = 100, receivedTotal = 100)
        Then("a missing source key is active for one full round, inactive after two; retry does not advance") {
            adapter.replace(snapshot("one", listOf("a", "b", "c", "d"), 0))
            adapter.replace(snapshot("two", listOf("a", "b", "c"), 60))
            rows.single { it.storeKey == "d" }.missingRounds shouldBe 1
            adapter.replace(snapshot("two", listOf("a", "b", "c"), 60)) shouldBe 0
            rows.single { it.storeKey == "d" }.missingRounds shouldBe 1
            adapter.replace(snapshot("three", listOf("a", "b", "c"), 120))
            rows.single { it.storeKey == "d" }.missingRounds shouldBe 2
            adapter.replace(snapshot("four", listOf("a", "b", "c", "d"), 180))
            rows.single { it.storeKey == "d" }.missingRounds shouldBe 0
            ObjectMapper().readTree(rows.first().rawJson).get("sourceExtra").asText() shouldBe "unchanged"
        }
        Then("a published verified source date survives snapshot metadata independently of collection time") {
            current = null
            rows.clear()
            val published = snapshot("dated", listOf("a"), 240).copy(sourceAsOf = LocalDate.parse("2026-10-01"))
            adapter.replace(published)
            every { snapshots.findById(1) } answers { Optional.ofNullable(current) }
            adapter.metadata()?.sourceAsOf shouldBe LocalDate.parse("2026-10-01")
            adapter.metadata()?.fetchedAt shouldBe published.fetchedAt
            rows.single().storeName shouldBe "스타벅스"
        }
        Then("excessive shrink/growth or out-of-order input is rejected before any write") {
            current = CafeStoreSnapshotJpaEntity(version = "latest", fetchedAt = Instant.parse("2026-10-20T00:00:00Z"))
            rows.clear(); rows.addAll((1..10).map { CafeStoreJpaEntity(storeKey = "$it") })
            clearMocks(stores, answers = false, recordedCalls = true)
            shouldThrow<IllegalArgumentException> { adapter.replace(snapshot("shrunk", listOf("a"), 60)) }
            shouldThrow<IllegalArgumentException> { adapter.replace(snapshot("old", (1..10).map { "$it" }, -60)) }
            shouldThrow<IllegalArgumentException> { adapter.replace(snapshot("exploded", (1..20).map { "$it" }, 60)) }
            verify(exactly = 0) { stores.saveAll(any<List<CafeStoreJpaEntity>>()) }
        }
    }
})
