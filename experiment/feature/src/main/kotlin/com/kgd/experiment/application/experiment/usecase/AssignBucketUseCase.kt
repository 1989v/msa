package com.kgd.experiment.application.experiment.usecase

/** 결정적 버킷 배정 — 같은 (experimentId, userId) 는 언제나 같은 variant */
interface AssignBucketUseCase {
    fun execute(command: Command): String

    data class Command(val experimentId: Long, val userId: String)
}
