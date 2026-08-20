package com.kgd.place.domain.attraction.model

import java.net.URLEncoder
import java.nio.charset.StandardCharsets

/** 링크의 성격 — 화면이 묶어서 보여주는 단위. */
enum class DeepLinkKind { SOCIAL, TOUR_PRODUCT }

/**
 * 수수료를 받는 링크인지 (ADR-0069 §1 의 축을 그대로 쓴다).
 * `AFFILIATE` 만 배지·고지와 `rel="sponsored"` 를 붙인다 — 받지도 않는 링크까지 광고로 표시하면
 * 고지의 목적(신뢰)과 반대로 간다.
 */
enum class LinkRevenueType { PLAIN, AFFILIATE }

data class AttractionDeepLink(
    val provider: String,
    val kind: DeepLinkKind,
    val url: String,
    val revenueType: LinkRevenueType,
)

/**
 * 관광지명으로 그 자리에서 조립되는 외부 링크 (ADR-0070 §2).
 *
 * **행을 만들지 않는다** — 관광지 6만 건 × 제공자 수만큼 같은 규칙의 복제본이 쌓이고,
 * 템플릿을 바꿀 때마다 전량 재적재해야 한다. 수집형(YouTube·네이버)만 테이블에 남는다.
 *
 * **URL 을 재조립하지 않는다** — 파라미터 주입·클로킹은 제휴 네트워크 약관 위반이고
 * 트래킹 쿠키를 깨뜨린다 (ADR-0069 §3).
 */
object AttractionDeepLinks {

    /**
     * 전부 PLAIN 으로 시작한다 — 제휴 승인 전에는 수수료가 없으므로 `sponsored` 를 붙이지 않는다.
     * 승인되면 해당 제공자만 AFFILIATE 로 올린다 (그때 트래킹 URL 도 여기서 갈린다).
     */
    fun of(title: String): List<AttractionDeepLink> {
        val tag = instagramTag(title)
        val query = encode(title)
        return buildList {
            // 인스타그램은 장소 기반 공개 검색 API 가 없다 — 태그 페이지로 보내는 것이
            // 공식 경로로 할 수 있는 전부다 (수집하지 않는다).
            if (tag.isNotBlank()) {
                add(AttractionDeepLink("INSTAGRAM", DeepLinkKind.SOCIAL,
                    "https://www.instagram.com/explore/tags/$tag/", LinkRevenueType.PLAIN))
            }
            // 유튜브 검색 — 수집 카드(하루 100곳 쿼터)와 별개로, 항상 즉시 나가는 "직접 더 찾아보기".
            // API 호출 0 이라 키 없이도 동작하고, 카드가 5개뿐인 한계를 사용자가 스스로 넘게 한다.
            add(AttractionDeepLink("YOUTUBE", DeepLinkKind.SOCIAL,
                "https://www.youtube.com/results?search_query=$query", LinkRevenueType.PLAIN))
            // 마이리얼트립 — 공개 제휴 프로그램·오픈 API 가 확인되지 않아 상품 데이터는 긁지 않는다
            // (ADR-0070 §6). 검색 딥링크만 건다.
            add(AttractionDeepLink("MYREALTRIP", DeepLinkKind.TOUR_PRODUCT,
                "https://www.myrealtrip.com/search?q=$query", LinkRevenueType.PLAIN))
            // Klook 은 로케일 경로(/en-US/search)가 봇 차단(403)이라 로케일 중립 경로를 쓴다.
            add(AttractionDeepLink("KLOOK", DeepLinkKind.TOUR_PRODUCT,
                "https://www.klook.com/search/?query=$query", LinkRevenueType.PLAIN))
        }
    }

    /** 해시태그는 구분자를 갖지 못한다 — 공백·문장부호를 떨어내고 붙인다. */
    fun instagramTag(title: String): String =
        title.filter { it.isLetterOrDigit() }.lowercase()

    private fun encode(value: String): String =
        URLEncoder.encode(value, StandardCharsets.UTF_8)
}
