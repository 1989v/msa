package com.kgd.ads.support

import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.jdbc.support.GeneratedKeyHolder
import java.security.MessageDigest
import java.sql.Statement
import java.time.LocalDateTime
import java.util.UUID

/**
 * ads_db 에 테스트 행을 넣는다. 캠페인·소재 쓰기 유스케이스가 아직 없는 곳은 SQL 로 직접 넣는다 —
 * 결정이 읽는 것은 인덱스 갱신이 DB 에서 읽은 값뿐이라 넣는 경로와 무관하다.
 * 시나리오마다 지면 키를 따로 두어 다른 시나리오의 캠페인과 경매에서 섞이지 않게 한다.
 */
class AdsFixtures(private val jdbc: JdbcTemplate) {

    fun placement(key: String, floorMicros: Long = 100_000, paidAllowed: Boolean = true, host: String = BLOG_HOST, ratios: String = "1.91:1") {
        jdbc.update(
            "INSERT INTO ad_placement (placement_key, host, format, aspect_ratios, floor_micros, active, paid_allowed, description, created_at, updated_at) " +
                "VALUES (?, ?, 'CARD', ?, ?, TRUE, ?, '테스트 지면', ?, ?)",
            key, host, ratios, floorMicros, paidAllowed, T0, T0,
        )
    }

    /**
     * 회원 광고주 + 지갑. @return 광고주 id
     *
     * 통합 스펙들은 컨테이너 DB 하나를 같이 쓰고 회원 id 는 유일 키다. 스펙마다 대역을 나눠 쓴다 —
     * 결정 5xxx · 후보 인덱스 6xxx · 클릭 7xxx · 에셋 8xxx · 이벤트 수락 9xxx.
     */
    fun memberAdvertiser(memberId: Long, balanceMicros: Long = 100_000_000, name: String = "광고주$memberId"): Long {
        val id = insert(
            "INSERT INTO ad_advertiser (kind, member_id, display_name, status, created_at, updated_at) VALUES ('MEMBER', ?, ?, 'ACTIVE', ?, ?)",
            memberId, name, T0, T0,
        )
        jdbc.update(
            "INSERT INTO ad_ledger_account (type, advertiser_id, balance_micros, version, created_at, updated_at) VALUES ('ADVERTISER_WALLET', ?, ?, 0, ?, ?)",
            id, balanceMicros, T0, T0,
        )
        return id
    }

    fun suspend(advertiserId: Long) {
        jdbc.update("UPDATE ad_advertiser SET status = 'SUSPENDED', suspend_reason = '테스트', suspended_at = ? WHERE id = ?", T0, advertiserId)
    }

    fun settledThrough(advertiserId: Long, hour: LocalDateTime) {
        jdbc.update(
            "INSERT INTO ad_advertiser_settled_through (advertiser_id, settled_through_hour_kst, updated_at) VALUES (?, ?, ?) " +
                "ON DUPLICATE KEY UPDATE settled_through_hour_kst = VALUES(settled_through_hour_kst)",
            advertiserId, hour, T0,
        )
    }

    /** ACTIVE 유료 캠페인. @return 캠페인 id */
    fun paidCampaign(
        advertiserId: Long,
        placementKeys: List<String>,
        bidType: String = "CPM",
        bidMicros: Long = 200_000,
        dailyBudgetMicros: Long = 10_000_000,
        totalBudgetMicros: Long? = null,
        frequencyCap: Int = 3,
        categories: Set<String> = emptySet(),
    ): Long {
        val id = insert(
            "INSERT INTO ad_campaign (advertiser_id, name, status, bid_type, bid_micros, daily_budget_micros, total_budget_micros, " +
                "start_at, end_at, frequency_cap_per_day, created_at, updated_at) VALUES (?, '테스트 캠페인', 'ACTIVE', ?, ?, ?, ?, ?, NULL, ?, ?, ?)",
            advertiserId, bidType, bidMicros, dailyBudgetMicros, totalBudgetMicros, CAMPAIGN_START, frequencyCap, T0, T0,
        )
        placementKeys.forEach { jdbc.update("INSERT INTO ad_campaign_placement (campaign_id, placement_key) VALUES (?, ?)", id, it) }
        categories.forEach { jdbc.update("INSERT INTO ad_campaign_category (campaign_id, category_code) VALUES (?, ?)", id, it) }
        return id
    }

    /** 유료 소재 + 이미지 메타. @return 소재 id */
    fun paidCreative(campaignId: Long, advertiserId: Long, status: String = "APPROVED", width: Int = 1200, height: Int = 628): Long {
        val hash = MessageDigest.getInstance("SHA-256").digest(UUID.randomUUID().toString().toByteArray())
            .joinToString("") { "%02x".format(it) }
        jdbc.update(
            "INSERT INTO ad_creative_asset (hash, content_type, bytes, byte_size, width, height, created_at) VALUES (?, 'image/png', ?, 4, ?, ?, ?)",
            hash, byteArrayOf(1, 2, 3, 4), width, height, T0,
        )
        return insert(
            "INSERT INTO ad_creative (campaign_id, advertiser_id, title, body, link_url, emoji, image_hash, status, reject_reason, " +
                "reviewed_by, reviewed_at, created_at, updated_at) VALUES (?, ?, '가을 세일', '지금 바로 확인하세요', 'https://example.com/landing', NULL, ?, ?, NULL, NULL, NULL, ?, ?)",
            campaignId, advertiserId, hash, status, T0, T0,
        )
    }

    fun approve(creativeId: Long) {
        jdbc.update("UPDATE ad_creative SET status = 'APPROVED', reviewed_by = 1, reviewed_at = ? WHERE id = ?", T0, creativeId)
    }

    fun reject(creativeId: Long) {
        jdbc.update("UPDATE ad_creative SET status = 'REJECTED', reject_reason = 'MISLEADING', reviewed_by = 1, reviewed_at = ? WHERE id = ?", T0, creativeId)
    }

    fun contextMapping(contextKey: String, categoryCode: String) {
        jdbc.update("INSERT INTO ad_context_mapping (context_key, category_code, updated_by, updated_at) VALUES (?, ?, NULL, ?)", contextKey, categoryCode, T0)
    }

    private fun insert(sql: String, vararg args: Any?): Long {
        val keys = GeneratedKeyHolder()
        jdbc.update({ conn ->
            conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS).apply { args.forEachIndexed { i, a -> setObject(i + 1, a) } }
        }, keys)
        return requireNotNull(keys.key).toLong()
    }

    companion object {
        const val BLOG_HOST = "blog.1989v.com"
        private val T0: LocalDateTime = LocalDateTime.of(2026, 9, 1, 0, 0)
        private val CAMPAIGN_START: LocalDateTime = LocalDateTime.of(2026, 9, 1, 0, 0)
    }
}
