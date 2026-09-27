package com.kgd.ads.infrastructure.persistence

import com.kgd.ads.support.AdsTestContainers
import com.kgd.ads.support.DockerAvailable
import io.kotest.core.annotation.EnabledIf
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldContainExactlyInAnyOrder
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import org.flywaydb.core.Flyway
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.jdbc.datasource.DriverManagerDataSource
import java.io.File

/**
 * 광고 형태 마이그레이션(V4) — 운영처럼 V3 까지 적용된 스키마에 운영자가 만든 지면이 있는 상태에서 V4 를 올린다.
 * 판정 근거: V4 뒤의 `ad_placement_format`·`ad_placement`·`ad_campaign` 행, 그리고 `ads/CLAUDE.md` 의 되돌리기 SQL 을
 * **그 파일에서 읽어** 실행한 뒤의 `ad_creative` 행. 사본을 두지 않는다 — 문서의 SQL 이 바뀌면 이 검사가 그것을 잰다.
 *
 * 다른 스펙과 같은 MySQL 컨테이너를 쓰되 별도 스키마(`ads_v4_check`)를 만들어 Flyway 를 처음부터 돌린다.
 */
@EnabledIf(DockerAvailable::class)
class AdsSchemaMigrationIntegrationSpec : BehaviorSpec({

    val db = requireNotNull(AdsTestContainers.mysql)
    val schema = "ads_v4_check"
    val root = JdbcTemplate(DriverManagerDataSource(db.jdbcUrl, db.username, db.password))
    root.execute("DROP DATABASE IF EXISTS $schema")
    root.execute("CREATE DATABASE $schema CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
    val url = db.jdbcUrl.replace("/${db.databaseName}", "/$schema") +
        (if ("?" in db.jdbcUrl) "&" else "?") + "characterEncoding=UTF-8&useUnicode=true"
    val dataSource = DriverManagerDataSource(url, db.username, db.password)
    val jdbc = JdbcTemplate(dataSource)
    fun flyway(target: String?) = Flyway.configure().dataSource(dataSource).locations("classpath:adsdb/migration")
        .apply { target?.let { target(it) } }.load()

    afterSpec { root.execute("DROP DATABASE IF EXISTS $schema") }

    flyway("3").migrate()
    // 운영자가 어드민에서 만든 지면(시드 아님, 비율 둘)
    jdbc.update(
        "INSERT INTO ad_placement (placement_key, host, format, aspect_ratios, floor_micros, active, paid_allowed, description, created_at, updated_at) " +
            "VALUES ('v4-admin-made', 'blog.1989v.com', 'CARD', '1.91:1,1:1', 70000, TRUE, TRUE, '운영자 지면', '2026-09-25 00:00:00', '2026-09-25 00:00:00')",
    )
    flyway(null).migrate()

    fun specs(key: String): List<Triple<String, String, Long>> = jdbc.query(
        "SELECT format, aspect_ratios, floor_micros FROM ad_placement_format WHERE placement_key = ? ORDER BY format",
        { rs, _ -> Triple(rs.getString(1), rs.getString(2), rs.getLong(3)) }, key,
    )

    fun legacy(key: String): List<Any?> = jdbc.queryForMap(
        "SELECT format, aspect_ratios, floor_micros, paid_allowed FROM ad_placement WHERE placement_key = ?", key,
    ).let { listOf(it["format"], it["aspect_ratios"], (it["floor_micros"] as Number).toLong(), it["paid_allowed"]) }

    given("V3 까지 적용된 스키마에 V4 를 올리면") {
        then("V4 가 성공으로 기록된다") {
            jdbc.queryForObject("SELECT success FROM flyway_schema_history WHERE version = '4'", Boolean::class.java) shouldBe true
        }
        then("운영자가 만든 지면은 옛 세 컬럼 값이 그대로 그 형식의 규격이 된다") {
            specs("v4-admin-made") shouldBe listOf(Triple("CARD", "1.91:1,1:1", 70_000L))
        }
        then("블로그 글 끝·관광지 상세 끝은 카드 0.10 에 띠배너 6.4:1 0.05 가 더해지고, 게임 목록 끝은 카드만이다") {
            listOf("blog-post-end", "attraction-end").forEach {
                specs(it) shouldBe listOf(Triple("BANNER", "6.4:1", 50_000L), Triple("CARD", "1.91:1", 100_000L))
            }
            specs("game-hub-end") shouldBe listOf(Triple("CARD", "1.91:1", 100_000L))
        }
        then("게임 목록 위는 띠배너 6.4:1 0.05 하나이고 옛 컬럼도 같은 값 — 유료는 꺼진 채다") {
            specs("game-list-banner") shouldBe listOf(Triple("BANNER", "6.4:1", 50_000L))
            legacy("game-list-banner") shouldBe listOf("BANNER", "6.4:1", 50_000L, false)
        }
        then("다른 지면의 옛 컬럼은 그대로다") {
            legacy("blog-post-end") shouldBe listOf("CARD", "1.91:1", 100_000L, true)
            legacy("v4-admin-made") shouldBe listOf("CARD", "1.91:1,1:1", 70_000L, true)
        }
        then("기존 캠페인(시드 HOUSE)은 형태 기본값 카드를 갖는다") {
            jdbc.queryForList("SELECT DISTINCT creative_format FROM ad_campaign", String::class.java) shouldBe listOf("CARD")
        }
    }

    given("ads/CLAUDE.md 의 되돌리기 SQL") {
        val rollbackSql = rollbackSqlFromClaudeMd()
        val t0 = "2026-09-26 00:00:00"
        jdbc.update("INSERT INTO ad_advertiser (kind, member_id, display_name, status, created_at, updated_at) VALUES ('MEMBER', 99001, '되돌리기 광고주', 'ACTIVE', ?, ?)", t0, t0)
        val advertiserId = jdbc.queryForObject("SELECT id FROM ad_advertiser WHERE member_id = 99001", Long::class.java)!!
        fun campaign(format: String): Long {
            jdbc.update(
                "INSERT INTO ad_campaign (advertiser_id, name, status, bid_type, bid_micros, daily_budget_micros, start_at, frequency_cap_per_day, " +
                    "creative_format, created_at, updated_at) VALUES (?, ?, 'ACTIVE', 'CPM', 100000, 10000000, ?, 3, ?, ?, ?)",
                advertiserId, "되돌리기 $format", t0, format, t0, t0,
            )
            return jdbc.queryForObject("SELECT MAX(id) FROM ad_campaign", Long::class.java)!!
        }
        fun creative(campaignId: Long, title: String, body: String, status: String, rejectReason: String? = null): Long {
            jdbc.update(
                "INSERT INTO ad_creative (campaign_id, advertiser_id, title, body, link_url, image_hash, status, reject_reason, created_at, updated_at) " +
                    "VALUES (?, ?, ?, ?, 'https://example.com/r', ?, ?, ?, ?, ?)",
                campaignId, advertiserId, title, body, "a".repeat(64), status, rejectReason, t0, t0,
            )
            return jdbc.queryForObject("SELECT MAX(id) FROM ad_creative", Long::class.java)!!
        }
        val banner = campaign("BANNER")
        val bannerApproved = creative(banner, "가을 세일 띠배너", "", "APPROVED")
        val bannerRejected = creative(banner, "반려된 띠배너", "", "REJECTED", "MISLEADING")
        val card = campaign("CARD")
        val cardCreative = creative(card, "카드 제목", "카드 설명", "APPROVED")

        fun row(id: Long): List<Any?> = jdbc.queryForMap("SELECT status, title, body, reject_reason FROM ad_creative WHERE id = ?", id)
            .let { listOf(it["status"], it["title"], it["body"], it["reject_reason"]) }
        val houseBefore = jdbc.queryForList("SELECT id, status, title, body FROM ad_creative WHERE advertiser_id <> ?", advertiserId)

        jdbc.update(rollbackSql)

        then("띠배너 캠페인의 소재는 보관되고 설명이 제목으로 채워진다 — 옛 코드가 읽을 수 있는 행이 된다") {
            row(bannerApproved) shouldBe listOf("ARCHIVED", "가을 세일 띠배너", "가을 세일 띠배너", null)
            row(bannerRejected) shouldBe listOf("ARCHIVED", "반려된 띠배너", "반려된 띠배너", null)
            jdbc.queryForList("SELECT body FROM ad_creative", String::class.java).forEach { it.isBlank() shouldBe false }
        }
        then("카드·HOUSE 소재는 그대로다") {
            row(cardCreative) shouldBe listOf("APPROVED", "카드 제목", "카드 설명", null)
            val houseAfter = jdbc.queryForList("SELECT id, status, title, body FROM ad_creative WHERE advertiser_id <> ?", advertiserId)
            houseAfter shouldContainExactlyInAnyOrder houseBefore
            houseAfter.size shouldNotBe 0
        }
    }
})

/**
 * `ads/CLAUDE.md` 에서 `creative_format` 을 쓰는 ```sql 블록 하나를 읽는다. 둘 이상이거나 없으면 실패한다.
 * 테스트 작업 디렉터리(모듈 디렉터리)에서 위로 올라가며 찾는다.
 */
private fun rollbackSqlFromClaudeMd(): String {
    val file = generateSequence(File(System.getProperty("user.dir")).absoluteFile) { it.parentFile }
        .map { File(it, "ads/CLAUDE.md") }
        .firstOrNull { it.isFile }
        ?: error("ads/CLAUDE.md 를 찾지 못했습니다")
    val blocks = Regex("```sql\\n(.*?)```", RegexOption.DOT_MATCHES_ALL).findAll(file.readText())
        .map { it.groupValues[1] }
        .filter { "creative_format" in it }
        .toList()
    check(blocks.size == 1) { "되돌리기 SQL 블록이 하나가 아닙니다: ${blocks.size}" }
    return blocks.single().lines().filterNot { it.trimStart().startsWith("--") }.joinToString("\n").trim().removeSuffix(";")
}
