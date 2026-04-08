package com.kgd.experiment.domain.model

import kotlin.math.abs
import kotlin.math.sqrt

data class SignificanceResult(
    val isSignificant: Boolean,
    val zScore: Double,
    val pValue: Double,
    val confidenceLevel: Double
)

object StatisticalSignificance {
    /**
     * Two-proportion Z-test for comparing conversion rates between control and treatment.
     */
    fun twoProportionZTest(
        controlSuccess: Long,
        controlTotal: Long,
        treatmentSuccess: Long,
        treatmentTotal: Long,
        significanceLevel: Double = 0.05
    ): SignificanceResult {
        if (controlTotal == 0L || treatmentTotal == 0L) {
            return SignificanceResult(false, 0.0, 1.0, 0.0)
        }

        val p1 = controlSuccess.toDouble() / controlTotal
        val p2 = treatmentSuccess.toDouble() / treatmentTotal
        val pPooled = (controlSuccess + treatmentSuccess).toDouble() / (controlTotal + treatmentTotal)

        val se = sqrt(pPooled * (1 - pPooled) * (1.0 / controlTotal + 1.0 / treatmentTotal))
        if (se == 0.0) {
            return SignificanceResult(false, 0.0, 1.0, 0.0)
        }

        val z = (p1 - p2) / se
        val pValue = 2.0 * normalCdf(-abs(z))
        val confidence = 1.0 - pValue

        return SignificanceResult(
            isSignificant = pValue < significanceLevel,
            zScore = z,
            pValue = pValue,
            confidenceLevel = confidence
        )
    }

    /**
     * Approximation of the standard normal CDF using Abramowitz and Stegun formula.
     */
    private fun normalCdf(x: Double): Double {
        if (x < -8.0) return 0.0
        if (x > 8.0) return 1.0

        val t = 1.0 / (1.0 + 0.2316419 * abs(x))
        val d = 0.3989422804014327 // 1/sqrt(2*PI)
        val prob = d * kotlin.math.exp(-x * x / 2.0) *
                (t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429)))))

        return if (x > 0) 1.0 - prob else prob
    }
}
