package com.kgd.codedictionary.infrastructure.retention

import com.kgd.blog.application.service.BlogViewService
import com.kgd.codedictionary.application.resume.port.ResumeAccessLogRepositoryPort
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.boot.ApplicationArguments
import org.springframework.boot.ApplicationRunner
import org.springframework.context.annotation.Profile
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
@Profile("retention")
class RetentionRunner(
    private val blogViewService: BlogViewService,
    private val resumeAccessLog: ResumeAccessLogRepositoryPort,
) : ApplicationRunner {

    override fun run(args: ApplicationArguments) {
        val results = listOf(
            purge("blog_post_view") { blogViewService.purgeOlderThan(BlogViewService.RETENTION_DAYS) },
            purge("resume_access_log") {
                resumeAccessLog.purgeOlderThan(LocalDateTime.now().minusDays(RESUME_ACCESS_RETENTION_DAYS))
            },
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
    }
}
