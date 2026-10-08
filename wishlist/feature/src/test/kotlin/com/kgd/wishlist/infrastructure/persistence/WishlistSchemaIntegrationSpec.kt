package com.kgd.wishlist.infrastructure.persistence

import com.kgd.common.persistence.ScopedFlywayMigrator
import com.kgd.wishlist.domain.model.CollectionShare
import com.kgd.wishlist.infrastructure.persistence.adapter.CollectionShareAdapter
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.nulls.shouldBeNull
import io.kotest.matchers.nulls.shouldNotBeNull
import io.kotest.matchers.shouldBe
import org.hibernate.boot.model.naming.PhysicalNamingStrategySnakeCaseImpl
import org.springframework.boot.hibernate.SpringImplicitNamingStrategy
import org.springframework.context.annotation.AnnotationConfigApplicationContext
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.ComponentScan
import org.springframework.context.annotation.Configuration
import org.springframework.dao.DuplicateKeyException
import org.springframework.data.jpa.repository.config.EnableJpaRepositories
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.jdbc.datasource.DriverManagerDataSource
import org.springframework.orm.jpa.JpaTransactionManager
import org.springframework.orm.jpa.LocalContainerEntityManagerFactoryBean
import org.springframework.orm.jpa.vendor.HibernateJpaVendorAdapter
import org.springframework.transaction.support.TransactionTemplate
import java.sql.SQLException
import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset
import java.util.function.Supplier
import javax.sql.DataSource
import org.testcontainers.DockerClientFactory
import org.testcontainers.containers.MySQLContainer
import org.testcontainers.utility.DockerImageName

/**
 * wishlist 전용 마이그레이션(`wishlistdb/migration`)을 실제 MySQL 에 적용하고
 * 공유 링크 테이블의 제약이 걸려 있는지 본다 — 운영은 `ddl-auto=none` 이라
 * 빠진 제약이 어디서도 드러나지 않는다. 판정은 information_schema 와 실제 삽입·삭제 결과다.
 *
 * Docker 부재 시 skip — skip 된 실행은 통과가 아니다.
 */
private val dockerAvailable: Boolean =
    runCatching { DockerClientFactory.instance().isDockerAvailable }.getOrDefault(false)

