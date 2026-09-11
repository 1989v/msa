package com.kgd.game.infrastructure.retention

import com.kgd.game.application.roster.usecase.PurgeRostersUseCase
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.boot.ApplicationArguments
import org.springframework.boot.ApplicationRunner
import org.springframework.context.annotation.Profile
import org.springframework.core.annotation.Order
import org.springframework.stereotype.Component

private val log = KotlinLogging.logger {}

/**
 * game 원장(`party_friend_group`) 보존기간 정리 배치 (ADR-0077 / ADR-0092).
 *
 * 상주 파드도 새 이미지도 만들지 않는다 — content 이미지를 그대로 쓰고
 * `--spring.main.web-application-type=none --spring.profiles.active=kubernetes,retention`
 * 으로 CronJob 이 띄웠다가 끝나면 내려간다.
 *
 * **code-dictionary 의 `RetentionRunner` 에서 갈라져 나왔다** (ADR-0093). game 이 content 로
 * 옮겨가 그쪽 클래스패스에서 이 원장을 볼 수 없기 때문이다.
 *
 * 호스트(`content:app`)가 아니라 **도메인 모듈 안에** 둔다. 호스트에 두면 합성 루트가 남의
 * 도메인을 import 하게 되고(교차 import 게이트, ADR-0083 ⑦), 재분리할 때 러너만 뒤에 남는다.
 * 원장을 아는 쪽이 그 원장을 정리한다 — 폴드가 바뀌어도 따라간다.
 */
@Component
@Order(0)
@Profile("retention")
class GameRetentionRunner(
    private val purgeRosters: PurgeRostersUseCase,
) : ApplicationRunner {

    override fun run(args: ApplicationArguments) {
        val result = runCatching { purgeRosters.unusedFor(FRIEND_GROUP_RETENTION_DAYS) }
            .fold(
                onSuccess = { "party_friend_group ${it}행" },
                onFailure = {
                    log.error(it) { "원장 정리 실패 — party_friend_group" }
                    "party_friend_group 실패"
                },
            )
        log.info { "원장 정리 완료 — $result" }
    }

    companion object {
        /**
         * 친구 그룹 보존기간 — **마지막으로 판에 쓰인 뒤** 이만큼 안 쓰면 파기한다 (ADR-0092).
         *
         * 만든 날이 아니라 쓴 날로 재는 이유는, 명부는 오래 두고 재사용하는 물건이기 때문이다.
         * 반년에 한 번 모이는 모임의 명부가 만든 지 1년이 됐다고 사라지면 기능의 동기가 사라진다.
         *
         * **이 숫자는 `/privacy` §6 에 적힌 것과 같아야 한다.** 한쪽만 고치면 개인정보처리방침이
         * 거짓이 된다. 그리고 상수만 두고 호출자가 없으면 무기한 누적된다 — `blog_post_view` 가
         * 실제로 그랬다. 그래서 이 상수는 위 `run()` 에서 반드시 소비된다.
         */
        const val FRIEND_GROUP_RETENTION_DAYS = 365L
    }
}
