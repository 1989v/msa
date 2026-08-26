package com.kgd.ranking

import com.kgd.common.exception.BusinessException
import com.kgd.ranking.application.ranking.port.RankingBoardRepositoryPort
import com.kgd.ranking.application.ranking.port.RankingEntryRepositoryPort
import com.kgd.ranking.application.ranking.port.RankingSnapshotRepositoryPort
import com.kgd.ranking.application.ranking.service.RankingQueryService
import com.kgd.ranking.domain.model.BoardStatus
import com.kgd.ranking.domain.model.RankingBoard
import com.kgd.ranking.domain.model.RankingDomain
import com.kgd.ranking.domain.model.RankingEntry
import com.kgd.ranking.domain.model.RankingMetric
import com.kgd.ranking.domain.model.RankingSnapshot
import com.kgd.ranking.domain.model.SortDirection
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import java.math.BigDecimal
import java.time.Instant

class RankingQueryServiceTest : BehaviorSpec({

    val boardRepository = mockk<RankingBoardRepositoryPort>()
    val snapshotRepository = mockk<RankingSnapshotRepositoryPort>()
    val entryRepository = mockk<RankingEntryRepositoryPort>()
    val service = RankingQueryService(boardRepository, snapshotRepository, entryRepository)

    val capturedAt = Instant.parse("2026-08-23T02:00:00Z")

    fun board(status: BoardStatus = BoardStatus.OPEN, snapshotId: Long? = 7L) =
        RankingBoard(
            id = 1L,
            slug = "gas-0101-b027",
            domain = RankingDomain.GAS_STATION,
            metric = RankingMetric.FUEL_PRICE,
            direction = SortDirection.ASC,
            scopeKey = "0101",
            scopeName = "종로구",
            title = "종로구 휘발유 최저가",
            subtitle = null,
            unit = "원/L",
            sourceLabel = "한국석유공사 오피넷",
            status = status,
            latestSnapshotId = snapshotId,
        )

    fun entry(rank: Int, prevRank: Int?, payload: Map<String, Any?> = emptyMap()) = RankingEntry(
        rank = rank,
        subjectKey = "gas:A$rank",
        subjectName = "주유소$rank",
        score = BigDecimal(1600 + rank),
        prevRank = prevRank,
        payload = payload,
    )

    Given("스냅샷이 있는 보드를 조회할 때") {
        every { boardRepository.findBySlug("gas-0101-b027") } returns board()
        every { snapshotRepository.findById(7L) } returns
            RankingSnapshot(id = 7L, boardId = 1L, capturedAt = capturedAt, entryCount = 3)
        every { entryRepository.findBySnapshotId(7L) } returns listOf(
            entry(1, prevRank = 3, payload = mapOf("brandName" to "SK에너지", "isSelf" to true)),
            entry(2, prevRank = 2),
            entry(3, prevRank = null),
        )

        When("상세를 받으면") {
            val detail = service.execute("gas-0101-b027")

            Then("등락이 종류와 칸 수로 갈려 나온다") {
                detail.entries[0].movement.type shouldBe "UP"
                detail.entries[0].movement.places shouldBe 2
                detail.entries[1].movement.type shouldBe "SAME"
            }

            Then("직전에 없던 대상은 NEW 다 — SAME 이 아니다") {
                detail.entries[2].movement.type shouldBe "NEW"
                detail.entries[2].movement.places shouldBe null
            }

            Then("payload 가 그대로 실린다") {
                detail.entries[0].payload["brandName"] shouldBe "SK에너지"
                detail.entries[0].payload["isSelf"] shouldBe true
                detail.entries[1].payload shouldBe emptyMap()
            }

            Then("출처 표기가 응답에 실린다") {
                detail.sourceLabel shouldBe "한국석유공사 오피넷"
                detail.capturedAt shouldBe capturedAt
            }
        }
    }

    Given("아직 스냅샷이 없는 보드일 때") {
        every { boardRepository.findBySlug("gas-9999-b027") } returns board(snapshotId = null)

        When("상세를 받으면") {
            val detail = service.execute("gas-9999-b027")

            Then("엔트리는 비었지만 화면이 그릴 정보는 다 온다 — 예외가 아니다") {
                detail.entries shouldBe emptyList()
                detail.capturedAt shouldBe null
                detail.title shouldBe "종로구 휘발유 최저가"
            }
        }
    }

    Given("전시하지 않는(HOLD) 보드일 때") {
        every { boardRepository.findBySlug("gas-hold-b027") } returns board(status = BoardStatus.HOLD)

        When("상세를 받으면") {
            Then("존재 여부를 감춘 채 NOT_FOUND 다") {
                shouldThrow<BusinessException> { service.execute("gas-hold-b027") }
            }
        }
    }

    Given("없는 slug 일 때") {
        every { boardRepository.findBySlug("nope") } returns null

        When("상세를 받으면") {
            Then("NOT_FOUND 다") {
                shouldThrow<BusinessException> { service.execute("nope") }
            }
        }
    }
})
