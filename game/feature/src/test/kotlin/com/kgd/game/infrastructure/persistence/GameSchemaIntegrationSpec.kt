package com.kgd.game.infrastructure.persistence

import com.kgd.game.application.catalog.port.GameSearchCriteria
import com.kgd.game.application.catalog.dto.GameSort
import com.kgd.game.domain.catalog.model.EngineType
import com.kgd.game.domain.catalog.model.GameStatus
import com.kgd.game.domain.catalog.model.Genre
import com.kgd.game.domain.catalog.model.LoadType
import com.kgd.game.domain.catalog.model.Orientation
import com.kgd.game.infrastructure.config.GameDataSourceConfig
import com.kgd.game.infrastructure.persistence.catalog.entity.GameJpaEntity
import com.kgd.game.infrastructure.persistence.catalog.repository.GameJpaRepository
import com.kgd.game.infrastructure.persistence.catalog.repository.GameQueryRepository
import com.kgd.game.infrastructure.persistence.catalog.repository.GameTagMapJpaRepository
import com.kgd.game.domain.play.model.ScoreBoardKey
import com.kgd.game.domain.play.model.ScoreTrack
import com.kgd.game.infrastructure.persistence.play.adapter.GameScoreRepositoryAdapter
import com.kgd.game.infrastructure.persistence.play.entity.GameScoreDailyJpaEntity
import com.kgd.game.infrastructure.persistence.play.entity.GameScoreJpaEntity
import com.kgd.game.infrastructure.persistence.play.repository.GameScoreDailyJpaRepository
import com.kgd.game.infrastructure.persistence.play.repository.GameScoreJpaRepository
import com.kgd.game.domain.suggestion.model.GameSuggestion
import com.kgd.game.domain.suggestion.model.ReplyAuthorType
import com.kgd.game.domain.suggestion.model.SuggestionStatus
import com.kgd.game.infrastructure.persistence.suggestion.adapter.GameSuggestionRepositoryAdapter
import com.kgd.game.infrastructure.persistence.suggestion.adapter.SuggestionReplyRepositoryAdapter
import org.springframework.data.domain.Sort
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.extensions.spring.SpringExtension
import io.kotest.matchers.collections.shouldContain
import io.kotest.matchers.collections.shouldNotContain
import io.kotest.matchers.ints.shouldBeGreaterThan
import io.kotest.matchers.shouldBe
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.boot.autoconfigure.EnableAutoConfiguration
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Import
import org.springframework.context.annotation.Primary
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.data.domain.PageRequest
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.testcontainers.DockerClientFactory
import org.testcontainers.containers.MySQLContainer
import org.testcontainers.utility.DockerImageName
import java.time.LocalDate
import javax.sql.DataSource

/**
 * ADR-0059 — game 슬라이스의 배포 전 스키마/쿼리 검증.
 *
 * 실제 MySQL 컨테이너에서 확증하는 것:
 *  1) 전용 Flyway(`classpath:gamedb/migration`)가 V1 스키마 + V2 시드를 적용한다.
 *  2) `ddl-auto=validate` 로 JPA 엔티티 매핑이 마이그레이션 스키마와 정확히 일치한다.
 *  3) Querydsl 리스트(정렬 3종·태그 필터)와 태그 교집합 유사게임 SQL 이 MySQL 에서 실행된다.
 *
 * Docker 부재 시 skip.
 */
private val dockerAvailable: Boolean =
    runCatching { DockerClientFactory.instance().isDockerAvailable }.getOrDefault(false)

@Suppress("unused")
fun isGameDockerAvailable(): Boolean = dockerAvailable

private const val DRAFT_SLUG = "zz-admin-draft-fixture"

/** 시드는 전부 PUBLISHED 라 상태 무관 조회를 확증하려면 비공개 상태 행을 직접 하나 심어야 한다 */
private fun draftFixture() = GameJpaEntity(
    slug = DRAFT_SLUG,
    title = "어드민 초안 픽스처",
    description = "상태 무관 조회 검증용",
    titleEn = "Admin Draft Fixture",
    descriptionEn = null,
    thumbnailUrl = "/thumbs/draft.png",
    coverUrl = null,
    engineType = EngineType.HTML5,
    loadType = LoadType.IFRAME,
    entryUrl = "/games/$DRAFT_SLUG/index.html",
    orientation = Orientation.BOTH,
    supportsMobile = true,
    developerName = "kgd",
    sdkIntegrated = false,
    status = GameStatus.DRAFT,
    genre = Genre.STRATEGY,
    releasedAt = null,
    contentUpdatedAt = null,
)

