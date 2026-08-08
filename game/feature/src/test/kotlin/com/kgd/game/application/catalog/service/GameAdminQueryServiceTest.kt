package com.kgd.game.application.catalog.service

import com.kgd.game.application.catalog.dto.AdminGameSummaryDto
import com.kgd.game.application.catalog.port.GameAdminQueryPort
import com.kgd.game.application.catalog.port.GameRepositoryPort
import com.kgd.game.application.catalog.port.GameSearchCriteria
import com.kgd.game.application.catalog.port.GameStatsRepositoryPort
import com.kgd.game.domain.catalog.exception.GameNotFoundException
import com.kgd.game.domain.catalog.model.EngineType
import com.kgd.game.domain.catalog.model.Game
import com.kgd.game.domain.catalog.model.GameStatus
import com.kgd.game.domain.catalog.model.Genre
import com.kgd.game.domain.catalog.model.LoadType
import com.kgd.game.domain.catalog.model.Orientation
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import org.springframework.data.domain.PageImpl
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Pageable
import java.time.Instant

class GameAdminQueryServiceTest : BehaviorSpec({

    fun row(slug: String, status: GameStatus) = AdminGameSummaryDto(
        id = 1,
        slug = slug,
        title = slug,
        titleEn = null,
        thumbnailUrl = "/t.png",
        status = status,
        genre = Genre.CASUAL,
        tags = listOf("puzzle"),
        playCount = 0,
        ratingAvg = 0.0,
        ratingCount = 0,
        updatedAt = Instant.parse("2026-08-01T00:00:00Z"),
    )

    fun gameWith(slug: String, status: GameStatus): Game = Game.restore(
        id = 7L,
        slug = slug,
        title = slug,
        description = "",
        thumbnailUrl = "/t.png",
        coverUrl = null,
        engineType = EngineType.HTML5,
        loadType = LoadType.IFRAME,
        entryUrl = "/games/$slug/index.html",
        orientation = Orientation.BOTH,
        supportsMobile = true,
        developerName = "kgd",
        sdkIntegrated = false,
        status = status,
        genre = Genre.CASUAL,
        tags = emptyList(),
        releasedAt = null,
        contentUpdatedAt = null,
    )

    given("어드민 목록 조회 시") {
        `when`("상태 필터가 없으면") {
            then("상태 무관 조건으로 조회해 DRAFT/BETA/SUSPENDED 도 함께 반환한다") {
                val port = mockk<GameAdminQueryPort>()
                val service = GameAdminQueryService(port, mockk(), mockk())
                val criteria = slot<GameSearchCriteria>()
                val hidden = listOf(
                    row("draft-game", GameStatus.DRAFT),
                    row("beta-game", GameStatus.BETA),
                    row("stopped-game", GameStatus.SUSPENDED),
                    row("live-game", GameStatus.PUBLISHED),
                )
                every { port.search(capture(criteria), any()) } returns PageImpl(hidden)

                val page = service.list(
                    q = null, status = null, genre = null, tag = null,
                    sort = GameSort.UPDATED, page = 0, size = 20,
                )

                criteria.captured.statuses shouldBe emptySet()
                page.content.map { it.status } shouldBe listOf(
                    GameStatus.DRAFT, GameStatus.BETA, GameStatus.SUSPENDED, GameStatus.PUBLISHED,
                )
            }
        }

        `when`("검색어·상태·장르·태그·정렬·페이징이 주어지면") {
            then("그대로 조회 조건에 실려야 한다") {
                val port = mockk<GameAdminQueryPort>()
                val service = GameAdminQueryService(port, mockk(), mockk())
                val criteria = slot<GameSearchCriteria>()
                val pageable = slot<Pageable>()
                every { port.search(capture(criteria), capture(pageable)) } returns PageImpl(
                    listOf(row("beta-game", GameStatus.BETA)),
                    PageRequest.of(2, 5),
                    1,
                )

                service.list(
                    q = "beta",
                    status = GameStatus.BETA,
                    genre = Genre.RPG,
                    tag = "adventure",
                    sort = GameSort.TITLE,
                    page = 2,
                    size = 5,
                )

                criteria.captured shouldBe GameSearchCriteria(
                    q = "beta",
                    tag = "adventure",
                    genre = Genre.RPG,
                    statuses = setOf(GameStatus.BETA),
                    sort = GameSort.TITLE,
                )
                pageable.captured.pageNumber shouldBe 2
                pageable.captured.pageSize shouldBe 5
            }
        }
    }

    given("어드민 상세 조회 시") {
        `when`("DRAFT 게임이면") {
            then("공개 상세와 달리 숨기지 않고 편집용으로 반환한다") {
                val gameRepository = mockk<GameRepositoryPort>()
                val statsRepository = mockk<GameStatsRepositoryPort>()
                val service = GameAdminQueryService(mockk(), gameRepository, statsRepository)
                every { gameRepository.findBySlug("hidden") } returns gameWith("hidden", GameStatus.DRAFT)
                every { statsRepository.findByGameId(7L) } returns null

                val detail = service.detail("hidden")

                detail.slug shouldBe "hidden"
                detail.status shouldBe GameStatus.DRAFT
                detail.playCount shouldBe 0
            }
        }

        `when`("존재하지 않는 슬러그면") {
            then("GameNotFoundException 이어야 한다") {
                val gameRepository = mockk<GameRepositoryPort>()
                val service = GameAdminQueryService(mockk(), gameRepository, mockk())
                every { gameRepository.findBySlug("nope") } returns null

                shouldThrow<GameNotFoundException> { service.detail("nope") }
            }
        }
    }

    given("어드민 정렬 파라미터 파싱 시") {
        `when`("created/title/playCount 가 오면") {
            then("각 정렬로 매핑되고, 그 외에는 최근 수정순이 기본이다") {
                GameSort.parseAdmin("created") shouldBe GameSort.CREATED
                GameSort.parseAdmin("title") shouldBe GameSort.TITLE
                GameSort.parseAdmin("playCount") shouldBe GameSort.PLAY_COUNT
                GameSort.parseAdmin("updated") shouldBe GameSort.UPDATED
                GameSort.parseAdmin(null) shouldBe GameSort.UPDATED
            }
        }

        `when`("공개 정렬 파서에 어드민 값이 오면") {
            then("공개 계약은 그대로 TRENDING 이어야 한다") {
                GameSort.parse("created") shouldBe GameSort.TRENDING
                GameSort.parse("title") shouldBe GameSort.TRENDING
            }
        }
    }
})
