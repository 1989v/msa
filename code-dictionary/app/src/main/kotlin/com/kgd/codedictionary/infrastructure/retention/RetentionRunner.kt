package com.kgd.codedictionary.infrastructure.retention

import com.kgd.blog.application.interaction.usecase.PurgeBlogViewsUseCase
import com.kgd.codedictionary.application.resume.port.ResumeAccessLogRepositoryPort
import com.kgd.game.application.roster.usecase.PurgeRostersUseCase
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.boot.ApplicationArguments
import org.springframework.boot.ApplicationRunner
import org.springframework.context.annotation.Profile
import org.springframework.core.annotation.Order
import org.springframework.stereotype.Component
import java.time.LocalDateTime

private val log = KotlinLogging.logger {}

/**
 * 원장 보존기간 정리 배치 (ADR-0077).
 *
 * 상주 파드도 새 이미지도 만들지 않는다 — code-dictionary 이미지를 그대로 쓰고
 * `--spring.main.web-application-type=none --spring.profiles.active=kubernetes,retention`
 * 으로 CronJob 이 띄웠다가 끝나면 내려간다 (deal-linkcheck 와 같은 방식).
 *
 * **deal-linkcheck 에 얹지 않은 이유**: 그 CronJob 은 외부 :443 egress 가 열린 유일한
 * 배치다. 네트워크가 필요 없는 정리 작업에 그 권한을 함께 주게 된다. 여기는 DB 만 만진다.
 *
 * 원장마다 따로 잡는 이유는 보존기간의 근거가 다르기 때문이다 — 아래 상수 주석 참조.
 * 하나가 실패해도 나머지는 돈다. 정리 실패로 다른 원장까지 안 지워지면 다음 주까지
 * 두 배로 쌓이고, 실패한 쪽은 로그에 남으므로 조용히 묻히지도 않는다.
 */
@Component
@Order(0)
@Profile("retention")
class RetentionRunner(
    private val purgeBlogViews: PurgeBlogViewsUseCase,
    private val resumeAccessLog: ResumeAccessLogRepositoryPort,
    private val purgeRosters: PurgeRostersUseCase,
) : ApplicationRunner {

    override fun run(args: ApplicationArguments) {
        val results = listOf(
            purge("blog_post_view") { purgeBlogViews.execute() },
            purge("resume_access_log") {
                resumeAccessLog.purgeOlderThan(LocalDateTime.now().minusDays(RESUME_ACCESS_RETENTION_DAYS))
            },
            purge("party_friend_group") { purgeRosters.unusedFor(FRIEND_GROUP_RETENTION_DAYS) },
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
         * 이력서 열람 기록 보존기간.
         *
         * 조회수 원장(90일)보다 길게 잡는다. 이 기록은 통계가 아니라 **제출처가 이력서를
         * 열어봤는지**를 알려주는 물건이고, 지원부터 결과까지가 몇 달씩 걸린다. 90일이면
         * 아직 진행 중인 지원 건의 기록이 사라진다.
         *
         * 열람자를 식별하는 정보가 없어(공유 링크 id·slug·시각뿐) 개인정보 최소화 관점의
         * 압박도 조회수 원장보다 약하다.
         */
        const val RESUME_ACCESS_RETENTION_DAYS = 365L

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
