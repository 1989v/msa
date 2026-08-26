package com.kgd.ranking

import com.kgd.ranking.infrastructure.persistence.adapter.RankingEntryRepositoryAdapter
import com.kgd.ranking.infrastructure.persistence.entity.RankingEntryJpaEntity
import com.kgd.ranking.infrastructure.persistence.repository.RankingEntryJpaRepository
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import tools.jackson.databind.ObjectMapper
import java.math.BigDecimal

class RankingEntryRepositoryAdapterTest : BehaviorSpec({

    val jpaRepository = mockk<RankingEntryJpaRepository>()
    val adapter = RankingEntryRepositoryAdapter(jpaRepository, ObjectMapper())

    fun row(rank: Int, payload: String?) = RankingEntryJpaEntity(
        snapshotId = 7L, rankNo = rank, subjectKey = "gas:A$rank", subjectName = "주유소$rank",
        score = BigDecimal(1600 + rank), prevRank = null, payload = payload,
    )

    Given("payload 가 JSON 문자열로 저장된 순위 줄") {
        every { jpaRepository.findBySnapshotIdOrderByRankNoAsc(7L) } returns listOf(
            row(1, """{"brandName":"SK에너지","isSelf":true}"""),
            row(2, null),
        )

        When("도메인으로 읽으면") {
            val entries = adapter.findBySnapshotId(7L)

            Then("payload 가 맵으로 풀린다") {
                entries[0].payload["brandName"] shouldBe "SK에너지"
                entries[0].payload["isSelf"] shouldBe true
            }

            Then("payload 가 없는 줄은 빈 맵이지 예외가 아니다") {
                entries[1].payload shouldBe emptyMap()
            }
        }
    }
})
