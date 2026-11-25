package com.kgd.blog.infrastructure.persistence.adapter

import com.kgd.blog.application.prompt.dto.*
import com.kgd.blog.application.prompt.port.PeerPromptRepositoryPort
import com.kgd.blog.domain.model.PeerPromptContent
import com.kgd.blog.domain.model.PeerReviewContent
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate
import org.springframework.jdbc.support.GeneratedKeyHolder
import org.springframework.stereotype.Repository
import java.sql.ResultSet
import javax.sql.DataSource

/** Uses the blog datasource and participates in blogTransactionManager; never the host primary. */
@Repository
class PeerPromptRepositoryAdapter(@Qualifier("blogDataSource") dataSource: DataSource) : PeerPromptRepositoryPort {
    private val jdbc = NamedParameterJdbcTemplate(dataSource)

    override fun list(domain: String?, page: Int, size: Int, memberId: Long?, tag: String?): List<PeerPromptSummary> = jdbc.query(
        "$summarySql WHERE p.removed = FALSE AND (:domain IS NULL OR p.domain = :domain) " +
            "AND (:tag IS NULL OR EXISTS(SELECT 1 FROM peer_prompt_tag t WHERE t.prompt_id=p.id AND t.tag=:tag)) " +
            "ORDER BY (COALESCE(r.review_count,0) >= 3) DESC, " +
            "CASE WHEN r.review_count >= 3 THEN r.average_score ELSE NULL END DESC, " +
            "CASE WHEN r.review_count >= 3 THEN r.review_count ELSE NULL END DESC, p.id DESC LIMIT :limit OFFSET :offset",
        mapOf("domain" to domain, "tag" to tag, "member" to memberId, "limit" to size + 1, "offset" to page * size),
    ) { rs, _ -> summary(rs, memberId) }

    override fun find(id: Long, lock: Boolean): PeerPromptRecord? = jdbc.query(
        "SELECT p.*, $tagSql AS tags FROM peer_prompt p WHERE id=:id" + if (lock) " FOR UPDATE" else "",
        mapOf("id" to id),
    ) { rs, _ -> PeerPromptRecord(rs.getLong("id"), rs.getLong("author_profile_id"), content(rs), rs.getBoolean("removed")) }
        .firstOrNull()

    override fun detail(id: Long, memberId: Long?): PeerPromptDetail? {
        val record = find(id, false)?.takeUnless { it.removed } ?: return null
        val summary = jdbc.query(
            "$summarySql WHERE p.id=:id AND p.removed=FALSE",
            mapOf("id" to id, "member" to memberId),
        ) { rs, _ -> summary(rs, memberId) }.firstOrNull() ?: return null
        val reviews = jdbc.query(
            """SELECT r.*, a.display_name, a.member_id FROM peer_prompt_review r
               JOIN blog_profile a ON a.id=r.profile_id WHERE r.prompt_id=:id ORDER BY r.id DESC LIMIT 100""",
            mapOf("id" to id),
        ) { rs, _ -> reviewResponse(rs, memberId) }
        val myReview = memberId?.let {
            jdbc.query(
                "SELECT r.*, a.display_name, a.member_id FROM peer_prompt_review r JOIN blog_profile a ON a.id=r.profile_id WHERE r.prompt_id=:id AND a.member_id=:member",
                mapOf("id" to id, "member" to memberId),
            ) { rs, _ -> reviewResponse(rs, memberId) }.firstOrNull()
        }
        return PeerPromptDetail(summary, record.content, reviews, myReview)
    }

    override fun create(authorProfileId: Long, content: PeerPromptContent): Long {
        val key = GeneratedKeyHolder()
        jdbc.update(
            """INSERT INTO peer_prompt(author_profile_id,domain,title,purpose,model_context,prompt_text)
               VALUES(:author,:domain,:title,:purpose,:model,:prompt)""",
            MapSqlParameterSource(mapOf("author" to authorProfileId, "domain" to content.domain, "title" to content.title,
                "purpose" to content.purpose, "model" to content.modelContext, "prompt" to content.promptText)), key,
        )
        val id = requireNotNull(key.key).toLong()
        content.tags.forEach { tag ->
            jdbc.update("INSERT INTO peer_prompt_tag(prompt_id,tag) VALUES(:id,:tag)", mapOf("id" to id, "tag" to tag))
        }
        return id
    }

