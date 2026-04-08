package com.kgd.experiment.application.usecase

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.experiment.domain.model.StatisticalSignificance
import com.kgd.experiment.domain.port.ExperimentRepositoryPort
import com.kgd.experiment.infrastructure.client.AnalyticsClient
import org.springframework.stereotype.Service
import java.time.Instant
import java.time.ZoneId

@Service
class GetExperimentResultsUseCase(
    private val repository: ExperimentRepositoryPort,
    private val analyticsClient: AnalyticsClient
) {
    fun execute(experimentId: Long): ExperimentResultDto {
        val experiment = repository.findById(experimentId)
            ?: throw BusinessException(ErrorCode.NOT_FOUND)

        val start = experiment.startDate
            ?.let { Instant.from(it.atZone(ZoneId.systemDefault())) }
            ?: Instant.EPOCH
        val end = experiment.endDate
            ?.let { Instant.from(it.atZone(ZoneId.systemDefault())) }
            ?: Instant.now()

        val metrics = analyticsClient.getExperimentMetrics(experimentId, start, end)

        val variantResults = metrics?.variants?.map { variant ->
            VariantResultDto(
                variantName = variant.variantName,
                impressions = variant.impressions,
                clicks = variant.clicks,
                orders = variant.orders,
                ctr = variant.ctr,
                cvr = variant.cvr
            )
        } ?: emptyList()

        val significanceResults = if (variantResults.size >= 2) {
            val control = variantResults.first()
            variantResults.drop(1).map { treatment ->
                val ctrSignificance = StatisticalSignificance.twoProportionZTest(
                    controlSuccess = control.clicks,
                    controlTotal = control.impressions,
                    treatmentSuccess = treatment.clicks,
                    treatmentTotal = treatment.impressions
                )
                val cvrSignificance = StatisticalSignificance.twoProportionZTest(
                    controlSuccess = control.orders,
                    controlTotal = control.clicks,
                    treatmentSuccess = treatment.orders,
                    treatmentTotal = treatment.clicks
                )
                SignificanceDto(
                    controlVariant = control.variantName,
                    treatmentVariant = treatment.variantName,
                    ctrSignificant = ctrSignificance.isSignificant,
                    ctrPValue = ctrSignificance.pValue,
                    cvrSignificant = cvrSignificance.isSignificant,
                    cvrPValue = cvrSignificance.pValue
                )
            }
        } else {
            emptyList()
        }

        return ExperimentResultDto(
            experimentId = experimentId,
            experimentName = experiment.name,
            variants = variantResults,
            significance = significanceResults
        )
    }
}

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
