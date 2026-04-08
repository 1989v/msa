package com.kgd.experiment.application.usecase

import com.kgd.common.exception.BusinessException
import com.kgd.experiment.domain.model.Experiment
import com.kgd.experiment.domain.model.ExperimentStatus
import com.kgd.experiment.domain.model.Variant
import com.kgd.experiment.domain.port.ExperimentRepositoryPort
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import io.mockk.every
import io.mockk.mockk
import java.time.LocalDateTime

class AssignBucketUseCaseTest : BehaviorSpec({
    val repository = mockk<ExperimentRepositoryPort>()
    val useCase = AssignBucketUseCase(repository)

    val runningExperiment = Experiment(
        id = 1L,
        name = "Test",
        description = "",
        status = ExperimentStatus.RUNNING,
        trafficPercentage = 100,
        variants = listOf(
            Variant(1L, "control", 50, emptyMap()),
            Variant(2L, "treatment", 50, emptyMap())
        ),
        startDate = null,
        endDate = null,
        createdAt = LocalDateTime.now()
    )

    Given("bucket assignment") {
        When("assigning to a running experiment") {
            every { repository.findById(1L) } returns runningExperiment

            val result = useCase.execute(1L, "user-123")

            Then("returns a variant") {
                result shouldNotBe null
                result shouldBe useCase.execute(1L, "user-123") // deterministic
            }
        }

        When("experiment is not running") {
            every { repository.findById(2L) } returns runningExperiment.copy(
                id = 2L, status = ExperimentStatus.DRAFT
            )

            Then("throws exception") {
                shouldThrow<BusinessException> {
                    useCase.execute(2L, "user-123")
                }
            }
        }

        When("experiment does not exist") {
            every { repository.findById(999L) } returns null

            Then("throws NOT_FOUND exception") {
                shouldThrow<BusinessException> {
                    useCase.execute(999L, "user-123")
                }
            }
        }
    }
})
