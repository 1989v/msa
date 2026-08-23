package com.kgd.game.infrastructure.persistence.play.adapter

import com.kgd.game.domain.play.model.ScoreTrack
import com.kgd.game.infrastructure.persistence.play.entity.GameScoreDailyJpaEntity
import com.kgd.game.infrastructure.persistence.play.entity.GameScoreJpaEntity
import com.kgd.game.infrastructure.persistence.play.repository.GameScoreDailyJpaRepository
import com.kgd.game.infrastructure.persistence.play.repository.GameScoreJpaRepository
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import io.mockk.verify
import java.time.LocalDate

/**
 * 오늘 보드 upsert — 제출 한 번이 보드 둘을 올린다.
 *
 * 여기서 지키는 불변식은 하나다: **두 보드의 판정이 서로 독립**이라는 것. 역대 최고를 넘지
 * 못한 런도 오늘 안에서는 최고일 수 있고, 그때 오늘 보드는 갱신되어야 한다.
 * (유니크 키·ONLY_FULL_GROUP_BY 같은 스키마 쪽 확증은 GameSchemaIntegrationSpec 이 맡는다.)
 */
class GameScoreRepositoryAdapterTest : BehaviorSpec({

    val gameId = 7L
    val track = ScoreTrack.BASE
    val today = LocalDate.of(2026, 8, 23)
    val nick = "가나"

    fun allTimeRow(score: Long) =
        GameScoreJpaEntity(gameId = gameId, track = track, nickname = nick, score = score, detail = null)

    fun dailyRow(score: Long) = GameScoreDailyJpaEntity(
        gameId = gameId, track = track, playDate = today, nickname = nick, score = score, detail = null,
    )

    /** relaxed 만으로는 제네릭 save 가 엉뚱한 타입을 돌려줘 캐스팅에서 터진다 — 넣은 걸 그대로 돌려준다 */
    fun repositories(): Pair<GameScoreJpaRepository, GameScoreDailyJpaRepository> {
        val allTime = mockk<GameScoreJpaRepository>(relaxed = true)
        val daily = mockk<GameScoreDailyJpaRepository>(relaxed = true)
        every { allTime.save(any<GameScoreJpaEntity>()) } answers { firstArg() }
        every { allTime.saveAndFlush(any<GameScoreJpaEntity>()) } answers { firstArg() }
        every { daily.save(any<GameScoreDailyJpaEntity>()) } answers { firstArg() }
        every { daily.saveAndFlush(any<GameScoreDailyJpaEntity>()) } answers { firstArg() }
        return allTime to daily
    }

    given("점수를 제출하면") {
        `when`("그 게임에서 처음 올리는 기록이면") {
            then("역대 보드와 오늘 보드에 각각 행이 생긴다") {
                val (allTime, daily) = repositories()
                every { allTime.findByGameIdAndTrackAndNickname(gameId, track, nick) } returns null
                every { daily.findByGameIdAndTrackAndPlayDateAndNickname(gameId, track, today, nick) } returns null
                every { allTime.countByGameIdAndTrackAndScoreGreaterThan(gameId, track, 900) } returns 0

                val (applied, rank) =
                    GameScoreRepositoryAdapter(allTime, daily).submit(gameId, track, nick, 900, null, today)

                applied shouldBe true
                rank shouldBe 1
                val row = slot<GameScoreDailyJpaEntity>()
                verify { daily.save(capture(row)) }
                row.captured.playDate shouldBe today
                row.captured.score shouldBe 900
            }
        }

        `when`("역대 최고에는 못 미치지만 오늘 안에서는 최고이면") {
            then("역대 보드는 그대로 두고 오늘 보드만 올린다 — 여기서 갈라 버리면 오늘의 1위가 빈다") {
                val (allTime, daily) = repositories()
                val best = allTimeRow(5_000)
                val morning = dailyRow(300)
                every { allTime.findByGameIdAndTrackAndNickname(gameId, track, nick) } returns best
                every { daily.findByGameIdAndTrackAndPlayDateAndNickname(gameId, track, today, nick) } returns morning
                every { allTime.countByGameIdAndTrackAndScoreGreaterThan(gameId, track, 5_000) } returns 0

                val (applied, _) =
                    GameScoreRepositoryAdapter(allTime, daily).submit(gameId, track, nick, 900, null, today)

                applied shouldBe false
                best.score shouldBe 5_000
                morning.score shouldBe 900
                verify { daily.saveAndFlush(morning) }
            }
        }

        `when`("오늘 이미 세운 기록보다 낮으면") {
            then("오늘 보드도 그대로다 — 하루 안에서도 닉네임당 최고 하나다") {
                val (allTime, daily) = repositories()
                val morning = dailyRow(1_200)
                every { allTime.findByGameIdAndTrackAndNickname(gameId, track, nick) } returns allTimeRow(5_000)
                every { daily.findByGameIdAndTrackAndPlayDateAndNickname(gameId, track, today, nick) } returns morning
                every { allTime.countByGameIdAndTrackAndScoreGreaterThan(gameId, track, 5_000) } returns 0

                GameScoreRepositoryAdapter(allTime, daily).submit(gameId, track, nick, 900, null, today)

                morning.score shouldBe 1_200
                verify(exactly = 0) { daily.saveAndFlush(any()) }
                verify(exactly = 0) { daily.save(any()) }
            }
        }

        `when`("같은 점수가 두 번 도착하면") {
            then("두 번째는 아무것도 바꾸지 않는다 (멱등)") {
                val (allTime, daily) = repositories()
                val already = dailyRow(900)
                every { allTime.findByGameIdAndTrackAndNickname(gameId, track, nick) } returns allTimeRow(900)
                every { daily.findByGameIdAndTrackAndPlayDateAndNickname(gameId, track, today, nick) } returns already
                every { allTime.countByGameIdAndTrackAndScoreGreaterThan(gameId, track, 900) } returns 0

                val (applied, _) =
                    GameScoreRepositoryAdapter(allTime, daily).submit(gameId, track, nick, 900, null, today)

                applied shouldBe false
                already.score shouldBe 900
                verify(exactly = 0) { daily.saveAndFlush(any()) }
                verify(exactly = 0) { allTime.saveAndFlush(any()) }
            }
        }

        `when`("날짜가 넘어간 뒤 첫 제출이면") {
            then("어제 행을 건드리지 않고 오늘 행을 새로 만든다") {
                val (allTime, daily) = repositories()
                val tomorrow = today.plusDays(1)
                every { allTime.findByGameIdAndTrackAndNickname(gameId, track, nick) } returns allTimeRow(5_000)
                every { daily.findByGameIdAndTrackAndPlayDateAndNickname(gameId, track, tomorrow, nick) } returns null
                every { allTime.countByGameIdAndTrackAndScoreGreaterThan(gameId, track, 5_000) } returns 0

                GameScoreRepositoryAdapter(allTime, daily).submit(gameId, track, nick, 100, null, tomorrow)

                val row = slot<GameScoreDailyJpaEntity>()
                verify { daily.save(capture(row)) }
                row.captured.playDate shouldBe tomorrow
                row.captured.score shouldBe 100
            }
        }
    }

    given("오늘 보드를 읽을 때") {
        `when`("그날 기록이 있으면") {
            then("점수 내림차순으로 순위를 매겨 돌려준다") {
                val allTime = mockk<GameScoreJpaRepository>()
                val daily = mockk<GameScoreDailyJpaRepository>()
                every {
                    daily.findTop50ByGameIdAndTrackAndPlayDateOrderByScoreDescUpdatedAtAsc(gameId, track, today)
                } returns listOf(dailyRow(900), dailyRow(500), dailyRow(100))

                val rows = GameScoreRepositoryAdapter(allTime, daily).topDaily(gameId, track, today, 2)

                rows.map { it.rank } shouldBe listOf(1, 2)
                rows.map { it.score } shouldBe listOf(900L, 500L)
            }
        }

        `when`("아무도 안 논 날이면") {
            then("빈 목록이다 — 오류가 아니라 아직 비어 있는 보드다") {
                val allTime = mockk<GameScoreJpaRepository>()
                val daily = mockk<GameScoreDailyJpaRepository>()
                every {
                    daily.findTop50ByGameIdAndTrackAndPlayDateOrderByScoreDescUpdatedAtAsc(gameId, track, today)
                } returns emptyList()

                GameScoreRepositoryAdapter(allTime, daily).topDaily(gameId, track, today, 10) shouldBe emptyList()
            }
        }
    }
})
