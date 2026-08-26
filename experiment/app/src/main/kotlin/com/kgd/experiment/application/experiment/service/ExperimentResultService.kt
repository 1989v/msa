package com.kgd.experiment.application.experiment.service

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.experiment.application.experiment.dto.ExperimentResultDto
import com.kgd.experiment.application.experiment.dto.SignificanceDto
import com.kgd.experiment.application.experiment.dto.VariantResultDto
import com.kgd.experiment.application.experiment.port.AnalyticsMetricsPort
import com.kgd.experiment.application.experiment.port.ExperimentRepositoryPort
import com.kgd.experiment.application.experiment.usecase.GetExperimentResultsUseCase
import com.kgd.experiment.domain.model.StatisticalSignificance
import org.springframework.stereotype.Service
import java.time.Instant
import java.time.ZoneId

@Service
class ExperimentResultService(
    private val repository: ExperimentRepositoryPort,
    private val analyticsMetrics: AnalyticsMetricsPort
) : GetExperimentResultsUseCase {

    override fun execute(experimentId: Long): ExperimentResultDto {
        val experiment = repository.findById(experimentId)
            ?: throw BusinessException(ErrorCode.NOT_FOUND)

        val start = experiment.startDate
            ?.let { Instant.from(it.atZone(ZoneId.systemDefault())) }
            ?: Instant.EPOCH
        val end = experiment.endDate
            ?.let { Instant.from(it.atZone(ZoneId.systemDefault())) }
            ?: Instant.now()

        val metrics = analyticsMetrics.getExperimentMetrics(experimentId, start, end)

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