class WishlistSchemaIntegrationSpec : BehaviorSpec({

    val mysql: MySQLContainer<*> by lazy {
        MySQLContainer(DockerImageName.parse("mysql:8.0.33"))
            .withDatabaseName("wishlist_db")
            .withUsername("root")
            .withPassword("test")
            .also { it.start() }
    }
    val ds: DataSource by lazy {
        DriverManagerDataSource(mysql.jdbcUrl, mysql.username, mysql.password).also {
            // 운영 빈(WishlistDataSourceConfig.wishlistFlyway)과 같은 위치·기준선
            ScopedFlywayMigrator(it, "classpath:wishlistdb/migration", baselineVersion = "1").afterPropertiesSet()
        }
    }
    val jdbc: JdbcTemplate by lazy { JdbcTemplate(ds) }

    // 마이그레이션이 만든 스키마 위에 엔티티를 validate 로 올린다 — 운영(account)이 ddl-auto=validate 다.
    // 매핑이 어긋나면 이 컨텍스트가 뜨지 않는다.
    val jpa: AnnotationConfigApplicationContext by lazy {
        AnnotationConfigApplicationContext().apply {
            registerBean("dataSource", DataSource::class.java, Supplier { ds })
            register(WishlistJpaProbeConfig::class.java)
            refresh()
        }
    }
    val adapter by lazy { jpa.getBean(CollectionShareAdapter::class.java) }
    val tx by lazy { TransactionTemplate(jpa.getBean(JpaTransactionManager::class.java)) }

    fun insertCollection(memberId: Long, name: String): Long {
        jdbc.update(
            "INSERT INTO wishlist_collection (member_id, name, created_at) VALUES (?, ?, NOW(6))",
            memberId, name,
        )
        // DriverManagerDataSource 는 문장마다 새 연결이라 LAST_INSERT_ID() 를 쓸 수 없다 — 고유키로 읽는다
        return jdbc.queryForObject(
            "SELECT id FROM wishlist_collection WHERE member_id = ? AND name = ?",
            Long::class.java, memberId, name,
        )!!
    }

    fun insertItem(memberId: Long, collectionId: Long?, type: String, key: String, createdAt: String) = jdbc.update(
        "INSERT INTO wishlist_items (member_id, collection_id, target_type, target_key, created_at) VALUES (?, ?, ?, ?, ?)",
        memberId, collectionId, type, key, createdAt,
    )

    /** 다른 연결에서 같은 묶음 행을 NOWAIT 로 잠가 본다 — 누가 잡고 있으면 바로 실패한다 */
    fun lockedElsewhere(collectionId: Long): Boolean =
        java.sql.DriverManager.getConnection(mysql.jdbcUrl, mysql.username, mysql.password).use { conn ->
            conn.autoCommit = false
            try {
                conn.prepareStatement("SELECT id FROM wishlist_collection WHERE id = ? FOR UPDATE NOWAIT").use {
                    it.setLong(1, collectionId)
                    it.executeQuery().close()
                }
                false
            } catch (e: SQLException) {
                // 3572 = ER_LOCK_NOWAIT
                if (e.errorCode != 3572) throw e
                true
            } finally {
                conn.rollback()
            }
        }

    fun insertShare(token: String, collectionId: Long, memberId: Long) = jdbc.update(
        "INSERT INTO collection_share (token, collection_id, member_id, created_at) VALUES (?, ?, ?, NOW(6))",
        token, collectionId, memberId,
    )

    Given("V4 까지 적용된 wishlist_db") {
        Then("collection_share 컬럼이 타입·NULL 허용까지 맞다").config(enabledIf = { dockerAvailable }) {
            val columns = jdbc.queryForList(
                """
                SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'collection_share'
                ORDER BY ORDINAL_POSITION
                """.trimIndent(),
            ).map { Triple(it["COLUMN_NAME"], it["COLUMN_TYPE"], it["IS_NULLABLE"]) }

            columns shouldBe listOf(
                Triple("id", "bigint", "NO"),
                Triple("token", "char(10)", "NO"),
                Triple("collection_id", "bigint", "NO"),
                Triple("member_id", "bigint", "NO"),
                Triple("created_at", "datetime(6)", "NO"),
                Triple("expires_at", "datetime(6)", "YES"),
                Triple("revoked_at", "datetime(6)", "YES"),
            )
        }

        Then("token 은 유일 인덱스, member_id 는 인덱스, collection_id 는 CASCADE FK 다")
            .config(enabledIf = { dockerAvailable }) {
                val indexes = jdbc.queryForList(
                    """
                    SELECT COLUMN_NAME, NON_UNIQUE FROM information_schema.STATISTICS
                    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'collection_share' AND SEQ_IN_INDEX = 1
                    """.trimIndent(),
                ).associate { it["COLUMN_NAME"] to (it["NON_UNIQUE"] as Number).toInt() }
                indexes["token"] shouldBe 0
                indexes["member_id"] shouldBe 1

                val deleteRule = jdbc.queryForObject(
                    """
                    SELECT DELETE_RULE FROM information_schema.REFERENTIAL_CONSTRAINTS
                    WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'collection_share'
                      AND REFERENCED_TABLE_NAME = 'wishlist_collection'
                    """.trimIndent(),
                    String::class.java,
                )
                deleteRule shouldBe "CASCADE"
            }

        Then("같은 토큰을 두 번 넣으면 유일 제약에 걸린다").config(enabledIf = { dockerAvailable }) {
            val collectionId = insertCollection(memberId = 1L, name = "제주")
            insertShare("AbCdEf0123", collectionId, 1L)
            shouldThrow<DuplicateKeyException> { insertShare("AbCdEf0123", collectionId, 1L) }
        }

        Then("묶음을 지우면 그 공유 행도 지워진다").config(enabledIf = { dockerAvailable }) {
            val collectionId = insertCollection(memberId = 2L, name = "부산")
            insertShare("ZyXwVu9876", collectionId, 2L)
            jdbc.update("DELETE FROM wishlist_collection WHERE id = ?", collectionId)
            jdbc.queryForObject(
                "SELECT COUNT(*) FROM collection_share WHERE collection_id = ?",
                Int::class.java, collectionId,
            ) shouldBe 0
        }
    }

    Given("마이그레이션 스키마 위의 JPA 어댑터") {
        val clock = Clock.fixed(Instant.parse("2026-10-09T00:00:00Z"), ZoneOffset.UTC)

        Then("엔티티 매핑이 ddl-auto=validate 를 통과한다").config(enabledIf = { dockerAvailable }) {
            jpa.getBean(CollectionShareAdapter::class.java).shouldNotBeNull()
        }

        Then("삽입·토큰 조회·폐기 반영이 왕복한다").config(enabledIf = { dockerAvailable }) {
            val collectionId = insertCollection(memberId = 10L, name = "강릉")
            val saved = tx.execute { adapter.save(CollectionShare.create(collectionId, 10L, 30, clock)) }!!
            val found = adapter.findByToken(saved.token)!!
            found.expiresAt shouldBe Instant.parse("2026-11-08T00:00:00Z")
            adapter.findUnrevokedByCollection(collectionId).map { it.id } shouldBe listOf(saved.id)

            tx.execute { adapter.save(found.also { it.revoke(Instant.parse("2026-10-10T00:00:00Z")) }) }
            adapter.findByToken(saved.token)!!.revokedAt shouldBe Instant.parse("2026-10-10T00:00:00Z")
            adapter.findUnrevokedByCollection(collectionId).shouldBeEmpty()
        }

        Then("공개 항목은 그 묶음의 관광지만, 찜한 시각 내림차순으로 상한까지").config(enabledIf = { dockerAvailable }) {
            val collectionId = insertCollection(memberId = 11L, name = "여수")
            val otherId = insertCollection(memberId = 11L, name = "순천")
            insertItem(11L, collectionId, "ATTRACTION", "a1", "2026-10-01 00:00:01")
            insertItem(11L, collectionId, "ATTRACTION", "a3", "2026-10-01 00:00:03")
            insertItem(11L, collectionId, "ATTRACTION", "a2", "2026-10-01 00:00:02")
            insertItem(11L, collectionId, "PRODUCT", "p9", "2026-10-01 00:00:09")
            insertItem(11L, otherId, "ATTRACTION", "x9", "2026-10-01 00:00:09")

            adapter.findAttractionItems(collectionId, 2).map { it.targetKey } shouldBe listOf("a3", "a2")
        }

        Then("소유 묶음 잠금은 행을 잡고, 남의 묶음이면 null 이다").config(enabledIf = { dockerAvailable }) {
            val collectionId = insertCollection(memberId = 12L, name = "통영")
            tx.execute {
                adapter.lockOwnedCollection(collectionId, 99L).shouldBeNull()
                adapter.lockOwnedCollection(collectionId, 12L).shouldNotBeNull()
                lockedElsewhere(collectionId) shouldBe true
            }
            // 대조군 — 잠금 없는 조회는 행을 잡지 않는다
            tx.execute {
                adapter.findOwnedCollection(collectionId, 12L).shouldNotBeNull()
                lockedElsewhere(collectionId) shouldBe false
            }
        }

        Then("탈퇴 정리는 그 회원의 공유 행만 지운다").config(enabledIf = { dockerAvailable }) {
            val mine = insertCollection(memberId = 13L, name = "목포")
            val theirs = insertCollection(memberId = 14L, name = "군산")
            val gone = tx.execute { adapter.save(CollectionShare.create(mine, 13L, null, clock)) }!!
            val kept = tx.execute { adapter.save(CollectionShare.create(theirs, 14L, null, clock)) }!!

            tx.execute { adapter.deleteAllByMemberId(13L) }

            adapter.findByToken(gone.token).shouldBeNull()
            adapter.findByToken(kept.token).shouldNotBeNull()
        }
    }
})

/** 운영 EMF(WishlistDataSourceConfig)와 같은 스캔 범위·이름 규칙, ddl 만 validate 로 고정 */
@Configuration
@EnableJpaRepositories(basePackages = ["com.kgd.wishlist.infrastructure.persistence.repository"])
@ComponentScan(basePackages = ["com.kgd.wishlist.infrastructure.persistence.adapter"])
class WishlistJpaProbeConfig {
    @Bean
    fun entityManagerFactory(dataSource: DataSource) = LocalContainerEntityManagerFactoryBean().apply {
        setDataSource(dataSource)
        setPackagesToScan("com.kgd.wishlist")
        jpaVendorAdapter = HibernateJpaVendorAdapter()
        setJpaPropertyMap(
            mapOf(
                "hibernate.hbm2ddl.auto" to "validate",
                "hibernate.physical_naming_strategy" to PhysicalNamingStrategySnakeCaseImpl::class.java.name,
                "hibernate.implicit_naming_strategy" to SpringImplicitNamingStrategy::class.java.name,
            ),
        )
    }

    @Bean
    fun transactionManager(emf: jakarta.persistence.EntityManagerFactory) = JpaTransactionManager(emf)
}
