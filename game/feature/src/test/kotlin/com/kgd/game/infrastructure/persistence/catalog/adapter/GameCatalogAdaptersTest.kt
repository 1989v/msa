package com.kgd.game.infrastructure.persistence.catalog.adapter

import com.kgd.game.application.catalog.port.GameSearchCriteria
import com.kgd.game.application.catalog.dto.GameSort
import com.kgd.game.domain.catalog.model.EngineType
import com.kgd.game.domain.catalog.model.GameStatus
import com.kgd.game.domain.catalog.model.Genre
import com.kgd.game.domain.catalog.model.LoadType
import com.kgd.game.domain.catalog.model.Orientation
import com.kgd.game.infrastructure.persistence.catalog.entity.GameJpaEntity
import com.kgd.game.infrastructure.persistence.catalog.entity.GameStatsJpaEntity
import com.kgd.game.infrastructure.persistence.catalog.repository.GameQueryRepository
import com.kgd.game.infrastructure.persistence.catalog.repository.GameStatsJpaRepository
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldNotContain
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import org.springframework.data.domain.PageImpl
import org.springframework.data.domain.PageRequest
import java.time.LocalDateTime
import java.time.ZoneId

class GameCatalogAdaptersTest : BehaviorSpec({

    val updatedAt = LocalDateTime.of(2026, 8, 1, 9, 30)

    fun entity(slug: String, status: GameStatus, id: Long = 1L) = GameJpaEntity(
        id = id,
        slug = slug,
        title = slug,
        description = "",
        titleEn = "$slug (en)",
        descriptionEn = null,
        thumbnailUrl = "/thumbs/$slug.png",
        coverUrl = null,
        engineType = EngineType.HTML5,
        loadType = LoadType.IFRAME,
        entryUrl = "/games/$slug/index.html",
        orientation = Orientation.BOTH,
        supportsMobile = true,
        developerName = "kgd",
        sdkIntegrated = false,
        status = status,
        genre = Genre.PUZZLE,
        tags = listOf("puzzle"),
        releasedAt = null,
        contentUpdatedAt = null,
        updatedAt = updatedAt,
    )

    given("공개 카탈로그 어댑터가 목록을 조회할 때") {
        `when`("어떤 필터가 오든") {
            then("플레이 가능한 상태(PUBLISHED·BETA) 조건이 강제로 붙어야 한다") {
                val queryRepository = mockk<GameQueryRepository>()
                val adapter = GameRepositoryAdapter(mockk(), queryRepository, mockk())
                val criteria = slot<GameSearchCriteria>()
                every { queryRepository.search(capture(criteria), any()) } returns
                    PageImpl(listOf(entity("live-game", GameStatus.PUBLISHED)))

                adapter.search(tag = "puzzle", genre = Genre.PUZZLE, sort = GameSort.NEW, pageable = PageRequest.of(0, 24))

                criteria.captured.statuses shouldBe setOf(GameStatus.PUBLISHED, GameStatus.BETA)
                // DRAFT/REVIEW/SUSPENDED 는 어떤 필터로도 새어 들어오면 안 된다
                criteria.captured.statuses shouldNotContain GameStatus.DRAFT
                criteria.captured.statuses shouldNotContain GameStatus.SUSPENDED
                // 공개 경로는 검색어를 노출하지 않는다 — 조건이 새어 들어가면 안 된다
                criteria.captured.q shouldBe null
                criteria.captured.tag shouldBe "puzzle"
                criteria.captured.sort shouldBe GameSort.NEW
            }
        }
    }

    given("어드민 조회 어댑터가 목록을 조회할 때") {
        `when`("상태 무관 조건이 주어지면") {
            then("조건을 그대로 넘기고 통계를 붙여 읽기 모델로 매핑한다") {
                val queryRepository = mockk<GameQueryRepository>()
                val statsRepository = mockk<GameStatsJpaRepository>()
                val adapter = GameAdminQueryAdapter(queryRepository, statsRepository)
                val criteria = slot<GameSearchCriteria>()
                every { queryRepository.search(capture(criteria), any()) } returns PageImpl(
                    listOf(entity("draft-game", GameStatus.DRAFT, id = 3L))
                )
                every { statsRepository.findAllById(listOf(3L)) } returns listOf(
                    GameStatsJpaEntity(gameId = 3L, playCount = 42, ratingSum = 27, ratingCount = 3, weeklyPlayCount = 5)
                )

                val page = adapter.search(GameSearchCriteria(q = "draft"), PageRequest.of(0, 20))

                criteria.captured.statuses shouldBe emptySet()
                criteria.captured.q shouldBe "draft"
                val summary = page.content.single()
                summary.slug shouldBe "draft-game"
                summary.titleEn shouldBe "draft-game (en)"
                summary.status shouldBe GameStatus.DRAFT
                summary.playCount shouldBe 42
                summary.ratingAvg shouldBe 9.0
                summary.updatedAt shouldBe updatedAt.atZone(ZoneId.systemDefault()).toInstant()
            }
        }

        `when`("통계 row 가 아직 없으면") {
            then("0 으로 채워 반환한다") {
                val queryRepository = mockk<GameQueryRepository>()
                val statsRepository = mockk<GameStatsJpaRepository>()
                val adapter = GameAdminQueryAdapter(queryRepository, statsRepository)
                every { queryRepository.search(any(), any()) } returns
                    PageImpl(listOf(entity("new-game", GameStatus.REVIEW, id = 9L)))
                every { statsRepository.findAllById(listOf(9L)) } returns emptyList()

                val summary = adapter.search(GameSearchCriteria(), PageRequest.of(0, 20)).content.single()

                summary.playCount shouldBe 0
                summary.ratingAvg shouldBe 0.0
                summary.ratingCount shouldBe 0
            }
        }
    }
})
