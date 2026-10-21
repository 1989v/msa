package com.kgd.ranking

import com.kgd.ranking.application.admin.usecase.RankingAdminUseCase
import com.kgd.ranking.infrastructure.retention.RankingRetentionRunner
import io.kotest.core.spec.style.BehaviorSpec
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import org.springframework.boot.DefaultApplicationArguments

class RankingRetentionRunnerTest : BehaviorSpec({
    Given("existing content CronJob enables retention profile") {
        Then("the runner invokes the same ranking audit retention policy") {
            val admin = mockk<RankingAdminUseCase>()
            every { admin.purgeAudits() } returns 3
            RankingRetentionRunner(admin).run(DefaultApplicationArguments())
            verify(exactly = 1) { admin.purgeAudits() }
        }
    }
})
