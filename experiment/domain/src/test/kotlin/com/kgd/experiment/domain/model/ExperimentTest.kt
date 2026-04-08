package com.kgd.experiment.domain.model

import com.kgd.common.exception.BusinessException
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import java.time.LocalDateTime

class ExperimentTest : BehaviorSpec({
    val validVariants = listOf(
        Variant(null, "control", 50, emptyMap()),
        Variant(null, "treatment", 50, emptyMap())
    )

    Given("Experiment 생성") {
        When("유효한 데이터로 생성하면") {
            val experiment = Experiment(
                id = null,
                name = "Test Experiment",
                description = "A/B test for ranking",
                status = ExperimentStatus.DRAFT,
                trafficPercentage = 100,
                variants = validVariants,
                startDate = null,
                endDate = null,
                createdAt = LocalDateTime.now()
            )

            Then("정상 생성된다") {
                experiment.name shouldBe "Test Experiment"
                experiment.status shouldBe ExperimentStatus.DRAFT
            }
        }

        When("variant weight 합이 100이 아니면") {
            Then("예외가 발생한다") {
                shouldThrow<IllegalArgumentException> {
                    Experiment(
                        id = null,
                        name = "Bad",
                        description = "",
                        status = ExperimentStatus.DRAFT,
                        trafficPercentage = 100,
                        variants = listOf(
                            Variant(null, "a", 30, emptyMap()),
                            Variant(null, "b", 30, emptyMap())
                        ),
                        startDate = null,
                        endDate = null,
                        createdAt = LocalDateTime.now()
                    )
                }
            }
        }

        When("빈 variants이면") {
            Then("예외가 발생한다") {
                shouldThrow<IllegalArgumentException> {
                    Experiment(
                        id = null,
                        name = "Empty",
                        description = "",
                        status = ExperimentStatus.DRAFT,
                        trafficPercentage = 100,
                        variants = emptyList(),
                        startDate = null,
                        endDate = null,
                        createdAt = LocalDateTime.now()
                    )
                }
            }
        }

        When("trafficPercentage가 범위 밖이면") {
            Then("예외가 발생한다") {
                shouldThrow<IllegalArgumentException> {
                    Experiment(
                        id = null,
                        name = "Bad traffic",
                        description = "",
                        status = ExperimentStatus.DRAFT,
                        trafficPercentage = 150,
                        variants = validVariants,
                        startDate = null,
                        endDate = null,
                        createdAt = LocalDateTime.now()
                    )
                }
            }
        }
    }

    Given("상태 전이") {
        val experiment = Experiment(
            id = 1L,
            name = "Test",
            description = "",
            status = ExperimentStatus.DRAFT,
            trafficPercentage = 100,
            variants = validVariants,
            startDate = null,
            endDate = null,
            createdAt = LocalDateTime.now()
        )

        When("DRAFT -> RUNNING") {
            val running = experiment.changeStatus(ExperimentStatus.RUNNING)

            Then("상태가 변경된다") {
                running.status shouldBe ExperimentStatus.RUNNING
            }
        }

        When("DRAFT -> COMPLETED (불가)") {
            Then("BusinessException이 발생한다") {
                shouldThrow<BusinessException> {
                    experiment.changeStatus(ExperimentStatus.COMPLETED)
                }
            }
        }
    }
})
