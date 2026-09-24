package com.kgd.blog.infrastructure.persistence

import com.kgd.blog.domain.model.BlogPost
import com.kgd.blog.domain.model.PostStatus
import com.kgd.blog.infrastructure.config.BlogDataSourceConfig
import com.kgd.blog.infrastructure.persistence.adapter.BlogPostConceptRepositoryAdapter
import com.kgd.blog.infrastructure.persistence.entity.BlogPostJpaEntity
import com.kgd.blog.infrastructure.persistence.repository.BlogPostConceptJpaRepository
import com.kgd.blog.infrastructure.persistence.repository.BlogCategoryJpaRepository
import com.kgd.blog.infrastructure.persistence.repository.BlogCommentJpaRepository
import com.kgd.blog.infrastructure.persistence.repository.BlogPostJpaRepository
import com.kgd.blog.infrastructure.persistence.repository.BlogPostLikeJpaRepository
import com.kgd.blog.infrastructure.persistence.repository.BlogPostRatingJpaRepository
import com.kgd.blog.infrastructure.persistence.repository.BlogPostViewJpaRepository
import com.kgd.blog.infrastructure.persistence.repository.BlogProfileJpaRepository
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.extensions.spring.SpringExtension
import io.kotest.matchers.shouldBe
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.boot.autoconfigure.EnableAutoConfiguration
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Import
import org.springframework.context.annotation.Primary
import org.springframework.data.domain.PageRequest
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.support.TransactionTemplate
import java.time.LocalDateTime
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.testcontainers.DockerClientFactory
import org.testcontainers.containers.MySQLContainer
import org.testcontainers.utility.DockerImageName
import javax.sql.DataSource

/**
 * ADR-0093 ③ — blog 전용 스키마(`blog_db`)와 JPA 엔티티가 일치하는지.
 *
 * **운영은 `ddl-auto=none` 이라 불일치가 거기서는 절대 안 드러난다.** 실제로 이 도메인을
 * 접으면서 `blog_post_rating.score` 가 TINYINT 인데 엔티티는 `Int` 인 것이 처음 발견됐다 —
 * 스키마를 옮기기 전까지 몇 달 동안 아무도 몰랐다. 여기가 그것을 잡는 자리다.
 *
 * 컨텍스트가 뜬다 = Flyway 가 `blogdb/migration` 을 적용했고 `validate` 가 통과했다는 뜻이다.
 * Docker 부재 시 skip.
 */
private val dockerAvailable: Boolean =
    runCatching { DockerClientFactory.instance().isDockerAvailable }.getOrDefault(false)

@Suppress("unused")
fun isBlogDockerAvailable(): Boolean = dockerAvailable

