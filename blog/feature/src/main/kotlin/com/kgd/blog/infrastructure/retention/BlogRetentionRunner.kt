package com.kgd.blog.infrastructure.retention

import com.kgd.blog.application.interaction.usecase.PurgeBlogViewsUseCase
import com.kgd.blog.application.shortlink.usecase.PurgeBlogShortLinkClicksUseCase
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.boot.ApplicationArguments
import org.springframework.boot.ApplicationRunner
import org.springframework.context.annotation.Profile
import org.springframework.core.annotation.Order
import org.springframework.stereotype.Component

private val log = KotlinLogging.logger {}

/**
 * blog 원장(`blog_post_view` 하루 1표 조회 원장, `blog_short_link_click`) 보존기간 정리 배치 (ADR-0077).
 *
 * **code-dictionary 의 `RetentionRunner` 에서 갈라져 나왔다** (ADR-0093 ③). blog 가 content 로
 * 옮겨가 그쪽 클래스패스에서 이 원장을 볼 수 없기 때문이다.
 *
 * 호스트가 아니라 **도메인 모듈 안에** 둔다. 호스트에 두면 합성 루트가 남의 도메인을 import
 * 하게 되고(교차 import 게이트, ADR-0083 ⑦), 재분리할 때 러너만 뒤에 남는다.
 * game 의 `GameRetentionRunner` 와 같은 판단이다.
 */
@Component
@Order(0)
@Profile("retention")
class BlogRetentionRunner(
    private val purgeBlogViews: PurgeBlogViewsUseCase,
    private val purgeShortLinkClicks: PurgeBlogShortLinkClicksUseCase,
) : ApplicationRunner {

    /** 원장마다 따로 잡는다 — 하나가 실패해도 나머지는 돈다. */
    override fun run(args: ApplicationArguments) {
        val results = listOf(
            purge("blog_post_view") { purgeBlogViews.execute() },
            purge("blog_short_link_click") { purgeShortLinkClicks.olderThan(BLOG_SHORT_LINK_CLICK_RETENTION_DAYS) },
        )
        log.info { "원장 정리 완료 — ${results.joinToString(", ")}" }
    }

    private fun purge(ledger: String, block: () -> Int): String =
        runCatching(block)
            .fold(
                onSuccess = { "$ledger ${it}행" },
                onFailure = {
                    log.error(it) { "원장 정리 실패 — $ledger" }
                    "$ledger 실패"
                },
            )

    companion object {
        /**
         * 단축 주소 클릭 원장 보존기간. 다른 조회·클릭 원장과 같은 90일이다 (ADR-0077).
         * 글별 누적 수(`blog_short_link_stat`)는 지우지 않는다.
         * **`/privacy` §6 의 숫자와 같아야 한다.**
         */
        const val BLOG_SHORT_LINK_CLICK_RETENTION_DAYS = 90L
    }
}
