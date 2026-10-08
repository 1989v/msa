package com.kgd.wishlist.infrastructure.persistence

import com.kgd.common.persistence.ScopedFlywayMigrator
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import org.springframework.dao.DuplicateKeyException
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.jdbc.datasource.DriverManagerDataSource
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

    val jdbc: JdbcTemplate by lazy {
        val mysql = MySQLContainer(DockerImageName.parse("mysql:8.0.33"))
            .withDatabaseName("wishlist_db")
            .withUsername("root")
            .withPassword("test")
            .also { it.start() }
        val ds = DriverManagerDataSource(mysql.jdbcUrl, mysql.username, mysql.password)
        // 운영 빈(WishlistDataSourceConfig.wishlistFlyway)과 같은 위치·기준선
        ScopedFlywayMigrator(ds, "classpath:wishlistdb/migration", baselineVersion = "1").afterPropertiesSet()
        JdbcTemplate(ds)
    }

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
})
