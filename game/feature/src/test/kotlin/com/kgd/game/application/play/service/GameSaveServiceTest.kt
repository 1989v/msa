package com.kgd.game.application.play.service

import com.kgd.game.application.catalog.port.GameRepositoryPort
import com.kgd.game.application.play.port.GameSaveRepositoryPort
import com.kgd.game.application.play.port.SaveLeasePort
import com.kgd.game.application.play.port.SaveSnapshot
import com.kgd.game.domain.catalog.model.EngineType
import com.kgd.game.domain.catalog.model.Game
import com.kgd.game.domain.catalog.model.GameStatus
import com.kgd.game.domain.catalog.model.Genre
import com.kgd.game.domain.catalog.model.LoadType
import com.kgd.game.domain.catalog.model.Orientation
import com.kgd.game.domain.play.exception.SaveLockedException
import com.kgd.game.domain.play.exception.SaveTooLargeException
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk

class GameSaveServiceTest : BehaviorSpec({

    fun publishedGame(): Game = Game.restore(
        id = 1L,
        slug = "roguelike",
        title = "Roguelike",
        description = "d",
        thumbnailUrl = "/t.png",
        coverUrl = null,
        engineType = EngineType.CANVAS_TS,
        loadType = LoadType.IFRAME,
        entryUrl = "/games/roguelike/index.html",
        orientation = Orientation.BOTH,
        supportsMobile = true,
        developerName = "kgd",
        sdkIntegrated = false,
        status = GameStatus.PUBLISHED,
        genre = Genre.RPG,
        tags = emptyList(),
        releasedAt = null,
        contentUpdatedAt = null,
    )

    fun serviceWith(
        lease: SaveLeasePort,
        saveRepository: GameSaveRepositoryPort = mockk(relaxed = true),
    ): GameSaveService {
        val gameRepository = mockk<GameRepositoryPort>()
        every { gameRepository.findBySlug("roguelike") } returns publishedGame()
        return GameSaveService(gameRepository, lease, GameSaveCommand(saveRepository))
    }

    given("세이브 로드 시") {
        `when`("다른 기기가 리스를 점유 중이어도") {
            then("읽기는 막히지 않아야 한다 (코드 복구 경로 보장)") {
                val lease = mockk<SaveLeasePort>()
                every { lease.tryAcquire(any(), any(), any(), any(), any()) } returns false
                val saveRepository = mockk<GameSaveRepositoryPort>()
                every { saveRepository.find(1L, 7L) } returns SaveSnapshot("{}", 2L, "CODE12345678")

                serviceWith(lease, saveRepository)
                    .load("roguelike", memberId = 7L, code = null, holder = "device-b")?.version shouldBe 2L
            }
        }

        `when`("세이브가 없으면") {
            then("null을 반환해야 한다 (신규 유저)") {
                val lease = mockk<SaveLeasePort>(relaxed = true)
                val saveRepository = mockk<GameSaveRepositoryPort>()
                every { saveRepository.find(1L, 7L) } returns null

                serviceWith(lease, saveRepository).load("roguelike", 7L, null, "device-a") shouldBe null
            }
        }

        `when`("게스트가 이어하기 코드를 제시하면") {
            then("코드로 세이브를 찾아야 한다") {
                val lease = mockk<SaveLeasePort>(relaxed = true)
                val saveRepository = mockk<GameSaveRepositoryPort>()
                every { saveRepository.findByCode(1L, "ABCD2345WXYZ") } returns
                    SaveSnapshot(data = """{"floor":5}""", version = 4L, code = "ABCD2345WXYZ")

                val result = serviceWith(lease, saveRepository)
                    .load("roguelike", memberId = null, code = "ABCD2345WXYZ", holder = "device-a")
                result?.version shouldBe 4L
                result?.code shouldBe "ABCD2345WXYZ"
            }
        }

        `when`("신원(로그인/코드)이 전혀 없으면") {
            then("불러올 세이브가 없어 null을 반환해야 한다") {
                val lease = mockk<SaveLeasePort>(relaxed = true)
                serviceWith(lease).load("roguelike", memberId = null, code = null, holder = "device-a") shouldBe null
            }
        }
    }

    given("세이브 저장 시") {
        `when`("64KB를 초과하면") {
            then("SaveTooLargeException이 발생해야 한다") {
                val lease = mockk<SaveLeasePort>()
                every { lease.tryAcquire(any(), any(), any(), any(), any()) } returns true

                shouldThrow<SaveTooLargeException> {
                    serviceWith(lease).store("roguelike", 7L, null, "device-a", "x".repeat(64 * 1024 + 1), 0)
                }
            }
        }

        `when`("리스 보유 + 버전이 맞으면") {
            then("업서트 결과를 반환해야 한다") {
                val lease = mockk<SaveLeasePort>()
                every { lease.tryAcquire(1L, "7", "device-a", any(), any()) } returns true
                val saveRepository = mockk<GameSaveRepositoryPort>()
                every { saveRepository.upsert(1L, 7L, null, """{"floor":3}""", 2L) } returns
                    SaveSnapshot(data = """{"floor":3}""", version = 3L, code = "CODE12345678")

                val result = serviceWith(lease, saveRepository)
                    .store("roguelike", 7L, null, "device-a", """{"floor":3}""", 2L)
                result.version shouldBe 3L
            }
        }

        `when`("게스트의 첫 저장이면") {
            then("리스 없이 저장되고 이어하기 코드가 발급되어야 한다") {
                val lease = mockk<SaveLeasePort>()
                val saveRepository = mockk<GameSaveRepositoryPort>()
                every { saveRepository.upsert(1L, null, null, """{"floor":1}""", 0L) } returns
                    SaveSnapshot(data = """{"floor":1}""", version = 1L, code = "NEWCODE23456")

                val result = serviceWith(lease, saveRepository)
                    .store("roguelike", null, null, "device-a", """{"floor":1}""", 0L)
                result.code shouldBe "NEWCODE23456"
            }
        }
    }
})