private fun publicCriteria(tag: String? = null, sort: GameSort = GameSort.TRENDING) =
    GameSearchCriteria(tag = tag, statuses = setOf(GameStatus.PUBLISHED), sort = sort)

@SpringBootTest(
    classes = [GameSchemaIntegrationSpec.Ctx::class],
    properties = [
        "spring.main.web-application-type=none",
        // 호스트(Boot) Flyway 는 끄고, game 전용 Flyway 만 돌려 분리를 검증
        "spring.flyway.enabled=false",
        "game.flyway.enabled=true",
        "spring.jpa.hibernate.ddl-auto=validate",
    ],
)
@org.junit.jupiter.api.condition.EnabledIf(
    value = "com.kgd.game.infrastructure.persistence.GameSchemaIntegrationSpecKt#isGameDockerAvailable",
    disabledReason = "Docker 미연결 — Testcontainers MySQL 사용 불가",
)
class GameSchemaIntegrationSpec(
    @Autowired private val gameRepository: GameJpaRepository,
    @Autowired private val queryRepository: GameQueryRepository,
    @Autowired private val tagMapRepository: GameTagMapJpaRepository,
    @Autowired private val scoreRepository: GameScoreJpaRepository,
    @Autowired private val dailyScoreRepository: GameScoreDailyJpaRepository,
    @Autowired private val suggestionAdapter: GameSuggestionRepositoryAdapter,
    @Autowired private val replyAdapter: SuggestionReplyRepositoryAdapter,
) : BehaviorSpec({

    val pageable = PageRequest.of(0, 10)

    Given("game 전용 Flyway 가 적용된 game_db") {
        When("마이그레이션이 끝나면") {
            Then("초기 시드(V3 아케이드 2종 + V7 신규 2종)와 태그 매핑이 적재된다")
                .config(enabledIf = { dockerAvailable }) {
                    // 시드는 마이그레이션마다 늘어난다 — 최초 시드 8종을 하한으로 검증
                    (gameRepository.count() >= 8) shouldBe true
                    // V25 에서 태그를 플레이 속성 축으로 정리하고(genre 중복 제거) V27 이 역정규화된
                    // game.tags 를 map 과 다시 맞춘다 — 이 단언이 그 동기화까지 검증한다.
                    gameRepository.findBySlug("snake")?.tags shouldBe listOf("leaderboard")
                    // #23 흡수분은 정적 자산을 iframe 으로 임베드한다
                    gameRepository.findBySlug("snake")?.entryUrl shouldBe "/games/snake/index.html"
                    gameRepository.findBySlug("overworld-quest")?.loadType shouldBe LoadType.IFRAME
                    tagMapRepository.count().toInt() shouldBeGreaterThan 0
                }
        }

        When("정렬별 공개 리스트를 조회하면") {
            Then("공개/어드민 정렬 쿼리가 모두 MySQL 에서 실행된다")
                .config(enabledIf = { dockerAvailable }) {
                    GameSort.entries.forEach { sort ->
                        (queryRepository.search(publicCriteria(sort = sort), pageable).totalElements >= 8) shouldBe true
                    }
                }
        }

        When("태그로 필터링하면") {
            Then("해당 태그를 가진 게임만 반환된다")
                .config(enabledIf = { dockerAvailable }) {
                    // V25 에서 태그를 플레이 속성 축으로 정리 — 'memory' 같은 파편 태그는 제거됐다.
                    queryRepository.search(publicCriteria(tag = "open-world"), pageable)
                        .content.map { it.slug } shouldBe listOf("drift-continent")
                    // 정확 개수 대신 하한 — 시드 팩이 늘 때마다 깨지는 단언을 피한다
                    (queryRepository.search(publicCriteria(tag = "roguelike"), pageable)
                        .totalElements >= 4) shouldBe true
                }
        }

        When("어드민이 상태 무관으로 조회하면") {
            Then("공개 목록에 없는 DRAFT 도 보이고, 공개 목록은 그대로 PUBLISHED 만 남는다")
                .config(enabledIf = { dockerAvailable }) {
                    val draft = gameRepository.save(draftFixture())
                    try {
                        val adminSlugs = queryRepository
                            .search(GameSearchCriteria(sort = GameSort.UPDATED), PageRequest.of(0, 200))
                            .content.map { it.slug }
                        adminSlugs shouldContain DRAFT_SLUG

                        val publicSlugs = queryRepository
                            .search(publicCriteria(sort = GameSort.UPDATED), PageRequest.of(0, 200))
                            .content.map { it.slug }
                        publicSlugs shouldNotContain DRAFT_SLUG
                    } finally {
                        gameRepository.delete(draft)
                    }
                }

            Then("검색어·상태·장르 필터와 페이징·정렬이 각각 동작한다")
                .config(enabledIf = { dockerAvailable }) {
                    val draft = gameRepository.save(draftFixture())
                    try {
                        // 검색어 — 슬러그/제목 부분일치
                        queryRepository.search(GameSearchCriteria(q = "admin-draft"), pageable)
                            .content.map { it.slug } shouldBe listOf(DRAFT_SLUG)
                        queryRepository.search(GameSearchCriteria(q = "픽스처"), pageable)
                            .content.map { it.slug } shouldBe listOf(DRAFT_SLUG)

                        // 상태 필터 — **포함**을 본다. 시드에도 DRAFT 가 있을 수 있으므로
                        // (V60 네온 드리프터가 그렇다) "픽스처 하나뿐" 을 기대하면 시드가 늘 때마다 깨진다.
                        // 여기서 지키려는 것은 "DRAFT 로 거르면 DRAFT 만 나온다" 이다.
                        val drafts = queryRepository
                            .search(GameSearchCriteria(statuses = setOf(GameStatus.DRAFT)), PageRequest.of(0, 200))
                            .content
                        drafts.map { it.slug } shouldContain DRAFT_SLUG
                        drafts.map { it.status }.toSet() shouldBe setOf(GameStatus.DRAFT)

                        // 장르 필터
                        val strategy = queryRepository
                            .search(GameSearchCriteria(genre = Genre.STRATEGY), PageRequest.of(0, 200)).content
                        strategy.map { it.genre }.toSet() shouldBe setOf(Genre.STRATEGY)
                        strategy.map { it.slug } shouldContain DRAFT_SLUG

                        // 페이징 — 같은 정렬에서 1페이지와 2페이지가 겹치지 않는다
                        val first = queryRepository.search(GameSearchCriteria(sort = GameSort.TITLE), PageRequest.of(0, 5))
                        val second = queryRepository.search(GameSearchCriteria(sort = GameSort.TITLE), PageRequest.of(1, 5))
                        first.content.size shouldBe 5
                        first.content.map { it.slug }.intersect(second.content.map { it.slug }.toSet()) shouldBe emptySet()

                        // 정렬 — created/updated 는 내림차순 (제목 정렬은 DB collation 소관이라 실행만 확인)
                        val created = queryRepository
                            .search(GameSearchCriteria(sort = GameSort.CREATED), PageRequest.of(0, 200)).content
                            .map { it.createdAt }
                        created shouldBe created.sortedDescending()
                        val updated = queryRepository
                            .search(GameSearchCriteria(sort = GameSort.UPDATED), PageRequest.of(0, 200)).content
                            .map { it.updatedAt }
                        updated shouldBe updated.sortedDescending()
                    } finally {
                        gameRepository.delete(draft)
                    }
                }
        }

        When("기록이 있는 보드를 집계하면") {
            Then("(게임, 트랙, 보드) 로 묶여 최근 갱신순으로 나온다")
                .config(enabledIf = { dockerAvailable }) {
                    val a = gameRepository.findBySlug("snake")!!.id!!
                    val b = gameRepository.findBySlug("overworld-quest")!!.id!!
                    val rows = listOf(
                        GameScoreJpaEntity(gameId = a, nickname = "가", track = ScoreTrack.BASE, score = 10, detail = null),
                        GameScoreJpaEntity(gameId = a, nickname = "나", track = ScoreTrack.BASE, score = 20, detail = null),
                        GameScoreJpaEntity(gameId = a, nickname = "다", track = ScoreTrack.MODDED, score = 30, detail = null),
                        // 같은 게임·같은 트랙인데 모드가 다르다 — 합쳐지면 안 된다 (V59)
                        GameScoreJpaEntity(
                            gameId = a, nickname = "마", track = ScoreTrack.BASE, board = "rockfall",
                            score = 50, detail = null,
                        ),
                        GameScoreJpaEntity(gameId = b, nickname = "라", track = ScoreTrack.BASE, score = 40, detail = null),
                    ).map { scoreRepository.save(it) }
                    try {
                        // 집계 쿼리는 MySQL 의 ONLY_FULL_GROUP_BY 아래에서도 돌아야 한다
                        val boards = scoreRepository.findActiveBoards(PageRequest.of(0, 10))

                        // 닉네임 5개가 보드 4개로 접힌다 — 같은 (게임, 트랙, 보드) 만 한 줄
                        boards.map { Triple(it.gameId, it.track, it.board) }.toSet() shouldBe setOf(
                            Triple(a, ScoreTrack.BASE, ""),
                            Triple(a, ScoreTrack.MODDED, ""),
                            Triple(a, ScoreTrack.BASE, "rockfall"),
                            Triple(b, ScoreTrack.BASE, ""),
                        )
                        val lastAts = boards.map { it.lastAt }
                        lastAts shouldBe lastAts.sortedDescending()
                    } finally {
                        scoreRepository.deleteAll(rows)
                    }
                }
        }

        When("같은 사람이 하루에 여러 번 기록을 올리면") {
            Then("역대 보드와 무관하게 그날의 최고 하나만 남는다")
                .config(enabledIf = { dockerAvailable }) {
                    val gameId = gameRepository.findBySlug("snake")!!.id!!
                    val day = LocalDate.of(2026, 8, 23)
                    val adapter = GameScoreRepositoryAdapter(scoreRepository, dailyScoreRepository)
                    try {
                        // 역대 최고를 먼저 높게 세워 둔다 — 이후 런은 역대 보드를 건드리지 못한다
                        val base = ScoreBoardKey.DEFAULT
                        adapter.submit(gameId, ScoreTrack.BASE, base, "하루", 5_000, null, day)
                        adapter.submit(gameId, ScoreTrack.BASE, base, "하루", 900, null, day)
                        adapter.submit(gameId, ScoreTrack.BASE, base, "하루", 2_000, null, day)
                        adapter.submit(gameId, ScoreTrack.BASE, base, "이웃", 1_500, null, day)

                        // 유니크 키 (game_id, track, board, play_date, nickname) — 세 번 올려도 한 행
                        val mine = dailyScoreRepository
                            .findByGameIdAndTrackAndBoardAndPlayDateAndNickname(
                                gameId, ScoreTrack.BASE, "", day, "하루",
                            )!!
                        mine.score shouldBe 5_000

                        val board = adapter.topDaily(gameId, ScoreTrack.BASE, base, day, 10)
                        board.map { it.nickname } shouldBe listOf("하루", "이웃")
                        board.map { it.rank } shouldBe listOf(1, 2)

                        // 다른 날은 같은 닉네임이어도 별개 행이다
                        adapter.submit(gameId, ScoreTrack.BASE, base, "하루", 100, null, day.plusDays(1))
                        adapter.topDaily(gameId, ScoreTrack.BASE, base, day.plusDays(1), 10)
                            .map { it.score } shouldBe listOf(100L)
                        adapter.topDaily(gameId, ScoreTrack.BASE, base, day, 10).map { it.score } shouldBe
                            listOf(5_000L, 1_500L)
                    } finally {
                        dailyScoreRepository.deleteAll(
                            dailyScoreRepository.findAll().filter { it.gameId == gameId },
                        )
                        scoreRepository.deleteAll(
                            scoreRepository.findAll().filter { it.gameId == gameId && it.nickname in setOf("하루", "이웃") },
                        )
                    }
                }

            Then("유니크 키가 같은 날 같은 닉네임의 둘째 행을 거부한다")
                .config(enabledIf = { dockerAvailable }) {
                    val gameId = gameRepository.findBySlug("snake")!!.id!!
                    val day = LocalDate.of(2026, 8, 24)
                    val first = dailyScoreRepository.save(
                        GameScoreDailyJpaEntity(
                            gameId = gameId, track = ScoreTrack.BASE, board = "", playDate = day,
                            nickname = "중복", score = 10, detail = null,
                        ),
                    )
                    try {
                        shouldThrow<DataIntegrityViolationException> {
                            dailyScoreRepository.saveAndFlush(
                                GameScoreDailyJpaEntity(
                                    gameId = gameId, track = ScoreTrack.BASE, board = "", playDate = day,
                                    nickname = "중복", score = 20, detail = null,
                                ),
                            )
                        }
                    } finally {
                        dailyScoreRepository.delete(first)
                    }
                }
        }

        When("유사 게임을 조회하면") {
            Then("태그를 공유하는 다른 게임만 반환된다 (자기 자신 제외)")
                .config(enabledIf = { dockerAvailable }) {
                    val target = gameRepository.findBySlug("snake")!!
                    val similar = queryRepository.findSimilar(target.id!!, limit = 8)

                    similar.size shouldBeGreaterThan 0
                    similar.map { it.slug } shouldNotContain "snake"
                }
        }

        When("개선 제안을 저장했다가 본문을 고치면 (V71)") {
            /**
             * 어댑터가 도메인 객체를 그대로 엔티티로 바꿔 저장하면 `created_at` 이 지금으로
             * 덮여 「언제 올라온 제안인가」가 사라진다. 실제 MySQL 로 왕복해야만 드러나는
             * 종류의 버그라 단위 테스트가 아니라 여기서 잡는다.
             */
            Then("접수 시각과 작성자는 그대로 남고 본문·상태만 바뀐다")
                .config(enabledIf = { dockerAvailable }) {
                    val gameId = gameRepository.findBySlug("snake")!!.id!!
                    val saved = suggestionAdapter.save(
                        GameSuggestion.open(gameId, memberId = 4242L, nickname = "활잡이", body = "보스 속도를 낮춰주세요"),
                    )
                    val id = saved.id!!
                    // 저장된 값끼리 비교한다 — MySQL DATETIME 은 초 단위라 메모리 값과는 애초에 다르다
                    val storedCreatedAt = suggestionAdapter.findById(id)!!.createdAt
                    val edited = suggestionAdapter.save(
                        suggestionAdapter.findById(id)!!
                            .editBy(4242L, "3스테이지도 같습니다")
                            .changeStatus(SuggestionStatus.APPLIED),
                    )

                    edited.id shouldBe id
                    edited.createdAt shouldBe storedCreatedAt
                    edited.memberId shouldBe 4242L
                    edited.nickname shouldBe "활잡이"
                    edited.body shouldBe "3스테이지도 같습니다"
                    edited.status shouldBe SuggestionStatus.APPLIED

                    // 답글은 시간순 한 줄기로 돌아온다 — 화면이 정렬을 다시 하지 않는다
                    replyAdapter.save(saved.reply(memberId = 4242L, isOperator = false, body = "2-3 진입 직후요"))
                    replyAdapter.save(saved.reply(memberId = 99L, isOperator = true, body = "1.2 에서 낮췄습니다"))
                    val replies = replyAdapter.findBySuggestionIds(listOf(id))
                    replies.map { it.authorType } shouldBe
                        listOf(ReplyAuthorType.AUTHOR, ReplyAuthorType.OPERATOR)
                    replies.last().authorName shouldBe GameSuggestion.OPERATOR_NAME

                    // 게임을 지정한 조회에 이 제안이 잡힌다
                    val page = suggestionAdapter.search(
                        gameId, SuggestionStatus.APPLIED,
                        // 서비스가 만드는 것과 **같은 정렬**을 쓴다 — 여기서만 다른 정렬을 쓰면
                        // 잘못된 속성명이 운영에서야 터진다
                        PageRequest.of(0, 10, Sort.by(Sort.Direction.DESC, "createdAt", "id")),
                    )
                    page.content.map { it.id } shouldContain id
                    // 수정이 행을 새로 만들지 않았다 — 같은 사람의 제안은 여전히 하나다
                    suggestionAdapter.search(gameId, null, PageRequest.of(0, 50))
                        .content.count { it.memberId == 4242L } shouldBe 1
                }
        }
    }
}) {

    override fun extensions() = listOf(SpringExtension)

    /**
     * game 슬라이스만 좁게 로드. 호스트(code-dictionary:app)가 제공하는 `@Primary` DataSource 를
     * 테스트에서 대신 제공해 Boot 의 EntityManagerFactoryBuilder 를 구성한다.
     */
    @EnableAutoConfiguration
    @Import(
        GameDataSourceConfig::class,
        GameQueryRepository::class,
        // 컴포넌트 스캔이 없는 좁은 슬라이스라 어댑터는 이름으로 들여온다
        GameSuggestionRepositoryAdapter::class,
        SuggestionReplyRepositoryAdapter::class,
    )
    open class Ctx {
        @Bean
        @Primary
        open fun primaryDataSource(@Qualifier("gameDataSource") gameDataSource: DataSource): DataSource =
            gameDataSource
    }

    companion object {
        @JvmStatic
        private val mysql: MySQLContainer<*>? = if (dockerAvailable) {
            MySQLContainer(DockerImageName.parse("mysql:8.0.33"))
                .withDatabaseName("game_db")
                .withUsername("root")
                .withPassword("test")
                .also { it.start() }
        } else {
            null
        }

        @JvmStatic
        @DynamicPropertySource
        fun props(registry: DynamicPropertyRegistry) {
            val container = mysql ?: return
            for (role in listOf("master", "replica")) {
                registry.add("spring.datasource.game.$role.jdbc-url") { container.jdbcUrl }
                registry.add("spring.datasource.game.$role.username") { container.username }
                registry.add("spring.datasource.game.$role.password") { container.password }
                registry.add("spring.datasource.game.$role.driver-class-name") { "com.mysql.cj.jdbc.Driver" }
            }
        }
    }
}
