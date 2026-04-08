package com.kgd.experiment.domain.model

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe

class ExperimentStatusTest : BehaviorSpec({
    Given("ExperimentStatus 전이 규칙") {
        When("DRAFT에서") {
            Then("RUNNING으로 전이 가능") {
                ExperimentStatus.DRAFT.canTransitionTo(ExperimentStatus.RUNNING) shouldBe true
            }
            Then("PAUSED로 전이 불가") {
                ExperimentStatus.DRAFT.canTransitionTo(ExperimentStatus.PAUSED) shouldBe false
            }
            Then("COMPLETED로 전이 불가") {
                ExperimentStatus.DRAFT.canTransitionTo(ExperimentStatus.COMPLETED) shouldBe false
            }
        }

        When("RUNNING에서") {
            Then("PAUSED로 전이 가능") {
                ExperimentStatus.RUNNING.canTransitionTo(ExperimentStatus.PAUSED) shouldBe true
            }
            Then("COMPLETED로 전이 가능") {
                ExperimentStatus.RUNNING.canTransitionTo(ExperimentStatus.COMPLETED) shouldBe true
            }
            Then("DRAFT로 전이 불가") {
                ExperimentStatus.RUNNING.canTransitionTo(ExperimentStatus.DRAFT) shouldBe false
            }
        }

        When("PAUSED에서") {
            Then("RUNNING으로 전이 가능") {
                ExperimentStatus.PAUSED.canTransitionTo(ExperimentStatus.RUNNING) shouldBe true
            }
            Then("COMPLETED로 전이 가능") {
                ExperimentStatus.PAUSED.canTransitionTo(ExperimentStatus.COMPLETED) shouldBe true
            }
        }

        When("COMPLETED에서") {
            Then("어디로도 전이 불가") {
                ExperimentStatus.entries.forEach { target ->
                    ExperimentStatus.COMPLETED.canTransitionTo(target) shouldBe false
                }
            }
        }
    }
})