@SpringBootTest(
    classes = [BlogSchemaIntegrationSpec.Ctx::class],
    properties = [
        "spring.main.web-application-type=none",
        "spring.flyway.enabled=false",
        "blog.flyway.enabled=true",
        "spring.jpa.hibernate.ddl-auto=validate",
    ],
)
@org.junit.jupiter.api.condition.EnabledIf(
    value = "com.kgd.blog.infrastructure.persistence.BlogSchemaIntegrationSpecKt#isBlogDockerAvailable",
    disabledReason = "Docker 미연결 — Testcontainers MySQL 사용 불가",
)
class BlogSchemaIntegrationSpec(
    @Autowired private val profiles: BlogProfileJpaRepository,
    @Autowired private val categories: BlogCategoryJpaRepository,
    @Autowired private val posts: BlogPostJpaRepository,
    @Autowired private val views: BlogPostViewJpaRepository,
    @Autowired private val likes: BlogPostLikeJpaRepository,
    @Autowired private val ratings: BlogPostRatingJpaRepository,
    @Autowired private val comments: BlogCommentJpaRepository,
    @Autowired private val concepts: BlogPostConceptJpaRepository,
    @Autowired @Qualifier("blogTransactionManager") private val txManager: PlatformTransactionManager,
) : BehaviorSpec({

    Given("blog 전용 Flyway 가 적용된 blog_db") {
        Then("일곱 테이블의 엔티티 매핑이 마이그레이션 스키마와 일치하고 쿼리가 실행된다")
            .config(enabledIf = { dockerAvailable }) {
                // count() 는 각 엔티티에 대해 실제 SQL 을 MySQL 로 보낸다 — 컬럼 타입이 어긋나면
                // validate 단계에서 컨텍스트가 아예 안 뜨고, 뜬 뒤에도 매핑이 틀리면 여기서 터진다.
                listOf(profiles, categories, posts, views, likes, ratings, comments)
                    .map { it.count() } shouldBe List(7) { 0L }
            }
    }

    Given("글 ↔ 개념 매핑") {
        Then("교체는 같은 키를 다시 넣어도 부딪치지 않고, 개념 필터는 발행글만 발행일 순으로 낸다")
            .config(enabledIf = { dockerAvailable }) {
                val tx = TransactionTemplate(txManager)
                val adapter = BlogPostConceptRepositoryAdapter(concepts)
                fun post(slug: String, status: PostStatus, at: LocalDateTime?) = posts.save(
                    BlogPostJpaEntity.fromDomain(
                        BlogPost(
                            id = null, authorProfileId = 1, categoryId = 1, slug = slug, title = slug,
                            summary = null, body = "본문", coverImageUrl = null, status = status, publishedAt = at,
                        ),
                    ),
                ).id!!
                val older = post("concept-older", PostStatus.PUBLISHED, LocalDateTime.of(2026, 9, 1, 0, 0))
                val newer = post("concept-newer", PostStatus.PUBLISHED, LocalDateTime.of(2026, 9, 20, 0, 0))
                val draft = post("concept-draft", PostStatus.DRAFT, null)

                tx.executeWithoutResult {
                    adapter.replace(older, listOf("bm25", "inverted-index"))
                    adapter.replace(newer, listOf("bm25"))
                    adapter.replace(draft, listOf("bm25"))
                }
                // 같은 키(bm25)를 남긴 채 순서를 바꿔 다시 교체
                tx.executeWithoutResult { adapter.replace(older, listOf("inverted-index", "bm25")) }

                adapter.findConceptIds(older) shouldBe listOf("inverted-index", "bm25")
                posts.findPublishedByConcept("bm25", PageRequest.of(0, 10)).content.map { it.slug } shouldBe
                    listOf("concept-newer", "concept-older")
                posts.findPublishedByConcept("bm25", PageRequest.of(0, 10)).totalElements shouldBe 2L
                posts.findPublishedByConcept("nothing", PageRequest.of(0, 10)).totalElements shouldBe 0L
                // 초안에도 bm25 가 걸려 있지만 세지 않는다
                adapter.countPublishedByConcept() shouldBe mapOf("bm25" to 2L, "inverted-index" to 1L)

                tx.executeWithoutResult { adapter.deleteByPostId(older) }
                adapter.findConceptIds(older) shouldBe emptyList()
            }
    }
}) {

    override fun extensions() = listOf(SpringExtension)

    @EnableAutoConfiguration
    @Import(BlogDataSourceConfig::class)
    open class Ctx {
        @Bean
        @Primary
        open fun primaryDataSource(@Qualifier("blogDataSource") blogDataSource: DataSource): DataSource =
            blogDataSource
    }

    companion object {
        @JvmStatic
        private val mysql: MySQLContainer<*>? = if (dockerAvailable) {
            MySQLContainer(DockerImageName.parse("mysql:8.0.33"))
                .withDatabaseName("blog_db")
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
            registry.add("spring.datasource.blog.url") { container.jdbcUrl }
            registry.add("spring.datasource.blog.username") { container.username }
            registry.add("spring.datasource.blog.password") { container.password }
            registry.add("spring.datasource.blog.driver-class-name") { "com.mysql.cj.jdbc.Driver" }
        }
    }
}
