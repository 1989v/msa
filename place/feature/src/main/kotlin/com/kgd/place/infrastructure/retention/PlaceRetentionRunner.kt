package com.kgd.place.infrastructure.retention

import com.kgd.place.application.shortlink.usecase.PurgeAttractionShortLinkClicksUseCase
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.boot.ApplicationArguments
import org.springframework.boot.ApplicationRunner
import org.springframework.context.annotation.Profile
import org.springframework.core.annotation.Order
import org.springframework.stereotype.Component

private val log = KotlinLogging.logger {}

/**
 * place 원장(`attraction_short_link_click`) 보존기간 정리 배치 (ADR-0077).
 *
 * `retention-content` CronJob 이 content 이미지를 `--spring.profiles.active=kubernetes,retention` 으로
 * 띄울 때 함께 돈다 — content 호스트가 `com.kgd.place` 를 스캔하므로 매니페스트를 고치지 않는다.
 *
 * 호스트가 아니라 **도메인 모듈 안에** 둔다. 호스트에 두면 합성 루트가 남의 도메인을 import
 * 하게 되고(교차 import 게이트, ADR-0083 ⑦), 재분리할 때 러너만 뒤에 남는다.
 * game 의 `GameRetentionRunner`, blog 의 `BlogRetentionRunner` 와 같은 판단이다.
 */
@Component
@Order(0)
@Profile("retention")
class PlaceRetentionRunner(
    private val purgeShortLinkClicks: PurgeAttractionShortLinkClicksUseCase,
) : ApplicationRunner {

    /** 실패해도 예외를 밖으로 내지 않는다 — 같은 배치의 다른 도메인 러너가 이어서 돈다. */
    override fun run(args: ApplicationArguments) {
        val result = runCatching { purgeShortLinkClicks.olderThan(ATTRACTION_SHORT_LINK_CLICK_RETENTION_DAYS) }
            .fold(
                onSuccess = { "attraction_short_link_click ${it}행" },
                onFailure = {
                    log.error(it) { "원장 정리 실패 — attraction_short_link_click" }
                    "attraction_short_link_click 실패"
                },
            )
        log.info { "원장 정리 완료 — $result" }
    }

    companion object {
        /**
         * 단축 주소 클릭 원장 보존기간. 다른 조회·클릭 원장과 같은 90일이다 (ADR-0077).
         * 관광지별 누적 수(`attraction_short_link_stat`)는 지우지 않는다.
         * **`/privacy` §6 의 숫자와 같아야 한다.**
         */
        const val ATTRACTION_SHORT_LINK_CLICK_RETENTION_DAYS = 90L
    }
}
