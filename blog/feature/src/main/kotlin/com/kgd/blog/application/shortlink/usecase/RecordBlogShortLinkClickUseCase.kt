package com.kgd.blog.application.shortlink.usecase

/**
 * 단축 주소 클릭 1건 적재 — 원장 1행 + 글별 누적 수 1 증가.
 *
 * 리퍼러는 호스트만, UA 는 계열만 남긴다(`deal_offer_click` 과 같다). IP 는 받지 않는다.
 * 조회수(`blog_post_view`)와는 다른 숫자다 — 이것은 「단축 주소로 들어온 횟수」다.
 * 호출부는 실패를 삼킨다 — 302 가 본질이고 통계는 부수다.
 */
interface RecordBlogShortLinkClickUseCase {
    fun execute(command: Command)

    data class Command(
        val postId: Long,
        val referrer: String?,
        val userAgent: String?,
    )
}