    // All review mutations hold the prompt row lock. The unique key also protects against other writers.
    // PUT replaces this member's single review, including its evidence, instead of adding another vote.
    override fun review(promptId: Long, profileId: Long, content: PeerReviewContent) {
        jdbc.update(
            """INSERT INTO peer_prompt_review(prompt_id,profile_id,reviewer_domain,reviewer_role,score,worked,limitations,context)
               VALUES(:prompt,:profile,:domain,:role,:score,:worked,:limits,:context)
               ON DUPLICATE KEY UPDATE reviewer_domain=:domain, reviewer_role=:role, score=:score,
               worked=:worked, limitations=:limits, context=:context""",
            mapOf("prompt" to promptId, "profile" to profileId, "domain" to content.reviewerDomain,
                "role" to content.reviewerRole, "score" to content.score, "worked" to content.worked,
                "limits" to content.limitations, "context" to content.context),
        )
    }

    override fun reviewOwner(promptId: Long, reviewId: Long): Long? = jdbc.query(
        "SELECT profile_id FROM peer_prompt_review WHERE prompt_id=:prompt AND id=:id",
        mapOf("prompt" to promptId, "id" to reviewId),
    ) { rs, _ -> rs.getLong("profile_id") }.firstOrNull()

    override fun removeReview(promptId: Long, reviewId: Long) {
        jdbc.update("DELETE FROM peer_prompt_review WHERE prompt_id=:prompt AND id=:id", mapOf("prompt" to promptId, "id" to reviewId))
    }

    override fun remove(id: Long) {
        jdbc.update("UPDATE peer_prompt SET removed=TRUE WHERE id=:id", mapOf("id" to id))
    }

    private fun content(rs: ResultSet) = PeerPromptContent(rs.getString("domain"), rs.getString("title"),
        rs.getString("purpose"), rs.getString("model_context"), rs.getString("prompt_text"), tags(rs))

    private fun tags(rs: ResultSet): List<String> = rs.getString("tags").orEmpty().split(',').filter { it.isNotEmpty() }

    private fun reviewResponse(rs: ResultSet, memberId: Long?) = PeerReviewResponse(
        rs.getLong("id"), rs.getString("display_name"),
        PeerReviewContent(rs.getString("reviewer_domain"), rs.getString("reviewer_role"), rs.getInt("score"),
            rs.getString("worked"), rs.getString("limitations"), rs.getString("context")),
        rs.getTimestamp("created_at").toLocalDateTime(), memberId != null && rs.getLong("member_id") == memberId,
    )

    private fun summary(rs: ResultSet, memberId: Long?) = PeerPromptSummary(
        rs.getLong("id"), rs.getString("domain"), rs.getString("title"), rs.getString("purpose"),
        rs.getString("display_name"), rs.getTimestamp("created_at").toLocalDateTime(), rs.getLong("review_count"),
        rs.getObject("average_score")?.let { (it as Number).toDouble() },
        memberId != null && rs.getLong("member_id") == memberId,
        tags(rs),
    )

    private val tagSql = "(SELECT GROUP_CONCAT(t.tag ORDER BY t.tag SEPARATOR ',') FROM peer_prompt_tag t WHERE t.prompt_id=p.id)"
    private val summarySql = """SELECT p.*, a.display_name, a.member_id,
        $tagSql AS tags, COALESCE(r.review_count,0) AS review_count, r.average_score FROM peer_prompt p
        JOIN blog_profile a ON a.id=p.author_profile_id
        LEFT JOIN (SELECT prompt_id, COUNT(*) AS review_count, AVG(score) AS average_score
            FROM peer_prompt_review GROUP BY prompt_id) r ON r.prompt_id=p.id"""
}
