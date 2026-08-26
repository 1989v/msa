package com.kgd.experiment.application.experiment.dto

data class ExperimentResultDto(
    val experimentId: Long,
    val experimentName: String,
    val variants: List<VariantResultDto>,
    val significance: List<SignificanceDto>
)

data class VariantResultDto(
    val variantName: String,
    val impressions: Long,
    val clicks: Long,
    val orders: Long,
    val ctr: Double,
    val cvr: Double
)

data class SignificanceDto(
    val controlVariant: String,
    val treatmentVariant: String,
    val ctrSignificant: Boolean,
    val ctrPValue: Double,
    val cvrSignificant: Boolean,
    val cvrPValue: Double
)
