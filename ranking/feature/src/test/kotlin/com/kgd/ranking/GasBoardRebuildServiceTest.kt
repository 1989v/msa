package com.kgd.ranking

import com.kgd.ranking.application.gas.port.GasStationRepositoryPort
import com.kgd.ranking.application.ranking.port.RankingBoardRepositoryPort
import com.kgd.ranking.application.ranking.port.RankingEntryRepositoryPort
import com.kgd.ranking.application.ranking.port.RankingSnapshotRepositoryPort
import com.kgd.ranking.application.ranking.service.GasBoardRebuildService
import com.kgd.ranking.application.ranking.usecase.RebuildGasBoardsUseCase
import com.kgd.ranking.domain.model.GasPrice
import com.kgd.ranking.domain.model.GasStation
import com.kgd.ranking.domain.model.RankingBoard
import com.kgd.ranking.domain.model.RankingEntry
import com.kgd.ranking.domain.model.RankingSnapshot
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldContainExactly
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import io.mockk.verify
import io.mockk.verifyOrder
import java.math.BigDecimal
import java.time.Instant

class GasBoardRebuildServiceTest : BehaviorSpec({

    fun station(opinetId: String, name: String, gasoline: Int?, area: String = "0101") = GasStation(
        id = opinetId.hashCode().toLong(),
        opinetId = opinetId,
        name = name,
        brandCode = null, brandName = null, isSelf = false,
        katecX = null, katecY = null, latitude = null, longitude = null,
        areaCode = area, areaName = "종로구",
        roadAddress = null, jibunAddress = null, tel = null,
        hasCarWash = null, hasMaintenance = null, hasCvs = null, is24h = null,
        syncedAt = Instant.EPOCH,
        prices = listOfNotNull(gasoline?.let { GasPrice("B027", it, null) }),
    )

    Given("주유소 3곳이 적재돼 있고 직전 스냅샷이 있을 때") {
        val boardRepository = mockk<RankingBoardRepositoryPort>()
        val snapshotRepository = mockk<RankingSnapshotRepositoryPort>(relaxUnitFun = true)
        val entryRepository = mockk<RankingEntryRepositoryPort>(relaxUnitFun = true)
        val stationRepository = mockk<GasStationRepositoryPort>()
        val service = GasBoardRebuildService(boardRepository, snapshotRepository, entryRepository, stationRepository)

        every { stationRepository.findAll() } returns listOf(
            station("A", "가주유소", gasoline = 1700),
            station("B", "나주유소", gasoline = 1650),
            station("C", "다주유소", gasoline = null), // 휘발유를 안 판다 — 보드에 안 들어간다
        )
        val savedBoards = mutableListOf<RankingBoard>()
        every { boardRepository.findBySlug("gas-0101-b027") } returns null
        every { boardRepository.save(capture(savedBoards)) } answers { firstArg<RankingBoard>().copy(id = 10L) }
        every { entryRepository.findBySnapshotId(any()) } returns emptyList()
        every { snapshotRepository.save(any()) } answers { firstArg<RankingSnapshot>().copy(id = 99L) }
        every { snapshotRepository.findIdsCapturedBefore(any()) } returns listOf(1L, 2L)

        When("전량 재생성하면") {
            val result = service.execute(RebuildGasBoardsUseCase.Command("한국석유공사 오피넷"))

            Then("휘발유를 파는 곳만 줄 세워 한 보드가 만들어진다") {
                result shouldBe RebuildGasBoardsUseCase.Result(boards = 1, entries = 2)
                val entries = slot<List<RankingEntry>>()
                verify { entryRepository.saveAll(99L, capture(entries)) }
                entries.captured.map { it.subjectKey } shouldContainExactly listOf("gas:B", "gas:A")
                entries.captured.map { it.rank } shouldContainExactly listOf(1, 2)
            }

            Then("보드는 엔트리를 다 쓴 뒤에 스냅샷을 공개한다") {
                verifyOrder {
                    entryRepository.saveAll(99L, any())
                    boardRepository.save(match { it.latestSnapshotId == 99L })
                }
                savedBoards.first().latestSnapshotId shouldBe null
                savedBoards.last().latestSnapshotId shouldBe 99L
            }

            Then("보관기간 지난 스냅샷은 엔트리부터 지운다") {
                verifyOrder {
                    entryRepository.deleteBySnapshotIdIn(listOf(1L, 2L))
                    snapshotRepository.deleteAllById(listOf(1L, 2L))
                }
            }
        }
    }

    Given("적재된 주유소가 없을 때") {
        val stationRepository = mockk<GasStationRepositoryPort>()
        val boardRepository = mockk<RankingBoardRepositoryPort>()
        val service = GasBoardRebuildService(boardRepository, mockk(), mockk(), stationRepository)
        every { stationRepository.findAll() } returns emptyList()

        When("재생성하면") {
            val result = service.execute(RebuildGasBoardsUseCase.Command("x"))

            Then("보드를 만들지 않고 0 을 돌려준다") {
                result shouldBe RebuildGasBoardsUseCase.Result(0, 0)
                verify(exactly = 0) { boardRepository.save(any()) }
            }
        }
    }
})
