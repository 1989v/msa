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

    /** 지면 하나의 형태 규격 — [format] 은 `CARD`·`BANNER`. */
    data class Spec(val format: String, val ratios: String, val floorMicros: Long)

    /**
     * 지면 + 형태 규격. 규격 기본값은 카드 하나이고 그 비율·최저가가 [ratios]·[floorMicros] 다.
     * 옛 지면 컬럼에는 운영 코드처럼 대표 규격(카드가 있으면 카드)을 쓴다.
     */
    fun placement(
        key: String,
        floorMicros: Long = 100_000,
        paidAllowed: Boolean = true,
        host: String = BLOG_HOST,
        ratios: String = "1.91:1",
        formats: List<Spec> = listOf(Spec("CARD", ratios, floorMicros)),
    ) {
        val representative = formats.firstOrNull { it.format == "CARD" } ?: formats.first()
        jdbc.update(
            "INSERT INTO ad_placement (placement_key, host, format, aspect_ratios, floor_micros, active, paid_allowed, description, created_at, updated_at) " +
                "VALUES (?, ?, ?, ?, ?, TRUE, ?, '테스트 지면', ?, ?)",
            key, host, representative.format, representative.ratios, representative.floorMicros, paidAllowed, T0, T0,
        )
        formats.forEach {
            jdbc.update(
                "INSERT INTO ad_placement_format (placement_key, format, aspect_ratios, floor_micros) VALUES (?, ?, ?, ?)",
                key, it.format, it.ratios, it.floorMicros,
            )
        }
    }

    /** 그 지면·형태 규격의 최저가를 바꾼다(어드민 변경과 같은 효과를 DB 로). */
    fun changeFormatFloor(key: String, format: String, floorMicros: Long) {
        jdbc.update("UPDATE ad_placement_format SET floor_micros = ? WHERE placement_key = ? AND format = ?", floorMicros, key, format)
    }

    /**
     * 회원 광고주 + 지갑. @return 광고주 id
     *
     * 통합 스펙들은 컨테이너 DB 하나를 같이 쓰고 회원 id 는 유일 키다. 스펙마다 대역을 나눠 쓴다 —
     * 결정 5xxx · 후보 인덱스 6xxx · 클릭 7xxx · 에셋 8xxx · 이벤트 수락 9xxx ·
     * 집계 100xx · 정산 101xx · 원장 102xx · 광고주 API 110xx · 소재 업로드 111xx · 어드민 API 112xx · 리포트 113xx ·
     * analytics 사본 120xx · 리포트 원장 총액 121xx · 광고 형태(광고주 API 122xx · 후보 인덱스 123xx · 어드민 API 124xx · 이벤트 수락 125xx) ·
     * 광고주 API 거절 문구·충전 여유 130xx.
     * 어드민 API 의 운영자(행위자)는 11299.
     *
     * 집계·정산 작업은 DB 전체의 닫힌 미정산 행을 훑는다. 광고주 API·리포트 스펙이 시간별 집계·정산 행을 직접 넣을 때는
     * 2027-01 을 쓴다 — 다른 스펙의 시계(2026-09~12)보다 뒤라 그 스펙들의 작업이 이 행을 닫거나 정산하지 않는다.
     * analytics 사본(02-02)·리포트 원장 총액(02-10)은 2027-02 — 집계 작업은 부르지 않고 자기 (캠페인, 시각)만 정산한다.
     * 광고주 API 의 충전 여유(KST 하루 경계)는 2027-03 에 시계를 둔다 — 충전만 하고 시간별 집계·정산 행은 넣지 않는다.
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
        format: String = "CARD",
    ): Long {
        val id = insert(
            "INSERT INTO ad_campaign (advertiser_id, name, status, bid_type, bid_micros, daily_budget_micros, total_budget_micros, " +
                "start_at, end_at, frequency_cap_per_day, creative_format, created_at, updated_at) " +
                "VALUES (?, '테스트 캠페인', 'ACTIVE', ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?)",
            advertiserId, bidType, bidMicros, dailyBudgetMicros, totalBudgetMicros, CAMPAIGN_START, frequencyCap, format, T0, T0,
        )
        placementKeys.forEach { jdbc.update("INSERT INTO ad_campaign_placement (campaign_id, placement_key) VALUES (?, ?)", id, it) }
        categories.forEach { jdbc.update("INSERT INTO ad_campaign_category (campaign_id, category_code) VALUES (?, ?)", id, it) }
        return id
    }

    /** 유료 소재 + 이미지 메타. 띠배너 소재는 [title] 에 대체 텍스트, [body] 는 빈 문자열로 넣는다. @return 소재 id */
    fun paidCreative(
        campaignId: Long,
        advertiserId: Long,
        status: String = "APPROVED",
        width: Int = 1200,
        height: Int = 628,
        title: String = "가을 세일",
        body: String = "지금 바로 확인하세요",
    ): Long {
        val hash = MessageDigest.getInstance("SHA-256").digest(UUID.randomUUID().toString().toByteArray())
            .joinToString("") { "%02x".format(it) }
        jdbc.update(
            "INSERT INTO ad_creative_asset (hash, content_type, bytes, byte_size, width, height, created_at) VALUES (?, 'image/png', ?, 4, ?, ?, ?)",
            hash, byteArrayOf(1, 2, 3, 4), width, height, T0,
        )
        return insert(
            "INSERT INTO ad_creative (campaign_id, advertiser_id, title, body, link_url, emoji, image_hash, status, reject_reason, " +
                "reviewed_by, reviewed_at, created_at, updated_at) VALUES (?, ?, ?, ?, 'https://example.com/landing', NULL, ?, ?, NULL, NULL, NULL, ?, ?)",
            campaignId, advertiserId, title, body, hash, status, T0, T0,
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
        val CARD = Spec("CARD", "1.91:1", 100_000)
        val BANNER = Spec("BANNER", "6.4:1", 50_000)
        private val T0: LocalDateTime = LocalDateTime.of(2026, 9, 1, 0, 0)
        private val CAMPAIGN_START: LocalDateTime = LocalDateTime.of(2026, 9, 1, 0, 0)
    }
}
