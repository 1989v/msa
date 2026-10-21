package com.kgd.ranking.infrastructure.retention

import com.kgd.ranking.application.admin.usecase.RankingAdminUseCase
import org.springframework.boot.ApplicationArguments
import org.springframework.boot.ApplicationRunner
import org.springframework.context.annotation.Profile
import org.springframework.core.annotation.Order
import org.springframework.stereotype.Component
import io.github.oshai.kotlinlogging.KotlinLogging

/** Existing content retention CronJob, same ranking TM and policy as /privacy §6. */
@Component
@Profile("retention")
@Order(0)
class RankingRetentionRunner(private val admin: RankingAdminUseCase) : ApplicationRunner {
    private val log = KotlinLogging.logger {}
    override fun run(args: ApplicationArguments) {
        val deleted = admin.purgeAudits()
        log.info { "랭킹 관리자 감사 정리 완료: $deleted" }
    }
}
