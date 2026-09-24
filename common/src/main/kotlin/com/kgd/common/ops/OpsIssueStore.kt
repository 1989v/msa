package com.kgd.common.ops

import com.kgd.common.ops.usecase.OpsIssuePageView
import com.kgd.common.ops.usecase.OpsIssueView
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.jdbc.core.RowMapper
import org.springframework.jdbc.support.GeneratedKeyHolder
import java.sql.Statement
import java.sql.Timestamp
import java.time.Clock
import javax.sql.DataSource

/**
 * 한 도메인 스키마의 `ops_issue` 테이블. 상태는 OPEN → RETRIED(여러 번) → CLOSED, CLOSED 는 종착.
 *
 * JDBC 로 둔다 — 도메인마다 EMF 가 따로라 공통 엔티티를 쓰면 EMF 여덟 곳의 스캔 목록을 고쳐야 한다.
 * [dataSource] 는 도메인 EMF 의 DataSource 를 넘긴다 — 도메인 트랜잭션 안에서 부르면 같은 커밋에 묶인다.
 */
class OpsIssueStore(
    dataSource: DataSource,
    private val clock: Clock = Clock.systemUTC(),
) {
    private val jdbc = JdbcTemplate(dataSource)

    fun open(type: String, targetId: String, detail: String, payload: String? = null): Long {
        val now = Timestamp.from(clock.instant())
        val keys = GeneratedKeyHolder()
        jdbc.update({ conn ->
            conn.prepareStatement(
                "INSERT INTO ops_issue (type, target_id, detail, payload, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                Statement.RETURN_GENERATED_KEYS,
            ).apply {
                setString(1, type)
                setString(2, targetId.take(TARGET_MAX))
                setString(3, detail.take(DETAIL_MAX))
                setString(4, payload)
                setString(5, OPEN)
                setTimestamp(6, now)
                setTimestamp(7, now)
            }
        }, keys)
        return requireNotNull(keys.key).toLong()
    }

    /** 같은 종류·대상의 OPEN 이슈가 있는가 — 반복 감지가 이슈를 쌓지 않게 */
    fun hasOpen(type: String, targetId: String): Boolean =
        (jdbc.queryForObject(
            "SELECT COUNT(*) FROM ops_issue WHERE type = ? AND target_id = ? AND status = ?",
            Long::class.java, type, targetId.take(TARGET_MAX), OPEN,
        ) ?: 0L) > 0

    /** 상태와 무관하게 같은 종류·대상이 있는가 — 같은 DLT 레코드가 다시 와도 한 건만 */
    fun exists(type: String, targetId: String): Boolean =
        (jdbc.queryForObject(
            "SELECT COUNT(*) FROM ops_issue WHERE type = ? AND target_id = ?", Long::class.java, type, targetId.take(TARGET_MAX),
        ) ?: 0L) > 0

    fun find(id: Long): OpsIssueView? =
        jdbc.query("SELECT $COLUMNS FROM ops_issue WHERE id = ?", MAPPER, id).firstOrNull()

    fun payload(id: Long): String? =
        jdbc.query("SELECT payload FROM ops_issue WHERE id = ?", { rs, _ -> rs.getString(1) }, id).firstOrNull()

    fun page(status: String?, type: String?, page: Int, size: Int): OpsIssuePageView {
        val where = buildList {
            if (status != null) add("status = ?" to status)
            if (type != null) add("type = ?" to type)
        }
        val clause = if (where.isEmpty()) "" else "WHERE " + where.joinToString(" AND ") { it.first }
        val args = where.map { it.second }
        val total = jdbc.queryForObject("SELECT COUNT(*) FROM ops_issue $clause", Long::class.java, *args.toTypedArray()) ?: 0L
        val items = jdbc.query(
            "SELECT $COLUMNS FROM ops_issue $clause ORDER BY id DESC LIMIT ? OFFSET ?",
            MAPPER, *(args + listOf(size, page.toLong() * size)).toTypedArray(),
        )
        return OpsIssuePageView(items, total)
    }

    /** CLOSED 가 아니면 RETRIED 로. 바뀌었으면 true */
    fun markRetried(id: Long, actorId: String, reason: String?): Boolean =
        jdbc.update(
            "UPDATE ops_issue SET status = ?, actor_id = ?, reason = ?, updated_at = ? WHERE id = ? AND status <> ?",
            RETRIED, actorId.take(ACTOR_MAX), reason?.take(REASON_MAX), Timestamp.from(clock.instant()), id, CLOSED,
        ) == 1

    /** CLOSED 가 아니면 CLOSED 로. 바뀌었으면 true */
    fun close(id: Long, actorId: String, reason: String): Boolean =
        jdbc.update(
            "UPDATE ops_issue SET status = ?, actor_id = ?, reason = ?, updated_at = ? WHERE id = ? AND status <> ?",
            CLOSED, actorId.take(ACTOR_MAX), reason.take(REASON_MAX), Timestamp.from(clock.instant()), id, CLOSED,
        ) == 1

    companion object {
        const val OPEN = "OPEN"
        const val RETRIED = "RETRIED"
        const val CLOSED = "CLOSED"

        private const val TARGET_MAX = 100
        private const val DETAIL_MAX = 1000
        private const val ACTOR_MAX = 64
        private const val REASON_MAX = 500

        private const val COLUMNS = "id, type, target_id, detail, business_date, status, actor_id, reason, created_at, updated_at"

        private val MAPPER = RowMapper { rs, _ ->
            OpsIssueView(
                id = rs.getLong("id"),
                type = rs.getString("type"),
                targetId = rs.getString("target_id"),
                detail = rs.getString("detail"),
                businessDate = rs.getDate("business_date")?.toLocalDate()?.toString(),
                status = rs.getString("status"),
                actorId = rs.getString("actor_id"),
                reason = rs.getString("reason"),
                createdAt = rs.getTimestamp("created_at").toInstant().toString(),
                updatedAt = rs.getTimestamp("updated_at").toInstant().toString(),
            )
        }
    }
}
