package com.kgd.common.quota

/**
 * 무료 쿼터가 붙는 외부 API 제공자 (ADR-0082).
 *
 * **쿼터는 API 키(제공자 계정)에 붙지 서비스에 붙지 않는다.** 그래서 장부의 단위도 제공자다 —
 * 여러 서비스가 같은 키를 쓰면 합산돼야 한다.
 *
 * [dailyLimit] 은 **안전 마진이지 조절 손잡이가 아니다.** 늘리고 싶으면 상수가 아니라 제공자
 * 문서를 본다. `null` 이면 한도 없이 **관측만** 한다 — 그래도 여기 등록하는 이유는, 새 외부 API 를
 * 붙일 때 "한도 있나?"를 강제로 묻게 하기 위해서다.
 *
 * @param unit 무엇을 세는가. YouTube 는 콜이 아니라 **units** 다 — `search.list` 가 건당 100.
 *   콜 수로 세면 100배 틀린다.
 */
enum class ExternalApiProvider(
    val key: String,
    val dailyLimit: Long?,
    val unit: QuotaUnit,
) {
    /** 네이버 검색 API — 일 25,000콜 (제공자 공표). place 후기 + deal 혜택 발견이 나눠 쓴다. */
    NAVER_SEARCH("naver-search", 25_000, QuotaUnit.CALL),

    /** YouTube Data API v3 — 일 10,000 units (제공자 공표). search.list=100, videos.list=1 */
    YOUTUBE_DATA("youtube-data", 10_000, QuotaUnit.UNIT),

    /** Google Places (New) — 무과금 구간이지만 **자체 상한**을 둔다. 상한 없이 돌리지 않는다. */
    GOOGLE_PLACES("google-places", 1_000, QuotaUnit.CALL),

    /** Google Directions — Essentials 무료 구간에 고정하기 위한 **자체 상한** */
    GOOGLE_DIRECTIONS("google-directions", 1_000, QuotaUnit.CALL),

    /** 공공데이터포털 — 제공자가 일일 한도를 공개하지 않는다 → 관측만 */
    DATA_GO_KR("data-go-kr", null, QuotaUnit.CALL),

    /** 거래소 시세 — 일일 무료 쿼터 개념이 없다 → 관측만 (ADR-0082 §3) */
    EXCHANGE_MARKET_DATA("exchange-market-data", null, QuotaUnit.CALL),

    /**
     * Google OAuth 토큰·userinfo — 일일 무료 쿼터가 없다 → 관측만.
     * **막으면 로그인이 죽으므로 한도를 두지 않는다.** 여기 등록하는 목적은 계측이다.
     */
    GOOGLE_OAUTH("google-oauth", null, QuotaUnit.CALL),
    ;

    /** 한도가 없으면 막지 않고 세기만 한다 */
    val enforced: Boolean get() = dailyLimit != null
}

enum class QuotaUnit { CALL, UNIT }
